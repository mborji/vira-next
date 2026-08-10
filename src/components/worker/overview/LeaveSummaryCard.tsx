import { cn, convertToPersianDigits } from "@/lib/utils";
import { OverviewPanel } from "./OverviewPanel";
import { formatCount, type LeaveSummary } from "./workerStats";

interface LeaveSummaryCardProps {
  summary: LeaveSummary;
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

/**
 * Leave counts for the selected Jalali year, plus the employee's leave balance:
 * how many days of the yearly allowance are already spent and how many are
 * left. Only approved requests are counted as used — a request still awaiting
 * review must not eat into the balance.
 *
 * The panel is written to stretch (`h-full` + `flex flex-col`) so it can absorb
 * the leftover height of its column; the balance block is pinned to the bottom
 * with `mt-auto`.
 */
export const LeaveSummaryCard = ({
  summary,
  yearLabel,
  className,
}: LeaveSummaryCardProps) => {
  const { used, entitlement, remaining, overused } = summary;

  /** How much of the allowance is spent, clamped for the progress bar. */
  const usedPercent =
    entitlement > 0 ? Math.min(100, Math.round((used / entitlement) * 100)) : 0;

  const isOverused = overused > 0;
  const isLow = !isOverused && remaining > 0 && remaining <= 5;

  const remainingTone = isOverused
    ? "text-rose-600 dark:text-rose-400"
    : remaining === 0
    ? "text-rose-600 dark:text-rose-400"
    : isLow
    ? "text-amber-500 dark:text-amber-400"
    : "text-emerald-600 dark:text-emerald-400";

  const barTone = isOverused || remaining === 0
    ? "bg-rose-500"
    : isLow
    ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <OverviewPanel
      title={yearLabel ? `خلاصه مرخصی‌ها — ${yearLabel}` : "خلاصه مرخصی‌ها"}
      className={cn("flex h-full flex-col", className)}
      bodyClassName="flex flex-1 flex-col"
    >
      <dl className="divide-y divide-border">
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

      {/* Leave balance — pinned to the bottom so the card can grow with its column. */}
      <div className="mt-auto space-y-3 pt-5">
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="persian-body text-xs text-muted-foreground">
                مرخصی استفاده‌شده
              </p>
              <p className="persian-heading text-2xl font-bold text-foreground [font-variant-numeric:tabular-nums]">
                {formatCount(used)}{" "}
                <span className="text-xs font-medium text-muted-foreground">
                  روز
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <p className="persian-body text-xs text-muted-foreground">
                مانده مرخصی
              </p>
              <p
                className={cn(
                  "persian-heading text-2xl font-bold [font-variant-numeric:tabular-nums]",
                  remainingTone
                )}
              >
                {formatCount(remaining)}{" "}
                <span className="text-xs font-medium text-muted-foreground">
                  روز
                </span>
              </p>
            </div>
          </div>

          <div
            className="mt-4 h-2 w-full overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={entitlement}
            aria-valuenow={used}
            aria-label="میزان مرخصی استفاده‌شده از سقف سالانه"
          >
            <div
              className={cn("h-full rounded-full transition-all", barTone)}
              style={{ width: `${usedPercent}%` }}
            />
          </div>

          <p className="persian-body mt-3 text-xs leading-6 text-muted-foreground">
            سقف مرخصی سالانه{" "}
            <span className="font-semibold text-foreground [font-variant-numeric:tabular-nums]">
              {formatCount(entitlement)} روز کاری
            </span>{" "}
            است و تاکنون{" "}
            <span
              dir="ltr"
              className="inline-block font-semibold text-foreground [font-variant-numeric:tabular-nums]"
            >
              {convertToPersianDigits(String(usedPercent))}٪
            </span>{" "}
            آن استفاده شده است.
            {isOverused && (
              <>
                {" "}
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {formatCount(overused)} روز بیش از سقف ثبت شده است.
                </span>
              </>
            )}
          </p>
        </div>
      </div>
    </OverviewPanel>
  );
};

export default LeaveSummaryCard;
