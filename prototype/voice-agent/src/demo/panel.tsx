import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ListOrdered, RotateCcw, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDemoStore, type DemoMode } from "@/mock/store";
import { demoSteps } from "./routes";

const modes: { key: DemoMode; label: string; hint: string }[] = [
  { key: "happy", label: "Happy", hint: "正常流程" },
  { key: "loading", label: "Loading", hint: "骨架屏 / CTA disable" },
  { key: "empty", label: "Empty", hint: "零資料畫面" },
  { key: "error", label: "Error", hint: "具體錯誤 + 修正建議" },
  { key: "edge", label: "Edge", hint: "聽唔清 / 超時 / 危險命令" },
];

export default function DemoPanel() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const step = useDemoStore((s) => s.step);
  const setStep = useDemoStore((s) => s.setStep);
  const demoMode = useDemoStore((s) => s.demoMode);
  const setDemoMode = useDemoStore((s) => s.setDemoMode);
  const reset = useDemoStore((s) => s.reset);
  const agentStatus = useDemoStore((s) => s.agentStatus);
  const setAgentStatus = useDemoStore((s) => s.setAgentStatus);

  const go = (i: number) => {
    const clamped = Math.max(0, Math.min(demoSteps.length - 1, i));
    const s = demoSteps[clamped];
    setStep(clamped);
    s.run?.();
    navigate(s.route);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-xs font-medium text-background shadow-pop hover:opacity-90"
      >
        <ListOrdered className="size-4" />
        Demo 路線（{step + 1}/{demoSteps.length}）
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-pop">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Demo 路線面板</div>
                <div className="text-[11px] text-muted-foreground">
                  8 步 · 跨 3 個 Surface · 同一個 mock store
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-control p-1 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
              <div>
                <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">五狀態切換（DoD-Full）</div>
                <div className="flex flex-wrap gap-1.5">
                  {modes.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setDemoMode(m.key)}
                      title={m.hint}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        demoMode === m.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-foreground hover:text-background"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">路線步驟</div>
                <ol className="space-y-1.5">
                  {demoSteps.map((s, i) => (
                    <li key={s.id}>
                      <button
                        onClick={() => go(i)}
                        className={`w-full rounded-control border p-2.5 text-left transition-colors ${
                          i === step
                            ? "border-primary/40 bg-primary/8"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">{s.id}</span>
                          <span className="text-xs font-medium">{s.title}</span>
                          <Badge variant="secondary" className="ml-auto shrink-0">
                            {s.surface}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11px] leading-[1.45] text-muted-foreground">{s.say}</p>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <footer className="space-y-2 border-t border-border p-4">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => go(step - 1)} disabled={step === 0}>
                  <ChevronLeft className="size-3.5" /> 上一步
                </Button>
                <Button size="sm" className="flex-1" onClick={() => go(step + 1)} disabled={step === demoSteps.length - 1}>
                  下一步 <ChevronRight className="size-3.5" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setAgentStatus(agentStatus === "offline" ? "ready" : "offline")}
                >
                  <Sparkles className="size-3.5" />
                  {agentStatus === "offline" ? "Agent 返嚟" : "模擬 Agent 離線"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { reset(); setStep(0); navigate("/"); }}>
                  <RotateCcw className="size-3.5" /> 重設資料
                </Button>
              </div>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
