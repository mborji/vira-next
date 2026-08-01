import { useMemo } from "react";
import type { JalaliDate } from "@/utils/jalali";
import { convertToPersianDigits } from "@/lib/utils";
import { LeaveHistoryCard } from "./LeaveHistoryCard";
import { LeaveSummaryCard } from "./LeaveSummaryCard";
import { OverviewStatCard } from "./OverviewStatCard";
import { ProfileSummaryCard, type OverviewProfile } from "./ProfileSummaryCard";
import { WorkloadRatioCard } from "./WorkloadRatioCard";
import type { MetricKey } from "./metricDetails";
import {
  buildWorkerMonthStats,
  formatCount,
  formatHours,
  summarizeLeaveRequests,
  type OverviewDayOffRequest,
  type OverviewHoliday,
  type OverviewTimeLog,
} from "./workerStats";

interface WorkerOverviewProps {
  profile: OverviewProfile;
  /** Jalali month the dashboard is currently showing. */
  selectedMonth: JalaliDate;
  /** Today as a `YYYY-MM-DD` key, so future days are not counted as absences. */
  todayKey: string;
  timeLogs: OverviewTimeLog[];
  /** Leave requests inside the selected month. */
  dayOffRequests: OverviewDayOffRequest[];
  /** Leave requests across the whole selected Jalali year. */
  yearlyDayOffRequests: OverviewDayOffRequest[];
  yearlyDayOffLoading?: boolean;
  holidays: OverviewHoliday[];
  /** Credited hours for the month, computed by the dashboard. */
  workedHours: number;
  /** When provided, every KPI tile becomes clickable and opens its details. */
  onMetricSelect?: (metric: MetricKey) => void;
}

/**
 * "پنل شخصی" — the read-only overview of an employee's month:
 * identity, KPI tiles, workload ratio and leave records.
 * All values are derived from the dashboard's live API data.
 */
export const WorkerOverview = ({
  profile,
  selectedMonth,
  todayKey,
  timeLogs,
  dayOffRequests,
  yearlyDayOffRequests,
  yearlyDayOffLoading,
  holidays,
  workedHours,
  onMetricSelect,
}: WorkerOverviewProps) => {
  const stats = useMemo(
    () =>
      buildWorkerMonthStats({
        month: selectedMonth,
        todayKey,
        timeLogs,
        dayOffRequests,
        holidays,
        workedHours,
      }),
    [selectedMonth, todayKey, timeLogs, dayOffRequests, holidays, workedHours]
  );

  const leaveSummary = useMemo(
    () => summarizeLeaveRequests(yearlyDayOffRequests),
    [yearlyDayOffRequests]
  );

  const yearLabel = convertToPersianDigits(String(selectedMonth.jy));
  const displayName = profile.fullName || profile.email || "کاربر";

  const tiles = useMemo(
    () =>
      [
        {
          metric: "worked",
          label: "کارکرد ماه جاری",
          value: formatHours(stats.workedHours),
          unit: "ساعت",
          tone: "teal",
        },
        {
          metric: "required",
          label: "ساعت موظفی",
          value: formatHours(stats.requiredHours),
          unit: "ساعت",
          tone: "slate",
        },
        {
          metric: "overtime",
          label: "اضافه‌کاری",
          value: formatHours(stats.overtimeHours),
          unit: "ساعت",
          tone: "emerald",
        },
        {
          metric: "attendance",
          label: "روزهای حضور",
          value: formatCount(stats.attendanceDays),
          unit: "روز",
          tone: "blue",
        },
        {
          metric: "late",
          label: "تأخیر",
          value: formatCount(stats.lateDays),
          unit: "بار",
          tone: "amber",
        },
        {
          metric: "absence",
          label: "غیبت",
          value: formatCount(stats.absenceDays),
          unit: "روز",
          tone: "rose",
        },
      ] as const,
    [stats]
  );

  return (
    <div className="space-y-5">
      <h2 className="persian-heading text-2xl font-bold text-foreground">
        پنل شخصی — {displayName}
      </h2>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* start (right in RTL): identity + leave summary */}
        <div className="space-y-5">
          <ProfileSummaryCard profile={profile} />
          <LeaveSummaryCard summary={leaveSummary} yearLabel={yearLabel} />
        </div>

        {/* end (left in RTL): KPIs, workload ratio, leave history */}
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tiles.map((tile) => (
              <OverviewStatCard
                key={tile.metric}
                label={tile.label}
                value={tile.value}
                unit={tile.unit}
                tone={tile.tone}
                onClick={
                  onMetricSelect
                    ? () => onMetricSelect(tile.metric)
                    : undefined
                }
              />
            ))}
          </div>

          <WorkloadRatioCard
            workedHours={stats.workedHours}
            requiredHours={stats.requiredHours}
            completionPercent={stats.completionPercent}
          />

          <LeaveHistoryCard
            requests={yearlyDayOffRequests}
            loading={yearlyDayOffLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default WorkerOverview;
