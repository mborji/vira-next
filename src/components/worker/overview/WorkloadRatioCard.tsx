import { cn } from "@/lib/utils";
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
  const reachedTarget = completionPercent >= 100;

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
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            reachedTarget ? "bg-teal-500" : "bg-teal-400"
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="persian-body text-xs font-medium text-muted-foreground [font-variant-numeric:tabular-nums]">
          {formatCount(completionPercent)}٪
        </span>
        <span className="persian-heading text-xs font-bold text-teal-700 [font-variant-numeric:tabular-nums] dark:text-teal-400">
          {formatHours(workedHours)} / {formatHours(requiredHours)} ساعت
        </span>
      </div>
    </OverviewPanel>
  );
};

export default WorkloadRatioCard;
