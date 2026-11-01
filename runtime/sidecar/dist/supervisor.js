import { spawn } from "node:child_process";
export class Supervisor {
    opts;
    child = null;
    stopping = false;
    timer = null;
    exitHandlers = [];
    spawnHandlers = [];
    restartHandlers = [];
    spawnCount = 0;
    /** 已重啟次數 */
    restartCount = 0;
    constructor(opts) {
        this.opts = opts;
    }
    onExit(cb) {
        this.exitHandlers.push(cb);
    }
    onSpawn(cb) {
        this.spawnHandlers.push(cb);
    }
    onRestart(cb) {
        this.restartHandlers.push(cb);
    }
    isRunning() {
        return this.child !== null && this.child.exitCode === null && !this.child.killed;
    }
    start() {
        this.stopping = false;
        this.spawnChild();
    }
    spawnChild() {
        const child = spawn(this.opts.command, this.opts.args, {
            cwd: this.opts.cwd,
            env: { ...process.env, ...this.opts.env },
            stdio: ["pipe", "pipe", "pipe"],
        });
        this.child = child;
        this.spawnCount += 1;
        // stdio 轉發去主 process（Rust 端會收到）
        child.stdout?.on("data", (d) => process.stdout.write(d));
        child.stderr?.on("data", (d) => process.stderr.write(d));
        for (const cb of this.spawnHandlers)
            cb();
        child.on("exit", (code, signal) => {
            for (const cb of this.exitHandlers)
                cb(code, signal);
            this.child = null;
            if (this.stopping)
                return;
            if (this.restartCount >= (this.opts.maxRestarts ?? 20))
                return;
            this.restartCount += 1;
            const delay = this.opts.restartDelayMs ?? 500;
            this.timer = setTimeout(() => {
                for (const cb of this.restartHandlers)
                    cb(this.restartCount);
                this.spawnChild();
            }, delay);
        });
    }
    /** 等到第 n 次重啟（超時就 throw） */
    async waitForRestart(n, timeoutMs) {
        if (this.restartCount >= n)
            return;
        await new Promise((resolve, reject) => {
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
    async waitForSpawn(n, timeoutMs) {
        if (this.spawnCount >= n)
            return;
        await new Promise((resolve, reject) => {
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
    async stop() {
        this.stopping = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        const child = this.child;
        this.child = null;
        if (!child || child.exitCode !== null)
            return;
        await new Promise((resolve) => {
            const done = () => resolve();
            child.once("exit", done);
            child.kill("SIGTERM");
            setTimeout(() => {
                if (child.exitCode === null)
                    child.kill("SIGKILL");
                resolve();
            }, 2000);
        });
    }
}
