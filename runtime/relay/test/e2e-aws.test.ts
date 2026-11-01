import { describe, expect, it } from "vitest";
import { RelayClient } from "../src/relay-client";
import { createAwsQueues } from "../src/aws";

/**
 * M02 真實 AWS 端到端驗證（opt-in）
 * 跑法：AWS_E2E=1 npx vitest run test/e2e-aws.test.ts
 *
 * 驗證鏈：App client → tasks queue → Sidecar client → results queue → App client ＋ DynamoDB transcript
 */
const enabled = process.env.AWS_E2E === "1";
const region = process.env.AWS_REGION ?? "ap-southeast-1";
const stack = process.env.RELAY_STACK ?? "voice-agent-m02-relay";
const userId = process.env.RELAY_USER_ID ?? `u-e2e-${Date.now().toString(36)}`;

async function stackOutputs(): Promise<Record<string, string>> {
  const { CloudFormationClient, DescribeStacksCommand } = await import(
    "@aws-sdk/client-cloudformation"
  );
  const cfn = new CloudFormationClient({ region });
  const res = await cfn.send(new DescribeStacksCommand({ StackName: stack }));
  const out: Record<string, string> = {};
  for (const o of res.Stacks?.[0]?.Outputs ?? []) {
    if (o.OutputKey && o.OutputValue) out[o.OutputKey] = o.OutputValue;
  }
  return out;
}

describe.skipIf(!enabled)("M02 relay 真實 AWS 端到端", () => {
  it("M02-relay-e2e-app-to-sidecar-and-back", async () => {
    const outs = await stackOutputs();
    const aws = createAwsQueues({
      region,
      tasksQueueUrl: outs.TasksQueueUrl!,
      resultsQueueUrl: outs.ResultsQueueUrl!,
      transcriptTable: outs.TranscriptTable!,
      taskTable: outs.TaskTable!,
      userId,
    });

    const app = new RelayClient({ userId, ...aws });
    const sidecar = new RelayClient({ userId, ...aws });

    // 先清走上一次殘留嘅訊息（共享隊列 → 唔 drain 會收到舊 requestId）
    for (const q of [aws.tasksQueue, aws.resultsQueue]) {
      for (let i = 0; i < 5; i++) {
        const msgs = await q.poll(1000, 10);
        if (!msgs.length) break;
        for (const m of msgs) await q.ack(m);
      }
    }

    // App → tasks queue
    const requestId = await app.sendTask({ text: "幫我寫封 email 俾客戶" });

    // Sidecar 長輪詢攞到
    let received: { requestId: string; text: string } | null = null;
    for (let i = 0; i < 3 && !received; i++) {
      await sidecar.pollTasks((t) => {
        received = { requestId: t.requestId, text: t.text };
      });
    }
    expect(received).not.toBeNull();
    expect((received as unknown as { requestId: string }).requestId).toBe(requestId);

    // Sidecar → results queue
    await sidecar.publishResult({ requestId, text: "搞掂咗，草稿喺下面", status: "completed" });

    // App 收到結果
    let got = false;
    for (let i = 0; i < 3 && !got; i++) {
      await app.pollResults((r) => {
        got = r.requestId === requestId;
      });
    }
    expect(got).toBe(true);

    // Transcript 兩條（user + agent）
    const t = await app.readTranscript();
    expect(t.entries.length).toBeGreaterThanOrEqual(2);
    expect(t.entries.some((e) => e.role === "user" && e.content.includes("幫我寫封 email"))).toBe(true);
    expect(t.entries.some((e) => e.role === "agent" && e.content.includes("搞掂咗"))).toBe(true);
  }, 60000);
});
