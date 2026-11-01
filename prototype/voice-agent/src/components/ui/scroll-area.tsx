import * as React from "react";
import { ScrollArea as RScrollArea } from "radix-ui";
import { cn } from "@/lib/utils";

export function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RScrollArea.Root>) {
  return (
    <RScrollArea.Root className={cn("relative overflow-hidden", className)} {...props}>
      <RScrollArea.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </RScrollArea.Viewport>
      <RScrollArea.Scrollbar
        orientation="vertical"
        className="flex w-2 touch-none select-none p-0.5"
      >
        <RScrollArea.Thumb className="flex-1 rounded-full bg-border" />
      </RScrollArea.Scrollbar>
    </RScrollArea.Root>
  );
}
