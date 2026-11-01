import { describe, expect, it } from "vitest";
import { RelayClient } from "@voice-agent/relay";
import { FakeQueue, FakeTasks, FakeTranscript } from "../../relay/src/fakes";
import { RelayWorker } from "../src/relay-worker";

/**
 * M03 sidecar ↔ relay worker contract
 * 探針名：M03-relay-worker-*
 */
function makeClient() {
  const tasksQueue = new FakeQueue();
  const resultsQueue = new FakeQueue();
  const transcript = new FakeTranscript();
  const tasks = new FakeTasks();
  const client = new RelayClient({
    userId: "u1",
    tasksQueue,
    resultsQueue,
    transcript,
    tasks,
  });
  return { client, tasksQueue, resultsQueue, transcript, tasks };
}

describe("M03 relay worker", () => {
  it("M03-relay-worker-runs-task-and-publishes-result", async () => {
    const { client, tasksQueue, transcript, tasks } = makeClient();
    await client.sendTask({ text: "幫我睇下今日要做咩" });

    const worker = new RelayWorker(client, {
      runTask: async () => ({ text: "今日要做：交房租", status: "completed" }),
    });

    await worker.pollOnce();
    await new Promise((r) => setTimeout(r, 80)); // 等並行 handler 跑完

    const entries = await transcript.read("u1");
    expect(entries.entries.some((e) => e.role === "agent" && e.content.includes("交房租"))).toBe(true);
    const state = await tasks.get(entries.entries[0]!.requestId);
    expect(state?.status).toBe("completed");
    expect(tasksQueue.inbox.length).toBe(0); // 已 ack
  });

  it("M03-relay-worker-publishes-failure", async () => {
    const { client, transcript } = makeClient();
    await client.sendTask({ text: "會爆嘅任務" });

    const worker = new RelayWorker(client, {
      runTask: async () => {
        throw new Error("boom");
      },
    });
    await worker.pollOnce();
    await new Promise((r) => setTimeout(r, 80)); // 等並行 handler 跑完

    const entries = await transcript.read("u1");
    expect(entries.entries.some((e) => e.content.includes("任務失敗"))).toBe(true);
  });

  it("M03-relay-worker-processes-tasks-concurrently", async () => {
    const { client, tasksQueue } = makeClient();
    await client.sendTask({ text: "任務 A（會卡住）" });
    await client.sendTask({ text: "任務 B" });

    let aStarted = false;
    let bStarted = false;
    const worker = new RelayWorker(client, {
      runTask: async (text) => {
        if (text.includes("A")) {
          aStarted = true;
          await new Promise((r) => setTimeout(r, 500)); // A 卡住
        } else {
          bStarted = true;
        }
        return { text: "完成", status: "completed" };
      },
    });

    await worker.pollOnce();
    await new Promise((r) => setTimeout(r, 50));
    // B 唔應該等 A 完成就已經開始
    expect(aStarted).toBe(true);
    expect(bStarted).toBe(true);
    await new Promise((r) => setTimeout(r, 700));
    expect(tasksQueue.inbox.length).toBe(0); // 兩個都 ack 咗
  });

  it("M03-relay-worker-skips-duplicate-delivery", async () => {
    const { client } = makeClient();
    await client.sendTask({ text: "重複投遞測試" });
    let runs = 0;
    const worker = new RelayWorker(client, {
      runTask: async () => {
        runs++;
        await new Promise((r) => setTimeout(r, 200));
        return { text: "完成", status: "completed" };
      },
    });
    // 同一個 message 送兩次（SQS at-least-once）
    await worker.pollOnce();
    await new Promise((r) => setTimeout(r, 30));
    await worker.pollOnce();
    await new Promise((r) => setTimeout(r, 300));
    expect(runs).toBe(1); // 只行一次
  });

  it("M03-relay-worker-does-not-crash-on-bad-payload", async () => {
    const { client, tasksQueue } = makeClient();
    await tasksQueue.send("bad-1", "not json");
    let handled = 0;
    await client.pollTasks(async () => {
      handled++;
    });
    expect(handled).toBe(0);
    expect(tasksQueue.inbox.length).toBe(0); // 壞 payload 都被 ack 咗，唔會卡住 queue
  });
});
