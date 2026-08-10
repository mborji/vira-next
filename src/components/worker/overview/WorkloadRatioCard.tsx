import { OverviewPanel } from "./OverviewPanel";
import { formatCount, formatHours } from "./workerStats";

interface WorkloadRatioCardProps {
  workedHours: number;
  requiredHours: number;
  /** Un-clamped completion percentage; the bar itself is clamped to 100. */
  completionPercent: number;
  className?: string;
}

/** Progress of credited hours against the contractual monthly hours. */
export const WorkloadRatioCard = ({
  workedHours,
  requiredHours,
  completionPercent,
  className,
}: WorkloadRatioCardProps) => {
  const barWidth = Math.min(100, Math.max(0, completionPercent));

  return (
    <OverviewPanel title="نسبت کارکرد به موظفی" className={className}>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(barWidth)}
        aria-label="نسبت کارکرد به ساعت موظفی"
      >
        {/* Same green as the «مانده مرخصی» bar in `LeaveSummaryCard` —
            keep the two in step if either one is ever restyled. */}
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-700 ease-out"
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="persian-body text-xs font-medium text-muted-foreground [font-variant-numeric:tabular-nums]">
          {formatCount(completionPercent)}٪
        </span>
        {/* Emerald to match the bar above and the «مانده مرخصی» block. */}
        <span className="persian-heading text-xs font-bold text-emerald-700 [font-variant-numeric:tabular-nums] dark:text-emerald-400">
          {formatHours(workedHours)} / {formatHours(requiredHours)} ساعت
        </span>
      </div>
    </OverviewPanel>
  );
};

export default WorkloadRatioCard;
