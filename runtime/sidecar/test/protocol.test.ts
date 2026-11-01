import { describe, expect, it } from "vitest";
import {
  ProtocolError,
  parseMessage,
  parseRequest,
  serializeMessage,
  serializeRequest,
} from "../src/protocol";

/**
 * M03 sidecar IPC 協議 contract
 * 探針名：M03-sidecar-protocol-*
 */
describe("M03 sidecar IPC 協議", () => {
  it("M03-sidecar-protocol-parses-prompt-request", () => {
    const req = parseRequest('{"type":"prompt","id":"r1","text":"幫我寫封 email"}');
    expect(req.type).toBe("prompt");
    expect(req.id).toBe("r1");
    expect(req.text).toBe("幫我寫封 email");
  });

  it("M03-sidecar-protocol-roundtrips-request-and-message", () => {
    const line = serializeRequest({ type: "status", id: "r2" });
    expect(parseRequest(line)).toEqual({ type: "status", id: "r2" });

    const msgLine = serializeMessage({ type: "ready", sessionId: "s-1", workspace: "~/ws" });
    const msg = parseMessage(msgLine);
    expect(msg.type).toBe("ready");
    expect(msg.sessionId).toBe("s-1");
  });

  it("M03-sidecar-protocol-rejects-malformed-line", () => {
    expect(() => parseRequest("not json")).toThrow(ProtocolError);
    expect(() => parseRequest("[]")).toThrow(ProtocolError);
    expect(() => parseRequest('{"type":"unknown"}')).toThrow(ProtocolError);
    expect(() => parseRequest("")).toThrow(ProtocolError);
  });

  it("M03-sidecar-protocol-error-message-is-actionable", () => {
    // 壞行嘅錯誤訊息要講得出點解錯（fail-loud ＋ 帶修復建議）
    let msg = "";
    try {
      parseRequest('{"type":"nope"}');
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain("未知 request type");
    expect(msg).toContain("nope");
  });
});
