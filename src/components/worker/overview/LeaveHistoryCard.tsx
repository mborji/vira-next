import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DASH } from "@/components/dashboard/dashboardTheme";
import { OverviewPanel } from "./OverviewPanel";
import {
  formatJalaliFromDbDate,
  toDateKey,
  type OverviewDayOffRequest,
} from "./workerStats";

/** Flat status pills of the reference design — fill + text, no border. */
const STATUS_META: Record<
  OverviewDayOffRequest["status"],
  { label: string; bg: string; fg: string }
> = {
  approved: { label: "تأیید شده", bg: "#ECFDF5", fg: "#047857" },
  pending: { label: "در انتظار", bg: "#FFFBEB", fg: "#B45309" },
  rejected: { label: "رد شده", bg: "#FFF1F2", fg: "#BE123C" },
};

interface LeaveHistoryCardProps {
  requests: OverviewDayOffRequest[];
  loading?: boolean;
  /** Panel title — managers inspecting an employee get a neutral wording. */
  title?: string;
  className?: string;
}

/**
 * Leave records of the selected Jalali year, newest first.
 *
 * The columns keep the project's order — تاریخ · علت · وضعیت. The reference
 * file lists them the other way round (وضعیت first); it is written back-to-front
 * throughout and its order is deliberately ignored here.
 */
export const LeaveHistoryCard = ({
  requests,
  loading,
  title = "سوابق مرخصی من",
  className,
}: LeaveHistoryCardProps) => {
  const rows = [...requests].sort((a, b) =>
    toDateKey(b.request_date).localeCompare(toDateKey(a.request_date))
  );

  const headCell = "h-auto px-1 pb-2.5 pt-0 text-[12px] font-medium";

  return (
    <OverviewPanel title={title} flush className={className}>
      {loading ? (
        <p
          className="persian-body py-6 text-center text-sm"
          style={{ color: DASH.subtle }}
        >
          در حال بارگذاری...
        </p>
      ) : rows.length === 0 ? (
        <p
          className="persian-body py-6 text-center text-sm"
          style={{ color: DASH.subtle }}
        >
          در این سال مرخصی‌ای ثبت نشده است.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow
              className="hover:bg-transparent"
              style={{ borderColor: DASH.track }}
            >
              <TableHead
                className={cn(headCell, "w-[36%]")}
                style={{ color: DASH.faint }}
              >
                تاریخ
              </TableHead>
              <TableHead
                className={cn(headCell, "w-[38%]")}
                style={{ color: DASH.faint }}
              >
                علت
              </TableHead>
              <TableHead className={headCell} style={{ color: DASH.faint }}>
                وضعیت
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((request) => {
              const status = STATUS_META[request.status] ?? STATUS_META.pending;
              return (
                <TableRow key={request.id} style={{ borderColor: "#F5F7F7" }}>
                  <TableCell
                    className="px-1 py-3 text-[13px] font-semibold [font-variant-numeric:tabular-nums]"
                    style={{ color: DASH.body }}
                  >
                    {formatJalaliFromDbDate(request.request_date)}
                  </TableCell>
                  <TableCell
                    className="persian-body px-1 py-3 text-[13px]"
                    style={{ color: DASH.muted }}
                  >
                    {request.reason || "—"}
                  </TableCell>
                  <TableCell className="px-1 py-3">
                    <span
                      className="persian-body inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold"
                      style={{ background: status.bg, color: status.fg }}
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
