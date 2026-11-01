import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex items-start gap-2 rounded-control border px-3 py-2 text-xs",
  {
    variants: {
      variant: {
        info: "border-primary/25 bg-primary/8 text-primary",
        warning: "border-warning/35 bg-warning/12 text-[#8a5a00]",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive",
        success: "border-accent/30 bg-accent/10 text-accent",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div className={cn(alertVariants({ variant }), className)} {...props} />;
}
