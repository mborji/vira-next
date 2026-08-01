import type { JalaliDate } from "@/utils/jalali";
import type { StatTone } from "./OverviewStatCard";
import {
  ACCEPTED_DAY_OFF_HOURS,
  DAILY_REQUIRED_HOURS,
  HOLIDAY_HOURS,
  buildWorkerMonthStats,
  formatClock,
  formatCount,
  formatDuration,
  formatHours,
  formatJalaliFromDbDate,
  getDayName,
  getWorkingDayKeys,
  groupTimeLogsByDay,
  sumLoggedHours,
  toDateKey,
  type OverviewDayOffRequest,
  type OverviewHoliday,
  type OverviewTimeLog,
} from "./workerStats";

/** Every summary card of the employee dashboard that opens a detail view. */
export type MetricKey =
  | "worked"
  | "required"
  | "overtime"
  | "attendance"
  | "late"
  | "absence"
  | "today"
  | "pendingLeave";

export type CellTone =
  | "default"
  | "muted"
  | "teal"
  | "emerald"
  | "amber"
  | "rose";

export interface MetricCell {
  text: string;
  tone?: CellTone;
  /** Renders the cell as a coloured pill instead of plain text. */
  badge?: boolean;
  /** Forces LTR so multi-part clock values keep their order in an RTL table. */
  ltr?: boolean;
}

export interface MetricDetailRow {
  id: string;
  /** Positional — one cell per column, in column order. */
  cells: MetricCell[];
}

export interface MetricColumn {
  label: string;
  className?: string;
}

export interface MetricDetail {
  key: MetricKey;
  title: string;
  /** How the card's number is calculated — shown under the dialog title. */
  description: string;
  /** The card's own value, restated inside the dialog. */
  headline: string;
  headlineTone: StatTone;
  columns: MetricColumn[];
  rows: MetricDetailRow[];
  footer?: { label: string; value: string };
  emptyText: string;
}

export interface MetricDetailInput {
  month: Pick<JalaliDate, "jy" | "jm">;
  todayKey: string;
  timeLogs: OverviewTimeLog[];
  dayOffRequests: OverviewDayOffRequest[];
  holidays: OverviewHoliday[];
  /** Credited hours for the month, as computed by the dashboard. */
  workedHours: number;
  /** Part-time employees are not credited holiday hours. */
  countHolidayHours: boolean;
}

const text = (value: string, tone?: CellTone): MetricCell => ({
  text: value,
  tone,
});

const badge = (value: string, tone: CellTone): MetricCell => ({
  text: value,
  tone,
  badge: true,
});

const dateCell = (dateKey: string) => text(formatJalaliFromDbDate(dateKey));
const dayCell = (dateKey: string) => text(getDayName(dateKey), "muted");

/** `09:00` or `09:00 / 14:30` when a second shift is logged. */
const shiftCell = (
  logs: OverviewTimeLog[],
  first: "start_time" | "end_time",
  second: "start_time_2" | "end_time_2"
): MetricCell => {
  const parts = logs
    .flatMap((log) => [log[first], log[second]])
    .filter(Boolean)
    .map((value) => formatClock(value))
    .filter((value) => value !== "—");

  return { text: parts.length ? parts.join(" / ") : "—", ltr: parts.length > 1 };
};

const descriptionCell = (logs: OverviewTimeLog[]): MetricCell => {
  const notes = logs
    .map((log) => (log.description || "").trim())
    .filter(Boolean);
  return text(notes.length ? notes.join(" ، ") : "—", "muted");
};

const LEAVE_STATUS: Record<
  OverviewDayOffRequest["status"],
  { label: string; tone: CellTone }
> = {
  approved: { label: "تأیید شده", tone: "emerald" },
  pending: { label: "در انتظار", tone: "amber" },
  rejected: { label: "رد شده", tone: "rose" },
};

/**
 * Builds the table shown when a summary card is clicked. Every row is derived
 * from the same live API data the cards are built from — nothing is mocked.
 */
export const buildMetricDetail = (
  key: MetricKey,
  input: MetricDetailInput
): MetricDetail => {
  const {
    month,
    todayKey,
    timeLogs,
    dayOffRequests,
    holidays,
    workedHours,
    countHolidayHours,
  } = input;

  const stats = buildWorkerMonthStats({
    month,
    todayKey,
    timeLogs,
    dayOffRequests,
    holidays,
    workedHours,
  });

  const logsByDay = groupTimeLogsByDay(timeLogs);
  const loggedDayKeys = [...logsByDay.keys()].sort();
  const workingDayKeys = getWorkingDayKeys(month, holidays);
  const workingDaySet = new Set(workingDayKeys);
  const hoursOf = (dateKey: string) =>
    sumLoggedHours(logsByDay.get(dateKey) || []);

  const leaveByDay = new Map(
    dayOffRequests.map((request) => [toDateKey(request.request_date), request])
  );

  switch (key) {
    case "attendance":
    case "today": {
      const isToday = key === "today";
      const days = isToday
        ? loggedDayKeys.filter((dateKey) => dateKey === todayKey)
        : loggedDayKeys;
      const totalHours = days.reduce((sum, dateKey) => sum + hoursOf(dateKey), 0);

      return {
        key,
        title: isToday ? "ساعات امروز" : "روزهای حضور",
        description: isToday
          ? "کارکرد ثبت‌شده برای امروز، به تفکیک شیفت."
          : "روزهایی از ماه انتخاب‌شده که برای آن‌ها کارکرد ثبت شده است.",
        headline: isToday
          ? `${formatDuration(totalHours)} ساعت`
          : `${formatCount(stats.attendanceDays)} روز`,
        headlineTone: isToday ? "teal" : "blue",
        columns: [
          { label: "تاریخ" },
          { label: "روز" },
          { label: "ورود" },
          { label: "خروج" },
          { label: "کارکرد" },
          { label: "توضیحات" },
        ],
        rows: days.map((dateKey) => {
          const logs = logsByDay.get(dateKey) || [];
          return {
            id: dateKey,
            cells: [
              dateCell(dateKey),
              dayCell(dateKey),
              shiftCell(logs, "start_time", "start_time_2"),
              shiftCell(logs, "end_time", "end_time_2"),
              text(formatDuration(hoursOf(dateKey)), "teal"),
              descriptionCell(logs),
            ],
          };
        }),
        footer: { label: "جمع کارکرد", value: formatDuration(totalHours) },
        emptyText: isToday
          ? "برای امروز کارکردی ثبت نشده است."
          : "در این ماه کارکردی ثبت نشده است.",
      };
    }

    case "late": {
      const days = loggedDayKeys.filter((dateKey) => {
        const hours = hoursOf(dateKey);
        return (
          workingDaySet.has(dateKey) && hours > 0 && hours < DAILY_REQUIRED_HOURS
        );
      });
      const shortfall = days.reduce(
        (sum, dateKey) => sum + (DAILY_REQUIRED_HOURS - hoursOf(dateKey)),
        0
      );

      return {
        key,
        title: "تأخیر",
        description: `روزهای کاری که کارکرد ثبت‌شده در آن‌ها کمتر از ${formatCount(
          DAILY_REQUIRED_HOURS
        )} ساعت موظفی روزانه بوده است.`,
        headline: `${formatCount(stats.lateDays)} بار`,
        headlineTone: "amber",
        columns: [
          { label: "تاریخ" },
          { label: "روز" },
          { label: "ورود" },
          { label: "خروج" },
          { label: "کارکرد" },
          { label: "کسری" },
        ],
        rows: days.map((dateKey) => {
          const logs = logsByDay.get(dateKey) || [];
          const hours = hoursOf(dateKey);
          return {
            id: dateKey,
            cells: [
              dateCell(dateKey),
              dayCell(dateKey),
              shiftCell(logs, "start_time", "start_time_2"),
              shiftCell(logs, "end_time", "end_time_2"),
              text(formatDuration(hours)),
              text(formatDuration(DAILY_REQUIRED_HOURS - hours), "rose"),
            ],
          };
        }),
        footer: { label: "جمع کسری", value: formatDuration(shortfall) },
        emptyText: "در این ماه تأخیری ثبت نشده است.",
      };
    }

    case "absence": {
      const days = workingDayKeys.filter(
        (dateKey) =>
          dateKey <= todayKey &&
          !logsByDay.has(dateKey) &&
          leaveByDay.get(dateKey)?.status !== "approved"
      );

      return {
        key,
        title: "غیبت",
        description:
          "روزهای کاری سپری‌شده که نه کارکردی برای آن‌ها ثبت شده و نه مرخصی تأییدشده‌ای دارند. جمعه‌ها و تعطیلات رسمی محاسبه نمی‌شوند.",
        headline: `${formatCount(stats.absenceDays)} روز`,
        headlineTone: "rose",
        columns: [
          { label: "تاریخ" },
          { label: "روز" },
          { label: "وضعیت" },
          { label: "توضیحات" },
        ],
        rows: days.map((dateKey) => {
          const leave = leaveByDay.get(dateKey);
          const status = leave
            ? leave.status === "rejected"
              ? badge("مرخصی رد شده", "rose")
              : badge("مرخصی در انتظار تأیید", "amber")
            : badge("بدون ثبت کارکرد", "rose");

          return {
            id: dateKey,
            cells: [
              dateCell(dateKey),
              dayCell(dateKey),
              status,
              text(leave?.reason || "—", "muted"),
            ],
          };
        }),
        emptyText: "در این ماه غیبتی ثبت نشده است.",
      };
    }

    case "overtime": {
      const days = loggedDayKeys.filter(
        (dateKey) => hoursOf(dateKey) > DAILY_REQUIRED_HOURS
      );
      const surplus = days.reduce(
        (sum, dateKey) => sum + (hoursOf(dateKey) - DAILY_REQUIRED_HOURS),
        0
      );

      return {
        key,
        title: "اضافه‌کاری",
        description: `عدد کارت از تفاضل کل کارکرد ماه و ساعت موظفی به دست می‌آید. جدول زیر روزهایی را نشان می‌دهد که کارکرد آن‌ها بیش از ${formatCount(
          DAILY_REQUIRED_HOURS
        )} ساعت بوده است.`,
        headline: `${formatHours(stats.overtimeHours)} ساعت`,
        headlineTone: "emerald",
        columns: [
          { label: "تاریخ" },
          { label: "روز" },
          { label: "کارکرد" },
          { label: "مازاد روزانه" },
        ],
        rows: days.map((dateKey) => {
          const hours = hoursOf(dateKey);
          return {
            id: dateKey,
            cells: [
              dateCell(dateKey),
              dayCell(dateKey),
              text(formatDuration(hours)),
              text(formatDuration(hours - DAILY_REQUIRED_HOURS), "emerald"),
            ],
          };
        }),
        footer: { label: "جمع مازاد روزانه", value: formatDuration(surplus) },
        emptyText: "در این ماه روزی با کارکرد بیش از حد موظفی ثبت نشده است.",
      };
    }

    case "required": {
      return {
        key,
        title: "ساعت موظفی",
        description: `روزهای کاری ماه (به جز جمعه‌ها و تعطیلات رسمی) ضربدر ${formatCount(
          DAILY_REQUIRED_HOURS
        )} ساعت.`,
        headline: `${formatHours(stats.requiredHours)} ساعت`,
        headlineTone: "slate",
        columns: [
          { label: "تاریخ" },
          { label: "روز" },
          { label: "ساعت موظفی" },
          { label: "وضعیت" },
        ],
        rows: workingDayKeys.map((dateKey) => {
          const hasLog = logsByDay.has(dateKey);
          const approvedLeave =
            leaveByDay.get(dateKey)?.status === "approved";
          const status = hasLog
            ? badge("کارکرد ثبت شده", "teal")
            : approvedLeave
            ? badge("مرخصی تأیید شده", "emerald")
            : dateKey <= todayKey
            ? badge("بدون ثبت", "rose")
            : badge("پیش رو", "muted");

          return {
            id: dateKey,
            cells: [
              dateCell(dateKey),
              dayCell(dateKey),
              text(formatDuration(DAILY_REQUIRED_HOURS)),
              status,
            ],
          };
        }),
        footer: {
          label: "جمع ساعت موظفی",
          value: formatDuration(stats.requiredHours),
        },
        emptyText: "روز کاری‌ای برای این ماه یافت نشد.",
      };
    }

    case "worked": {
      const rows: MetricDetailRow[] = [
        ...loggedDayKeys.map((dateKey) => {
          const logs = logsByDay.get(dateKey) || [];
          return {
            id: `log-${dateKey}`,
            sortKey: dateKey,
            cells: [
              dateCell(dateKey),
              badge("کارکرد", "teal"),
              text(formatDuration(hoursOf(dateKey))),
              descriptionCell(logs),
            ],
          };
        }),
        ...dayOffRequests
          .filter((request) => request.status === "approved")
          .map((request) => {
            const dateKey = toDateKey(request.request_date);
            return {
              id: `leave-${request.id}`,
              sortKey: dateKey,
              cells: [
                dateCell(dateKey),
                badge("مرخصی تأیید شده", "emerald"),
                text(formatDuration(ACCEPTED_DAY_OFF_HOURS)),
                text(request.reason || "—", "muted"),
              ],
            };
          }),
        ...(countHolidayHours
          ? holidays.map((holiday) => {
              const dateKey = toDateKey(holiday.holiday_date);
              return {
                id: `holiday-${holiday.id}`,
                sortKey: dateKey,
                cells: [
                  dateCell(dateKey),
                  badge("تعطیل رسمی", "amber"),
                  text(formatDuration(HOLIDAY_HOURS)),
                  text(holiday.title || "—", "muted"),
                ],
              };
            })
          : []),
      ]
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        .map(({ sortKey, ...row }) => row);

      return {
        key,
        title: "کارکرد ماه جاری",
        description:
          "مجموع ساعات ثبت‌شده، به‌علاوه مرخصی‌های تأییدشده و تعطیلات رسمی ماه انتخاب‌شده.",
        headline: `${formatHours(stats.workedHours)} ساعت`,
        headlineTone: "teal",
        columns: [
          { label: "تاریخ" },
          { label: "نوع" },
          { label: "ساعت" },
          { label: "توضیحات" },
        ],
        rows,
        footer: {
          label: "جمع کارکرد ماه",
          value: formatDuration(stats.workedHours),
        },
        emptyText: "برای این ماه رکوردی ثبت نشده است.",
      };
    }

    case "pendingLeave":
    default: {
      const pending = dayOffRequests.filter(
        (request) => request.status === "pending"
      ).length;
      const rows = [...dayOffRequests].sort((a, b) =>
        toDateKey(b.request_date).localeCompare(toDateKey(a.request_date))
      );

      return {
        key: "pendingLeave",
        title: "درخواست مرخصی",
        description:
          "عدد کارت تعداد درخواست‌های در انتظار بررسی است؛ جدول زیر همه درخواست‌های مرخصی این ماه را نشان می‌دهد.",
        headline: `${formatCount(pending)} مورد`,
        headlineTone: "amber",
        columns: [{ label: "تاریخ" }, { label: "علت" }, { label: "وضعیت" }],
        rows: rows.map((request) => {
          const status = LEAVE_STATUS[request.status] ?? LEAVE_STATUS.pending;
          return {
            id: request.id,
            cells: [
              dateCell(request.request_date),
              text(request.reason || "—"),
              badge(status.label, status.tone),
            ],
          };
        }),
        emptyText: "در این ماه درخواست مرخصی‌ای ثبت نشده است.",
      };
    }
  }
};
