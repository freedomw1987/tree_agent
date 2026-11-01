import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  MessageSquare,
  Cpu,
  Wrench,
  BarChart3,
  Smartphone,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/d/chat", label: "對話", icon: MessageSquare },
  { to: "/d/runtime", label: "Agent", icon: Cpu },
  { to: "/d/tools", label: "工具", icon: Wrench },
  { to: "/d/stats", label: "統計", icon: BarChart3 },
];

export function DesktopShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex h-screen min-h-[640px] w-full bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">Voice Agent</div>
          <div className="text-[11px] text-muted-foreground">macOS App（demo）</div>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-control px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <n.icon className="size-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-border p-2">
          <NavLink
            to="/m/chat"
            className="flex items-center gap-2 rounded-control px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
          >
            <Smartphone className="size-4" /> 手機 App
          </NavLink>
          <NavLink
            to="/t/console"
            className="flex items-center gap-2 rounded-control px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
          >
            <Terminal className="size-4" /> sidecar console
          </NavLink>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-card px-5 py-3">
          <div>
            <h1 className="text-sm font-semibold">{title}</h1>
            {subtitle ? (
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {actions}
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-5">{children}</main>
      </div>
    </div>
  );
}
