import { getJalaliMonthName } from "@/utils/jalali";

/**
 * Official monthly working-hour quota per Jalali month, as supplied by HR.
 *
 * The quota follows the 44-hour working week: every day except Friday and the
 * official non-Friday holidays is a working day, and each working day is worth
 * 44 / 6 ≈ 7:20 hours. `requiredHours` is the rounded figure HR publishes and
 * is the value the «کسری کار» card compares against — the other columns are
 * kept so the number can be audited against the source table.
 *
 * NOTE: this quota is intentionally separate from the «ساعت موظفی» card, which
 * uses the company's own working-day rule (see `workerStats.ts`). Only the
 * work-deficit calculation reads this table.
 */
export interface MonthWorkQuota {
  /** Jalali month number, 1 (فروردین) … 12 (اسفند). */
  month: number;
  daysInMonth: number;
  fridays: number;
  /** Official holidays of the month that do not fall on a Friday. */
  otherHolidays: number;
  workingDays: number;
  requiredHours: number;
}

export const MONTHLY_WORK_QUOTAS: readonly MonthWorkQuota[] = [
  { month: 1, daysInMonth: 31, fridays: 4, otherHolidays: 7, workingDays: 20, requiredHours: 147 },
  { month: 2, daysInMonth: 31, fridays: 4, otherHolidays: 1, workingDays: 26, requiredHours: 191 },
  { month: 3, daysInMonth: 31, fridays: 5, otherHolidays: 2, workingDays: 24, requiredHours: 176 },
  { month: 4, daysInMonth: 31, fridays: 4, otherHolidays: 2, workingDays: 25, requiredHours: 183 },
  { month: 5, daysInMonth: 31, fridays: 5, otherHolidays: 3, workingDays: 23, requiredHours: 169 },
  { month: 6, daysInMonth: 31, fridays: 4, otherHolidays: 1, workingDays: 26, requiredHours: 191 },
  { month: 7, daysInMonth: 30, fridays: 4, otherHolidays: 0, workingDays: 26, requiredHours: 191 },
  { month: 8, daysInMonth: 30, fridays: 5, otherHolidays: 0, workingDays: 25, requiredHours: 183 },
  { month: 9, daysInMonth: 30, fridays: 4, otherHolidays: 0, workingDays: 26, requiredHours: 191 },
  { month: 10, daysInMonth: 30, fridays: 4, otherHolidays: 2, workingDays: 24, requiredHours: 176 },
  { month: 11, daysInMonth: 30, fridays: 5, otherHolidays: 2, workingDays: 23, requiredHours: 169 },
  { month: 12, daysInMonth: 29, fridays: 4, otherHolidays: 4, workingDays: 21, requiredHours: 154 },
];

/** Quota row of a Jalali month, or `undefined` for an out-of-range month. */
export const getMonthQuota = (jm: number): MonthWorkQuota | undefined =>
  MONTHLY_WORK_QUOTAS.find((quota) => quota.month === jm);

/** Published required hours of a Jalali month (`0` when out of range). */
export const getMonthlyRequiredHours = (jm: number): number =>
  getMonthQuota(jm)?.requiredHours ?? 0;

/**
 * Hours a single working day of the month is worth — used to credit an
 * approved day off against that month's quota.
 */
export const getQuotaDailyHours = (jm: number): number => {
  const quota = getMonthQuota(jm);
  if (!quota || !quota.workingDays) return 0;
  return quota.requiredHours / quota.workingDays;
};

export const getMonthLabel = (jm: number): string => getJalaliMonthName(jm);
