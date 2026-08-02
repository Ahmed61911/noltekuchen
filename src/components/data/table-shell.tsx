import type { CSSProperties, ReactNode } from "react";

import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * The one container for a list table.
 *
 * v1.0 had two: products used `Card` + `Table`, orders and invoices used
 * `Card p-4` + `div.rounded-md.border` + `Table` — a double border, a table
 * inset by 16px and a different density on every other screen. Here the card
 * *is* the frame: no padding, no inner border.
 *
 * `.table-scroll` (styles.css) bounds the scroll area the Table primitive
 * already creates and makes the column header sticky inside it. `--table-offset`
 * is what sits above the table on that screen (page header, stat cards, filter
 * bar), so the table ends exactly at the bottom of the window.
 */
export function TableShell({
  children,
  offset = "22rem",
  className,
}: {
  children: ReactNode;
  offset?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("surface table-scroll overflow-hidden", className)}
      style={{ "--table-offset": offset } as CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Loading, empty and error states all live in the same box, inside the table
 * shell, with the column header still in place — so nothing jumps when the
 * data lands.
 */
export function TableStateRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0 text-center">
        {children}
      </TableCell>
    </TableRow>
  );
}
