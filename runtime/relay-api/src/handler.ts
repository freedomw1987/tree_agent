import { RelayClient } from "../../relay/src/relay-client";
import { createAwsQueues } from "../../relay/src/aws";
import { decideConfirm, getTranscript, parseEvent, postTasks, type ApiResponse } from "./api";
import { authorize } from "./authorizer";

/**
 * M02 HTTP API —— Lambda entry
 *
 * 認證：**喺 Lambda 入面驗 token**（唔用 API Gateway REQUEST authorizer）
 *   原因（實測）：REQUEST authorizer 喺呢個 setup 會喺 authorizer 之後、integration 之前回 500，
 *   而且 API Lambda 一次都唔會被 invoke；喺 Lambda 內驗證就 100% 正常（202/200/401）。
 *   驗證邏輯仍然係同一個純函式 `authorize()`（有單元測試），將來換 Cognito 只係換 provider。
 *
 * 環境變數：
 *   TASKS_QUEUE_URL / RESULTS_QUEUE_URL / TRANSCRIPT_TABLE / TASK_TABLE / RELAY_USER_ID / RELAY_TOKEN
 */

export interface HandlerEvent {
  rawPath?: string;
  body?: string | null;
  headers?: Record<string, string | undefined> | null;
  queryStringParameters?: Record<string, string | undefined> | null;
  requestContext?: {
    http?: { method?: string };
    authorizer?: { principalId?: string };
  };
}

/** 建立 handler（注入 client ＋ token → 易測試） */
export function createHandler(deps: { client: RelayClient; token: string; userId: string }) {
  return async (event: HandlerEvent): Promise<ApiResponse> => {
    const { method, path, body, query } = parseEvent(event);

    const auth = authorize({ headers: event.headers }, { secret: deps.token, userId: deps.userId });
    if (!auth.isAuthorized) {
      return {
        statusCode: 401,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: "Unauthorized：需要有效 token（Authorization: Bearer <token>）",
        }),
      };
    }

    // client 喺建構時已綁定 userId（單用戶）；將來多用戶就要按 principalId 搵對應 client
    try {
      if (method === "POST" && path === "/tasks") {
        return await postTasks(body, { client: deps.client });
      }
      if (method === "POST" && /^\/tasks\/[^/]+\/confirm$/.test(path)) {
        const requestId = decodeURIComponent(path.split("/")[2] ?? "");
        return await decideConfirm(requestId, body, { client: deps.client });
      }
      if (method === "GET" && path.startsWith("/tasks/")) {
        const requestId = decodeURIComponent(path.slice("/tasks/".length));
        const state = await deps.client.getTask(requestId);
        if (!state) {
          return {
            statusCode: 404,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: `搵唔到任務 ${requestId}` }),
          };
        }
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(state),
        };
      }
      if (method === "GET" && path === "/transcript") {
        return await getTranscript(query, { client: deps.client });
      }
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: `冇呢條路由：${method} ${path}` }),
      };
    } catch (err) {
      console.error("relay api 錯誤", err);
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Server error：睇 Lambda log（cloud-watch）" }),
      };
    }
  };
}

function buildClient(userId: string): RelayClient {
  const region = process.env.AWS_REGION ?? "ap-southeast-1";
  const aws = createAwsQueues({
    region,
    tasksQueueUrl: process.env.TASKS_QUEUE_URL ?? "",
    resultsQueueUrl: process.env.RESULTS_QUEUE_URL ?? "",
    transcriptTable: process.env.TRANSCRIPT_TABLE ?? "",
    taskTable: process.env.TASK_TABLE ?? "",
    userId,
  });
  return new RelayClient({ userId, ...aws });
}

export async function handler(event: HandlerEvent): Promise<ApiResponse> {
  const userId = process.env.RELAY_USER_ID ?? "default";
  const token = process.env.RELAY_TOKEN ?? "";
  return createHandler({ client: buildClient(userId), token, userId })(event);
}
