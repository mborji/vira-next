import { formatDateForDB, type JalaliDate } from "@/utils/jalali";
import {
  COMPANY_DAILY_HOURS,
  getMonthQuota,
} from "@/components/worker/overview/monthlyWorkQuota";
import {
  buildWorkerMonthStats,
  type OverviewDayOffRequest,
  type OverviewHoliday,
  type OverviewTimeLog,
} from "@/components/worker/overview/workerStats";
import { elapsedShareOfMonth } from "@/components/worker/overview/workBalance";

/**
 * Per-employee figures the manager panel's comparison charts and the redesigned
 * employee cards read.
 *
 * **Nothing here fetches anything.** Every field is derived, in the browser,
 * from data `WorkerManagement` has already loaded for the selected month:
 * `timeLogs`, `dayOffRequests`, `holidays` and `workers`. No endpoint, no query
 * key and no role check is involved.
 *
 * The three figures the panel already displayed — credited hours, days worked
 * and approved leave — are **passed in** from the existing
 * `calculateWorkerSummaries`, not recomputed here, so the redesign cannot make
 * those numbers disagree with what the panel showed before.
 */
export interface ManagerWorkerStats {
  /** `profiles.user_id` — the id every attendance row points at. */
  workerId: string;
  /** «کارکرد مؤثر» of the month, straight from the existing summary. */
  workedHours: number;
  /**
   * «ساعت موظفی» of the month for this employee, from the company quota table
   * in `monthlyWorkQuota.ts` — never derived from the calendar. A running month
   * is charged only for the quota days elapsed so far, by the same
   * `elapsedShareOfMonth` rule the employee dashboard's balance uses, and a
   * month in the future is charged nothing.
   */
  requiredHours: number;
  /** `workedHours − requiredHours`: positive is overtime, negative a deficit. */
  balanceHours: number;
  /** `max(0, balanceHours)` — the «اضافه‌کاری» figure. */
  overtimeHours: number;
  /** `max(0, −balanceHours)` — the «کسری» figure. */
  deficitHours: number;
  /** Distinct days with at least one time log, from the existing summary. */
  attendanceDays: number;
  /** Approved days off of the month, from the existing summary. */
  leaveDays: number;
  /** Elapsed working days with neither a time log nor approved leave. */
  absenceDays: number;
  /** Working days whose clock-in was after ۰۹:۳۰. */
  lateDays: number;
  /** Total minutes late across those days. */
  totalDelayMinutes: number;
  /** Company working days of the month — the «روزهای حضور» denominator. */
  requiredWorkingDays: number;
  /** `workedHours / requiredHours` as a percentage, clamped to 0…100 for bars. */
  completionPercent: number;
}

interface BuildInput {
  /** The Jalali month the panel is showing. */
  month: Pick<JalaliDate, "jy" | "jm">;
  /** Today's Jalali date, so a running month is charged only up to now. */
  today: JalaliDate;
  workerId: string;
  /** `false` for part-timers, who are neither credited nor charged holidays. */
  countHolidayHours: boolean;
  /** This employee's time logs for the month. */
  timeLogs: OverviewTimeLog[];
  /** This employee's day-off requests for the month. */
  dayOffRequests: OverviewDayOffRequest[];
  /** The month's registered official holidays. */
  holidays: OverviewHoliday[];
  /** Credited hours as the panel already computes them. */
  workedHours: number;
  /** Days worked as the panel already computes them. */
  attendanceDays: number;
  /** Approved leave days as the panel already computes them. */
  leaveDays: number;
}

/**
 * «ساعت موظفی» of one employee for one month.
 *
 * The rule is the employee dashboard's, unchanged:
 * `(روز کاری [+ تعطیل رسمی]) × ۹`, with the holiday half dropped for
 * part-timers — they are not credited holiday hours, so charging them would
 * turn every holiday into a deficit. A running month is charged only for the
 * quota days already elapsed; a future month is charged nothing.
 */
const requiredHoursFor = (
  month: Pick<JalaliDate, "jy" | "jm">,
  today: JalaliDate,
  countHolidayHours: boolean
): { requiredHours: number; requiredWorkingDays: number } => {
  const quota = getMonthQuota(month.jm);
  if (!quota) return { requiredHours: 0, requiredWorkingDays: 0 };

  const isFuture =
    month.jy > today.jy || (month.jy === today.jy && month.jm > today.jm);
  if (isFuture) {
    return { requiredHours: 0, requiredWorkingDays: quota.workingDays };
  }

  const inProgress = month.jy === today.jy && month.jm === today.jm;
  const share = inProgress
    ? elapsedShareOfMonth(month.jy, month.jm, today.jd)
    : 1;

  const quotaDays = countHolidayHours ? quota.quotaDays : quota.workingDays;
  // Never `quota.requiredHours × share` — the quota is a whole number of
  // 9-hour days at every point in the month, running or finished.
  const requiredQuotaDays = inProgress
    ? Math.round(quotaDays * share)
    : quotaDays;

  return {
    requiredHours: requiredQuotaDays * COMPANY_DAILY_HOURS,
    requiredWorkingDays: quota.workingDays,
  };
};

export const buildManagerWorkerStats = ({
  month,
  today,
  workerId,
  countHolidayHours,
  timeLogs,
  dayOffRequests,
  holidays,
  workedHours,
  attendanceDays,
  leaveDays,
}: BuildInput): ManagerWorkerStats => {
  const { requiredHours, requiredWorkingDays } = requiredHoursFor(
    month,
    today,
    countHolidayHours
  );

  // Absences, late days and total delay come from the employee dashboard's own
  // helper, so the manager panel and the employee's page can only ever agree.
  // Its `requiredHours` field is deliberately ignored here: it is the flat
  // monthly quota, while this panel pro-rates a running month (above).
  const monthStats = buildWorkerMonthStats({
    month,
    todayKey: formatDateForDB(today.jy, today.jm, today.jd),
    timeLogs,
    dayOffRequests,
    holidays,
    workedHours,
  });

  const balanceHours = workedHours - requiredHours;

  return {
    workerId,
    workedHours,
    requiredHours,
    balanceHours,
    overtimeHours: Math.max(0, balanceHours),
    deficitHours: Math.max(0, -balanceHours),
    attendanceDays,
    leaveDays,
    absenceDays: monthStats.absenceDays,
    lateDays: monthStats.lateDays,
    totalDelayMinutes: monthStats.totalDelayMinutes,
    requiredWorkingDays,
    completionPercent:
      requiredHours > 0
        ? Math.min(100, Math.max(0, (workedHours / requiredHours) * 100))
        : 0,
  };
};
