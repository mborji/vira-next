import {
  formatDateForDB,
  getDaysInJalaliMonth,
  jalaliToGregorian,
  type JalaliDate,
} from "@/utils/jalali";
import {
  COMPANY_DAILY_HOURS,
  getMonthLabel,
  getMonthQuota,
} from "./monthlyWorkQuota";
import {
  ACCEPTED_DAY_OFF_HOURS,
  HOLIDAY_HOURS,
  loggedHoursOf,
  toDateKey,
  type OverviewDayOffRequest,
  type OverviewHoliday,
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
  /** Company working days of the month (holidays excluded). */
  fullWorkingDays: number;
  /** Official holidays of the month — `0` when they are not being credited. */
  fullOfficialHolidays: number;
  /** `fullWorkingDays + fullOfficialHolidays` — every day the quota charges. */
  fullQuotaDays: number;
  /** Quota days actually charged — elapsed days only while the month runs. */
  requiredQuotaDays: number;
  /** Full quota of the month (`fullQuotaDays × 9`), before any pro-rating. */
  fullRequiredHours: number;
  /** Quota actually charged: `requiredQuotaDays × COMPANY_DAILY_HOURS`. */
  requiredHours: number;
  /** Hours from the employee's own time logs. */
  loggedHours: number;
  /** Approved days off × {@link ACCEPTED_DAY_OFF_HOURS} (9h per day). */
  leaveHours: number;
  /** Official holidays × {@link HOLIDAY_HOURS} (9h per record). */
  holidayHours: number;
  /**
   * «کارکرد مؤثر» — `loggedHours + leaveHours + holidayHours`, i.e. everything
   * the month is credited with.
   */
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
  /** Every official holiday of the selected Jalali year. */
  yearHolidays?: OverviewHoliday[];
  /** Part-time employees are not credited holiday hours. */
  countHolidayHours?: boolean;
}

/**
 * Share of a month that has already elapsed, measured in non-Friday days.
 *
 * Exported — behaviour untouched — so the manager panel can pro-rate a running
 * month's quota by the very same rule the employee balance uses. Copying it
 * there is exactly how the two views would drift apart.
 */
export const elapsedShareOfMonth = (
  jy: number,
  jm: number,
  jd: number
): number => {
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
 * «کارکرد مؤثر» of a month is the *full* credited total, exactly as the
 * dashboard's «کارکرد ماه جاری» card computes it, so the two figures can never
 * disagree:
 *
 *     کارکرد مؤثر = ساعات ثبت‌شده
 *                 + (روزهای مرخصی تأییدشده × ACCEPTED_DAY_OFF_HOURS)
 *                 + (رکوردهای تعطیل رسمی   × HOLIDAY_HOURS)
 *
 * Required hours are always «(روز کاری + تعطیل رسمی) × ۹», straight from the
 * company table in `monthlyWorkQuota.ts` — never derived from the calendar.
 * Holidays therefore sit on both sides and cancel out exactly.
 *
 * The running month is charged only for the quota days elapsed so far
 * (`round(quotaDays × elapsed share) × 9`), and — for the same reason — only
 * leave and holidays **up to today** are credited. Crediting a holiday later
 * this month while its quota is not yet charged would show phantom overtime.
 */
export const buildYearBalance = ({
  year,
  upToMonth,
  today,
  yearTimeLogs,
  yearDayOffRequests,
  yearHolidays = [],
  countHolidayHours = true,
}: BuildYearBalanceInput): YearBalance => {
  const lastMonth =
    year > today.jy ? 0 : Math.min(upToMonth, year < today.jy ? 12 : today.jm);

  /**
   * Today as a DB day key. Leave and holidays are only credited up to here, so
   * a running month never earns hours its quota has not charged for yet. Past
   * months are unaffected — every one of their days is already `<=` this key.
   */
  const todayKey = formatDateForDB(today.jy, today.jm, today.jd);
  const hasHappened = (dateKey: string) => Boolean(dateKey) && dateKey <= todayKey;

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
      const dateKey = toDateKey(request.request_date);
      const jm = monthKeyIndex.get(dateKey);
      if (!jm || !hasHappened(dateKey)) return;
      leaveDaysByMonth.set(jm, (leaveDaysByMonth.get(jm) || 0) + 1);
    });

  // Every registered holiday counts, flat `HOLIDAY_HOURS`, for every employee
  // and regardless of whether they clocked in. The count comes from the
  // registered holiday records, which are expected to match the company
  // table's `officialHolidays` column month by month.
  const holidayDaysByMonth = new Map<number, number>();
  if (countHolidayHours) {
    yearHolidays.forEach((holiday) => {
      const dateKey = toDateKey(holiday.holiday_date);
      const jm = monthKeyIndex.get(dateKey);
      if (!jm || !hasHappened(dateKey)) return;
      holidayDaysByMonth.set(jm, (holidayDaysByMonth.get(jm) || 0) + 1);
    });
  }

  const months: MonthBalance[] = [];

  for (let jm = 1; jm <= lastMonth; jm += 1) {
    const quota = getMonthQuota(jm);
    if (!quota) continue;

    const inProgress = year === today.jy && jm === today.jm;
    const share = inProgress ? elapsedShareOfMonth(year, jm, today.jd) : 1;

    // Part-timers are not credited holiday hours, so they must not be charged
    // for them either — otherwise every holiday would become a deficit.
    const quotaDays = countHolidayHours ? quota.quotaDays : quota.workingDays;
    const requiredQuotaDays = inProgress
      ? Math.round(quotaDays * share)
      : quotaDays;
    // Never `quota.requiredHours * share` — the quota is a whole number of
    // 9-hour days at every point in the month, running or finished.
    const requiredHours = requiredQuotaDays * COMPANY_DAILY_HOURS;

    const loggedHours = loggedByMonth.get(jm) || 0;
    const leaveHours =
      (leaveDaysByMonth.get(jm) || 0) * ACCEPTED_DAY_OFF_HOURS;
    const holidayHours = (holidayDaysByMonth.get(jm) || 0) * HOLIDAY_HOURS;
    const workedHours = loggedHours + leaveHours + holidayHours;

    months.push({
      month: jm,
      monthName: getMonthLabel(jm),
      fullWorkingDays: quota.workingDays,
      fullOfficialHolidays: countHolidayHours ? quota.officialHolidays : 0,
      fullQuotaDays: quotaDays,
      requiredQuotaDays,
      fullRequiredHours: quotaDays * COMPANY_DAILY_HOURS,
      requiredHours,
      loggedHours,
      leaveHours,
      holidayHours,
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
