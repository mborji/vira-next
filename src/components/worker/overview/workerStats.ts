import {
  formatDateForDB,
  getDaysInJalaliMonth,
  getJalaliDayName,
  gregorianToJalali,
  jalaliToGregorian,
  type JalaliDate,
} from "@/utils/jalali";
import { convertToPersianDigits, formatDecimalHoursToTime } from "@/lib/utils";

/**
 * Contractual hours an employee owes for a single working day.
 * "ساعت موظفی" of a month = (working days of that month) × DAILY_REQUIRED_HOURS.
 */
export const DAILY_REQUIRED_HOURS = 8;

/** Hours credited for a single approved day off. */
export const ACCEPTED_DAY_OFF_HOURS = 9;

/** Hours credited for an official holiday (full-time employees only). */
export const HOLIDAY_HOURS = 9;

/** `Date.getDay()` value for Friday — the weekly day off in Iran. */
const FRIDAY = 5;

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
 * Every day of the Jalali month that counts as a working day:
 * the month's days minus Fridays and minus official holidays.
 */
export const getWorkingDayKeys = (
  month: Pick<JalaliDate, "jy" | "jm">,
  holidays: OverviewHoliday[]
): string[] => {
  const holidayKeys = new Set(holidays.map((h) => toDateKey(h.holiday_date)));
  const daysInMonth = getDaysInJalaliMonth(month.jy, month.jm);
  const keys: string[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    if (jalaliToGregorian(month.jy, month.jm, day).getDay() === FRIDAY) continue;
    const key = formatDateForDB(month.jy, month.jm, day);
    if (holidayKeys.has(key)) continue;
    keys.push(key);
  }

  return keys;
};

export interface WorkerMonthStats {
  /** Hours actually credited for the month (work + approved leave + holidays). */
  workedHours: number;
  /** Hours the employee is contractually required to deliver this month. */
  requiredHours: number;
  /** Positive difference between credited and required hours. */
  overtimeHours: number;
  /** Distinct days with at least one time log. */
  attendanceDays: number;
  /** Working days logged with less than a full day of work. */
  lateDays: number;
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
  const workingDaySet = new Set(workingDayKeys);

  const hoursByDay = new Map<string, number>();
  timeLogs.forEach((log) => {
    const key = toDateKey(log.date);
    if (!key) return;
    hoursByDay.set(key, (hoursByDay.get(key) || 0) + loggedHoursOf(log));
  });

  const approvedLeaveKeys = new Set(
    dayOffRequests
      .filter((request) => request.status === "approved")
      .map((request) => toDateKey(request.request_date))
  );

  const requiredHours = workingDayKeys.length * DAILY_REQUIRED_HOURS;

  const lateDays = [...hoursByDay.entries()].filter(
    ([key, hours]) =>
      workingDaySet.has(key) && hours > 0 && hours < DAILY_REQUIRED_HOURS
  ).length;

  const absenceDays = workingDayKeys.filter(
    (key) =>
      key <= todayKey && !hoursByDay.has(key) && !approvedLeaveKeys.has(key)
  ).length;

  return {
    workedHours,
    requiredHours,
    overtimeHours: Math.max(0, workedHours - requiredHours),
    attendanceDays: hoursByDay.size,
    lateDays,
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
