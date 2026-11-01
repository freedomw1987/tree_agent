import { Link } from "react-router-dom";
import { Smartphone, Monitor, Terminal, ArrowRight } from "lucide-react";
import { PhoneFrame } from "@/components/shell/PhoneFrame";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const surfaces = [
  {
    to: "/m/chat",
    icon: Smartphone,
    name: "mobile-app",
    desc: "手機 App（iOS / Android）· 對話、語音輸入、確認卡、統計",
  },
  {
    to: "/d/chat",
    icon: Monitor,
    name: "desktop-mac",
    desc: "macOS App · 對話、Agent 狀態、audit log、統計",
  },
  {
    to: "/t/console",
    icon: Terminal,
    name: "cli-terminal",
    desc: "sidecar console · streaming、relay 送達、風險閘攔截",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Badge variant="default">設計期原型 · mock data</Badge>
        <h1 className="mt-3 text-2xl font-semibold">Voice Agent App — 系統 Demo</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          三個 Surface（mobile-app / desktop-mac / cli-terminal）共用同一套 design tokens ＋ 單一 mock store。
          右上角「Demo 路線」面板可以逐步行完 8 步跨 Surface 流程；面板仲有「五狀態切換器」（Happy / Loading / Empty / Error / Edge）。
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {surfaces.map((s) => (
            <Link key={s.to} to={s.to}>
              <Card className="h-full transition-shadow hover:shadow-pop">
                <CardHeader className="flex-row items-center gap-2 space-y-0">
                  <s.icon className="size-4 text-primary" />
                  <CardTitle>{s.name}</CardTitle>
                  <ArrowRight className="ml-auto size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <CardDescription>{s.desc}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <div className="mb-3 text-xs font-medium text-muted-foreground">預覽：mobile-app</div>
          <PhoneFrame label="390 × 844 · iOS">
            <div className="flex flex-1 flex-col bg-background">
              <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
                <span className="text-sm font-semibold">Voice Agent</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent">
                  <span className="size-1.5 rounded-full bg-accent" /> Agent 已就緒
                </span>
              </div>
              <div className="flex-1 space-y-3 p-3">
                <div className="flex justify-end">
                  <div className="max-w-[78%] rounded-panel rounded-br-md bg-user-bubble px-3 py-2 text-[13px] text-primary-foreground">
                    幫我寫封 email 俾客戶講明延遲兩日交付
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="mt-1 flex size-7 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary">
                    AI
                  </div>
                  <div className="max-w-[78%] rounded-panel rounded-bl-md border border-border bg-agent-bubble px-3 py-2 text-[13px]">
                    搞掂咗，交付物喺下面 👇
                  </div>
                </div>
                <div className="w-full max-w-[78%] rounded-panel border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium">寫 email 草稿</span>
                    <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[11px] text-accent">完成</span>
                  </div>
                  <div className="mt-2 rounded-control bg-muted p-2 text-[11px] text-muted-foreground">
                    標題：關於交付日期調整（延遲 2 日）…
                  </div>
                </div>
              </div>
              <div className="border-t border-border bg-card p-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-11 flex-1 rounded-full bg-muted" />
                  <div className="size-14 rounded-full bg-primary shadow-card ring-4 ring-primary/15" />
                </div>
              </div>
            </div>
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}
