import WebSocket from "ws";
import type { RelayHandler, RelayTask, RelayTransport } from "../types";

/**
 * 方案 C：API Gateway WebSocket
 *  - 兩個角色各開一條 WSS 連線
 *  - publish：直接用自己條 WSS 送 JSON → Lambda $default 廣播畀所有連線
 *  - 特性：要 Lambda ＋ DynamoDB 記連線（維護成本最高），但係真 streaming
 */
export class WebSocketTransport implements RelayTransport {
  readonly name = "api-gateway-websocket";
  readonly idleCostPerMonthUsd = 0;

  private ws: WebSocket | null = null;
  private handlers: RelayHandler[] = [];
  private connected: Promise<void> | null = null;

  constructor(private readonly url: string) {}

  private connect(): Promise<void> {
    if (this.connected) return this.connected;
    this.connected = new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.on("open", () => resolve());
      ws.on("error", (err) => reject(err));
      ws.on("message", (raw) => {
        try {
          const task = JSON.parse(raw.toString()) as RelayTask;
          for (const h of this.handlers) h(task);
        } catch {
          /* 忽略非 JSON */
        }
      });
    });
    return this.connected;
  }

  async publish(task: RelayTask): Promise<void> {
    await this.connect();
    this.ws?.send(JSON.stringify(task));
  }

  async subscribe(handler: RelayHandler): Promise<void> {
    this.handlers.push(handler);
    await this.connect();
  }

  async close(): Promise<void> {
    this.handlers = [];
    this.ws?.close();
    this.ws = null;
    this.connected = null;
  }
}
