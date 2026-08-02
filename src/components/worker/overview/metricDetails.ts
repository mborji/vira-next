import type { JalaliDate } from "@/utils/jalali";
import type { StatTone } from "./OverviewStatCard";
import {
  getMonthLabel,
  getMonthQuota,
  getQuotaDailyHours,
} from "./monthlyWorkQuota";
import {
  buildYearBalance,
  getBalanceLabel,
  getBalanceTone,
} from "./workBalance";
import {
  ACCEPTED_DAY_OFF_HOURS,
  ALLOWED_ARRIVAL_TIME,
  HOLIDAY_HOURS,
  buildWorkerMonthStats,
  formatClock,
  formatCount,
  formatDuration,
  formatHours,
  formatJalaliFromDbDate,
  formatMinutesAsClock,
  formatMinutesLabel,
  getArrivalMinutes,
  getDayName,
  getDelayMinutes,
  getWorkingDayKeys,
  groupTimeLogsByDay,
  isNonWorkingWeekday,
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
  | "balance"
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
  /** Today's Jalali date — pro-rates the quota of the running month. */
  today: JalaliDate;
  timeLogs: OverviewTimeLog[];
  dayOffRequests: OverviewDayOffRequest[];
  holidays: OverviewHoliday[];
  /** Time logs of the whole selected Jalali year — powers «تراز کارکرد». */
  yearTimeLogs: OverviewTimeLog[];
  /** Day-off requests of the whole selected Jalali year. */
  yearDayOffRequests: OverviewDayOffRequest[];
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
    today,
    timeLogs,
    dayOffRequests,
    holidays,
    yearTimeLogs,
    yearDayOffRequests,
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
  const hoursOf = (dateKey: string) =>
    sumLoggedHours(logsByDay.get(dateKey) || []);

  const leaveByDay = new Map(
    dayOffRequests.map((request) => [toDateKey(request.request_date), request])
  );

  const holidayByDay = new Map(
    holidays.map((holiday) => [toDateKey(holiday.holiday_date), holiday])
  );

  /** «تعطیل رسمی» / «تعطیل هفتگی» / «روز کاری» label of a single day. */
  const dayTypeCell = (dateKey: string): MetricCell => {
    const holiday = holidayByDay.get(dateKey);
    if (holiday) {
      return badge(holiday.title?.trim() || "تعطیل رسمی", "rose");
    }
    if (isNonWorkingWeekday(dateKey)) return badge("تعطیل هفتگی", "rose");
    return badge("روز کاری", "teal");
  };

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
          : "شمار روزهایی که برای آن‌ها کارکرد ثبت شده، در برابر تعداد روز کاری همان ماه طبق جدول رسمی. کارکرد در پنجشنبه، جمعه یا تعطیل رسمی هم شمرده می‌شود و در ستون «نوع روز» مشخص است.",
        headline: isToday
          ? `${formatDuration(totalHours)} ساعت`
          : `${formatCount(stats.attendanceDays)} / ${formatCount(
              stats.requiredWorkingDays
            )} روز`,
        headlineTone: isToday ? "teal" : "blue",
        columns: [
          { label: "تاریخ" },
          { label: "روز" },
          { label: "نوع روز" },
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
              dayTypeCell(dateKey),
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
      // Only working days can produce a delay: Thursdays, Fridays and official
      // holidays are already excluded from `workingDayKeys`.
      const days = workingDayKeys.filter((dateKey) => {
        const delay = getDelayMinutes(logsByDay.get(dateKey) || []);
        return delay !== null && delay > 0;
      });

      return {
        key,
        title: "تأخیر",
        description: `ساعت ورود مجاز ${formatClock(
          ALLOWED_ARRIVAL_TIME
        )} است. هر روز کاری که اولین ورود ثبت‌شده بعد از این ساعت باشد یک تأخیر شمرده می‌شود و مدت آن از اختلاف ورود با ${formatClock(
          ALLOWED_ARRIVAL_TIME
        )} محاسبه می‌شود. پنجشنبه‌ها، جمعه‌ها و تعطیلات رسمی محاسبه نمی‌شوند.`,
        headline: `${formatCount(stats.lateDays)} بار`,
        headlineTone: "amber",
        columns: [
          { label: "تاریخ" },
          { label: "روز" },
          { label: "ورود مجاز" },
          { label: "ورود واقعی" },
          { label: "مدت تأخیر" },
          { label: "کارکرد" },
        ],
        rows: days.map((dateKey) => {
          const logs = logsByDay.get(dateKey) || [];
          const arrival = getArrivalMinutes(logs);
          const delay = getDelayMinutes(logs) ?? 0;
          return {
            id: dateKey,
            cells: [
              dateCell(dateKey),
              dayCell(dateKey),
              text(formatClock(ALLOWED_ARRIVAL_TIME), "muted"),
              text(formatMinutesAsClock(arrival), "rose"),
              text(formatMinutesLabel(delay), "rose"),
              text(formatDuration(hoursOf(dateKey))),
            ],
          };
        }),
        footer: {
          label: "جمع تأخیر",
          value: formatMinutesLabel(stats.totalDelayMinutes),
        },
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
          "روزهای کاری سپری‌شده که نه کارکردی برای آن‌ها ثبت شده و نه مرخصی تأییدشده‌ای دارند. پنجشنبه‌ها، جمعه‌ها و تعطیلات رسمی روز کاری نیستند و در غیبت شمرده نمی‌شوند.",
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

    case "required": {
      const quota = getMonthQuota(month.jm);
      const monthName = getMonthLabel(month.jm);

      return {
        key,
        title: "ساعت موظفی",
        description: `ساعت موظفی هر ماه از جدول رسمی منابع انسانی خوانده می‌شود: روزهای ماه منهای جمعه‌ها و تعطیلات رسمی، ضربدر سهم ساعتی هر روز کاری (هفته‌ی کاری ${formatCount(
          44
        )} ساعته).`,
        headline: `${formatHours(stats.requiredHours)} ساعت`,
        headlineTone: "slate",
        columns: [{ label: "شرح" }, { label: "مقدار" }],
        rows: quota
          ? [
              {
                id: "days",
                cells: [
                  text(`روزهای ${monthName}`),
                  text(`${formatCount(quota.daysInMonth)} روز`),
                ],
              },
              {
                id: "fridays",
                cells: [
                  text("تعداد جمعه", "muted"),
                  text(`${formatCount(quota.fridays)} روز`, "rose"),
                ],
              },
              {
                id: "holidays",
                cells: [
                  text("تعطیل رسمی غیرجمعه", "muted"),
                  text(`${formatCount(quota.otherHolidays)} روز`, "rose"),
                ],
              },
              {
                id: "working",
                cells: [
                  text("تعداد روز کاری"),
                  text(`${formatCount(quota.workingDays)} روز`, "teal"),
                ],
              },
              {
                id: "daily",
                cells: [
                  text("سهم هر روز کاری", "muted"),
                  text(formatDuration(getQuotaDailyHours(month.jm))),
                ],
              },
            ]
          : [],
        footer: {
          label: "جمع ساعت موظفی ماه",
          value: formatDuration(stats.requiredHours),
        },
        emptyText: "برای این ماه ساعت موظفی رسمی ثبت نشده است.",
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

    case "balance": {
      const balance = buildYearBalance({
        year: month.jy,
        upToMonth: month.jm,
        today,
        yearTimeLogs,
        yearDayOffRequests,
      });

      const signed = (hours: number): MetricCell => {
        const tone = getBalanceTone(hours);
        if (tone === "slate") return text("۰۰:۰۰", "muted");
        return text(
          `${formatDuration(Math.abs(hours))} ${getBalanceLabel(hours)}`,
          tone
        );
      };

      return {
        key,
        title: "تراز کارکرد",
        description:
          "تراز هر ماه = کارکرد واقعی منهای ساعت موظفی همان ماه طبق جدول رسمی. عدد مثبت اضافه‌کاری و عدد منفی کسری کار است. کارکرد واقعی شامل ساعات ثبت‌شده به‌علاوه معادل ساعتی مرخصی‌های تأییدشده است. عدد کارت تراز تجمعی از ابتدای سال تا ماه انتخاب‌شده است و ماه در جریان فقط تا امروز محاسبه می‌شود.",
        headline: `${formatDuration(
          Math.abs(balance.totalBalanceHours)
        )} ساعت ${getBalanceLabel(balance.totalBalanceHours)}`,
        headlineTone: getBalanceTone(balance.totalBalanceHours),
        columns: [
          { label: "ماه" },
          { label: "روز کاری" },
          { label: "ساعت موظفی" },
          { label: "کارکرد واقعی" },
          { label: "تراز ماه" },
        ],
        rows: balance.months.map((row) => ({
          id: `balance-${row.month}`,
          cells: [
            text(
              row.inProgress ? `${row.monthName} (تا امروز)` : row.monthName
            ),
            text(
              row.inProgress
                ? `${formatCount(row.requiredWorkingDays)} از ${formatCount(
                    row.fullWorkingDays
                  )}`
                : `${formatCount(row.fullWorkingDays)} روز`,
              "muted"
            ),
            text(formatDuration(row.requiredHours), "muted"),
            text(formatDuration(row.workedHours), "teal"),
            signed(row.balanceHours),
          ],
        })),
        footer: {
          label: "تراز تجمعی از ابتدای سال",
          value:
            getBalanceTone(balance.totalBalanceHours) === "slate"
              ? "۰۰:۰۰"
              : `${formatDuration(
                  Math.abs(balance.totalBalanceHours)
                )} ${getBalanceLabel(balance.totalBalanceHours)}`,
        },
        emptyText: "برای این سال هنوز ماهی برای محاسبه تراز کارکرد وجود ندارد.",
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
