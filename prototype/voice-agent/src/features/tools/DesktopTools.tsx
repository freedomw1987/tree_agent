import { useState } from "react";
import { Wrench, ShieldCheck, AlertTriangle } from "lucide-react";
import { DesktopShell } from "@/components/shell/DesktopShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useDemoStore } from "@/mock/store";
import { RiskBadge } from "@/features/chat/parts";
import { fmtTime } from "@/lib/utils";

const rules = [
  { tool: "delivery_plan.read", risk: "read_only", note: "只讀 → 自動執行" },
  { tool: "workspace.read / search", risk: "read_only", note: "路徑鎖死喺 Workspace" },
  { tool: "workspace.write_file", risk: "write", note: "先出確認卡（顯示 diff）" },
  { tool: "terminal.exec", risk: "write", note: "非唯讀命令先確認" },
  { tool: "terminal.exec（黑名單）", risk: "external_effect", note: "rm -rf / sudo / curl|sh 一定確認" },
  { tool: "github.create_issue（示例）", risk: "external_effect", note: "外部副作用先確認" },
];

export default function DesktopTools() {
  const audit = useDemoStore((s) => s.audit);
  const demoMode = useDemoStore((s) => s.demoMode);
  const [filter, setFilter] = useState("");

  const rows = audit.filter((a) => a.tool.toLowerCase().includes(filter.toLowerCase()));

  return (
    <DesktopShell
      title="工具"
      subtitle="audit log + Risk Gate 規則（M04 / M05）"
      actions={
        <div className="w-56">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="過濾工具名…"
            className="h-8 text-xs"
          />
        </div>
      }
    >
      {demoMode === "empty" ? (
        <Alert variant="info">
          <span>仲未有工具註冊 —— 呢個係 M05 批次之後先有內容。</span>
        </Alert>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Wrench className="size-4 text-primary" />
            <CardTitle>Audit log</CardTitle>
            <Badge variant="secondary" className="ml-auto">
              {rows.length} 筆
            </Badge>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                未有工具調用紀錄。
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-1.5">時間</th>
                    <th className="py-1.5">工具</th>
                    <th className="py-1.5">風險</th>
                    <th className="py-1.5">參數摘要</th>
                    <th className="py-1.5">結果</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-t border-border align-top">
                      <td className="py-2 text-muted-foreground">{fmtTime(a.ts)}</td>
                      <td className="py-2 font-mono text-[11px]">{a.tool}</td>
                      <td className="py-2">
                        <RiskBadge risk={a.risk} />
                      </td>
                      <td className="py-2 font-mono text-[10px] text-muted-foreground">{a.args}</td>
                      <td className="py-2 text-muted-foreground">{a.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <ShieldCheck className="size-4 text-accent" />
            <CardTitle>Risk Gate 規則</CardTitle>
          </CardHeader>
          <CardDescription className="px-4">M04 決定，M05 只准照住做</CardDescription>
          <CardContent className="space-y-2">
            {rules.map((r) => (
              <div key={r.tool} className="rounded-control border border-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px]">{r.tool}</span>
                  <RiskBadge risk={r.risk as "read_only" | "write" | "external_effect"} />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{r.note}</div>
              </div>
            ))}
            <Alert variant="warning">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>確認卡 5 分鐘有效；取消 = 最終拒絕（唔會自動重試）。</span>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="outline">
          匯出 audit log（CSV）
        </Button>
      </div>
    </DesktopShell>
  );
}
