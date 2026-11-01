import { createAwsQueues, RelayClient } from "@voice-agent/relay";
import type { TaskState } from "@voice-agent/relay";

/**
 * M03 sidecar ↔ M02 relay 嘅 worker
 *
 * Mac 上面嘅 sidecar 長期輪詢 tasks queue：
 *   收到任務 → 喺本地 session 執行 → 交結果（transcript ＋ task state ＋ results queue）
 *
 * 手機 App 就係經 relay 派任務同收結果（手機唔會直接行 Node sidecar）。
 */

export interface RelayTaskResult {
  text: string;
  status: Extract<TaskState["status"], "completed" | "failed" | "partial">;
  error?: string;
}

export interface RelayWorkerDeps {
  /** 執行任務（例如交畀 SessionHost） */
  runTask: (text: string, requestId: string) => Promise<RelayTaskResult>;
  /** log（去 stderr，唔好污染 stdout 嘅 IPC 通道） */
  log?: (msg: string) => void;
}

export class RelayWorker {
  private running = false;
  private loopPromise: Promise<void> | null = null;
  /** 執行中嘅任務（SQS at-least-once 可能重複投遞 → 唔好做兩次） */
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly client: RelayClient,
    private readonly deps: RelayWorkerDeps,
  ) {}

  /** 開始輪詢（唔 block：喺背景跑） */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.loopPromise = this.loop();
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.loopPromise?.catch(() => undefined);
  }

  /** 跑一個 poll cycle（測試用：可以同步等佢跑完一個 cycle） */
  async pollOnce(): Promise<void> {
    await this.client.pollTasksConcurrent(async (task) => {
      if (this.inFlight.has(task.requestId)) {
        this.deps.log?.(`relay 收到重複任務 ${task.requestId}（跳過）`);
        return;
      }
      this.inFlight.add(task.requestId);
      this.deps.log?.(`relay 收到任務 ${task.requestId}：${task.text.slice(0, 60)}`);
      try {
        const result = await this.deps.runTask(task.text, task.requestId);
        await this.client.publishResult({
          requestId: task.requestId,
          text: result.text,
          status: result.status,
          error: result.error,
        });
        this.deps.log?.(`relay 任務 ${task.requestId} 完成（${result.status}）`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.deps.log?.(`relay 任務 ${task.requestId} 失敗：${message}`);
        await this.client.publishResult({
          requestId: task.requestId,
          text: `任務失敗：${message}`,
          status: "failed",
          error: message,
        });
      } finally {
        this.inFlight.delete(task.requestId);
      }
    });
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        await this.pollOnce();
      } catch (err) {
        this.deps.log?.(`relay 輪詢錯誤：${err instanceof Error ? err.message : String(err)}`);
        // 唔好即刻重試死循環：等一下
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
}

/** 由環境變數砌一個真 relay client（單用戶） */
export function createRelayClientFromEnv(env: NodeJS.ProcessEnv = process.env): RelayClient | null {
  const tasksQueueUrl = env.TASKS_QUEUE_URL;
  const resultsQueueUrl = env.RESULTS_QUEUE_URL;
  const transcriptTable = env.TRANSCRIPT_TABLE;
  const taskTable = env.TASK_TABLE;
  if (!tasksQueueUrl || !resultsQueueUrl || !transcriptTable || !taskTable) return null;

  const userId = env.RELAY_USER_ID ?? "default";
  const aws = createAwsQueues({
    region: env.AWS_REGION ?? "ap-southeast-1",
    tasksQueueUrl,
    resultsQueueUrl,
    transcriptTable,
    taskTable,
    userId,
  });
  return new RelayClient({ userId, ...aws });
}
