import { getJalaliMonthName } from "@/utils/jalali";

/**
 * Hours a single company working day is worth. The company runs a fixed 9-hour
 * day, so this is a policy constant — never a share derived from the calendar.
 */
export const COMPANY_DAILY_HOURS = 9;

/**
 * The company's own working-day table, one row per Jalali month.
 *
 * These day counts are set by company policy, not by the national calendar:
 * the system must never re-derive them from the number of calendar days, the
 * Fridays in a month, or the registered holidays. `requiredHours` is always
 * `workingDays × COMPANY_DAILY_HOURS`.
 *
 * Official holidays are handled entirely separately — every record an admin
 * registers is credited as worked hours in `workBalance.ts`; none of them
 * changes the figures below.
 */
export interface MonthWorkQuota {
  /** Jalali month number, 1 (فروردین) … 12 (اسفند). */
  month: number;
  /** Working days defined by the company for this month. */
  workingDays: number;
  /** `workingDays × COMPANY_DAILY_HOURS`. */
  requiredHours: number;
}

const quota = (month: number, workingDays: number): MonthWorkQuota => ({
  month,
  workingDays,
  requiredHours: workingDays * COMPANY_DAILY_HOURS,
});

export const MONTHLY_WORK_QUOTAS: readonly MonthWorkQuota[] = [
  quota(1, 23), //  فروردین  → ۲۰۷
  quota(2, 22), //  اردیبهشت → ۱۹۸
  quota(3, 22), //  خرداد    → ۱۹۸
  quota(4, 23), //  تیر      → ۲۰۷
  quota(5, 21), //  مرداد    → ۱۸۹
  quota(6, 23), //  شهریور   → ۲۰۷
  quota(7, 21), //  مهر      → ۱۸۹
  quota(8, 21), //  آبان     → ۱۸۹
  quota(9, 22), //  آذر      → ۱۹۸
  quota(10, 22), // دی       → ۱۹۸
  quota(11, 20), // بهمن     → ۱۸۰
  quota(12, 21), // اسفند    → ۱۸۹
];

/** Quota row of a Jalali month, or `undefined` for an out-of-range month. */
export const getMonthQuota = (jm: number): MonthWorkQuota | undefined =>
  MONTHLY_WORK_QUOTAS.find((row) => row.month === jm);

/** Company working days of a Jalali month (`0` when out of range). */
export const getMonthWorkingDays = (jm: number): number =>
  getMonthQuota(jm)?.workingDays ?? 0;

/** Required hours of a Jalali month (`0` when out of range). */
export const getMonthlyRequiredHours = (jm: number): number =>
  getMonthQuota(jm)?.requiredHours ?? 0;

export const getMonthLabel = (jm: number): string => getJalaliMonthName(jm);
