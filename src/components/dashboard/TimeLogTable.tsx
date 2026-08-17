import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// `TooltipProvider` is already mounted once in App.tsx — do not nest another.
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatHours,
  formatJalaliFromDbDate,
  formatMinutesAsClock,
  getArrivalMinutes,
  getDepartureMinutes,
  getInitials,
  loggedHoursOf,
  type OverviewTimeLog,
} from "@/components/worker/overview/workerStats";
// The 9-hour company day is the single source of truth for every derived
// number here — never redeclare it locally (see monthlyWorkQuota.ts).
import { COMPANY_DAILY_HOURS } from "@/components/worker/overview/monthlyWorkQuota";

/**
 * Full width of the کارکرد bar. One hour above a complete working day, so an
 * overtime row still has somewhere to grow and two rows stay comparable.
 */
const PROGRESS_MAX_HOURS = COMPANY_DAILY_HOURS + 1;

export interface TimeLogTableLog extends OverviewTimeLog {
  worker_id: string;
  worker_name?: string | null;
}

export interface TimeLogTableWorker {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  /**
   * The database only allows `full_time` / `part_time` today (a CHECK
   * constraint on `profiles.worker_type`). Adding an `hourly` type later is a
   * one-line change in {@link WORKER_TYPE_STYLES}.
   */
  worker_type?: string | null;
}

/** عادی / اضافه‌کاری / تأخیر / غیبت — derived, never stored. */
export type AttendanceStatus = "normal" | "overtime" | "late" | "absent";

const WORKER_TYPE_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  full_time: {
    label: "تمام‌وقت",
    className:
      "border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-300",
  },
  part_time: {
    label: "پاره‌وقت",
    className:
      "border-orange-200/70 bg-orange-50 text-orange-700 dark:border-orange-800/60 dark:bg-orange-950/50 dark:text-orange-300",
  },
  // hourly: {
  //   label: "ساعتی",
  //   className:
  //     "border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-300",
  // },
};

const DAY_LABEL = `${formatHours(COMPANY_DAILY_HOURS)} ساعت`;

const STATUS_STYLES: Record<
  AttendanceStatus,
  { label: string; description: string; badge: string; bar: string }
> = {
  normal: {
    label: "عادی",
    description: `کارکرد دقیقاً ${DAY_LABEL} — برابر با یک روز کاری کامل.`,
    badge:
      "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  overtime: {
    label: "اضافه‌کاری",
    description: `کارکرد بیشتر از ${DAY_LABEL} — مازاد بر یک روز کاری کامل.`,
    badge:
      "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200",
    bar: "bg-emerald-600",
  },
  late: {
    label: "تأخیر",
    description: `کارکرد کمتر از ${DAY_LABEL} — می‌تواند به دلیل ورود دیرهنگام یا خروج زودهنگام باشد.`,
    badge:
      "border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  absent: {
    label: "غیبت",
    description: "برای این روز هیچ ورود و خروجی ثبت نشده است.",
    badge:
      "border-red-200/70 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-300",
    bar: "",
  },
};

/** Fixed avatar palette — the colour is derived from the name, so it never changes between renders. */
const AVATAR_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];

const avatarColorOf = (seed: string): string => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

interface DerivedRow {
  log: TimeLogTableLog;
  name: string;
  email: string;
  workerType: string | null;
  hours: number;
  arrival: string;
  departure: string;
  status: AttendanceStatus;
  percent: number;
}

/**
 * Tolerance for the "exactly a full day" test — **half a minute**, in hours.
 *
 * A flat `0.01` (the obvious choice) is wrong in both directions: `hours_worked`
 * is an `HH:MM` value, so the smallest real deviation from a full day is one
 * minute = 0.0167 h, and `Math.abs(9.01 - 9)` evaluates to 0.00999999… in
 * floating point — a `< 0.01` test would swallow it and call 9:01 a عادی day.
 * Half a minute is below the data's own granularity, so any genuine overrun
 * registers, while float noise (which never exceeds ~1e-12 here) never does.
 */
const HOURS_EPSILON = 0.5 / 60;

/**
 * Status is decided by the **total hours worked**, not by the arrival time:
 *
 *     غیبت      no clock-in and no clock-out at all
 *     تأخیر     hours < COMPANY_DAILY_HOURS   ← a short day, whatever caused it
 *     عادی      hours === COMPANY_DAILY_HOURS (within HOURS_EPSILON)
 *     اضافه‌کاری hours > COMPANY_DAILY_HOURS   ← even after a late arrival, if the
 *                                              employee stayed late enough
 *
 * NOTE — this «تأخیر» is deliberately NOT the arrival-based «تأخیر» of the
 * employee dashboard (`workerStats`, arrival after 09:30). Here it means "the day
 * fell short of a full one". The badge carries a tooltip spelling that out,
 * because the word alone is misleading.
 */
const deriveStatus = (
  hours: number,
  arrivalMinutes: number | null,
  departureMinutes: number | null
): AttendanceStatus => {
  // Absence is about a missing record, never about the hour count.
  if (arrivalMinutes === null && departureMinutes === null) return "absent";
  if (Math.abs(hours - COMPANY_DAILY_HOURS) < HOURS_EPSILON) return "normal";
  return hours < COMPANY_DAILY_HOURS ? "late" : "overtime";
};

const EM_DASH = "—";

/**
 * One entry per column, holding **both** the width and the text alignment.
 *
 * - The table is `table-fixed`, so `width` is authoritative: a long name or a
 *   two-digit hour count can never widen a column and shift the ones beside it.
 *   Anything that could overflow (name, email, description) truncates instead.
 * - `align` is applied to the `<th>` **and** its `<td>`s, explicitly. Never rely
 *   on inheritance from `<TableRow>` here: `text-align: start` is resolved
 *   against each element's *own* `direction`, so a cell carrying `dir="ltr"`
 *   (as the clock columns used to) resolves `start` to the **left** while its
 *   RTL header resolves it to the **right** — the two drift apart by the width
 *   of the cell. `dir="ltr"` now lives on the inner `<span>` only, which fixes
 *   the digit order without touching the cell's alignment.
 */
const COLUMNS = {
  worker: { width: "w-[220px]", align: "text-start" },
  type: { width: "w-[92px]", align: "text-center" },
  date: { width: "w-[104px]", align: "text-center" },
  arrival: { width: "w-[76px]", align: "text-center" },
  departure: { width: "w-[76px]", align: "text-center" },
  work: { width: "w-[150px]", align: "text-start" },
  status: { width: "w-[104px]", align: "text-start" },
  description: { width: "w-[150px]", align: "text-start" },
  actions: { width: "w-[56px]", align: "text-center" },
} as const;

/** `<th>` classes for a column — base styling plus its width and alignment. */
const headClass = (key: keyof typeof COLUMNS): string =>
  cn("h-11 text-xs font-bold", COLUMNS[key].width, COLUMNS[key].align);

const buildRow = (
  log: TimeLogTableLog,
  worker?: TimeLogTableWorker
): DerivedRow => {
  const single = [log];
  const hours = loggedHoursOf(log);
  const arrivalMinutes = getArrivalMinutes(single);
  const departureMinutes = getDepartureMinutes(single);
  const status = deriveStatus(hours, arrivalMinutes, departureMinutes);

  return {
    log,
    name: worker?.full_name || log.worker_name || "نامشخص",
    email: worker?.email || "",
    workerType: worker?.worker_type ?? null,
    hours,
    // Earliest clock-in / latest clock-out across both shifts, so a day logged
    // out of order still shows the real ورود and خروج.
    arrival: formatMinutesAsClock(arrivalMinutes),
    departure: formatMinutesAsClock(departureMinutes),
    status,
    percent:
      status === "absent"
        ? 0
        : Math.min(100, Math.round((hours / PROGRESS_MAX_HOURS) * 100)),
  };
};

/**
 * Avatar + name + email, exported so «مدیریت مرخصی‌ها» renders an identical
 * employee cell instead of copying the avatar-colour hash.
 */
export const WorkerCell: React.FC<{ name: string; email: string }> = ({
  name,
  email,
}) => (
  <div className="flex items-center gap-3">
    <Avatar className="h-9 w-9 shrink-0">
      <AvatarFallback
        className={cn(
          "text-[11px] font-bold text-white",
          avatarColorOf(name || email || "?")
        )}
      >
        {getInitials(name, email)}
      </AvatarFallback>
    </Avatar>
    <div className="min-w-0">
      <div className="truncate font-bold text-foreground">{name}</div>
      {email ? (
        <div className="truncate text-[11px] text-muted-foreground">
          {email}
        </div>
      ) : null}
    </div>
  </div>
);

const WorkerTypeBadge: React.FC<{ workerType: string | null }> = ({
  workerType,
}) => {
  const style = workerType ? WORKER_TYPE_STYLES[workerType] : undefined;
  if (!style) {
    return <span className="text-xs text-muted-foreground">{EM_DASH}</span>;
  }
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-3 py-0.5 text-[11px]", style.className)}
    >
      {style.label}
    </Badge>
  );
};

/**
 * Every status badge explains itself on hover — and on tap, because the trigger
 * is a real `<button>`: Radix opens the tooltip on focus too, which a `<div>`
 * would never receive.
 */
const StatusBadge: React.FC<{ status: AttendanceStatus }> = ({ status }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="cursor-help rounded-full">
        <Badge
          variant="outline"
          className={cn(
            "rounded-full px-3 py-0.5 text-[11px]",
            STATUS_STYLES[status].badge
          )}
        >
          {STATUS_STYLES[status].label}
        </Badge>
      </button>
    </TooltipTrigger>
    <TooltipContent className="max-w-[240px] text-xs leading-5">
      {STATUS_STYLES[status].description}
    </TooltipContent>
  </Tooltip>
);

/**
 * The کارکرد bar. Deliberately not `ui/progress`: that primitive positions its
 * indicator with `translateX`, which is physical and would fill from the left
 * inside this globally `dir="rtl"` app. A plain block fills from the inline
 * start, so it grows from the right here with no direction branch at all.
 */
const WorkHoursBar: React.FC<{ hours: number; percent: number; status: AttendanceStatus }> = ({
  hours,
  percent,
  status,
}) => {
  const standardMark = (COMPANY_DAILY_HOURS / PROGRESS_MAX_HOURS) * 100;

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-foreground">
        {`${formatHours(hours)} ساعت`}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={PROGRESS_MAX_HOURS}
        aria-valuenow={Math.round(hours * 10) / 10}
        title={`${formatDuration(hours)} از ${formatDuration(
          COMPANY_DAILY_HOURS
        )} ساعت روز کاری`}
        className="relative h-1.5 w-full min-w-[90px] overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-all", STATUS_STYLES[status].bar)}
          style={{ width: `${percent}%` }}
        />
        <span
          aria-hidden
          className="absolute inset-y-0 w-px bg-foreground/20"
          style={{ insetInlineStart: `${standardMark}%` }}
        />
      </div>
    </div>
  );
};

export interface TimeLogTableProps {
  logs: TimeLogTableLog[];
  workers: TimeLogTableWorker[];
  onEdit?: (log: TimeLogTableLog) => void;
  className?: string;
}

/**
 * «ساعات کاری ثبت شده» — one row per registered time log. Absence is *not*
 * synthesised here: a day with no record simply has no row. A row only reads
 * as غیبت when its own clock-in and clock-out are empty.
 */
export const TimeLogTable: React.FC<TimeLogTableProps> = ({
  logs,
  workers,
  onEdit,
  className,
}) => {
  const workerById = React.useMemo(() => {
    const map = new Map<string, TimeLogTableWorker>();
    workers.forEach((worker) => map.set(worker.user_id, worker));
    return map;
  }, [workers]);

  const rows = React.useMemo(
    () => logs.map((log) => buildRow(log, workerById.get(log.worker_id))),
    [logs, workerById]
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
        برای این بازه هیچ ساعت کاری ثبت نشده است.
      </div>
    );
  }

  return (
    <div className={className}>
      {/* دسکتاپ: جدول با اسکرول افقی */}
      <div className="hidden overflow-x-auto md:block">
        <Table className="min-w-[1000px] table-fixed">
          <TableHeader>
            {/* `TableHead` in ui/table.tsx is physically `text-left`, while the cells
                inherit `text-right` from the RTL root — so every heading would sit on
                the opposite edge from its own column. `text-start` is logical and the
                child selector outranks it. */}
            <TableRow className="border-b border-border/60 bg-muted/50 hover:bg-muted/50">
              <TableHead className={headClass("worker")}>کارمند</TableHead>
              <TableHead className={headClass("type")}>نوع</TableHead>
              <TableHead className={headClass("date")}>تاریخ</TableHead>
              <TableHead className={headClass("arrival")}>ورود</TableHead>
              <TableHead className={headClass("departure")}>خروج</TableHead>
              <TableHead className={headClass("work")}>کارکرد</TableHead>
              <TableHead className={headClass("status")}>وضعیت</TableHead>
              <TableHead className={headClass("description")}>توضیحات</TableHead>
              {/* Rendered under exactly the same condition as its cell below, so a
                  read-only table can never end up one column short. */}
              {onEdit ? (
                <TableHead className={headClass("actions")}>عملیات</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.log.id}
                className="border-b border-border/50 align-middle transition-colors hover:bg-muted/30"
              >
                <TableCell className={cn("py-3", COLUMNS.worker.align)}>
                  <WorkerCell name={row.name} email={row.email} />
                </TableCell>
                <TableCell className={cn("py-3", COLUMNS.type.align)}>
                  <WorkerTypeBadge workerType={row.workerType} />
                </TableCell>
                <TableCell
                  className={cn(
                    "py-3 text-xs font-medium text-foreground/80",
                    COLUMNS.date.align
                  )}
                >
                  {/* `dir` on the span, never on the cell — see COLUMNS. */}
                  <span dir="ltr">{formatJalaliFromDbDate(row.log.date)}</span>
                </TableCell>
                <TableCell
                  className={cn(
                    "py-3 font-bold",
                    COLUMNS.arrival.align,
                    row.arrival === EM_DASH
                      ? "text-muted-foreground"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  <span dir="ltr">{row.arrival}</span>
                </TableCell>
                <TableCell
                  className={cn(
                    "py-3 font-bold",
                    COLUMNS.departure.align,
                    row.departure === EM_DASH
                      ? "text-muted-foreground"
                      : "text-sky-600 dark:text-sky-400"
                  )}
                >
                  <span dir="ltr">{row.departure}</span>
                </TableCell>
                <TableCell className={cn("py-3", COLUMNS.work.align)}>
                  {row.status === "absent" ? (
                    <span className="text-muted-foreground">{EM_DASH}</span>
                  ) : (
                    <WorkHoursBar
                      hours={row.hours}
                      percent={row.percent}
                      status={row.status}
                    />
                  )}
                </TableCell>
                <TableCell className={cn("py-3", COLUMNS.status.align)}>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell
                  className={cn(
                    "py-3 text-xs text-muted-foreground",
                    COLUMNS.description.align
                  )}
                >
                  <span
                    className="line-clamp-2"
                    title={row.log.description || undefined}
                  >
                    {row.log.description || EM_DASH}
                  </span>
                </TableCell>
                {onEdit ? (
                  <TableCell className={cn("py-3", COLUMNS.actions.align)}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      aria-label="ویرایش ساعت کاری"
                      onClick={() => onEdit(row.log)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* موبایل: هر ردیف یک کارت */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div
            key={row.log.id}
            className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <WorkerCell name={row.name} email={row.email} />
              <StatusBadge status={row.status} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground" dir="ltr">
                {formatJalaliFromDbDate(row.log.date)}
              </span>
              <WorkerTypeBadge workerType={row.workerType} />
            </div>

            <div className="mt-2 flex items-center gap-4 text-xs">
              <span>
                <span className="text-muted-foreground">ورود: </span>
                <span
                  className={cn(
                    "font-bold",
                    row.arrival === EM_DASH
                      ? "text-muted-foreground"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                  dir="ltr"
                >
                  {row.arrival}
                </span>
              </span>
              <span>
                <span className="text-muted-foreground">خروج: </span>
                <span
                  className={cn(
                    "font-bold",
                    row.departure === EM_DASH
                      ? "text-muted-foreground"
                      : "text-sky-600 dark:text-sky-400"
                  )}
                  dir="ltr"
                >
                  {row.departure}
                </span>
              </span>
            </div>

            {row.status === "absent" ? null : (
              <div className="mt-3">
                <WorkHoursBar
                  hours={row.hours}
                  percent={row.percent}
                  status={row.status}
                />
              </div>
            )}

            {row.log.description ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {row.log.description}
              </p>
            ) : null}

            {onEdit ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => onEdit(row.log)}
              >
                <Edit className="ms-2 h-4 w-4" />
                ویرایش
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimeLogTable;
