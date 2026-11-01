import * as React from "react";
import { Tooltip as RTooltip } from "radix-ui";
import { cn } from "@/lib/utils";

export const TooltipProvider = RTooltip.Provider;
export const Tooltip = RTooltip.Root;
export const TooltipTrigger = RTooltip.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof RTooltip.Content>) {
  return (
    <RTooltip.Portal>
      <RTooltip.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-control bg-foreground px-2 py-1 text-[11px] text-background shadow-pop",
          className,
        )}
        {...props}
      />
    </RTooltip.Portal>
  );
}
