import * as React from "react";
import { Separator as RSeparator } from "radix-ui";
import { cn } from "@/lib/utils";

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof RSeparator.Root>) {
  return (
    <RSeparator.Root
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}
