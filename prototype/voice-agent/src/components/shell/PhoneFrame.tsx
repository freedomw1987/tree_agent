import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 手機外壳（390×844）—— 只喺 desktop-mac / home 頁用；mobile-app route 係全屏 */
export function PhoneFrame({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[44px] border-[10px] border-[#16181d] bg-background shadow-pop">
        <div className="absolute left-1/2 top-0 z-20 h-6 w-28 -translate-x-1/2 rounded-b-xl bg-[#16181d]" />
        <div className="flex h-full flex-col">
          <div className="flex h-8 shrink-0 items-center justify-between px-6 pt-1 text-[11px] font-semibold text-foreground">
            <span>9:41</span>
            <span className="tracking-tight">●●● ⌁ ▮</span>
          </div>
          {children}
        </div>
        <div className="absolute bottom-1.5 left-1/2 h-1 w-32 -translate-x-1/2 rounded-full bg-[#16181d]/30" />
      </div>
      {label ? <div className="text-xs text-muted-foreground">{label}</div> : null}
    </div>
  );
}
