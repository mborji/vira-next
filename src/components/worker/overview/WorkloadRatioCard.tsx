import { DASH } from "@/components/dashboard/dashboardTheme";
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
      {/*
        The track inherits the page's `dir="rtl"`, so the fill starts at the
        right edge and grows leftwards — which is what an RTL progress bar has
        to do. The reference forces `direction:ltr` here and grows it the other
        way; that is corrected on purpose, exactly as it was for the manager's
        comparison charts.
      */}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: DASH.track }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(barWidth)}
        aria-label="نسبت کارکرد به ساعت موظفی"
      >
        {/* Same green as the «مانده مرخصی» bar in `LeaveSummaryCard` —
            keep the two in step if either one is ever restyled. */}
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${barWidth}%`, background: DASH.success }}
        />
      </div>

      {/* Percentage first (right in RTL), hours second — the project's order. */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <span
          className="persian-heading text-xs font-bold [font-variant-numeric:tabular-nums]"
          style={{ color: DASH.success }}
        >
          {formatCount(completionPercent)}٪
        </span>
        <span
          className="persian-body text-xs [font-variant-numeric:tabular-nums]"
          style={{ color: DASH.subtle }}
        >
          {formatHours(workedHours)} / {formatHours(requiredHours)} ساعت
        </span>
      </div>
    </OverviewPanel>
  );
};

export default WorkloadRatioCard;
