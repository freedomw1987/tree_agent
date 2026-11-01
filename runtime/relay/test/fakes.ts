import type { QueueMessage } from "../src/types";
import type { Queue, TaskState, TaskStore, TranscriptEntry, TranscriptStore } from "../src/types";

/** 測試用 fake（relay ＋ relay-api 共用） */

export class FakeQueue implements Queue {
  readonly sent: Array<{ id: string; body: string }> = [];
  inbox: QueueMessage[] = [];
  private seq = 0;

  async send(id: string, body: string): Promise<void> {
    this.sent.push({ id, body });
    this.seq += 1;
    this.inbox.push({ id, body, receiptHandle: `rh-${this.seq}`, receivedAt: Date.now() });
  }

  async poll(_waitTimeMs: number, _max: number): Promise<QueueMessage[]> {
    return this.inbox.splice(0, 10);
  }

  async ack(message: QueueMessage): Promise<void> {
    this.inbox = this.inbox.filter((m) => m.id !== message.id);
  }
}

export class FakeTranscript implements TranscriptStore {
  readonly entries: TranscriptEntry[] = [];

  async append(entry: TranscriptEntry): Promise<void> {
    if (this.entries.some((e) => e.requestId === entry.requestId && e.role === entry.role)) return;
    this.entries.push(entry);
  }

  async read(userId: string, cursor?: string) {
    let list = this.entries.filter((e) => e.userId === userId);
    if (cursor) {
      const idx = list.findIndex((e) => `${e.ts}:${e.requestId}:${e.role}` === cursor);
      if (idx >= 0) list = list.slice(idx + 1);
    }
    const last = list[list.length - 1];
    return {
      entries: list,
      cursor: last ? `${last.ts}:${last.requestId}:${last.role}` : cursor,
    };
  }
}

export class FakeTasks implements TaskStore {
  readonly map = new Map<string, TaskState>();

  async put(state: TaskState): Promise<void> {
    this.map.set(state.requestId, state);
  }

  async get(requestId: string) {
    return this.map.get(requestId);
  }
}
