import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { OverviewPanel } from "./OverviewPanel";
import {
  formatJalaliFromDbDate,
  toDateKey,
  type OverviewDayOffRequest,
} from "./workerStats";

const STATUS_META: Record<
  OverviewDayOffRequest["status"],
  { label: string; className: string }
> = {
  approved: {
    label: "تأیید شده",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  pending: {
    label: "در انتظار",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  rejected: {
    label: "رد شده",
    className:
      "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
};

interface LeaveHistoryCardProps {
  requests: OverviewDayOffRequest[];
  loading?: boolean;
  className?: string;
}

/** Leave records of the selected Jalali year, newest first. */
export const LeaveHistoryCard = ({
  requests,
  loading,
  className,
}: LeaveHistoryCardProps) => {
  const rows = [...requests].sort((a, b) =>
    toDateKey(b.request_date).localeCompare(toDateKey(a.request_date))
  );

  return (
    <OverviewPanel title="سوابق مرخصی من" flush className={className}>
      {loading ? (
        <p className="persian-body py-6 text-center text-sm text-muted-foreground">
          در حال بارگذاری...
        </p>
      ) : rows.length === 0 ? (
        <p className="persian-body py-6 text-center text-sm text-muted-foreground">
          در این سال مرخصی‌ای ثبت نشده است.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 w-[36%] px-2 text-xs font-medium">
                تاریخ
              </TableHead>
              <TableHead className="h-9 w-[38%] px-2 text-xs font-medium">
                علت
              </TableHead>
              <TableHead className="h-9 px-2 text-xs font-medium">
                وضعیت
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((request) => {
              const status = STATUS_META[request.status] ?? STATUS_META.pending;
              return (
                <TableRow key={request.id}>
                  <TableCell className="px-2 py-3 text-sm [font-variant-numeric:tabular-nums]">
                    {formatJalaliFromDbDate(request.request_date)}
                  </TableCell>
                  <TableCell className="persian-body px-2 py-3 text-sm text-foreground">
                    {request.reason || "—"}
                  </TableCell>
                  <TableCell className="px-2 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        status.className
                      )}
                    >
                      {status.label}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </OverviewPanel>
  );
};

export default LeaveHistoryCard;
