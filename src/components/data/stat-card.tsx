import type { LucideIcon } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "info" | "success" | "warning" | "danger";

const iconTone: Record<StatTone, string> = {
  default: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  // Same reasoning as StatusBadge: `--warning` is a light amber fill token,
  // so the glyph takes the foreground built for it and swaps in dark mode.
  warning: "bg-warning/25 text-warning-foreground dark:bg-warning/20 dark:text-warning",
  danger: "bg-destructive/10 text-destructive",
};

/**
 * The single statistic card. It replaces three near-identical local copies
 * (`StatCard` on products, `Kpi` on orders and sales, `KpiCard` on invoices)
 * that differed in height, icon size and label case — enough to make the
 * banner jump when moving from one screen to the next.
 *
 * Interactivity is opt-in: passing `onClick` is what makes it a real button
 * (role, tab stop, `aria-pressed`, keyboard activation). Cards that were not
 * clickable in v1.0 stay inert — turning them into filters would be a
 * behaviour change, not a visual one.
 *
 * While loading, the value is a skeleton bar rather than a `0`: a zero reads
 * as data, and it is a lie until the query resolves.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
  onClick,
  active,
  loading,
  dense,
}: {
  icon: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  tone?: StatTone;
  onClick?: () => void;
  active?: boolean;
  loading?: boolean;
  /** For currency values, which never fit at `text-2xl` in a five-card row. */
  dense?: boolean;
}) {
  const interactive = typeof onClick === "function";

  const activate = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      onClick={onClick}
      onKeyDown={interactive ? activate : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? !!active : undefined}
      className={cn(
        "flex h-[76px] items-center gap-3 px-4 py-3",
        // A clickable card carries a firmer border even at rest, so the
        // affordance does not depend on hovering it first.
        interactive
          ? "cursor-pointer border-border hover:shadow-(--elev-2)"
          : "border-border/70",
        active && "border-primary/70 bg-primary/5 ring-1 ring-primary",
      )}
    >
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", iconTone[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="micro-label truncate">{label}</p>
        {loading ? (
          <div className="skeleton mt-1.5 h-5 w-20" aria-hidden="true" />
        ) : (
          <p
            className={cn(
              "truncate font-display font-semibold leading-tight tabular-nums",
              dense ? "text-lg" : "text-2xl",
            )}
          >
            {value}
          </p>
        )}
      </div>
    </Card>
  );
}
