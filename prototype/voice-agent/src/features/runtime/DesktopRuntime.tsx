import { useState } from "react";
import { Cpu, FolderOpen, RotateCcw, Server, ShieldCheck } from "lucide-react";
import { DesktopShell } from "@/components/shell/DesktopShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useDemoStore } from "@/mock/store";
import { AgentStatusPill } from "@/features/chat/parts";
import { fmtTime } from "@/lib/utils";

export default function DesktopRuntime() {
  const agentStatus = useDemoStore((s) => s.agentStatus);
  const setAgentStatus = useDemoStore((s) => s.setAgentStatus);
  const workspace = useDemoStore((s) => s.workspace);
  const setWorkspace = useDemoStore((s) => s.setWorkspace);
  const sessions = useDemoStore((s) => s.sessions);
  const demoMode = useDemoStore((s) => s.demoMode);
  const [draftWs, setDraftWs] = useState(workspace);

  return (
    <DesktopShell
      title="Agent"
      subtitle="Mac sidecar + Pi SDK runtime（M03）"
      actions={<AgentStatusPill status={agentStatus} />}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Cpu className="size-4 text-primary" />
            <CardTitle>Sidecar 狀態</CardTitle>
            <Badge className="ml-auto" variant={agentStatus === "offline" ? "warning" : "success"}>
              {agentStatus === "offline" ? "offline" : "running"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {demoMode === "loading" ? (
              <div className="space-y-2">
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pi SDK session</span>
                  <span className="font-mono">session-7f3a · ok</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">啟動時間</span>
                  <span>今日 09:12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">崩潰自動重啟</span>
                  <span>已啟用（≤ 5 秒）</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sidecar 身份</span>
                  <span className="inline-flex items-center gap-1 text-accent">
                    <ShieldCheck className="size-3.5" /> 獨立憑證（唔用 App token）
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <FolderOpen className="size-4 text-primary" />
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardDescription className="px-4">Agent 可以操作嘅目錄（檔案工具鎖死喺呢度）</CardDescription>
          <CardContent className="space-y-2">
            <Input value={draftWs} onChange={(e) => setDraftWs(e.target.value)} className="font-mono text-xs" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setWorkspace(draftWs)}>
                套用
              </Button>
              <Button size="sm" variant="outline">
                選擇資料夾
              </Button>
            </div>
            {workspace !== "~/agent-workspace" && (
              <Alert variant="info">已切換到 {workspace}（session cwd 會跟住變）</Alert>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Server className="size-4 text-primary" />
            <CardTitle>Sessions</CardTitle>
            <CardDescription className="ml-2">保留喺 Mac 本地，唔上雲</CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                仲未有 session — 用手機派第一個任務就會開一個。
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-1.5">標題</th>
                    <th className="py-1.5">開始</th>
                    <th className="py-1.5">訊息</th>
                    <th className="py-1.5">狀態</th>
                    <th className="py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="py-2 font-medium">{s.title}</td>
                      <td className="py-2 text-muted-foreground">{fmtTime(s.startedAt)}</td>
                      <td className="py-2 text-muted-foreground">{s.messages}</td>
                      <td className="py-2">
                        <Badge variant={s.state === "active" ? "success" : "secondary"}>{s.state}</Badge>
                      </td>
                      <td className="py-2 text-right">
                        <Button size="sm" variant="ghost">
                          重啟
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Demo 開關</CardTitle>
            <CardDescription>用嚟重現真實場景（原型專用）</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={agentStatus === "offline" ? "destructive" : "outline"}
              onClick={() => setAgentStatus(agentStatus === "offline" ? "ready" : "offline")}
            >
              {agentStatus === "offline" ? "令 Agent 離線" : "模擬 Agent 離線"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAgentStatus("busy")}>
              模擬做緊嘢
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAgentStatus("ready")}>
              回到就緒
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
              <RotateCcw className="size-3.5" /> 重載
            </Button>
          </CardContent>
        </Card>
      </div>
    </DesktopShell>
  );
}
