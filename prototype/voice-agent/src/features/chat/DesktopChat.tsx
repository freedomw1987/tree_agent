import { useState } from "react";
import { Mic, Send, Volume2 } from "lucide-react";
import { DesktopShell } from "@/components/shell/DesktopShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDemoStore } from "@/mock/store";
import { AgentStatusPill, ConfirmCard, MessageBubble, NewMessageButton, TaskCard } from "./parts";
import { useStickyStream } from "./useStickyStream";

export default function DesktopChat() {
  const messages = useDemoStore((s) => s.messages);
  const tasks = useDemoStore((s) => s.tasks);
  const confirm = useDemoStore((s) => s.confirm);
  const sessions = useDemoStore((s) => s.sessions);
  const currentSessionId = useDemoStore((s) => s.currentSessionId);
  const switchSession = useDemoStore((s) => s.switchSession);
  const agentStatus = useDemoStore((s) => s.agentStatus);
  const sendMessage = useDemoStore((s) => s.sendMessage);
  const approveConfirm = useDemoStore((s) => s.approveConfirm);
  const cancelConfirm = useDemoStore((s) => s.cancelConfirm);
  const [text, setText] = useState("");
  const sticky = useStickyStream(messages.length + tasks.length);

  return (
    <DesktopShell
      title="對話"
      subtitle="同一個 App 嘅桌面版 —— 同一份 transcript"
      actions={<AgentStatusPill status={agentStatus} />}
    >
      <div className="flex h-full gap-4">
        {/* session 清單 */}
        <aside className="w-56 shrink-0">
          <div className="mb-2 text-[11px] font-medium text-muted-foreground">Sessions</div>
          <div className="space-y-1">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => switchSession(s.id)}
                className={`block w-full rounded-control px-3 py-2 text-left text-xs ${
                  s.id === currentSessionId
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium">{s.title}</span>
                  <Badge variant={s.state === "active" ? "success" : "secondary"}>
                    {s.state}
                  </Badge>
                </div>
                <div className="mt-0.5 text-[10px] opacity-70">
                  {s.messages} 則訊息{s.auto ? " · 自動分流開出" : ""}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* 訊息串 */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={sticky.ref}
            onScroll={sticky.onScroll}
            data-stream="desktop"
            className="min-h-[420px] flex-1 space-y-3 overflow-auto rounded-panel border border-border bg-card p-4 pb-28"
          >
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {tasks.map((t) => (
              <div key={t.id} className="flex justify-start">
                <TaskCard task={t} />
              </div>
            ))}
            {confirm && (
              <div className="flex justify-start">
                <ConfirmCard confirm={confirm} onApprove={approveConfirm} onCancel={cancelConfirm} />
              </div>
            )}
          </div>
          {sticky.pending > 0 && (
            <NewMessageButton count={sticky.pending} onClick={() => sticky.scrollToBottom()} />
          )}
          </div>

          {/* 浮動輸入列：貼住視窗最下方，右邊嘅傳送／錄音鈕一齊浮住 */}
          <div className="pointer-events-none absolute inset-x-0 -bottom-5 -mx-5 z-10 border-t border-border bg-card/85 px-5 pb-3 pt-3 backdrop-blur-md">
            <div className="pointer-events-auto mx-auto flex max-w-[760px] items-center gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && text.trim()) {
                    sendMessage(text.trim());
                    setText("");
                  }
                }}
                placeholder="打字，或者用咪高峰（⌘K）"
                className="h-10"
              />
              <Button variant="outline" size="icon" aria-label="語音輸入">
                <Mic className="size-4" />
              </Button>
              <Button
                size="icon"
                aria-label="發送"
                onClick={() => {
                  if (!text.trim()) return;
                  sendMessage(text.trim());
                  setText("");
                }}
              >
                <Send className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="播報最新回覆">
                <Volume2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}
