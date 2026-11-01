import { describe, expect, it } from "vitest";
import { RelayClient } from "../src/relay-client";
import type { Queue, QueueMessage, TaskState, TaskStore, TranscriptEntry, TranscriptStore } from "../src/types";

/**
 * M02 relay client contract（用 fake queue/store → deterministic、唔使 AWS）
 * 探針名：M02-relay-*
 */
class FakeQueue implements Queue {
  readonly sent: Array<{ id: string; body: string }> = [];
  inbox: QueueMessage[] = [];
  private seq = 0;

  async send(id: string, body: string): Promise<void> {
    this.sent.push({ id, body });
    this.seq += 1;
    this.inbox.push({ id, body, receivedAt: Date.now() });
  }

  async poll(_waitTimeMs: number, _max: number): Promise<QueueMessage[]> {
    const out = this.inbox.splice(0, 10);
    return out;
  }

  async ack(message: QueueMessage): Promise<void> {
    this.inbox = this.inbox.filter((m) => m.id !== message.id);
  }
}

/**
 * cursor 要唯一：同一毫秒內同一 requestId 會有 user / agent 兩條
 * → 必須包埋 role，否則增量拉取會漏條（實測踩過）
 */
function cursorOf(e: TranscriptEntry): string {
  return `${e.ts}:${e.requestId}:${e.role}`;
}

class FakeTranscript implements TranscriptStore {
  readonly entries: TranscriptEntry[] = [];

  async append(entry: TranscriptEntry): Promise<void> {
    // 冪等：同 (userId, requestId, role) 唔會寫兩次
    if (this.entries.some((e) => e.requestId === entry.requestId && e.role === entry.role)) return;
    this.entries.push(entry);
  }

  async read(userId: string, cursor?: string) {
    let list = this.entries.filter((e) => e.userId === userId);
    if (cursor) {
      const idx = list.findIndex((e) => cursorOf(e) === cursor);
      if (idx >= 0) list = list.slice(idx + 1);
    }
    const last = list[list.length - 1];
    return {
      entries: list,
      cursor: last ? cursorOf(last) : cursor,
    };
  }
}

class FakeTasks implements TaskStore {
  readonly map = new Map<string, TaskState>();

  async put(state: TaskState): Promise<void> {
    this.map.set(state.requestId, state);
  }

  async get(requestId: string) {
    return this.map.get(requestId);
  }
}

function makeClient(ids?: string[]) {
  const tasksQueue = new FakeQueue();
  const resultsQueue = new FakeQueue();
  const transcript = new FakeTranscript();
  const tasks = new FakeTasks();
  let n = 0;
  const client = new RelayClient({
    userId: "u-1",
    tasksQueue,
    resultsQueue,
    transcript,
    tasks,
    newRequestId: () => ids?.[n++] ?? `req-${n++}`,
  });
  return { client, tasksQueue, resultsQueue, transcript, tasks };
}

describe("M02 relay client", () => {
  it("M02-relay-sendtask-enqueues-and-records", async () => {
    const { client, tasksQueue, transcript, tasks } = makeClient(["req-1"]);

    const requestId = await client.sendTask({ text: "幫我寫封 email" });

    expect(requestId).toBe("req-1");
    expect(tasksQueue.sent.length).toBe(1);
    expect(JSON.parse(tasksQueue.sent[0]!.body).text).toBe("幫我寫封 email");
    expect(transcript.entries.length).toBe(1);
    expect(transcript.entries[0]!.role).toBe("user");
    expect((await tasks.get("req-1"))?.status).toBe("queued");
  });

  it("M02-relay-sendtask-is-idempotent-on-same-request-id", async () => {
    const { client, tasksQueue, transcript } = makeClient();

    const a = await client.sendTask({ text: "重試測試", requestId: "req-dup" });
    const b = await client.sendTask({ text: "重試測試", requestId: "req-dup" });

    expect(a).toBe(b);
    expect(tasksQueue.sent.length).toBe(1); // 只入隊一次
    expect(transcript.entries.length).toBe(1); // 只入庫一次
  });

  it("M02-relay-polltasks-delivers-to-handler-and-acks", async () => {
    const { client, tasksQueue } = makeClient();
    await client.sendTask({ text: "任務 A" });

    const got: string[] = [];
    await client.pollTasks((t) => {
      got.push(t.text);
    });

    expect(got).toEqual(["任務 A"]);
    expect(tasksQueue.inbox.length).toBe(0); // 已被 ack
  });

  it("M02-relay-polltasks-skips-malformed-payload", async () => {
    const { client, tasksQueue } = makeClient();
    await tasksQueue.send("bad", "{ not json");

    const got: string[] = [];
    await client.pollTasks((t) => {
      got.push(t.text);
    });

    expect(got).toEqual([]); // 壞 payload 唔應該炸 host
  });

  it("M02-relay-publishresult-writes-transcript-and-queue", async () => {
    const { client, resultsQueue, transcript, tasks } = makeClient(["req-2"]);
    await client.sendTask({ text: "任務 B" });

    await client.publishResult({ requestId: "req-2", text: "搞掂咗", status: "completed" });

    expect(transcript.entries.some((e) => e.role === "agent" && e.content === "搞掂咗")).toBe(true);
    expect(resultsQueue.sent.length).toBe(1);
    expect((await tasks.get("req-2"))?.status).toBe("completed");
  });

  it("M02-relay-pollresults-delivers-to-handler", async () => {
    const { client } = makeClient(["req-3"]);
    await client.sendTask({ text: "任務 C" });
    await client.publishResult({ requestId: "req-3", text: "完成", status: "completed" });

    const got: string[] = [];
    await client.pollResults((r) => {
      got.push(r.requestId);
    });

    expect(got).toEqual(["req-3"]);
  });

  it("M02-relay-readtranscript-supports-cursor", async () => {
    const { client } = makeClient();
    await client.sendTask({ text: "第一句", requestId: "r-a" });
    await client.publishResult({ requestId: "r-a", text: "回覆", status: "completed" });

    const first = await client.readTranscript();
    expect(first.entries.length).toBe(2);
    expect(first.cursor).toBeTruthy();

    await client.sendTask({ text: "第二句", requestId: "r-b" });
    const second = await client.readTranscript(first.cursor);
    expect(second.entries.length).toBe(1);
    expect(second.entries[0]!.content).toBe("第二句");
  });

  it("M02-relay-publishresult-does-not-duplicate-transcript", async () => {
    const { client, transcript } = makeClient(["req-4"]);
    await client.sendTask({ text: "任務 D" });
    await client.publishResult({ requestId: "req-4", text: "答案", status: "completed" });
    await client.publishResult({ requestId: "req-4", text: "答案", status: "completed" });

    const agentEntries = transcript.entries.filter((e) => e.role === "agent");
    expect(agentEntries.length).toBe(1);
  });
});
