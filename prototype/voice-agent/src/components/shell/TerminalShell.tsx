import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function TerminalShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen min-h-[560px] flex-col bg-[#0B0D12] font-mono text-[13px] leading-[1.55] text-[#C9D1D9]">
      <div className="flex shrink-0 items-center gap-3 border-b border-[#1B2029] px-4 py-2 text-[12px] text-[#7D8590]">
        <span className="size-2.5 rounded-full bg-[#FF5F57]" />
        <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="size-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-2">sidecar — pi-sdk-runtime</span>
        <Link to="/" className="ml-auto text-[#58A6FF] hover:underline">
          exit demo
        </Link>
      </div>
      <div className="term-scroll min-h-0 flex-1 overflow-auto px-4 py-3">{children}</div>
    </div>
  );
}

export function TerminalLine({
  kind,
  children,
  className,
}: {
  kind: "relay" | "stream" | "tool" | "blocked" | "error" | "info";
  children: ReactNode;
  className?: string;
}) {
  const color = {
    relay: "text-[#58A6FF]",
    stream: "text-[#C9D1D9]",
    tool: "text-[#E3B341]",
    blocked: "text-[#FF7B72]",
    error: "text-[#FF7B72]",
    info: "text-[#7D8590]",
  }[kind];
  return (
    <div className={cn("whitespace-pre-wrap", color, className)}>{children}</div>
  );
}

export function TerminalPrompt({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex gap-2 text-[#7D8590]">
      <span className="text-[#7EE787]">agent-workspace %</span>
      <span className="text-[#C9D1D9]">{children}</span>
    </div>
  );
}
