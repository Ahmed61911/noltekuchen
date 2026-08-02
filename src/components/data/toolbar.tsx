import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The filter bar of a list screen: one card, one row, one order —
 * search, choice filters, date filters, reset, counter.
 */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn("p-3", className)}>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </Card>
  );
}

/**
 * The one search field of the app.
 *
 * v1.0 wrote `absolute left-2` with `pl-8` on orders, sales, invoices and
 * customers: in Arabic the magnifier stayed on the left while the text started
 * on the right, so the icon sat on top of what was being typed. Logical
 * `start-2.5` / `ps-9` mirrors on its own.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ps-9"
      />
    </div>
  );
}

/** `{shown} / {total}`, pushed to the end side of the toolbar. */
export function ResultCount({ shown, total }: { shown: number; total: number }) {
  return (
    <span className="ms-auto text-xs tabular-nums text-muted-foreground">
      {shown} / {total}
    </span>
  );
}
