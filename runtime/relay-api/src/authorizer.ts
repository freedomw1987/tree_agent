/**
 * M02 HTTP API —— Lambda authorizer（自製 token；可換 Cognito）
 *
 * 規則：
 *  - token 喺 Authorization: Bearer <token> 或 x-api-token
 *  - 有效 → allow（principalId = userId，令下游用 userId 做隔離）
 *  - 無效／缺失 → 401（唔好回應細節，唔好印 token 落 log）
 */

export interface AuthConfig {
  /** 有效 token（單用戶：來自環境變數／Secrets Manager） */
  secret: string;
  /** 呢個 token 對應嘅 user（單用戶就係一個固定 id） */
  userId: string;
}

export interface AuthorizeResult {
  /**
   * ⚠️ HTTP API v2 REQUEST authorizer 只接受呢個格式：
   *    allow = { isAuthorized: true, context: {...} }；deny = { isAuthorized: false }
   *    多加 statusCode 之類欄位 → API Gateway 會當格式錯誤 → 500（實測踩過）
   */
  isAuthorized: boolean;
  context?: {
    principalId: string;
    /**
     * REQUEST authorizer 嘅 context 用 stringToValue（claims 係 JWT authorizer 先用）
     * 兩者都帶住，穩陣過淨係得一個
     */
    stringToValue?: Record<string, string>;
    claims?: Record<string, string>;
  };
}

/** 從 API Gateway event 抽 token（支援 Bearer 同 x-api-token） */
export function extractToken(event: {
  headers?: Record<string, string | undefined> | null;
}): string | undefined {
  const headers = event.headers ?? {};
  const auth = headers.authorization ?? headers.Authorization;
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const direct = headers["x-api-token"];
  return direct?.trim() || undefined;
}

/** 純函式：驗 token → 決定放唔放行（唔碰 AWS，方便測試） */
export function authorize(
  event: { headers?: Record<string, string | undefined> | null },
  cfg: AuthConfig,
): AuthorizeResult {
  const token = extractToken(event);
  if (!token || !cfg.secret) {
    return { isAuthorized: false };
  }
  if (token !== cfg.secret) {
    return { isAuthorized: false };
  }
  return {
    isAuthorized: true,
    context: {
      principalId: cfg.userId,
      stringToValue: { userId: cfg.userId },
      claims: { userId: cfg.userId },
    },
  };
}

/** Lambda authorizer entry（REQUEST 型） */
export async function handler(event: {
  headers?: Record<string, string | undefined> | null;
}): Promise<AuthorizeResult> {
  const cfg: AuthConfig = {
    secret: process.env.RELAY_TOKEN ?? "",
    userId: process.env.RELAY_USER_ID ?? "default",
  };
  const result = authorize(event, cfg);
  if (!result.isAuthorized) {
    // ⚠️ 唔好將 token 寫入 log
    console.warn("relay authorizer: 拒絕（token 缺失或無效）");
  }
  return result;
}
