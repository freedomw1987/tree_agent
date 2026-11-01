import { RelayClient } from "../../relay/src/relay-client";

/**
 * M02 HTTP API —— App 端唔使直接攞 AWS 憑證
 *
 * 路由：
 *  - POST /tasks       { text, requestId?, kind?, title? } → 202 { requestId }
 *  - GET  /transcript  ?cursor=... → 200 { entries, cursor }
 *
 * 註：呢度用相對路徑 import relay 層，因為 Lambda 會用 esbuild 打包（避免多一個 workspace 發佈機制）
 */

export interface ApiDeps {
  client: RelayClient;
  maxTextLength?: number;
}

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const json = (statusCode: number, payload: unknown): ApiResponse => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});

export async function postTasks(body: unknown, deps: ApiDeps): Promise<ApiResponse> {
  const maxLen = deps.maxTextLength ?? 4000;

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json(400, { error: "body 必須係 JSON object（例如 { text: '...' }）" });
  }
  const b = body as Record<string, unknown>;
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (!text) {
    return json(400, { error: "缺少 text（要講咩任務）—— 例：{ text: '幫我寫封 email' }" });
  }
  if (text.length > maxLen) {
    return json(413, {
      error: `text 太長（${text.length} 字，上限 ${maxLen}）—— 拆成幾個任務先`,
    });
  }
  if (b.requestId !== undefined && typeof b.requestId !== "string") {
    return json(400, { error: "requestId 必須係字串" });
  }

  const requestId = await deps.client.sendTask({
    text,
    requestId: typeof b.requestId === "string" ? b.requestId : undefined,
    kind: b.kind === "voice" ? "voice" : "text",
    title: typeof b.title === "string" ? b.title : undefined,
  });

  return json(202, { requestId, status: "queued" });
}

/** 回覆確認卡（POST /tasks/{id}/confirm） */
export async function decideConfirm(
  requestId: string,
  body: unknown,
  deps: ApiDeps,
): Promise<ApiResponse> {
  const payload = (body ?? {}) as { approved?: unknown };
  if (typeof payload.approved !== "boolean") {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "body 要有 approved: boolean" }),
    };
  }
  try {
    await deps.client.decideConfirm(requestId, payload.approved);
  } catch (err) {
    return {
      statusCode: 404,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: `回覆失敗：${err instanceof Error ? err.message : String(err)}` }),
    };
  }
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true, requestId, approved: payload.approved }),
  };
}

export async function getTranscript(
  query: Record<string, string | undefined>,
  deps: ApiDeps,
): Promise<ApiResponse> {
  const cursor = query.cursor;
  const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50) || 50));
  const { entries, cursor: next } = await deps.client.readTranscript(cursor, limit);
  return json(200, { entries, cursor: next ?? null });
}

/** API Gateway HTTP API v2 payload → body / query */
export function parseEvent(event: {
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined> | null;
  rawPath?: string;
  requestContext?: { http?: { method?: string } };
}): { method: string; path: string; body: unknown; query: Record<string, string | undefined> } {
  const method = event.requestContext?.http?.method ?? "GET";
  const path = event.rawPath ?? "/";
  let body: unknown = undefined;
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      body = { __invalidJson: event.body };
    }
  }
  return { method, path, body, query: event.queryStringParameters ?? {} };
}
