import { SQSClient, SendMessageCommand, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import type { RelayHandler, RelayTask, RelayTransport } from "../types";

/**
 * 方案 A：SQS long-poll
 *  - publish：SendMessage（App 或 Sidecar 都用同一條隊列）
 *  - subscribe：ReceiveMessage 長輪詢（WaitTimeSeconds=20）
 *  - 特性：冇 Lambda、冇常駐資源、idle 成本 = $0；延遲 = queue 輪詢回應延遲
 */
export class SqsTransport implements RelayTransport {
  readonly name = "sqs-long-poll";
  readonly idleCostPerMonthUsd = 0;

  private readonly client: SQSClient;
  private running = false;

  constructor(
    private readonly queueUrl: string,
    region: string,
    private readonly waitTimeSeconds = 20,
  ) {
    this.client = new SQSClient({ region });
  }

  async publish(task: RelayTask): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(task),
      }),
    );
  }

  async subscribe(handler: RelayHandler): Promise<void> {
    this.running = true;
    // 長輪詢 loop：收到即派發
    void (async () => {
      while (this.running) {
        try {
          const res = await this.client.send(
            new ReceiveMessageCommand({
              QueueUrl: this.queueUrl,
              MaxNumberOfMessages: 10,
              WaitTimeSeconds: this.waitTimeSeconds,
              VisibilityTimeout: 30,
            }),
          );
          for (const m of res.Messages ?? []) {
            try {
              handler(JSON.parse(m.Body ?? "{}") as RelayTask);
            } catch {
              /* 壞 payload：跳過 */
            }
          }
        } catch {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    })();
  }

  async close(): Promise<void> {
    this.running = false;
    this.client.destroy();
  }
}
