import * as React from "react";
import { Tabs as RTabs } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = RTabs.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof RTabs.List>) {
  return (
    <RTabs.List
      className={cn(
        "inline-flex items-center gap-1 rounded-control bg-muted p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cn(
        "rounded-control px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof RTabs.Content>) {
  return <RTabs.Content className={cn("mt-3 focus-visible:outline-none", className)} {...props} />;
}
