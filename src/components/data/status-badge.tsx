import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * One status rendering for the whole ERP.
 *
 * v1.0 had three systems side by side: hard-coded Tailwind palettes
 * (`bg-amber-500/15 text-amber-700`), filled `variant="destructive"` badges,
 * and token pairs (`bg-warning/10 text-warning`). The palette one had no dark
 * variant on the payment table, so "Payée" came out green-700 on a dark
 * surface — around 2.4:1, unreadable. Everything here is built from tokens, so
 * a theme switch carries it automatically.
 *
 * Always outline + tint, never a solid fill: solid is reserved for the primary
 * action of a screen, and a status must never look like something to click.
 */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export const statusToneClasses: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-info/25 bg-info/10 text-info",
  success: "border-success/25 bg-success/10 text-success",
  // `--warning` is a light amber *fill* token that ships with its own dark
  // foreground, so `text-warning` would put amber on near-white at ~1.7:1.
  // Light mode takes the foreground made to sit on that amber; dark mode
  // flips the pair, where the light amber is the readable one.
  warning:
    "border-warning/50 bg-warning/20 text-warning-foreground dark:border-warning/40 dark:bg-warning/15 dark:text-warning",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
};

export function StatusBadge({
  tone = "neutral",
  label,
  className,
}: {
  tone?: StatusTone;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(statusToneClasses[tone], className)}>
      {label}
    </Badge>
  );
}
