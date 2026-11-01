import * as React from "react";
import { DropdownMenu as RDropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";

export const DropdownMenu = RDropdownMenu.Root;
export const DropdownMenuTrigger = RDropdownMenu.Trigger;

export function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof RDropdownMenu.Content>) {
  return (
    <RDropdownMenu.Portal>
      <RDropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-40 overflow-hidden rounded-panel border border-border bg-card p-1 shadow-pop",
          className,
        )}
        {...props}
      />
    </RDropdownMenu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof RDropdownMenu.Item>) {
  return (
    <RDropdownMenu.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-xs text-foreground outline-none data-[highlighted]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof RDropdownMenu.Label>) {
  return (
    <RDropdownMenu.Label
      className={cn("px-2 py-1 text-[11px] text-muted-foreground", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof RDropdownMenu.Separator>) {
  return (
    <RDropdownMenu.Separator className={cn("my-1 h-px bg-border", className)} {...props} />
  );
}
