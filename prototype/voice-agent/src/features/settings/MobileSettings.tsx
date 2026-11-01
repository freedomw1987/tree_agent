import { NavLink } from "react-router-dom";
import type { ComponentType } from "react";
import { MessageSquare, BarChart3, SlidersHorizontal, KeyRound, Mic, Volume2, Bell, Moon, PencilLine } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { useDemoStore } from "@/mock/store";

function Row({
  icon: Icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function MobileSettings() {
  const settings = useDemoStore((s) => s.settings);
  const updateSettings = useDemoStore((s) => s.updateSettings);
  const agentStatus = useDemoStore((s) => s.agentStatus);

  return (
    <div className="flex min-h-screen justify-center bg-muted/40 py-6">
      <div className="flex h-[844px] w-[390px] flex-col overflow-hidden bg-background shadow-card md:rounded-panel md:border md:border-border">
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-card px-4">
          <span className="text-sm font-semibold">設定</span>
          <Badge variant="secondary" className="ml-auto">
            單用戶
          </Badge>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
          <Alert variant="warning">
            <span>
              麥克風權限：<b>未授權</b> —— 錄音鍵會被擋。撳「去設定」喺系統設定入開返。
            </span>
          </Alert>

          <div className="rounded-panel border border-border bg-card">
            <Row
              icon={Mic}
              label="語音輸入（STT）"
              hint="device native · 粵語 zh-HK · 音頻唔上傳"
              checked={settings.stt}
              onChange={(v) => updateSettings({ stt: v })}
            />
            <Row
              icon={Volume2}
              label="語音回覆（TTS）"
              hint="AWS Polly · mp3"
              checked={settings.tts}
              onChange={(v) => updateSettings({ tts: v })}
            />
            <Row
              icon={Bell}
              label="完成推播"
              hint="APNs / FCM · 附 Polly 語音"
              checked={settings.push}
              onChange={(v) => updateSettings({ push: v })}
            />
            <Row
              icon={Moon}
              label="安靜模式"
              hint="只推文字，唔播語音"
              checked={settings.quiet}
              onChange={(v) => updateSettings({ quiet: v })}
            />
            <Row
              icon={PencilLine}
              label="語音送出前先編輯"
              hint="關（預設）＝ 放開「按住說話」即傳送；開 = 轉成文字先改再送出"
              checked={settings.editBeforeSend}
              onChange={(v) => updateSettings({ editBeforeSend: v })}
            />
          </div>

          <div className="rounded-panel border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <KeyRound className="size-4 text-muted-foreground" /> 認證
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              自製 API token（單用戶）· 介面係 AuthProvider，日後可換 Cognito
            </div>
            <div className="mt-2 rounded-control bg-muted px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
              va_live_••••••••••••4f2c
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline">
                更換 token
              </Button>
              <Button size="sm" variant="ghost">
                重新授權
              </Button>
            </div>
          </div>

          <div className="rounded-panel border border-border bg-card p-3 text-[11px] text-muted-foreground">
            <div>Agent 狀態：{agentStatus === "offline" ? "離線" : "就緒"}</div>
            <div>Workspace：~/agent-workspace（喺桌面版改）</div>
            <div>Pi SDK session：s-1（14 則訊息）</div>
          </div>
        </div>

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
      </div>
    </div>
  );
}
