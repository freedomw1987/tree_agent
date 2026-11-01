import * as React from "react";
import { Dialog as RDialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = RDialog.Root;
export const SheetTrigger = RDialog.Trigger;
export const SheetClose = RDialog.Close;

export function SheetContent({
  className,
  side = "right",
  children,
  ...props
}: React.ComponentProps<typeof RDialog.Content> & { side?: "right" | "bottom" | "left" }) {
  return (
    <RDialog.Portal>
      <RDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <RDialog.Content
        className={cn(
          "fixed z-50 flex flex-col bg-card shadow-pop focus:outline-none",
          side === "right" && "inset-y-0 right-0 h-full w-full max-w-md border-l",
          side === "left" && "inset-y-0 left-0 h-full w-full max-w-md border-r",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[85vh] rounded-t-panel border-t",
          className,
        )}
        {...props}
      >
        {children}
      </RDialog.Content>
    </RDialog.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between p-4 pb-2", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.ComponentProps<typeof RDialog.Title>) {
  return (
    <RDialog.Title className={cn("text-sm font-semibold", className)} {...props} />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof RDialog.Description>) {
  return (
    <RDialog.Description className={cn("text-xs text-muted-foreground", className)} {...props} />
  );
}

export function SheetCloseButton() {
  return (
    <RDialog.Close className="rounded-control p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none">
      <X className="size-4" />
      <span className="sr-only">關閉</span>
    </RDialog.Close>
  );
}
