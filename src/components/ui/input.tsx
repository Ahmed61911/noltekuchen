import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        // The field itself now reacts: the border warms on hover and turns the
        // brand colour on focus, so the input is legible as "active" even
        // before you read the focus ring. The ring itself is the single global
        // one from styles.css — v1.0 stacked a second, thinner ring here.
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-(--elev-1) transition-[color,border-color,box-shadow] duration-(--dur-fast) ease-(--ease-out) file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/70 hover:border-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/40 disabled:opacity-60 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
