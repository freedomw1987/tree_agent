/**
 * SPIKE-001 量度 CLI
 * 用法：tsx src/measure.ts --transport=sqs|ws --count=20 [--stack=voice-agent-spike-relay]
 *
 * 輸出：JSON（p50/p95/max 延遲、收到數、transport 名、idle 成本）
 */
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { measureRoundTrip } from "./harness";
import { SqsTransport } from "./adapters/sqs";
import { WebSocketTransport } from "./adapters/ws";
import type { RelayTransport } from "./types";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1]! : fallback;
}

async function stackOutputs(stackName: string): Promise<Record<string, string>> {
  const cfn = new CloudFormationClient({ region: process.env.AWS_REGION ?? "ap-southeast-1" });
  const res = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
  const outs: Record<string, string> = {};
  for (const o of res.Stacks?.[0]?.Outputs ?? []) {
    if (o.OutputKey && o.OutputValue) outs[o.OutputKey] = o.OutputValue;
  }
  return outs;
}

async function main() {
  const transportName = arg("transport", "sqs");
  const count = Number(arg("count", "20"));
  const stackName = arg("stack", "voice-agent-spike-relay");
  const region = process.env.AWS_REGION ?? "ap-southeast-1";

  const outs = await stackOutputs(stackName);
  const pub: RelayTransport = (() => {
    if (transportName === "sqs") {
      return new SqsTransport(outs.QueueUrl!, region);
    }
    if (transportName === "ws") {
      return new WebSocketTransport(outs.WsUrl!);
    }
    throw new Error(`未知 transport: ${transportName}`);
  })();
  const sub: RelayTransport = (() => {
    if (transportName === "sqs") {
      return new SqsTransport(outs.QueueUrl!, region);
    }
    if (transportName === "ws") {
      return new WebSocketTransport(outs.WsUrl!);
    }
    throw new Error(`未知 transport: ${transportName}`);
  })();

  const result = await measureRoundTrip(pub, sub, { count, timeoutMs: 30000 });
  await pub.close();
  await sub.close();

  console.log(
    JSON.stringify(
      {
        transport: transportName,
        count,
        received: result.received,
        p50: result.p50,
        p95: result.p95,
        max: result.max,
        idleCostPerMonthUsd: pub.idleCostPerMonthUsd,
        region,
        measuredAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error("measure 失敗：", e);
  process.exit(1);
});
