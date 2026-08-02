import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Badges are read as status chips all over this ERP. They get a gap and an
  // icon size so a chip with an icon lines up, `whitespace-nowrap` so a status
  // never wraps into two lines inside a table cell, and no drop shadow — a
  // 20px chip with a shadow just looks smudged.
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-0.5 text-xs font-semibold leading-5 transition-colors duration-(--dur-fast) [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/85",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
