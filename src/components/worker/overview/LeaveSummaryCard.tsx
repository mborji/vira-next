import { cn } from "@/lib/utils";
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

/** Pending / approved / rejected leave counts for the selected Jalali year. */
export const LeaveSummaryCard = ({
  summary,
  yearLabel,
  className,
}: LeaveSummaryCardProps) => (
  <OverviewPanel
    title={yearLabel ? `خلاصه مرخصی‌ها — ${yearLabel}` : "خلاصه مرخصی‌ها"}
    className={className}
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
  </OverviewPanel>
);

export default LeaveSummaryCard;
