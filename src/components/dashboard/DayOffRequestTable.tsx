import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// `TooltipProvider` is already mounted once in App.tsx — do not nest another.
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatJalaliFromDbDate } from "@/components/worker/overview/workerStats";
// Same avatar + name cell as «ساعات کاری ثبت شده», imported rather than copied so
// the two tables cannot drift apart (the avatar colour is a hash of the name).
import { WorkerCell } from "@/components/dashboard/TimeLogTable";

export type DayOffStatus = "pending" | "approved" | "rejected";

export interface DayOffRequestRow {
  id: string;
  worker_id: string;
  request_date: string;
  reason?: string | null;
  status: DayOffStatus;
  worker_name?: string | null;
  created_at?: string | null;
}

export interface DayOffTableWorker {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
}

const STATUS_STYLES: Record<DayOffStatus, { label: string; badge: string }> = {
  pending: {
    label: "در انتظار",
    badge:
      "border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300",
  },
  approved: {
    label: "تأیید شده",
    badge:
      "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  rejected: {
    label: "رد شده",
    badge:
      "border-red-200/70 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-300",
  },
};

/**
 * Width + alignment per column, applied to the `<th>` **and** its `<td>`s.
 * Same contract as `TimeLogTable`: the table is `table-fixed` so a long reason
 * cannot widen its column, and alignment is never inherited — `text-align: start`
 * resolves against each element's own `direction`, which is how the clock columns
 * of the other table drifted from their headers. `علت` carries no width so it
 * absorbs whatever is left over.
 */
const COLUMNS = {
  worker: { width: "w-[240px]", align: "text-start" },
  date: { width: "w-[110px]", align: "text-center" },
  reason: { width: "w-auto", align: "text-start" },
  status: { width: "w-[110px]", align: "text-start" },
  actions: { width: "w-[132px]", align: "text-center" },
} as const;

const headClass = (key: keyof typeof COLUMNS): string =>
  cn("h-11 text-xs font-bold", COLUMNS[key].width, COLUMNS[key].align);

const EM_DASH = "—";

const StatusBadge: React.FC<{ row: DayOffRequestRow }> = ({ row }) => {
  const style = STATUS_STYLES[row.status];
  const badge = (
    <Badge
      variant="outline"
      className={cn("rounded-full px-3 py-0.5 text-[11px]", style.badge)}
    >
      {style.label}
    </Badge>
  );

  if (!row.created_at) return badge;

  // The «تاریخ درخواست» column was dropped from the redesign, so the submission
  // date lives here instead of disappearing.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="cursor-help rounded-full">
          {badge}
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        {`ثبت درخواست: ${formatJalaliFromDbDate(row.created_at)}`}
      </TooltipContent>
    </Tooltip>
  );
};

interface DecisionButtonsProps {
  row: DayOffRequestRow;
  onDecide: (id: string, status: "approved" | "rejected") => void;
  busy: boolean;
}

const DecisionButtons: React.FC<DecisionButtonsProps> = ({
  row,
  onDecide,
  busy,
}) => (
  <div className="flex items-center justify-center gap-2">
    <Button
      size="sm"
      className="h-8 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
      disabled={busy}
      onClick={() => onDecide(row.id, "approved")}
    >
      <CheckCircle className="ms-1 h-3.5 w-3.5" />
      تأیید
    </Button>
    <Button
      size="sm"
      variant="destructive"
      className="h-8 px-3 text-xs"
      disabled={busy}
      onClick={() => onDecide(row.id, "rejected")}
    >
      <XCircle className="ms-1 h-3.5 w-3.5" />
      رد
    </Button>
  </div>
);

export interface DayOffRequestTableProps {
  requests: DayOffRequestRow[];
  workers: DayOffTableWorker[];
  /** Omitted for a read-only table — the «عملیات» column then disappears entirely. */
  onDecide?: (id: string, status: "approved" | "rejected") => void;
  /** Id of the request currently being written, so its buttons can be disabled. */
  decidingId?: string | null;
  emptyLabel?: string;
  className?: string;
}

/**
 * «مدیریت مرخصی‌ها» — one row per `day_off_requests` record. تأیید / رد render only
 * for a `pending` row; a decided row keeps its (empty) cell so the columns stay
 * aligned, per the same rule that keeps «عملیات» in `TimeLogTable` consistent.
 */
export const DayOffRequestTable: React.FC<DayOffRequestTableProps> = ({
  requests,
  workers,
  onDecide,
  decidingId,
  emptyLabel = "برای این بازه هیچ درخواست مرخصی‌ای ثبت نشده است.",
  className,
}) => {
  const workerById = React.useMemo(() => {
    const map = new Map<string, DayOffTableWorker>();
    workers.forEach((worker) => map.set(worker.user_id, worker));
    return map;
  }, [workers]);

  const nameOf = (row: DayOffRequestRow) =>
    workerById.get(row.worker_id)?.full_name || row.worker_name || "نامشخص";
  const emailOf = (row: DayOffRequestRow) =>
    workerById.get(row.worker_id)?.email || "";

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* دسکتاپ */}
      <div className="hidden overflow-x-auto md:block">
        <Table className="min-w-[860px] table-fixed">
          <TableHeader>
            <TableRow className="border-b border-border/60 bg-muted/50 hover:bg-muted/50">
              <TableHead className={headClass("worker")}>کارمند</TableHead>
              <TableHead className={headClass("date")}>تاریخ</TableHead>
              <TableHead className={headClass("reason")}>علت</TableHead>
              <TableHead className={headClass("status")}>وضعیت</TableHead>
              {onDecide ? (
                <TableHead className={headClass("actions")}>عملیات</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((row) => (
              <TableRow
                key={row.id}
                className="border-b border-border/50 align-middle transition-colors hover:bg-muted/30"
              >
                <TableCell className={cn("py-3", COLUMNS.worker.align)}>
                  <WorkerCell name={nameOf(row)} email={emailOf(row)} />
                </TableCell>
                <TableCell
                  className={cn(
                    "py-3 text-xs font-medium text-sky-600 dark:text-sky-400",
                    COLUMNS.date.align
                  )}
                >
                  {/* `dir` on the span, never on the cell — see COLUMNS. */}
                  <span dir="ltr">{formatJalaliFromDbDate(row.request_date)}</span>
                </TableCell>
                <TableCell
                  className={cn(
                    "py-3 text-xs text-muted-foreground",
                    COLUMNS.reason.align
                  )}
                >
                  <span className="line-clamp-2" title={row.reason || undefined}>
                    {row.reason || EM_DASH}
                  </span>
                </TableCell>
                <TableCell className={cn("py-3", COLUMNS.status.align)}>
                  <StatusBadge row={row} />
                </TableCell>
                {onDecide ? (
                  <TableCell className={cn("py-3", COLUMNS.actions.align)}>
                    {row.status === "pending" ? (
                      <DecisionButtons
                        row={row}
                        onDecide={onDecide}
                        busy={decidingId === row.id}
                      />
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* موبایل */}
      <div className="space-y-3 md:hidden">
        {requests.map((row) => (
          <div
            key={row.id}
            className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <WorkerCell name={nameOf(row)} email={emailOf(row)} />
              <StatusBadge row={row} />
            </div>

            <div className="mt-3 text-xs">
              <span className="text-muted-foreground">تاریخ مرخصی: </span>
              <span
                className="font-medium text-sky-600 dark:text-sky-400"
                dir="ltr"
              >
                {formatJalaliFromDbDate(row.request_date)}
              </span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {row.reason || EM_DASH}
            </p>

            {onDecide && row.status === "pending" ? (
              <div className="mt-3">
                <DecisionButtons
                  row={row}
                  onDecide={onDecide}
                  busy={decidingId === row.id}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DayOffRequestTable;
