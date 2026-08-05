import { cn } from "@/lib/utils";
import { OverviewPanel } from "./OverviewPanel";
import { formatCount, type LeaveSummary } from "./workerStats";

/**
 * Yearly leave entitlement, straight from
 * `GET /workers/day-off-requests/remaining` — the server owns the yearly cap,
 * so nothing is recomputed on the client.
 */
export interface LeaveBalance {
  /** Yearly entitlement in days (`limitPerYear` on the server). */
  limit: number;
  /** Approved leave days already taken this Jalali year. */
  used: number;
  /** `max(0, limit − used)`. */
  remaining: number;
}

interface LeaveSummaryCardProps {
  summary: LeaveSummary;
  /** Entitlement block; omitted while it is still loading or unavailable. */
  balance?: LeaveBalance | null;
  balanceLoading?: boolean;
  /** Jalali year the summary covers, shown in the panel title. */
  yearLabel?: string;
  className?: string;
}

const ROWS: Array<{
  key: keyof LeaveSummary;
  label: string;
  unit: string;
  tone: string;
}> = [
  {
    key: "pending",
    label: "مرخصی در انتظار",
    unit: "مورد",
    tone: "text-amber-500 dark:text-amber-400",
  },
  {
    key: "approved",
    label: "مرخصی تأیید شده",
    unit: "روز",
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "rejected",
    label: "مرخصی رد شده",
    unit: "مورد",
    tone: "text-rose-600 dark:text-rose-400",
  },
];

/** Used / remaining split, shown as one bar so it reads at a glance. */
const EntitlementBar = ({ balance }: { balance: LeaveBalance }) => {
  const usedPercent = balance.limit
    ? Math.min(100, Math.max(0, (balance.used / balance.limit) * 100))
    : 0;
  const runningLow = balance.remaining <= Math.max(2, balance.limit * 0.15);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
          <p className="persian-body text-xs text-muted-foreground">
            استفاده‌شده
          </p>
          <p className="persian-heading mt-1.5 text-xl font-bold text-teal-600 [font-variant-numeric:tabular-nums] dark:text-teal-400">
            {formatCount(balance.used)}
            <span className="ms-1 text-xs font-medium text-muted-foreground">
              روز
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
          <p className="persian-body text-xs text-muted-foreground">
            مانده مرخصی
          </p>
          <p
            className={cn(
              "persian-heading mt-1.5 text-xl font-bold [font-variant-numeric:tabular-nums]",
              runningLow
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {formatCount(balance.remaining)}
            <span className="ms-1 text-xs font-medium text-muted-foreground">
              روز
            </span>
          </p>
        </div>
      </div>

      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={balance.limit}
        aria-valuenow={balance.used}
        aria-label="مرخصی استفاده‌شده از سهمیه سالانه"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            runningLow ? "bg-rose-500" : "bg-teal-500"
          )}
          style={{ width: `${usedPercent}%` }}
        />
      </div>

      <p className="persian-body text-center text-xs text-muted-foreground [font-variant-numeric:tabular-nums]">
        سهمیه سالانه: {formatCount(balance.limit)} روز
      </p>
    </div>
  );
};

/**
 * Leave entitlement and the pending / approved / rejected counts of the
 * selected Jalali year.
 */
export const LeaveSummaryCard = ({
  summary,
  balance,
  balanceLoading,
  yearLabel,
  className,
}: LeaveSummaryCardProps) => (
  <OverviewPanel
    title={yearLabel ? `خلاصه مرخصی‌ها — ${yearLabel}` : "خلاصه مرخصی‌ها"}
    className={className}
  >
    {balanceLoading ? (
      <p className="persian-body py-6 text-center text-sm text-muted-foreground">
        در حال بارگذاری مانده مرخصی...
      </p>
    ) : balance ? (
      <EntitlementBar balance={balance} />
    ) : null}

    <dl
      className={cn(
        "divide-y divide-border",
        (balance || balanceLoading) && "mt-4 border-t border-border pt-1"
      )}
    >
      {ROWS.map((row) => (
        <div
          key={row.key}
          className="flex items-center justify-between gap-4 py-2.5"
        >
          <dt className="persian-body text-sm text-muted-foreground">
            {row.label}
          </dt>
          <dd
            className={cn(
              "persian-heading text-sm font-bold [font-variant-numeric:tabular-nums]",
              row.tone
            )}
          >
            {formatCount(summary[row.key])}{" "}
            <span className="text-xs font-medium">{row.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  </OverviewPanel>
);

export default LeaveSummaryCard;
