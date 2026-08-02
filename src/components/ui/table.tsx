import * as React from "react";

import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  // A tinted, non-hoverable header band. v1.0 reused TableRow for the header,
  // so the header lit up on hover like a data row and the eye lost the anchor
  // at the top of long ERP tables.
  <thead
    ref={ref}
    className={cn("bg-muted/40 [&_tr]:border-b [&_tr:hover]:bg-transparent", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    // Same tint as the header so a table reads as head / body / totals, and the
    // totals row carries a little more weight because that is what people look
    // for first on an invoice.
    className={cn(
      "border-t bg-muted/40 font-semibold [&>tr]:last:border-b-0 [&_tr:hover]:bg-transparent",
      className,
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      // Hover moves to the warm accent instead of grey: rows now answer the
      // pointer in the brand's own colour, which is what makes a dense table
      // feel alive rather than printed.
      className={cn(
        "border-b border-border/60 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-accent/40 data-[state=selected]:bg-accent/60",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    // Column labels become small caps: they stop competing with the data and
    // start reading as structure. `text-start` and `pe-0` replace the physical
    // left/right so Arabic mirrors correctly.
    className={cn(
      "h-11 px-3 text-start align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    // Rows breathe: px-3/py-3 lands a standard row on the ~3rem rhythm the
    // foundation defines, which is the difference between a table you can scan
    // for eight hours and one you squint at.
    className={cn(
      "px-3 py-3 align-middle [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
