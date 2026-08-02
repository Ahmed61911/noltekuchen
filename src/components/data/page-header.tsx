import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The header of a list or detail screen: where am I, what can I do here.
 *
 * The title drops from `text-2xl`/`text-3xl` to `text-xl`, which gives back
 * roughly ten pixels of table on every screen. This is an internal tool — the
 * title confirms where you are, it does not need to impress.
 *
 * Actions go to the *end* side through `ms-auto`, never `ml-auto`, so they
 * follow the reading direction in Arabic.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold leading-7 tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="text-xs leading-4 text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:ms-auto">{actions}</div>
      ) : null}
    </div>
  );
}
