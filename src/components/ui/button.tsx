import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Transitions now cover shadow and transform as well as colour: a button that
  // lifts a little and deepens its shadow reads as pressable, which a pure
  // colour swap never did. Focus is deliberately NOT handled here — the single
  // global focus ring in styles.css owns it, so we no longer stack two rings.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-(--dur-fast) ease-(--ease-out) active:translate-y-px disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // The brand glow is reserved for the primary action, and only on hover,
        // so "the main thing to do on this screen" stays legible at a glance.
        default:
          "bg-primary text-primary-foreground shadow-(--elev-1) hover:bg-primary/90 hover:shadow-(--elev-brand)",
        destructive:
          "bg-destructive text-destructive-foreground shadow-(--elev-1) hover:bg-destructive/90 hover:shadow-(--elev-2)",
        outline:
          "border border-input bg-background shadow-(--elev-1) hover:border-primary/40 hover:bg-accent hover:text-accent-foreground hover:shadow-(--elev-2)",
        secondary:
          "bg-secondary text-secondary-foreground shadow-(--elev-1) hover:bg-secondary/80 hover:shadow-(--elev-2)",
        ghost: "hover:bg-accent hover:text-accent-foreground active:translate-y-0",
        link: "text-primary underline-offset-4 hover:underline active:translate-y-0",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
