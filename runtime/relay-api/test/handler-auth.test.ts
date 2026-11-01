import { describe, expect, it } from "vitest";
import { RelayClient } from "../../relay/src/relay-client";
import { FakeQueue, FakeTasks, FakeTranscript } from "../../relay/test/fakes";
import { createHandler } from "../src/handler";

/**
 * M02 API Lambda 層嘅認證（唔靠 API Gateway REQUEST authorizer —— 實測嗰條路徑會 500）
 * 探針名：M02-handler-auth-*
 */
function makeHandler(secret = "va_live_test") {
  const tasksQueue = new FakeQueue();
  const resultsQueue = new FakeQueue();
  const transcript = new FakeTranscript();
  const tasks = new FakeTasks();
  const client = new RelayClient({ userId: "u-1", tasksQueue, resultsQueue, transcript, tasks });
  const handler = createHandler({ client, token: secret, userId: "u-1" });
  return { handler, tasksQueue, transcript };
}

const post = (headers: Record<string, string>, body: unknown) => ({
  rawPath: "/tasks",
  headers,
  body: JSON.stringify(body),
  requestContext: { http: { method: "POST" } },
});

describe("M02 API Lambda 認證", () => {
  it("M02-handler-auth-rejects-missing-token", async () => {
    const { handler } = makeHandler();
    const res = await handler(post({}, { text: "測試" }));
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toContain("token");
  });

  it("M02-handler-auth-rejects-wrong-token", async () => {
    const { handler } = makeHandler();
    const res = await handler(post({ authorization: "Bearer wrong" }, { text: "測試" }));
    expect(res.statusCode).toBe(401);
  });

  it("M02-handler-auth-accepts-valid-token-and-queues", async () => {
    const { handler, tasksQueue } = makeHandler();
    const res = await handler(
      post({ authorization: "Bearer va_live_test" }, { text: "幫我寫封 email" }),
    );
    expect(res.statusCode).toBe(202);
    expect(tasksQueue.sent.length).toBe(1);
  });

  it("M02-handler-auth-does-not-echo-token", async () => {
    const { handler } = makeHandler();
    const res = await handler(post({ authorization: "Bearer va_live_test" }, { text: "測試" }));
    expect(res.body).not.toContain("va_live_test");
  });

  it("M02-handler-auth-unknown-route-404", async () => {
    const { handler } = makeHandler();
    const res = await handler({
      rawPath: "/nope",
      headers: { authorization: "Bearer va_live_test" },
      body: "",
      requestContext: { http: { method: "GET" } },
    });
    expect(res.statusCode).toBe(404);
  });
});
