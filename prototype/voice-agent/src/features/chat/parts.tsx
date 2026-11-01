import { useEffect, useState } from "react";
import {
  Mic,
  Square,
  Volume2,
  Check,
  Clock3,
  AlertTriangle,
  CircleAlert,
  ShieldCheck,
  RotateCcw,
  Loader2,
  ArrowDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, fmtTime } from "@/lib/utils";
import type { AgentStatus, ConfirmRequest, Message, RiskLevel, Task } from "@/mock/store";

/* ── Risk Badge（風險級別）──────────────────────────────────────────── */
export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const map = {
    read_only: { label: "read_only", v: "success" as const },
    write: { label: "write", v: "warning" as const },
    external_effect: { label: "external_effect", v: "destructive" as const },
  };
  const m = map[risk];
  return (
    <Badge variant={m.v}>
      {risk === "read_only" ? <ShieldCheck className="size-3" /> : <AlertTriangle className="size-3" />}
      {m.label}
    </Badge>
  );
}

/* ── Agent 狀態 ─────────────────────────────────────────────────────── */
export function AgentStatusPill({ status }: { status: AgentStatus }) {
  const map = {
    ready: { text: "Agent 已就緒", cls: "bg-accent/12 text-accent" },
    busy: { text: "Agent 做緊…", cls: "bg-primary/12 text-primary" },
    offline: { text: "Agent 離線", cls: "bg-warning/15 text-[#8a5a00]" },
  };
  const m = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", m.cls)}>
      <span className={cn("size-1.5 rounded-full", status === "ready" ? "bg-accent" : status === "busy" ? "bg-primary" : "bg-warning")} />
      {m.text}
    </span>
  );
}

/* ── 訊息氣泡 ───────────────────────────────────────────────────────── */
export function MessageBubble({
  message,
  onPlay,
  sessionTitle,
}: {
  message: Message;
  onPlay?: () => void;
  /** 當訊息屬於另一條 session 時顯示（跨 session 提醒） */
  sessionTitle?: string;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex w-full gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary">
          AI
        </div>
      )}
      <div className={cn("max-w-[78%] space-y-1", isUser && "items-end")}>
        {sessionTitle ? (
          <div className={cn("text-[10px] text-muted-foreground", isUser && "text-right")}>
            對話：{sessionTitle}
          </div>
        ) : null}
        <div
          className={cn(
            "rounded-panel px-3 py-2 text-[13px] leading-[1.45] shadow-card",
            isUser
              ? "rounded-br-md bg-user-bubble text-primary-foreground"
              : "rounded-bl-md border border-border bg-agent-bubble text-foreground",
          )}
        >
          {message.kind === "voice" && (
            <div className="mb-1 flex items-center gap-1.5 text-[11px] opacity-80">
              <Mic className="size-3" /> 語音輸入（device STT）
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.text}</p>
        </div>
        <div className={cn("flex items-center gap-2 text-[10px] text-muted-foreground", isUser && "justify-end")}>
          <span>{fmtTime(message.ts)}</span>
          {message.status === "sending" && <span>傳送中…</span>}
          {message.status === "delivered" && <span className="text-accent">已送達</span>}
          {message.status === "failed" && <span className="text-destructive">送唔到</span>}
          {message.hasAudio && (
            <button
              onClick={onPlay}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] hover:bg-border"
            >
              <Volume2 className="size-3" /> 播報
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 「新訊息」提示鈕（用戶拖咗上去時出現）───────────────────────── */
export function NewMessageButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-3 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-medium text-background shadow-pop"
    >
      <ArrowDown className="size-3.5" />
      {count > 1 ? `${count} 則新訊息` : "新訊息"}
    </button>
  );
}

/* ── 錄音鍵 ─────────────────────────────────────────────────────────── */
export function VoiceRecorder({
  recording,
  onStart,
  onStop,
  disabled,
}: {
  recording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!recording) {
      setSec(0);
      return;
    }
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  return (
    <div className="flex items-center gap-2">
      {recording && (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive">
          <span className="size-2 animate-pulse rounded-full bg-destructive" />
          {String(Math.floor(sec / 60)).padStart(2, "0")}:{String(sec % 60).padStart(2, "0")}
        </div>
      )}
      <Button
        size="iconLg"
        variant={recording ? "destructive" : "default"}
        onClick={recording ? onStop : onStart}
        disabled={disabled}
        aria-label={recording ? "停止錄音" : "開始錄音"}
        className={cn("shadow-card", !recording && "ring-4 ring-primary/15")}
      >
        {recording ? <Square className="size-5" /> : <Mic className="size-6" />}
      </Button>
    </div>
  );
}

/* ── STT 草稿（可編輯）──────────────────────────────────────────────── */
export function SttDraft({
  draft,
  onChange,
  onSend,
  onCancel,
  unclear,
}: {
  draft: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onCancel: () => void;
  unclear?: boolean;
}) {
  return (
    <div className="rounded-panel border border-border bg-card p-3 shadow-card">
      {unclear ? (
        <div className="flex items-center gap-2 text-xs text-warning">
          <CircleAlert className="size-4" /> 聽唔清，試多次或者用文字輸入。
        </div>
      ) : (
        <>
          <div className="mb-1.5 text-[11px] text-muted-foreground">STT 結果（改完先送出）</div>
          <textarea
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-control border border-border bg-background px-2.5 py-2 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
        {!unclear && (
          <Button size="sm" onClick={onSend} disabled={!draft.trim()}>
            送出
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── 任務卡片 ───────────────────────────────────────────────────────── */
export function TaskCard({
  task,
  onRetry,
  onPlay,
}: {
  task: Task;
  onRetry?: () => void;
  onPlay?: () => void;
}) {
  const statusMap = {
    queued: { label: "排隊中", v: "secondary" as const },
    running: { label: "執行中", v: "default" as const },
    awaiting_confirm: { label: "等你確認", v: "warning" as const },
    completed: { label: "完成", v: "success" as const },
    failed: { label: "失敗", v: "destructive" as const },
    partial: { label: "部分完成", v: "warning" as const },
  };
  const st = statusMap[task.status];
  return (
    <div className="w-full max-w-[78%] rounded-panel border border-border bg-card p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-[13px] font-medium">{task.title}</div>
        <Badge variant={st.v}>{st.label}</Badge>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
        {task.elapsed ? (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3" /> {task.elapsed}
          </span>
        ) : null}
        {task.risk ? <RiskBadge risk={task.risk} /> : null}
      </div>

      {task.status === "running" && (
        <div className="mt-2 space-y-1.5">
          <Progress value={62} />
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Agent 執行緊…
          </div>
        </div>
      )}

      {task.result && (
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-control bg-muted p-2.5 font-sans text-[12px] leading-[1.5]">
          {task.result}
        </pre>
      )}

      {task.error && (
        <div className="mt-2 rounded-control bg-destructive/8 p-2.5 text-[12px] text-destructive">
          {task.error}
        </div>
      )}

      <div className="mt-2.5 flex gap-2">
        {task.result && onPlay ? (
          <Button size="sm" variant="outline" onClick={onPlay}>
            <Volume2 className="size-3.5" /> 播報
          </Button>
        ) : null}
        {task.status === "failed" && onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw className="size-3.5" /> 重試
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ── 確認卡（Risk Gate）────────────────────────────────────────────── */
export function ConfirmCard({
  confirm,
  onApprove,
  onCancel,
}: {
  confirm: ConfirmRequest;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const [left, setLeft] = useState(() =>
    Math.max(0, Math.round((confirm.expiresAt - Date.now()) / 1000)),
  );
  useEffect(() => {
    const t = setInterval(
      () => setLeft(Math.max(0, Math.round((confirm.expiresAt - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(t);
  }, [confirm.expiresAt]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="w-full max-w-[88%] rounded-panel border border-warning/50 bg-card p-3 shadow-pop">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold">想改一個檔案，想你確認先改</div>
        <RiskBadge risk={confirm.risk} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {confirm.tool} · 剩餘 {mm}:{ss}
      </div>
      <pre className="mt-2 max-h-48 overflow-auto rounded-control bg-[#0B0D12] p-2.5 font-mono text-[11px] leading-[1.5] text-[#C9D1D9]">
        {confirm.preview}
      </pre>
      <div className="mt-2.5 flex gap-2">
        <Button size="sm" onClick={onApprove}>
          <Check className="size-3.5" /> 確認
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          取消
        </Button>
      </div>
      <div className="mt-1.5 text-[10px] text-muted-foreground">
        識講「confirm」得一樣效果（語音 → STT → 文字）
      </div>
    </div>
  );
}
