import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The pagination of the whole application — one hook, one bar, twelve screens.
 *
 * Until now no list was paginated: products, orders, sales and invoices
 * rendered every row they had, and stock cut at `.limit(200)` with no offset,
 * so the 201st movement simply did not exist for the user.
 *
 * Two shapes, one API:
 *  - client side (the screen already holds every row and filters in memory):
 *    `usePagination({ total: filtered.length, resetKey })` then
 *    `pagination.slice(filtered)`;
 *  - server side (`stock`): the same hook feeds `rangeStart` / `rangeEnd` to
 *    `.range()`, and `total` comes back from `count: "exact"`.
 *
 * In both cases the filters run on the *whole* set, never on the page — the
 * classic trap of paginating first and searching afterwards.
 *
 * `src/components/ui/pagination.tsx` (the shadcn primitive) is deliberately not
 * used: it renders `<a>` without href, hard-codes "Previous" / "Next" in
 * English and lays out with `pl-2.5` / `pr-2.5`, which cannot mirror in Arabic.
 * Two competing systems would be worse than one, so it was removed.
 */

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type PaginationState = {
  /** Current page, 1-based and always within `1..pageCount`. */
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  /** 1-based index of the first row shown ("1" in "1–25 sur 348"), 0 if empty. */
  from: number;
  /** 1-based index of the last row shown ("25" in "1–25 sur 348"), 0 if empty. */
  to: number;
  /** 0-based offset of the page — `.range(rangeStart, rangeEnd)`. */
  rangeStart: number;
  /** 0-based inclusive end of the page, as PostgREST expects it. */
  rangeEnd: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  /** Client-side helper: the rows of the current page. */
  slice: <T>(rows: T[]) => T[];
};

export function usePagination({
  total,
  resetKey,
  initialPageSize = DEFAULT_PAGE_SIZE,
}: {
  /** Number of rows *after* filtering — the whole matching set, not the page. */
  total: number;
  /**
   * A signature of the active filters. When it changes the page goes back to 1,
   * otherwise a filter typed while on page 7 lands the user on an empty screen.
   */
  resetKey?: string;
  initialPageSize?: number;
}): PaginationState {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize);
  const [seenKey, setSeenKey] = useState(resetKey);

  // Both corrections are derived during render rather than in an effect: an
  // effect would let one render — and, on the stock screen, one request — go
  // out with a page that we already know is wrong.
  let current = page;
  if (resetKey !== seenKey) {
    setSeenKey(resetKey);
    current = 1;
  }

  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  // Clamp only once the total is known: while a server page is in flight the
  // count is 0, and clamping on it would drag the user back to page 1.
  if (total > 0 && current > pageCount) current = pageCount;
  if (current !== page) setPageState(current);

  const rangeStart = (current - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;

  return {
    page: current,
    pageSize,
    pageCount,
    total,
    from: total === 0 ? 0 : rangeStart + 1,
    to: total === 0 ? 0 : Math.min(rangeStart + pageSize, total),
    rangeStart,
    rangeEnd,
    setPage: (p: number) => setPageState(Math.min(Math.max(1, p), pageCount)),
    setPageSize: (size: number) => {
      setPageSizeState(size);
      setPageState(1);
    },
    slice: <T,>(rows: T[]) => rows.slice(rangeStart, rangeStart + pageSize),
  };
}

/**
 * The bar under a list table. It sits after the table container on every
 * screen, so the position is the same whether the table lives in a `TableShell`
 * or in a plain `Card`.
 *
 * RTL: no arrow is placed by hand. The chevrons are mirrored by the global
 * `[dir="rtl"] .rtl-flip` rule in `styles.css`, so "previous" always points to
 * the start edge of the reading direction, and the layout uses `ms-auto` only.
 */
export function DataPagination({
  pagination,
  className,
}: {
  pagination: PaginationState;
  className?: string;
}) {
  const { t } = useI18n();
  const { page, pageCount, pageSize, total, from, to, setPage, setPageSize } = pagination;

  // Nothing to paginate, and nothing to say: the table itself is already
  // showing its loading, empty or error state.
  if (total === 0) return null;

  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  const range = t("pagination_range")
    .replace("{from}", String(from))
    .replace("{to}", String(to))
    .replace("{total}", String(total));
  const pageOf = t("pagination_page_of")
    .replace("{page}", String(page))
    .replace("{pageCount}", String(pageCount));

  return (
    <Card className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2", className)}>
      <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
        {range}
      </p>

      <div className="flex items-center gap-2 ms-auto">
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {t("pagination_rows_per_page")}
        </span>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-[4.75rem]" aria-label={t("pagination_rows_per_page")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <nav aria-label={t("pagination_label")} className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("pagination_first")}
          title={t("pagination_first")}
          disabled={atStart}
          onClick={() => setPage(1)}
        >
          <ChevronsLeft className="rtl-flip" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("pagination_previous")}
          title={t("pagination_previous")}
          disabled={atStart}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="rtl-flip" />
        </Button>

        <span className="px-2 text-xs tabular-nums text-muted-foreground">{pageOf}</span>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("pagination_next")}
          title={t("pagination_next")}
          disabled={atEnd}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight className="rtl-flip" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("pagination_last")}
          title={t("pagination_last")}
          disabled={atEnd}
          onClick={() => setPage(pageCount)}
        >
          <ChevronsRight className="rtl-flip" />
        </Button>
      </nav>
    </Card>
  );
}
