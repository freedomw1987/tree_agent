import { useMemo } from "react";
import type { ComponentType } from "react";
import { DesktopShell } from "@/components/shell/DesktopShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/mock/store";
import { fmtTime } from "@/lib/utils";
import { TrendingUp, Clock3, ListChecks } from "lucide-react";

const WPM = 40; // 打字速度假設（字/分鐘），可配置

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-1">
        <Icon className="size-4 text-primary" />
        <CardTitle className="text-xs">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

export function useDailyStats() {
  const tasks = useDemoStore((s) => s.tasks);
  return useMemo(() => {
    const completed = tasks.filter((t) => t.status === "completed");
    const seconds = completed.reduce((acc, t) => {
      const m = /(\d+)\s*秒/.exec(t.elapsed ?? "");
      const min = /(\d+)\s*分/.exec(t.elapsed ?? "");
      return acc + (m ? Number(m[1]) : 0) + (min ? Number(min[1]) * 60 : 0);
    }, 0);
    const savedMinutes = Math.round((completed.length * 90) / WPM);
    return { completed, savedMinutes, seconds };
  }, [tasks]);
}

export function DailyStatsList({ compact = false }: { compact?: boolean }) {
  const tasks = useDemoStore((s) => s.tasks);
  const demoMode = useDemoStore((s) => s.demoMode);
  const { completed } = useDailyStats();

  if (demoMode === "empty" || (tasks.length === 0 && demoMode !== "loading")) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <ListChecks className="size-6 text-muted-foreground" />
        <div className="text-xs font-medium">今日仲未完成任何任務</div>
        <p className="max-w-[220px] text-[11px] text-muted-foreground">
          用講嘅方式派第一個任務（例如「幫我寫封 email 俾客戶」），完成咗就會喺度計數。
        </p>
        <Button size="sm" variant="outline">
          去派任務
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 rounded-control border border-border bg-card px-3 py-2 text-xs"
        >
          <Badge
            variant={
              t.status === "completed"
                ? "success"
                : t.status === "failed"
                  ? "destructive"
                  : t.status === "awaiting_confirm"
                    ? "warning"
                    : "secondary"
            }
          >
            {t.status === "completed"
              ? "完成"
              : t.status === "failed"
                ? "失敗"
                : t.status === "awaiting_confirm"
                  ? "等你確認"
                  : t.status === "running"
                    ? "執行中"
                    : "排隊"}
          </Badge>
          <span className="min-w-0 flex-1 truncate">{t.title}</span>
          {!compact && t.elapsed ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock3 className="size-3" />
              {t.elapsed}
            </span>
          ) : null}
          <span className="text-[11px] text-muted-foreground">{fmtTime(t.createdAt)}</span>
        </div>
      ))}
      {completed.length === 0 && (
        <div className="text-[11px] text-muted-foreground">暫時未有完成嘅任務。</div>
      )}
    </div>
  );
}

export function MobileStats() {
  const { completed, savedMinutes } = useDailyStats();
  const demoMode = useDemoStore((s) => s.demoMode);

  return (
    <div className="flex min-h-screen justify-center bg-muted/40 py-6">
      <div className="flex h-[844px] w-[390px] flex-col overflow-hidden bg-background shadow-card md:rounded-panel md:border md:border-border">
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-card px-4">
          <span className="text-sm font-semibold">每日任務數</span>
          <span className="ml-auto text-[11px] text-muted-foreground">核心指標</span>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-[11px] text-muted-foreground">今日完成任務</div>
              <div className="text-4xl font-semibold tabular-nums">{completed.length}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                目標：每日 ≥ 3 個任務
              </div>
              <Progress
                value={(completed.length / 3) * 100}
                className="mt-2"
                barClassName={completed.length >= 3 ? "bg-accent" : "bg-primary"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-[11px] text-muted-foreground">估算節省輸入時間</div>
              <div className="text-2xl font-semibold tabular-nums">
                {demoMode === "loading" ? "—" : `${savedMinutes} 分鐘`}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                按每個任務約 90 字輸入、40 字/分鐘估算
              </div>
            </CardContent>
          </Card>

          <div className="text-[11px] font-medium text-muted-foreground">今日明細</div>
          <DailyStatsList compact />
        </div>
      </div>
    </div>
  );
}

export function DesktopStats() {
  const { completed, savedMinutes } = useDailyStats();
  return (
    <DesktopShell title="統計" subtitle="每日任務數 = 核心成功指標">
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={ListChecks}
          label="今日完成任務"
          value={String(completed.length)}
          hint="目標 ≥ 3 / 日"
        />
        <StatCard
          icon={Clock3}
          label="估算節省輸入時間"
          value={`${savedMinutes} 分鐘`}
          hint="40 字/分鐘 × 90 字/任務"
        />
        <StatCard
          icon={TrendingUp}
          label="7 日走勢"
          value="2 → 4 → 3 → 5 → 6 → 5 → 7"
          hint="（demo 假數據）"
        />
      </div>
      <div className="mt-4">
        <div className="mb-2 text-xs font-medium">今日明細</div>
        <DailyStatsList />
      </div>
    </DesktopShell>
  );
}
