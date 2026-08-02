import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { StatTone } from "./OverviewStatCard";
import {
  buildMetricDetail,
  type CellTone,
  type MetricCell,
  type MetricDetailInput,
  type MetricKey,
} from "./metricDetails";

const HEADLINE_TONE: Record<StatTone, string> = {
  teal: "text-teal-600 dark:text-teal-400",
  slate: "text-slate-700 dark:text-slate-200",
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-500 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
};

const CELL_TEXT_TONE: Record<CellTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  teal: "text-teal-600 dark:text-teal-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
};

const CELL_BADGE_TONE: Record<CellTone, string> = {
  default: "bg-muted text-foreground",
  muted: "bg-muted text-muted-foreground",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

const DetailCell = ({ cell }: { cell: MetricCell }) => {
  const tone = cell.tone ?? "default";

  if (cell.badge) {
    return (
      <span
        className={cn(
          "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
          CELL_BADGE_TONE[tone]
        )}
      >
        {cell.text}
      </span>
    );
  }

  return (
    <span
      dir={cell.ltr ? "ltr" : undefined}
      className={cn(
        "persian-body [font-variant-numeric:tabular-nums]",
        cell.ltr && "inline-block",
        CELL_TEXT_TONE[tone]
      )}
    >
      {cell.text}
    </span>
  );
};

interface MetricDetailDialogProps {
  /** The clicked card, or `null` when the dialog is closed. */
  metric: MetricKey | null;
  onClose: () => void;
  data: MetricDetailInput;
}

/**
 * Detail view of a single summary card: the rule behind the number, the
 * number itself and the underlying day-by-day records. Read-only.
 */
export const MetricDetailDialog = ({
  metric,
  onClose,
  data,
}: MetricDetailDialogProps) => {
  const detail = useMemo(
    () => (metric ? buildMetricDetail(metric, data) : null),
    [metric, data]
  );

  return (
    <Dialog open={metric !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        dir="rtl"
        // Radix pins its close button to the physical right — move it to the
        // start edge so it does not sit on top of the RTL title.
        className="max-w-3xl gap-4 [&>button]:left-4 [&>button]:right-auto"
      >
        {detail && (
          <>
            <DialogHeader className="space-y-2 pe-6">
              <DialogTitle className="persian-heading text-lg font-bold">
                {detail.title}
              </DialogTitle>
              <DialogDescription className="persian-body text-xs leading-6">
                {detail.description}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <span className="persian-body text-xs text-muted-foreground">
                مقدار این ماه
              </span>
              <span
                className={cn(
                  "persian-heading text-xl font-bold [font-variant-numeric:tabular-nums]",
                  HEADLINE_TONE[detail.headlineTone]
                )}
              >
                {detail.headline}
              </span>
            </div>

            {detail.rows.length === 0 ? (
              <p className="persian-body rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                {detail.emptyText}
              </p>
            ) : (
              <div className="max-h-[52vh] overflow-y-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {detail.columns.map((column) => (
                        <TableHead
                          key={column.label}
                          className={cn(
                            "sticky top-0 z-10 h-10 whitespace-nowrap border-b bg-card px-3 text-xs font-medium",
                            column.className
                          )}
                        >
                          {column.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.cells.map((cell, index) => (
                          <TableCell
                            key={detail.columns[index]?.label ?? index}
                            className="px-3 py-2.5 text-sm"
                          >
                            <DetailCell cell={cell} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                  {detail.footer && (
                    <TableFooter className="bg-transparent">
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          className="persian-body sticky bottom-0 z-10 border-t bg-muted px-3 py-2.5 text-xs font-medium text-muted-foreground"
                          colSpan={Math.max(1, detail.columns.length - 1)}
                        >
                          {detail.footer.label}
                        </TableCell>
                        <TableCell className="persian-heading sticky bottom-0 z-10 border-t bg-muted px-3 py-2.5 text-sm font-bold [font-variant-numeric:tabular-nums]">
                          {detail.footer.value}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MetricDetailDialog;
