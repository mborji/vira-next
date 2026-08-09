import { getJalaliMonthName } from "@/utils/jalali";

/**
 * Hours a single company day is worth — a working day, an official holiday and
 * an approved day off are all worth exactly this much.
 *
 * This is a *company* rule, not a legal or calendar one. `ACCEPTED_DAY_OFF_HOURS`
 * and `HOLIDAY_HOURS` in `workerStats.ts` re-export this constant, so credit and
 * obligation are the same number and a leave day or a holiday is always neutral —
 * it can never create a deficit.
 */
export const COMPANY_DAILY_HOURS = 9;

interface CompanyMonthRow {
  /** Company working days — official holidays are *not* included. */
  workingDays: number;
  /** Official holidays of the month. Fridays are never counted here. */
  officialHolidays: number;
}

/**
 * **The single source of truth for ۱۴۰۵.** Index 0 is فروردین.
 *
 * These counts are a management decision and are final. The system must never
 * recompute them from the Jalali calendar, from Fridays or from the registered
 * holiday records — Fridays are simply non-working days that appear in neither
 * column. Edit this table when the company publishes a new calendar; nothing
 * else in the codebase may derive these numbers.
 */
export const COMPANY_CALENDAR_1405: readonly CompanyMonthRow[] = [
  { workingDays: 17, officialHolidays: 6 }, // فروردین  → ۱۵۳ + ۵۴ = ۲۰۷
  { workingDays: 22, officialHolidays: 0 }, // اردیبهشت → ۱۹۸ +  ۰ = ۱۹۸
  { workingDays: 21, officialHolidays: 1 }, // خرداد    → ۱۸۹ +  ۹ = ۱۹۸
  { workingDays: 18, officialHolidays: 5 }, // تیر      → ۱۶۲ + ۴۵ = ۲۰۷
  { workingDays: 19, officialHolidays: 2 }, // مرداد    → ۱۷۱ + ۱۸ = ۱۸۹
  { workingDays: 22, officialHolidays: 1 }, // شهریور   → ۱۹۸ +  ۹ = ۲۰۷
  { workingDays: 21, officialHolidays: 0 }, // مهر      → ۱۸۹ +  ۰ = ۱۸۹
  { workingDays: 21, officialHolidays: 0 }, // آبان     → ۱۸۹ +  ۰ = ۱۸۹
  { workingDays: 22, officialHolidays: 0 }, // آذر      → ۱۹۸ +  ۰ = ۱۹۸
  { workingDays: 20, officialHolidays: 2 }, // دی       → ۱۸۰ + ۱۸ = ۱۹۸
  { workingDays: 19, officialHolidays: 1 }, // بهمن     → ۱۷۱ +  ۹ = ۱۸۰
  { workingDays: 18, officialHolidays: 3 }, // اسفند    → ۱۶۲ + ۲۷ = ۱۸۹
];

export interface MonthWorkQuota {
  /** Jalali month number, 1 (فروردین) … 12 (اسفند). */
  month: number;
  /** Company working days — the «روزهای حضور» denominator. */
  workingDays: number;
  /** Official holidays of the month (Fridays excluded). */
  officialHolidays: number;
  /** `workingDays + officialHolidays` — every day the quota charges for. */
  quotaDays: number;
  /** `workingDays × COMPANY_DAILY_HOURS`. */
  workingDayHours: number;
  /** `officialHolidays × COMPANY_DAILY_HOURS`. */
  holidayHours: number;
  /**
   * «ساعت موظفی کل ماه» = `(workingDays + officialHolidays) × COMPANY_DAILY_HOURS`.
   *
   * Holidays sit on *both* sides of the balance: they are charged here and
   * credited back as کارکرد مؤثر, so they cancel out exactly.
   */
  requiredHours: number;
}

/**
 * The company's ۱۴۰۵ quota table:
 * ۲۰۷ / ۱۹۸ / ۱۹۸ / ۲۰۷ / ۱۸۹ / ۲۰۷ / ۱۸۹ / ۱۸۹ / ۱۹۸ / ۱۹۸ / ۱۸۰ / ۱۸۹ ساعت
 * (۲۴۰ روز کاری + ۲۱ تعطیل رسمی = ۲۳۴۹ ساعت در سال).
 *
 * Every figure is *derived* from {@link COMPANY_CALENDAR_1405}, never typed in
 * by hand, so the table can only ever say «(روز کاری + تعطیل رسمی) × ۹».
 */
export const MONTHLY_WORK_QUOTAS: readonly MonthWorkQuota[] =
  COMPANY_CALENDAR_1405.map(({ workingDays, officialHolidays }, index) => ({
    month: index + 1,
    workingDays,
    officialHolidays,
    quotaDays: workingDays + officialHolidays,
    workingDayHours: workingDays * COMPANY_DAILY_HOURS,
    holidayHours: officialHolidays * COMPANY_DAILY_HOURS,
    requiredHours: (workingDays + officialHolidays) * COMPANY_DAILY_HOURS,
  }));

/** Quota row of a Jalali month, or `undefined` for an out-of-range month. */
export const getMonthQuota = (jm: number): MonthWorkQuota | undefined =>
  MONTHLY_WORK_QUOTAS.find((quota) => quota.month === jm);

/** Required hours of a Jalali month (`0` when out of range). */
export const getMonthlyRequiredHours = (jm: number): number =>
  getMonthQuota(jm)?.requiredHours ?? 0;

/** Company working days of a Jalali month (`0` when out of range). */
export const getMonthlyWorkingDays = (jm: number): number =>
  getMonthQuota(jm)?.workingDays ?? 0;

// NOTE: there is deliberately no `getQuotaDailyHours` any more. The daily share
// is the flat COMPANY_DAILY_HOURS constant — never `requiredHours / workingDays`,
// which used to yield ~7:20 and quietly under-credited leave days.

export const getMonthLabel = (jm: number): string => getJalaliMonthName(jm);
