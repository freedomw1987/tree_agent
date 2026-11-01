import { spawn, type ChildProcess } from "node:child_process";

/**
 * M03 supervisor —— sidecar 進程守護
 *
 * 職責：sidecar 崩潰 → 自動重啟（≤ 5 秒，AC-M03-3）
 * 跟 App 生死（OQ-5）：App 閂咗 → stop() → 唔再重啟
 *
 * 設計：pure Node（唔靠 Tauri/Rust）→ 可以獨立測試；Rust/Tauri 側只需呼叫呢層
 */

export interface SupervisorOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** 重啟前等幾耐（預設 500ms；AC 要求 ≤ 5 秒內完成重啟） */
  restartDelayMs?: number;
  /** 連續重啟上限（防止無限 crash loop）*/
  maxRestarts?: number;
}

export class Supervisor {
  private child: ChildProcess | null = null;
  private stopping = false;
  private timer: NodeJS.Timeout | null = null;
  private exitHandlers: Array<(code: number | null, signal: string | null) => void> = [];
  private spawnHandlers: Array<() => void> = [];
  private restartHandlers: Array<(count: number) => void> = [];
  private spawnCount = 0;

  /** 已重啟次數 */
  restartCount = 0;

  constructor(private readonly opts: SupervisorOptions) {}

  onExit(cb: (code: number | null, signal: string | null) => void): void {
    this.exitHandlers.push(cb);
  }

  onSpawn(cb: () => void): void {
    this.spawnHandlers.push(cb);
  }

  onRestart(cb: (count: number) => void): void {
    this.restartHandlers.push(cb);
  }

  isRunning(): boolean {
    return this.child !== null && this.child.exitCode === null && !this.child.killed;
  }

  start(): void {
    this.stopping = false;
    this.spawnChild();
  }

  private spawnChild(): void {
    const child = spawn(this.opts.command, this.opts.args, {
      cwd: this.opts.cwd,
      env: { ...process.env, ...this.opts.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    this.spawnCount += 1;

    // stdio 轉發去主 process（Rust 端會收到）
    child.stdout?.on("data", (d: Buffer) => process.stdout.write(d));
    child.stderr?.on("data", (d: Buffer) => process.stderr.write(d));

    for (const cb of this.spawnHandlers) cb();

    child.on("exit", (code, signal) => {
      for (const cb of this.exitHandlers) cb(code, signal);
      this.child = null;
      if (this.stopping) return;
      if (this.restartCount >= (this.opts.maxRestarts ?? 20)) return;
      this.restartCount += 1;
      const delay = this.opts.restartDelayMs ?? 500;
      this.timer = setTimeout(() => {
        for (const cb of this.restartHandlers) cb(this.restartCount);
        this.spawnChild();
      }, delay);
    });
  }

  /** 等到第 n 次重啟（超時就 throw） */
  async waitForRestart(n: number, timeoutMs: number): Promise<void> {
    if (this.restartCount >= n) return;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => {
        reject(new Error(`等唔到第 ${n} 次重啟（${timeoutMs}ms 內）`));
      }, timeoutMs);
      this.onRestart((count) => {
        if (count >= n) {
          clearTimeout(t);
          resolve();
        }
      });
    });
  }

  /** 等到第 n 次 spawn */
  async waitForSpawn(n: number, timeoutMs: number): Promise<void> {
    if (this.spawnCount >= n) return;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => {
        reject(new Error(`等唔到第 ${n} 次啟動（${timeoutMs}ms 內）`));
      }, timeoutMs);
      this.onSpawn(() => {
        if (this.spawnCount >= n) {
          clearTimeout(t);
          resolve();
        }
      });
    });
  }

  /** 收工：殺 process、唔再重啟（跟 App 生死） */
  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null) return;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      child.once("exit", done);
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        resolve();
      }, 2000);
    });
  }
}
