import { TerminalLine, TerminalPrompt, TerminalShell } from "@/components/shell/TerminalShell";
import { useDemoStore } from "@/mock/store";
import { fmtTime } from "@/lib/utils";

export default function TerminalConsole() {
  const lines = useDemoStore((s) => s.consoleLines);
  const relay = useDemoStore((s) => s.relay);
  const agentStatus = useDemoStore((s) => s.agentStatus);
  const demoMode = useDemoStore((s) => s.demoMode);

  return (
    <TerminalShell>
      <div className="text-[#7D8590]">
        sidecar v0.1 · node {`${20}`}.x · Pi SDK session ok · workspace=~/agent-workspace
      </div>
      <div className="text-[#7D8590]">
        transport = app-sync-events (demo) · auth = client-credentials · agent = {agentStatus}
      </div>

      <div className="mt-3 space-y-0.5">
        {lines.map((l) => (
          <div key={l.id} className="flex gap-2">
            <span className="shrink-0 text-[#4D5560]">{fmtTime(l.ts)}</span>
            <TerminalLine kind={l.kind}>{l.text}</TerminalLine>
          </div>
        ))}
        {demoMode === "error" && (
          <div className="flex gap-2">
            <span className="shrink-0 text-[#4D5560]">{fmtTime(new Date())}</span>
            <TerminalLine kind="error">[error] relay unreachable · retrying with backoff…</TerminalLine>
          </div>
        )}
      </div>

      <div className="mt-4 text-[#7D8590]">── relay 送達紀錄 ─────────────</div>
      <div className="space-y-0.5">
        {relay.length === 0 ? (
          <div className="text-[#7D8590]">未有送達紀錄</div>
        ) : (
          relay.map((r) => (
            <div key={r.id} className="flex gap-2">
              <span className="shrink-0 text-[#4D5560]">{fmtTime(r.ts)}</span>
              <TerminalLine
                kind={r.state === "error" ? "error" : r.state === "deduped" ? "blocked" : "relay"}
              >
                {r.dir === "in" ? "→" : "←"} {r.detail} [{r.state}]
              </TerminalLine>
            </div>
          ))
        )}
      </div>

      <TerminalPrompt>ps aux | grep pi-sdk</TerminalPrompt>
      <div className="text-[#C9D1D9]">davidchu 18244 0.4 12.1 0:04.12 /usr/local/bin/node sidecar.js</div>
    </TerminalShell>
  );
}
