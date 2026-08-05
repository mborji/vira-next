import {
  formatDateForDB,
  getDaysInJalaliMonth,
  getJalaliDayName,
  gregorianToJalali,
  jalaliToGregorian,
  type JalaliDate,
} from "@/utils/jalali";
import { convertToPersianDigits, formatDecimalHoursToTime } from "@/lib/utils";
import { getMonthQuota } from "./monthlyWorkQuota";

/** Hours credited for a single approved day off. */
export const ACCEPTED_DAY_OFF_HOURS = 9;

/** Hours credited for an official holiday (full-time employees only). */
export const HOLIDAY_HOURS = 9;

/**
 * Weekly days off, as `Date.getDay()` values — Thursday (4) and Friday (5).
 * They never count as working days, so they are excluded from the required
 * hours, from absences and from late arrivals.
 */
export const NON_WORKING_WEEKDAYS: readonly number[] = [4, 5];

/**
 * Latest arrival that is still on time. Anything after this counts as a delay,
 * and the delay duration is the difference from this moment.
 */
export const ALLOWED_ARRIVAL_TIME = "09:30";

export interface OverviewTimeLog {
  id: string;
  date: string;
  hours_worked?: string | null;
  hours_worked_str?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  start_time_2?: string | null;
  end_time_2?: string | null;
  description?: string | null;
}

export interface OverviewDayOffRequest {
  id: string;
  request_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

export interface OverviewHoliday {
  id: string;
  holiday_date: string;
  title?: string | null;
}

/** Normalises any API date (ISO string or `YYYY-MM-DD`) to a `YYYY-MM-DD` key. */
export const toDateKey = (value?: string | null): string =>
  value ? String(value).substring(0, 10) : "";

/** Converts an `HH:MM` / `HH:MM:SS` duration into decimal hours. */
export const parseDurationToHours = (value?: string | null): number => {
  if (!value) return 0;
  const [hours, minutes] = String(value).split(":").map(Number);
  if (!Number.isFinite(hours)) return 0;
  return hours + (Number.isFinite(minutes) ? minutes : 0) / 60;
};

/**
 * Minutes since midnight for a clock value (`HH:MM`, `HH:MM:SS` or an ISO
 * date-time). Returns `null` when the value is missing or unparsable.
 */
export const parseClockToMinutes = (value?: string | null): number | null => {
  if (!value) return null;
  const raw = String(value);
  const timePart = raw.includes("T") ? raw.split("T")[1] : raw;
  const match = timePart.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

/** Minutes since midnight of the configured on-time arrival. */
export const ALLOWED_ARRIVAL_MINUTES =
  parseClockToMinutes(ALLOWED_ARRIVAL_TIME) ?? 0;

/** True when the given `YYYY-MM-DD` key falls on a Friday. */
export const isFriday = (dateKey: string): boolean => {
  const [year, month, day] = toDateKey(dateKey).split("-").map(Number);
  if (!year || !month || !day) return false;
  return new Date(year, month - 1, day).getDay() === 5;
};

/**
 * Official holidays of a month that do **not** fall on a Friday, counted from
 * the records an admin registered — never from a built-in calendar.
 */
export const countNonFridayHolidays = (holidays: OverviewHoliday[]): number =>
  holidays.filter((holiday) => !isFriday(toDateKey(holiday.holiday_date)))
    .length;

/** True when the given `YYYY-MM-DD` key falls on a weekly day off. */
export const isNonWorkingWeekday = (dateKey: string): boolean => {
  const [year, month, day] = toDateKey(dateKey).split("-").map(Number);
  if (!year || !month || !day) return false;
  return NON_WORKING_WEEKDAYS.includes(new Date(year, month - 1, day).getDay());
};

export const loggedHoursOf = (log: OverviewTimeLog): number =>
  parseDurationToHours(log.hours_worked_str || log.hours_worked);

/** Groups time logs by their `YYYY-MM-DD` key, preserving API order. */
export const groupTimeLogsByDay = (
  timeLogs: OverviewTimeLog[]
): Map<string, OverviewTimeLog[]> => {
  const grouped = new Map<string, OverviewTimeLog[]>();
  timeLogs.forEach((log) => {
    const key = toDateKey(log.date);
    if (!key) return;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(log);
    else grouped.set(key, [log]);
  });
  return grouped;
};

/** Total credited hours of a single day across all of its time logs. */
export const sumLoggedHours = (logs: OverviewTimeLog[]): number =>
  logs.reduce((total, log) => total + loggedHoursOf(log), 0);

/**
 * Earliest clock-in of a day, in minutes since midnight. Both shifts are
 * considered so an out-of-order second shift cannot hide the real arrival.
 */
export const getArrivalMinutes = (logs: OverviewTimeLog[]): number | null => {
  const arrivals = logs
    .flatMap((log) => [log.start_time, log.start_time_2])
    .map((value) => parseClockToMinutes(value))
    .filter((value): value is number => value !== null);

  return arrivals.length ? Math.min(...arrivals) : null;
};

/**
 * Latest clock-out of a day, in minutes since midnight. Both shifts are
 * considered so the second shift's end wins when one is recorded.
 */
export const getDepartureMinutes = (logs: OverviewTimeLog[]): number | null => {
  const departures = logs
    .flatMap((log) => [log.end_time, log.end_time_2])
    .map((value) => parseClockToMinutes(value))
    .filter((value): value is number => value !== null);

  return departures.length ? Math.max(...departures) : null;
};

/**
 * Minutes late for a day: the gap between the actual arrival and
 * {@link ALLOWED_ARRIVAL_TIME}. `0` when on time, `null` when no clock-in
 * was recorded (a missing arrival is an absence, not a delay).
 */
export const getDelayMinutes = (logs: OverviewTimeLog[]): number | null => {
  const arrival = getArrivalMinutes(logs);
  if (arrival === null) return null;
  return Math.max(0, arrival - ALLOWED_ARRIVAL_MINUTES);
};

/**
 * Every day of the Jalali month that counts as a working day: the month's days
 * minus the weekly days off ({@link NON_WORKING_WEEKDAYS} — Thursday and
 * Friday) and minus official holidays.
 */
export const getWorkingDayKeys = (
  month: Pick<JalaliDate, "jy" | "jm">,
  holidays: OverviewHoliday[]
): string[] => {
  const holidayKeys = new Set(holidays.map((h) => toDateKey(h.holiday_date)));
  const daysInMonth = getDaysInJalaliMonth(month.jy, month.jm);
  const keys: string[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const weekday = jalaliToGregorian(month.jy, month.jm, day).getDay();
    if (NON_WORKING_WEEKDAYS.includes(weekday)) continue;
    const key = formatDateForDB(month.jy, month.jm, day);
    if (holidayKeys.has(key)) continue;
    keys.push(key);
  }

  return keys;
};

export interface WorkerMonthStats {
  /** Hours actually credited for the month (work + approved leave + holidays). */
  workedHours: number;
  /**
   * Company quota for the month, read from `monthlyWorkQuota.ts`:
   * `workingDays × COMPANY_DAILY_HOURS`. Set by company policy, never derived
   * from the calendar. `getWorkingDayKeys` drives only absence and late arrivals.
   */
  requiredHours: number;
  /** Company working days of the month — the «روزهای حضور» denominator. */
  requiredWorkingDays: number;
  /** Distinct days with at least one time log. */
  attendanceDays: number;
  /** Working days whose clock-in was after {@link ALLOWED_ARRIVAL_TIME}. */
  lateDays: number;
  /** Total minutes late across those days. */
  totalDelayMinutes: number;
  /** Elapsed working days with no time log and no approved leave. */
  absenceDays: number;
  /** `workedHours / requiredHours` as a percentage (not clamped). */
  completionPercent: number;
}

interface BuildStatsInput {
  month: Pick<JalaliDate, "jy" | "jm">;
  /** Today as a `YYYY-MM-DD` key — used so future days never count as absences. */
  todayKey: string;
  timeLogs: OverviewTimeLog[];
  dayOffRequests: OverviewDayOffRequest[];
  holidays: OverviewHoliday[];
  /** Credited hours already computed by the dashboard (kept as the source of truth). */
  workedHours: number;
}

export const buildWorkerMonthStats = ({
  month,
  todayKey,
  timeLogs,
  dayOffRequests,
  holidays,
  workedHours,
}: BuildStatsInput): WorkerMonthStats => {
  const workingDayKeys = getWorkingDayKeys(month, holidays);
  const logsByDay = groupTimeLogsByDay(timeLogs);

  const approvedLeaveKeys = new Set(
    dayOffRequests
      .filter((request) => request.status === "approved")
      .map((request) => toDateKey(request.request_date))
  );

  // The monthly quota is published by HR, not derived from the calendar.
  const quota = getMonthQuota(month.jm);
  const requiredHours = quota?.requiredHours ?? 0;
  const requiredWorkingDays = quota?.workingDays ?? 0;

  // A delay is a late clock-in on a working day — never on a Thursday,
  // a Friday or an official holiday.
  const delays = workingDayKeys
    .map((key) => getDelayMinutes(logsByDay.get(key) || []))
    .filter((minutes): minutes is number => minutes !== null && minutes > 0);

  const absenceDays = workingDayKeys.filter(
    (key) =>
      key <= todayKey && !logsByDay.has(key) && !approvedLeaveKeys.has(key)
  ).length;

  return {
    workedHours,
    requiredHours,
    requiredWorkingDays,
    attendanceDays: logsByDay.size,
    lateDays: delays.length,
    totalDelayMinutes: delays.reduce((sum, minutes) => sum + minutes, 0),
    absenceDays,
    completionPercent:
      requiredHours > 0 ? (workedHours / requiredHours) * 100 : 0,
  };
};

export interface LeaveSummary {
  pending: number;
  approved: number;
  rejected: number;
}

export const summarizeLeaveRequests = (
  requests: OverviewDayOffRequest[]
): LeaveSummary =>
  requests.reduce<LeaveSummary>(
    (summary, request) => {
      if (request.status === "approved") summary.approved += 1;
      else if (request.status === "rejected") summary.rejected += 1;
      else summary.pending += 1;
      return summary;
    },
    { pending: 0, approved: 0, rejected: 0 }
  );

/** Persian-digit integer, e.g. `22` → `۲۲`. */
export const formatCount = (value: number): string =>
  convertToPersianDigits(String(Math.round(value)));

/**
 * Persian-digit hour amount with at most one decimal, e.g. `182` → `۱۸۲`
 * and `7.5` → `۷٫۵`.
 */
export const formatHours = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(".", "٫");
  return convertToPersianDigits(text);
};

/**
 * A duration in minutes, written out in Persian:
 * `0` → `بدون تأخیر`, `5` → `۵ دقیقه`, `75` → `۱ ساعت و ۱۵ دقیقه`.
 */
export const formatMinutesLabel = (
  minutes: number,
  zeroLabel = "بدون تأخیر"
): string => {
  const total = Math.max(0, Math.round(minutes));
  if (total === 0) return zeroLabel;

  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (!hours) return `${formatCount(rest)} دقیقه`;
  if (!rest) return `${formatCount(hours)} ساعت`;
  return `${formatCount(hours)} ساعت و ${formatCount(rest)} دقیقه`;
};

/** Decimal hours as a Persian `HH:MM` clock, e.g. `7.5` → `۰۷:۳۰`. */
export const formatDuration = (hours: number): string =>
  convertToPersianDigits(formatDecimalHoursToTime(hours));

/**
 * A `HH:MM[:SS]` (or ISO date-time) column value as a Persian `HH:MM` clock.
 * Returns an em dash when the value is missing or unparsable.
 */
export const formatClock = (value?: string | null): string => {
  if (!value) return "—";
  const raw = String(value);
  const timePart = raw.includes("T") ? raw.split("T")[1] : raw;
  const match = timePart.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "—";
  return convertToPersianDigits(`${match[1].padStart(2, "0")}:${match[2]}`);
};

/** Minutes since midnight as a Persian `HH:MM` clock, e.g. `575` → `۰۹:۳۵`. */
export const formatMinutesAsClock = (minutes: number | null): string => {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const total = Math.max(0, Math.round(minutes));
  return convertToPersianDigits(
    `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
      total % 60
    ).padStart(2, "0")}`
  );
};

/** Persian weekday name of a `YYYY-MM-DD` key, e.g. `۱۴۰۵/۰۵/۰۱` → `پنج‌شنبه`. */
export const getDayName = (dateKey: string): string => {
  const [year, month, day] = toDateKey(dateKey).split("-").map(Number);
  if (!year || !month || !day) return "—";
  return getJalaliDayName(new Date(year, month - 1, day).getDay());
};

/** `2026-05-06` → `۱۴۰۵/۰۲/۱۶` */
export const formatJalaliFromDbDate = (value?: string | null): string => {
  const key = toDateKey(value);
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return "—";

  const jalali = gregorianToJalali(new Date(year, month - 1, day));
  return convertToPersianDigits(
    `${jalali.jy}/${String(jalali.jm).padStart(2, "0")}/${String(
      jalali.jd
    ).padStart(2, "0")}`
  );
};

/** Initials shown inside the profile avatar, e.g. "مهسا برجی" → "م ب". */
export const getInitials = (fullName?: string | null, email?: string): string => {
  const name = (fullName || "").trim();
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join(" ");
  }
  return (email || "?").charAt(0).toUpperCase();
};
