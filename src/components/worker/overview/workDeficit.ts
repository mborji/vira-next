import {
  formatDateForDB,
  getDaysInJalaliMonth,
  jalaliToGregorian,
  type JalaliDate,
} from "@/utils/jalali";
import {
  getMonthLabel,
  getMonthQuota,
  getQuotaDailyHours,
} from "./monthlyWorkQuota";
import {
  loggedHoursOf,
  toDateKey,
  type OverviewDayOffRequest,
  type OverviewTimeLog,
} from "./workerStats";

/** `Date.getDay()` value for Friday — the only weekly day off in the HR quota. */
const FRIDAY = 5;

export interface MonthDeficit {
  /** Jalali month number, 1 … 12. */
  month: number;
  monthName: string;
  /** Published quota of the month, before any pro-rating. */
  fullRequiredHours: number;
  /** Quota actually compared against — pro-rated while the month is running. */
  requiredHours: number;
  /** Hours from the employee's own time logs. */
  loggedHours: number;
  /** Approved days off, credited at the month's daily quota rate. */
  leaveHours: number;
  /** `max(0, required − logged − leave)`. */
  deficitHours: number;
  /** True for the month that is still in progress. */
  inProgress: boolean;
}

export interface YearDeficit {
  months: MonthDeficit[];
  totalRequiredHours: number;
  totalWorkedHours: number;
  /** Cumulative deficit from فروردین up to the selected month. */
  totalDeficitHours: number;
}

interface BuildYearDeficitInput {
  /** Jalali year the dashboard is showing. */
  year: number;
  /** Jalali month selected in the dashboard — the cumulative total stops here. */
  upToMonth: number;
  /** Today's Jalali date, so a running month is only counted up to now. */
  today: JalaliDate;
  /** Every time log of the selected Jalali year. */
  yearTimeLogs: OverviewTimeLog[];
  /** Every day-off request of the selected Jalali year. */
  yearDayOffRequests: OverviewDayOffRequest[];
}

/** Share of a month that has already elapsed, measured in non-Friday days. */
const elapsedShareOfMonth = (jy: number, jm: number, jd: number): number => {
  const daysInMonth = getDaysInJalaliMonth(jy, jm);
  let total = 0;
  let elapsed = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    if (jalaliToGregorian(jy, jm, day).getDay() === FRIDAY) continue;
    total += 1;
    if (day <= jd) elapsed += 1;
  }

  if (!total) return 0;
  return Math.min(1, elapsed / total);
};

/** Maps a `YYYY-MM-DD` key to the Jalali month it belongs to, or `0`. */
const monthOfKey = (key: string, monthKeyIndex: Map<string, number>): number =>
  monthKeyIndex.get(key) ?? 0;

/**
 * Builds the month-by-month work deficit of a Jalali year.
 *
 * Required hours come from the HR quota table (`monthlyWorkQuota.ts`). Because
 * that table already removes official holidays, holiday hours are *not*
 * credited here — only real time logs plus approved leave count as fulfilled.
 */
export const buildYearDeficit = ({
  year,
  upToMonth,
  today,
  yearTimeLogs,
  yearDayOffRequests,
}: BuildYearDeficitInput): YearDeficit => {
  const lastMonth =
    year > today.jy ? 0 : Math.min(upToMonth, year < today.jy ? 12 : today.jm);

  // Every day key of the year mapped to its Jalali month, so logs coming back
  // as Gregorian dates can be bucketed without re-converting each one.
  const monthKeyIndex = new Map<string, number>();
  for (let jm = 1; jm <= 12; jm += 1) {
    const daysInMonth = getDaysInJalaliMonth(year, jm);
    for (let jd = 1; jd <= daysInMonth; jd += 1) {
      monthKeyIndex.set(formatDateForDB(year, jm, jd), jm);
    }
  }

  const loggedByMonth = new Map<number, number>();
  yearTimeLogs.forEach((log) => {
    const jm = monthOfKey(toDateKey(log.date), monthKeyIndex);
    if (!jm) return;
    loggedByMonth.set(jm, (loggedByMonth.get(jm) || 0) + loggedHoursOf(log));
  });

  const leaveDaysByMonth = new Map<number, number>();
  yearDayOffRequests
    .filter((request) => request.status === "approved")
    .forEach((request) => {
      const jm = monthOfKey(toDateKey(request.request_date), monthKeyIndex);
      if (!jm) return;
      leaveDaysByMonth.set(jm, (leaveDaysByMonth.get(jm) || 0) + 1);
    });

  const months: MonthDeficit[] = [];

  for (let jm = 1; jm <= lastMonth; jm += 1) {
    const quota = getMonthQuota(jm);
    if (!quota) continue;

    const inProgress = year === today.jy && jm === today.jm;
    const share = inProgress ? elapsedShareOfMonth(year, jm, today.jd) : 1;
    const requiredHours = quota.requiredHours * share;

    const loggedHours = loggedByMonth.get(jm) || 0;
    const leaveHours =
      (leaveDaysByMonth.get(jm) || 0) * getQuotaDailyHours(jm);

    months.push({
      month: jm,
      monthName: getMonthLabel(jm),
      fullRequiredHours: quota.requiredHours,
      requiredHours,
      loggedHours,
      leaveHours,
      deficitHours: Math.max(0, requiredHours - loggedHours - leaveHours),
      inProgress,
    });
  }

  return {
    months,
    totalRequiredHours: months.reduce((sum, m) => sum + m.requiredHours, 0),
    totalWorkedHours: months.reduce(
      (sum, m) => sum + m.loggedHours + m.leaveHours,
      0
    ),
    totalDeficitHours: months.reduce((sum, m) => sum + m.deficitHours, 0),
  };
};
