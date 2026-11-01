import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Settings as SettingsIcon,
  MessageSquare,
  BarChart3,
  SlidersHorizontal,
  X,
  Volume2,
  WifiOff,
  MessagesSquare,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetCloseButton,
} from "@/components/ui/sheet";
import { useDemoStore, type Message, type Task } from "@/mock/store";
import {
  AgentStatusPill,
  ConfirmCard,
  MessageBubble,
  NewMessageButton,
  SttDraft,
  TaskCard,
  VoiceRecorder,
} from "./parts";
import { useStickyStream } from "./useStickyStream";

type StreamItem =
  | { kind: "msg"; ts: string; m: Message }
  | { kind: "task"; ts: string; t: Task };

export default function MobileChat() {
  const messages = useDemoStore((s) => s.messages);
  const tasks = useDemoStore((s) => s.tasks);
  const confirm = useDemoStore((s) => s.confirm);
  const demoMode = useDemoStore((s) => s.demoMode);
  const agentStatus = useDemoStore((s) => s.agentStatus);
  const sttDraft = useDemoStore((s) => s.sttDraft);
  const recording = useDemoStore((s) => s.recording);
  const notify = useDemoStore((s) => s.notify);
  const settings = useDemoStore((s) => s.settings);
  const sessions = useDemoStore((s) => s.sessions);
  const currentSessionId = useDemoStore((s) => s.currentSessionId);
  const sessionSheetOpen = useDemoStore((s) => s.sessionSheetOpen);
  const openSessionSheet = useDemoStore((s) => s.openSessionSheet);
  const closeSessionSheet = useDemoStore((s) => s.closeSessionSheet);
  const switchSession = useDemoStore((s) => s.switchSession);
  const startNewSession = useDemoStore((s) => s.startNewSession);

  const sendMessage = useDemoStore((s) => s.sendMessage);
  const requestConfirm = useDemoStore((s) => s.requestConfirm);
  const approveConfirm = useDemoStore((s) => s.approveConfirm);
  const cancelConfirm = useDemoStore((s) => s.cancelConfirm);
  const setRecording = useDemoStore((s) => s.setRecording);
  const setSttDraft = useDemoStore((s) => s.setSttDraft);
  const dismissNotify = useDemoStore((s) => s.dismissNotify);
  const failLastTask = useDemoStore((s) => s.failLastTask);

  const [text, setText] = useState("");
  const [unclear, setUnclear] = useState(false);
  const [playing, setPlaying] = useState(false);

  const stream = useMemo<StreamItem[]>(() => {
    const items: StreamItem[] = [
      ...messages.map((m) => ({ kind: "msg" as const, ts: m.ts, m })),
      ...tasks.map((t) => ({ kind: "task" as const, ts: t.createdAt, t })),
    ];
    return items.sort((a, b) => a.ts.localeCompare(b.ts));
  }, [messages, tasks]);

  const sticky = useStickyStream(stream.length);

  useEffect(() => {
    if (!notify) return;
    const t = setTimeout(() => dismissNotify(), 6000);
    return () => clearTimeout(t);
  }, [notify, dismissNotify]);

  const isEmpty = messages.length === 0 && tasks.length === 0;

  const handleSend = (value: string, voice = false) => {
    const v = value.trim();
    if (!v) return;
    sendMessage(v, { voice, title: voice ? "語音任務" : v.slice(0, 20) });
    setText("");
    setSttDraft(null);
    setUnclear(false);
    sticky.scrollToBottom();
  };

  const startRecording = () => {
    setRecording(true);
    setUnclear(false);
  };

  const stopRecording = () => {
    setRecording(false);
    if (demoMode === "edge") {
      setUnclear(true);
      return;
    }
    setSttDraft("幫我寫封 email 俾客戶講明延遲兩日交付");
  };

  const playVoice = () => {
    setPlaying(true);
    setTimeout(() => setPlaying(false), 1200);
  };

  return (
    <div className="flex min-h-screen justify-center bg-muted/40 py-6">
      <div className="relative flex h-[844px] w-[390px] flex-col overflow-hidden bg-background shadow-card md:rounded-panel md:border md:border-border">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Voice Agent</span>
          <button
            onClick={openSessionSheet}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium hover:bg-border"
            title="對話 session（自動分流 + 開新對話）"
          >
            <MessagesSquare className="size-3" />
            {sessions.find((s) => s.id === currentSessionId)?.title ?? "對話"}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <AgentStatusPill status={agentStatus} />
          <NavLink to="/m/settings" className="rounded-control p-1.5 text-muted-foreground hover:bg-muted">
            <SettingsIcon className="size-4" />
          </NavLink>
        </div>
      </header>

      {/* Banners */}
      <div className="space-y-2 px-3 pt-2">
        {agentStatus === "offline" && (
          <Alert variant="warning">
            <WifiOff className="size-3.5 shrink-0" />
            <span>Agent 離線（Mac sidecar 未連上）—— 訊息會排隊，恢復後自動送出。</span>
          </Alert>
        )}
        {demoMode === "error" && (
          <Alert variant="destructive">
            <span>連唔到 Relay：網絡／AWS 異常。輸入內容已保留，可撳重試。</span>
          </Alert>
        )}
        {demoMode === "loading" && (
          <Alert variant="info">
            <span>同步緊 Transcript…</span>
          </Alert>
        )}
      </div>

      {/* Stream */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={sticky.ref}
          onScroll={sticky.onScroll}
          data-stream="mobile"
          className="h-full space-y-3 overflow-auto px-3 py-3"
        >
        {demoMode === "loading" ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-20 w-4/5" />
            <Skeleton className="h-12 w-1/2" />
          </div>
        ) : isEmpty || demoMode === "empty" ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="size-6 text-primary" />
            </div>
            <div className="text-sm font-medium">仲未傾過偈</div>
            <p className="max-w-[240px] text-xs text-muted-foreground">
              按住下面嘅咪高峰講嘢，或者直接打字。Agent 會喺你部 Mac 上面做事，完成咗會通知你。
            </p>
          </div>
        ) : (
          stream.map((item) => {
            if (item.kind === "msg") {
              const other = item.m.sessionId && item.m.sessionId !== currentSessionId;
              const otherTitle = other
                ? sessions.find((s) => s.id === item.m.sessionId)?.title
                : undefined;
              return (
                <MessageBubble
                  key={item.m.id}
                  message={item.m}
                  onPlay={playVoice}
                  sessionTitle={otherTitle}
                />
              );
            }
            const t = item.t;
            return (
              <div key={t.id} className="space-y-2">
                <TaskCard
                  task={t}
                  onRetry={failLastTask}
                  onPlay={settings.tts ? playVoice : undefined}
                />
                {confirm && confirm.taskId === t.id && (
                  <ConfirmCard
                    confirm={confirm}
                    onApprove={approveConfirm}
                    onCancel={cancelConfirm}
                  />
                )}
              </div>
            );
          })
        )}
        </div>
        {sticky.pending > 0 && (
          <NewMessageButton count={sticky.pending} onClick={() => sticky.scrollToBottom()} />
        )}
      </div>

      {/* STT draft */}
      {(sttDraft !== null || unclear) && (
        <div className="px-3 pb-2">
          <SttDraft
            draft={sttDraft ?? ""}
            unclear={unclear}
            onChange={(v) => {
              setUnclear(false);
              setSttDraft(v);
            }}
            onSend={() => handleSend(sttDraft ?? "", true)}
            onCancel={() => {
              setSttDraft(null);
              setUnclear(false);
            }}
          />
        </div>
      )}

      {/* 快速動作（demo） */}
      <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-border bg-card px-3 py-1.5">
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={requestConfirm}>
          試一次要確認嘅操作
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px]"
          onClick={() => sendMessage("幫我睇下 delivery-plan.md 寫咗啲咩", { title: "讀取交付計劃" })}
        >
          派一個 read-only 任務
        </Button>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-card px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend(text);
            }}
            placeholder="打字都得…"
            className="h-11 flex-1 rounded-full bg-muted"
          />
          {text.trim() && (
            <Button size="icon" onClick={() => handleSend(text)} aria-label="發送">
              <MessageSquare className="size-4" />
            </Button>
          )}
          {!text.trim() && (
            <VoiceRecorder
              recording={recording}
              onStart={startRecording}
              onStop={stopRecording}
              disabled={agentStatus === "offline"}
            />
          )}
        </div>
      </div>

      {/* Bottom tabs */}
      <nav className="flex h-14 shrink-0 items-center justify-around border-t border-border bg-card">
        {[
          { to: "/m/chat", label: "對話", icon: MessageSquare },
          { to: "/m/stats", label: "統計", icon: BarChart3 },
          { to: "/m/settings", label: "設定", icon: SlidersHorizontal },
        ].map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-6 text-[10px] ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <t.icon className="size-4" />
            {t.label}
          </NavLink>
        ))}
      </nav>

        {/* Session 抽屜（自動分流 + 開新對話）*/}
      <Sheet
        open={sessionSheetOpen}
        onOpenChange={(o) => (o ? openSessionSheet() : closeSessionSheet())}
      >
        <SheetContent side="bottom">
          <SheetHeader>
            <div>
              <SheetTitle>對話 session</SheetTitle>
              <SheetDescription>
                Agent 會自動分流：同一話題就續返舊對話，唔肯定就開新（自動命名）。想自己開就撳下面。
              </SheetDescription>
            </div>
            <SheetCloseButton />
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-4">
            {sessions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                仲未有對話 session —— 講第一句嘢就會自動開一條。
              </div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => switchSession(s.id)}
                  className={`flex w-full items-center gap-2 rounded-control border p-3 text-left transition-colors ${
                    s.id === currentSessionId
                      ? "border-primary/40 bg-primary/8"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <MessagesSquare className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{s.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.messages} 則訊息 · {s.auto ? "自動分流開出" : "人手開"}
                    </div>
                  </div>
                  {s.id === currentSessionId && <Badge variant="default">當前</Badge>}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-border p-4">
            <Button className="w-full" onClick={() => startNewSession("新對話")}>
              <Plus className="size-4" /> 開新對話
            </Button>
            <p className="mt-2 text-[10px] leading-[1.5] text-muted-foreground">
              <Sparkles className="inline size-3" /> 想「帶住舊上文開新」，用 Pi SDK 嘅 fork（第二入口，
              預設唔開）。
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* 推播通知（Polly 語音通知） */}
        {notify && (
          <div className="absolute left-1/2 top-14 z-30 w-[350px] -translate-x-1/2 rounded-panel border border-border bg-card p-3 shadow-pop">
          <div className="flex items-start gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12">
              <MessageSquare className="size-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold">{notify.title}</div>
              <div className="truncate text-[11px] text-muted-foreground">{notify.body}</div>
            </div>
            {notify.audio && (
              <button
                onClick={playVoice}
                className="rounded-full bg-primary/10 p-1.5 text-primary"
                aria-label="播放語音通知"
              >
                <Volume2 className="size-3.5" />
              </button>
            )}
            <button onClick={dismissNotify} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
              <X className="size-3.5" />
            </button>
          </div>
          {playing && <div className="mt-2 text-[11px] text-primary">播放緊 Polly 語音…</div>}
        </div>
      )}
      </div>
    </div>
  );
}
