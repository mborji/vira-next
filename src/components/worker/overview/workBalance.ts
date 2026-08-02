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

/** Hours below which a balance is treated as exactly zero (float noise guard). */
const BALANCE_EPSILON = 1 / 60;

export type BalanceTone = "emerald" | "rose" | "slate";

/** Green for a surplus, red for a deficit, neutral for a balanced month. */
export const getBalanceTone = (balanceHours: number): BalanceTone => {
  if (balanceHours > BALANCE_EPSILON) return "emerald";
  if (balanceHours < -BALANCE_EPSILON) return "rose";
  return "slate";
};

/** «اضافه‌کاری» / «کسری» / «تراز» — the word that follows a balance figure. */
export const getBalanceLabel = (balanceHours: number): string => {
  if (balanceHours > BALANCE_EPSILON) return "اضافه‌کاری";
  if (balanceHours < -BALANCE_EPSILON) return "کسری";
  return "تراز";
};

export interface MonthBalance {
  /** Jalali month number, 1 … 12. */
  month: number;
  monthName: string;
  /** Working days of the month per the HR quota. */
  fullWorkingDays: number;
  /** Working days actually charged — pro-rated while the month is running. */
  requiredWorkingDays: number;
  /** Published quota of the month, before any pro-rating. */
  fullRequiredHours: number;
  /** Quota actually charged — pro-rated while the month is running. */
  requiredHours: number;
  /** Hours from the employee's own time logs. */
  loggedHours: number;
  /** Approved days off, credited at the month's daily quota rate. */
  leaveHours: number;
  /** `loggedHours + leaveHours` — what the month is credited with. */
  workedHours: number;
  /** `workedHours − requiredHours`; negative is a deficit, positive overtime. */
  balanceHours: number;
  /** True for the month that is still in progress. */
  inProgress: boolean;
}

export interface YearBalance {
  months: MonthBalance[];
  totalRequiredHours: number;
  totalWorkedHours: number;
  /** Cumulative balance from فروردین up to the selected month. */
  totalBalanceHours: number;
}

interface BuildYearBalanceInput {
  /** Jalali year the dashboard is showing. */
  year: number;
  /** Jalali month selected in the dashboard — the cumulative total stops here. */
  upToMonth: number;
  /** Today's Jalali date, so a running month is only charged up to now. */
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

/**
 * Month-by-month work-hour balance of a Jalali year.
 *
 * Required hours and required working days come from the HR quota table
 * (`monthlyWorkQuota.ts`). Because that table already removes official
 * holidays, holiday hours are *not* credited here — only real time logs plus
 * approved leave count towards the quota.
 *
 * The running month is charged pro rata (by elapsed non-Friday days) so a
 * half-finished month does not read as a large deficit.
 */
export const buildYearBalance = ({
  year,
  upToMonth,
  today,
  yearTimeLogs,
  yearDayOffRequests,
}: BuildYearBalanceInput): YearBalance => {
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
    const jm = monthKeyIndex.get(toDateKey(log.date));
    if (!jm) return;
    loggedByMonth.set(jm, (loggedByMonth.get(jm) || 0) + loggedHoursOf(log));
  });

  const leaveDaysByMonth = new Map<number, number>();
  yearDayOffRequests
    .filter((request) => request.status === "approved")
    .forEach((request) => {
      const jm = monthKeyIndex.get(toDateKey(request.request_date));
      if (!jm) return;
      leaveDaysByMonth.set(jm, (leaveDaysByMonth.get(jm) || 0) + 1);
    });

  const months: MonthBalance[] = [];

  for (let jm = 1; jm <= lastMonth; jm += 1) {
    const quota = getMonthQuota(jm);
    if (!quota) continue;

    const inProgress = year === today.jy && jm === today.jm;
    const share = inProgress ? elapsedShareOfMonth(year, jm, today.jd) : 1;

    const requiredHours = quota.requiredHours * share;
    const requiredWorkingDays = inProgress
      ? Math.round(quota.workingDays * share)
      : quota.workingDays;

    const loggedHours = loggedByMonth.get(jm) || 0;
    const leaveHours = (leaveDaysByMonth.get(jm) || 0) * getQuotaDailyHours(jm);
    const workedHours = loggedHours + leaveHours;

    months.push({
      month: jm,
      monthName: getMonthLabel(jm),
      fullWorkingDays: quota.workingDays,
      requiredWorkingDays,
      fullRequiredHours: quota.requiredHours,
      requiredHours,
      loggedHours,
      leaveHours,
      workedHours,
      balanceHours: workedHours - requiredHours,
      inProgress,
    });
  }

  return {
    months,
    totalRequiredHours: months.reduce((sum, m) => sum + m.requiredHours, 0),
    totalWorkedHours: months.reduce((sum, m) => sum + m.workedHours, 0),
    totalBalanceHours: months.reduce((sum, m) => sum + m.balanceHours, 0),
  };
};
