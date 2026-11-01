import { describe, expect, it } from "vitest";
import { authorize, extractToken } from "../src/authorizer";

/**
 * M02 Lambda authorizer contract
 * 探針名：M02-authorizer-*
 */
const CFG = { secret: "va_live_test_token", userId: "u-1" };

describe("M02 authorizer", () => {
  it("M02-authorizer-extracts-bearer-token", () => {
    expect(extractToken({ headers: { authorization: "Bearer abc123" } })).toBe("abc123");
    expect(extractToken({ headers: { "x-api-token": "xyz" } })).toBe("xyz");
    expect(extractToken({ headers: {} })).toBeUndefined();
  });

  it("M02-authorizer-allows-valid-token", () => {
    const r = authorize({ headers: { authorization: "Bearer va_live_test_token" } }, CFG);
    expect(r.isAuthorized).toBe(true);
    expect(r.context?.principalId).toBe("u-1");
    expect(r.context?.claims?.userId).toBe("u-1");
    expect(r.context?.stringToValue?.userId).toBe("u-1");
  });

  it("M02-authorizer-rejects-invalid-or-missing-token", () => {
    expect(authorize({ headers: { authorization: "Bearer wrong" } }, CFG).isAuthorized).toBe(false);
    expect(authorize({ headers: {} }, CFG).isAuthorized).toBe(false);
    expect(authorize({ headers: undefined }, CFG).isAuthorized).toBe(false);
    // HTTP API v2 會自己回 401（authorizer 只回 isAuthorized:false）
    expect(Object.keys(authorize({ headers: { authorization: "Bearer wrong" } }, CFG))).toEqual([
      "isAuthorized",
    ]);
  });

  it("M02-authorizer-rejects-when-secret-not-configured", () => {
    // 環境變數未設定 → 一律拒（唔可以「無 token 即放行」）
    const r = authorize({ headers: { authorization: "Bearer anything" } }, { secret: "", userId: "u-1" });
    expect(r.isAuthorized).toBe(false);
  });

  it("M02-authorizer-does-not-echo-token", () => {
    const r = authorize({ headers: { authorization: "Bearer va_live_test_token" } }, CFG);
    expect(JSON.stringify(r)).not.toContain("va_live_test_token");
  });
});
