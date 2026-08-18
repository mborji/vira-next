import { useMemo } from "react";
import { User } from "lucide-react";
import type { JalaliDate } from "@/utils/jalali";
import { convertToPersianDigits } from "@/lib/utils";
import { DASH } from "@/components/dashboard/dashboardTheme";
import { LeaveHistoryCard } from "./LeaveHistoryCard";
import { LeaveSummaryCard } from "./LeaveSummaryCard";
import { OverviewStatCard } from "./OverviewStatCard";
import { ProfileSummaryCard, type OverviewProfile } from "./ProfileSummaryCard";
import { WorkloadRatioCard } from "./WorkloadRatioCard";
import type { MetricKey } from "./metricDetails";
import {
  buildYearBalance,
  getBalanceLabel,
  getBalanceTone,
} from "./workBalance";
import {
  buildWorkerMonthStats,
  formatCount,
  formatDuration,
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
  /** Time logs across the whole selected Jalali year — powers «تراز کارکرد». */
  yearlyTimeLogs: OverviewTimeLog[];
  /** Today's Jalali date, used to pro-rate the running month's quota. */
  today: JalaliDate;
  holidays: OverviewHoliday[];
  /** Official holidays of the whole selected Jalali year — «تراز کارکرد». */
  yearlyHolidays?: OverviewHoliday[];
  /** Part-time employees are not credited holiday hours. */
  countHolidayHours?: boolean;
  /** Credited hours for the month, computed by the dashboard. */
  workedHours: number;
  /**
   * `false` when a manager is inspecting somebody else, which switches the
   * first-person wording («پنل شخصی من» → «جزئیات کارکرد») to a neutral one.
   */
  isSelf?: boolean;
  /** When provided, every KPI tile becomes clickable and opens its details. */
  onMetricSelect?: (metric: MetricKey) => void;
}

/**
 * "پنل شخصی" — the read-only overview of an employee's month:
 * identity, KPI tiles, workload ratio and leave records.
 * All values are derived from the dashboard's live API data.
 *
 * ─── ORDER IS A CONTRACT ───────────────────────────────────────────────────
 * The 2026-08-18 redesign changed the LOOK of this panel only. Every block is
 * still rendered in the order the project already had:
 *
 *   heading → [ identity + leave summary ]  |  [ KPI tiles → ratio → history ]
 *
 * and the six KPI tiles are still کارکرد ماه جاری · ساعت موظفی · تراز کارکرد ·
 * روزهای حضور · تأخیر · غیبت. The reference HTML lists both of those the other
 * way round; that file is written back-to-front and its order is ignored here,
 * the same rule the management panel follows. Don't "fix" this back.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const WorkerOverview = ({
  profile,
  selectedMonth,
  todayKey,
  timeLogs,
  dayOffRequests,
  yearlyDayOffRequests,
  yearlyDayOffLoading,
  yearlyTimeLogs,
  today,
  holidays,
  yearlyHolidays,
  countHolidayHours = true,
  workedHours,
  isSelf = true,
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

  /** Cumulative work-hour balance from فروردین up to the selected month. */
  const yearBalance = useMemo(
    () =>
      buildYearBalance({
        year: selectedMonth.jy,
        upToMonth: selectedMonth.jm,
        today,
        yearTimeLogs: yearlyTimeLogs,
        yearDayOffRequests: yearlyDayOffRequests,
        yearHolidays: yearlyHolidays ?? holidays,
        countHolidayHours,
      }),
    [
      selectedMonth,
      today,
      yearlyTimeLogs,
      yearlyDayOffRequests,
      yearlyHolidays,
      holidays,
      countHolidayHours,
    ]
  );

  const balance = yearBalance.totalBalanceHours;
  const balanceTone = getBalanceTone(balance);

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
          metric: "balance",
          label: "تراز کارکرد",
          // HH:MM so the card and its detail dialog can never disagree by a
          // rounding minute the way a one-decimal figure would.
          value:
            balanceTone === "slate"
              ? "۰۰:۰۰"
              : formatDuration(Math.abs(balance)),
          unit:
            balanceTone === "slate"
              ? "ساعت"
              : `ساعت ${getBalanceLabel(balance)}`,
          tone: balanceTone,
        },
        {
          metric: "attendance",
          label: "روزهای حضور",
          value: `${formatCount(stats.attendanceDays)} / ${formatCount(
            stats.requiredWorkingDays
          )}`,
          unit: "روز",
          tone: "blue",
          ltrValue: true,
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
    [stats, balance, balanceTone]
  );

  return (
    <div className="space-y-3.5">
      {/* Heading, icon then title — the management panel's heading shape. */}
      <h2
        className="persian-heading flex items-center gap-2 text-lg font-extrabold"
        style={{ color: DASH.ink }}
      >
        <User
          aria-hidden="true"
          className="h-[19px] w-[19px] shrink-0"
          style={{ color: DASH.primary }}
        />
        {isSelf ? "پنل شخصی" : "جزئیات کارکرد"} — {displayName}
      </h2>

      {/*
        Two columns, the reference's 1:1.15 split. The WIDER one is the KPI /
        ratio / history column, which in this project is the SECOND child —
        hence `[1fr_1.15fr]` rather than the reference's `1.15fr 1fr`. Same
        proportions, project order preserved.
      */}
      {/*
        NO `items-start` here. The columns must STRETCH to the row's height —
        that is the whole reason `LeaveSummaryCard` carries `flex-1` and
        `OverviewPanel` can be told to be `h-full flex flex-col`. With
        `items-start` each column was only as tall as its own content, the
        stretch was silently dead, and «خلاصه مرخصی‌ها» stopped short of
        «سوابق مرخصی من» with a gap under it. Grid's default `stretch` makes the
        two cards end on exactly the same line.
      */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        {/* start (right in RTL): identity + leave summary.
            A flex column (not `space-y-*`) so «خلاصه مرخصی‌ها» can take the
            height left over by the taller column beside it instead of leaving
            a gap at the bottom of the page. */}
        <div className="flex flex-col gap-4">
          <ProfileSummaryCard profile={profile} />
          <LeaveSummaryCard
            summary={leaveSummary}
            yearLabel={yearLabel}
            className="flex-1"
          />
        </div>

        {/* end (left in RTL): KPIs, workload ratio, leave history */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tiles.map((tile) => (
              <OverviewStatCard
                key={tile.metric}
                label={tile.label}
                value={tile.value}
                unit={tile.unit}
                tone={tile.tone}
                ltrValue={"ltrValue" in tile ? tile.ltrValue : undefined}
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
            title={isSelf ? "سوابق مرخصی من" : "سوابق مرخصی"}
          />
        </div>
      </div>
    </div>
  );
};

export default WorkerOverview;
