import { TableCell, TableRow } from "@/components/ui/table";

// Varied widths on purpose: bars of equal length read as a progress meter,
// uneven ones read as text that has not arrived yet.
const WIDTHS = ["60%", "85%", "40%", "72%", "55%", "90%", "45%", "78%"];

/**
 * Loading state of a list table: real rows at the real row height, so the
 * table does not resize when the data replaces them.
 *
 * Purely decorative, hence `aria-hidden`; the caller marks the table
 * `aria-busy` so assistive tech is told once, properly.
 */
export function TableSkeleton({ rows = 8, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} aria-hidden="true" className="hover:bg-transparent">
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c}>
              <div className="skeleton h-3" style={{ width: WIDTHS[(r + c * 3) % WIDTHS.length] }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
