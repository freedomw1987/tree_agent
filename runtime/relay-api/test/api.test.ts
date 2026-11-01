import { describe, expect, it } from "vitest";
import { getTranscript, postTasks } from "../src/api";
import { RelayClient } from "../../relay/src/relay-client";
import { FakeQueue, FakeTasks, FakeTranscript } from "../../relay/src/fakes";

/**
 * M02 HTTP API contract
 * 探針名：M02-api-*
 */
function makeDeps() {
  const tasksQueue = new FakeQueue();
  const resultsQueue = new FakeQueue();
  const transcript = new FakeTranscript();
  const tasks = new FakeTasks();
  const client = new RelayClient({
    userId: "u-1",
    tasksQueue,
    resultsQueue,
    transcript,
    tasks,
  });
  return { deps: { client }, tasksQueue, transcript, tasks };
}

describe("M02 HTTP API", () => {
  it("M02-api-posttasks-accepts-and-queues", async () => {
    const { deps, tasksQueue } = makeDeps();
    const res = await postTasks({ text: "幫我寫封 email" }, deps);

    expect(res.statusCode).toBe(202);
    const payload = JSON.parse(res.body);
    expect(payload.requestId).toBeTruthy();
    expect(payload.status).toBe("queued");
    expect(tasksQueue.sent.length).toBe(1);
  });

  it("M02-api-posttasks-is-idempotent-with-same-request-id", async () => {
    const { deps, tasksQueue } = makeDeps();
    const a = await postTasks({ text: "重試", requestId: "req-x" }, deps);
    const b = await postTasks({ text: "重試", requestId: "req-x" }, deps);

    expect(JSON.parse(a.body).requestId).toBe("req-x");
    expect(JSON.parse(b.body).requestId).toBe("req-x");
    expect(tasksQueue.sent.length).toBe(1); // 只入隊一次
  });

  it("M02-api-posttasks-rejects-missing-text-with-actionable-error", async () => {
    const { deps } = makeDeps();
    const res = await postTasks({}, deps);

    expect(res.statusCode).toBe(400);
    const err = JSON.parse(res.body);
    expect(err.error).toContain("text");
    expect(err.error).toContain("幫我寫封 email"); // 講得出點改
  });

  it("M02-api-posttasks-rejects-too-long-text", async () => {
    const { deps } = makeDeps();
    const res = await postTasks({ text: "x".repeat(5000) }, deps);

    expect(res.statusCode).toBe(413);
    expect(JSON.parse(res.body).error).toContain("上限");
  });

  it("M02-api-posttasks-rejects-non-object-body", async () => {
    const { deps } = makeDeps();
    expect((await postTasks("just a string", deps)).statusCode).toBe(400);
    expect((await postTasks([1, 2], deps)).statusCode).toBe(400);
  });

  it("M02-api-gettranscript-returns-entries-and-cursor", async () => {
    const { deps } = makeDeps();
    await postTasks({ text: "第一句", requestId: "r-1" }, deps);
    await deps.client.publishResult({ requestId: "r-1", text: "回覆", status: "completed" });

    const res = await getTranscript({}, deps);
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload.entries.length).toBe(2);
    expect(payload.cursor).toBeTruthy();
  });

  it("M02-api-gettranscript-supports-incremental-cursor", async () => {
    const { deps } = makeDeps();
    await postTasks({ text: "第一句", requestId: "r-1" }, deps);
    const first = JSON.parse((await getTranscript({}, deps)).body);
    await postTasks({ text: "第二句", requestId: "r-2" }, deps);
    const second = JSON.parse((await getTranscript({ cursor: first.cursor }, deps)).body);

    expect(second.entries.length).toBe(1);
    expect(second.entries[0].content).toBe("第二句");
  });
});
