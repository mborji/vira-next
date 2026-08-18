import React, { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { DASH } from "./dashboardTheme";
import type { ManagerWorkerStats } from "./managerSummaryStats";
import {
  formatCount,
  formatHours,
  formatMinutesLabel,
} from "@/components/worker/overview/workerStats";

export interface ComparisonRow extends ManagerWorkerStats {
  /** Display name — the panel already resolves it for the summary cards. */
  name: string;
}

interface ManagerComparisonChartsProps {
  rows: ComparisonRow[];
  /** «مرداد ۱۴۰۵» — the month pill beside the section heading. */
  monthLabel: string;
}

/** Card shell shared by the four charts. */
const ChartCard = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div
    className="rounded-2xl border p-[18px]"
    style={{ background: DASH.card, borderColor: DASH.cardLine }}
  >
    {/*
      Heading first, hint second. The reference markup lists them the other way
      round — that file is written back-to-front throughout — and under the app's
      global `dir="rtl"` copying it verbatim would push every Persian title to
      the left edge. Reading order wins: title on the start (right) side.
    */}
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <b className="persian-heading text-sm" style={{ color: DASH.ink }}>
        {title}
      </b>
      <span
        className="persian-body text-[10px] leading-tight"
        style={{ color: DASH.faint }}
      >
        {hint}
      </span>
    </div>
    <div className="flex flex-col gap-2.5">{children}</div>
  </div>
);

/** One chart line: employee name (start), bar, figure (end). */
const ChartRow = ({
  name,
  bar,
  value,
  valueColor,
}: {
  name: string;
  bar: React.ReactNode;
  value: string;
  valueColor: string;
}) => (
  <div className="grid grid-cols-[84px_1fr_auto] items-center gap-2.5 text-xs sm:grid-cols-[110px_1fr_auto]">
    <span
      className="persian-body truncate"
      style={{ color: DASH.muted }}
      title={name}
    >
      {name}
    </span>
    {bar}
    <span
      className="persian-body whitespace-nowrap text-end text-[11px] font-bold"
      style={{ color: valueColor }}
    >
      {value}
    </span>
  </div>
);

/**
 * A bar that fills from the reading-side (right) edge of its track.
 * `direction: ltr` only keeps the absolute offsets predictable; the fill is
 * pinned to `right`, so it always grows right-to-left.
 */
const Bar = ({ percent, color }: { percent: number; color: string }) => (
  <div
    className="relative h-[9px] overflow-hidden rounded-full"
    style={{ background: DASH.track, direction: "ltr" }}
  >
    <span
      className="absolute bottom-0 right-0 top-0 rounded-full transition-[width] duration-500"
      style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }}
    />
  </div>
);

const EmptyState = () => (
  <p
    className="persian-body py-6 text-center text-xs"
    style={{ color: DASH.faint }}
  >
    داده‌ای برای نمایش در این ماه وجود ندارد
  </p>
);

/**
 * «تحلیل و مقایسه مدیریتی» — four side-by-side comparisons of the employees
 * already listed in «خلاصه عملکرد کارمندان».
 *
 * Presentation only: every number arrives pre-computed in `rows`, which
 * `WorkerManagement` derives from the month's data it has already fetched. This
 * component issues no request and holds no state.
 */
export const ManagerComparisonCharts = ({
  rows,
  monthLabel,
}: ManagerComparisonChartsProps) => {
  const worked = useMemo(
    () => [...rows].sort((a, b) => b.workedHours - a.workedHours),
    [rows]
  );
  const workedMax = Math.max(...worked.map((r) => r.workedHours), 1);

  const delays = useMemo(
    () => [...rows].sort((a, b) => b.totalDelayMinutes - a.totalDelayMinutes),
    [rows]
  );
  const delayMax = Math.max(...delays.map((r) => r.totalDelayMinutes), 1);

  const balances = useMemo(
    () => [...rows].sort((a, b) => b.balanceHours - a.balanceHours),
    [rows]
  );
  const balanceMax = Math.max(
    ...balances.map((r) => Math.abs(r.balanceHours)),
    1
  );

  const isEmpty = rows.length === 0;

  return (
    <section className="space-y-3.5">
      {/*
        Heading first, month pill second — same reading-order correction as in
        `ChartCard`; the reference lists the pill first.
      */}
      <div className="flex items-center justify-between gap-3">
        <h3
          className="persian-heading m-0 flex items-center gap-2 text-lg font-extrabold"
          style={{ color: DASH.ink }}
        >
          <BarChart3 className="h-[19px] w-[19px]" style={{ color: DASH.primary }} />
          تحلیل و مقایسه مدیریتی
        </h3>
        <span
          className="persian-body rounded-full px-3.5 py-1 text-xs font-semibold text-white"
          style={{ background: DASH.primary }}
        >
          {monthLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ۱ — مقایسه ساعات کارکرد */}
        <ChartCard title="مقایسه ساعات کارکرد" hint="کارکرد مؤثر ماه">
          {isEmpty ? (
            <EmptyState />
          ) : (
            worked.map((row) => (
              <ChartRow
                key={row.workerId}
                name={row.name}
                value={`${formatHours(row.workedHours)} ساعت`}
                valueColor={DASH.ink}
                bar={
                  <Bar
                    percent={(row.workedHours / workedMax) * 100}
                    color={row.workedHours > 0 ? DASH.primary : DASH.zeroFill}
                  />
                }
              />
            ))
          )}
        </ChartCard>

        {/* ۲ — مقایسه تأخیر */}
        <ChartCard title="مقایسه تأخیر" hint="مبنای ورود: ۰۹:۳۰">
          {isEmpty ? (
            <EmptyState />
          ) : (
            delays.map((row, index) => {
              const late = row.totalDelayMinutes > 0;
              return (
                <ChartRow
                  key={row.workerId}
                  name={row.name}
                  value={formatMinutesLabel(row.totalDelayMinutes, "۰ دقیقه")}
                  valueColor={late ? DASH.warning : DASH.faint}
                  bar={
                    <Bar
                      percent={(row.totalDelayMinutes / delayMax) * 100}
                      color={
                        !late
                          ? DASH.zeroFill
                          : index === 0
                          ? DASH.danger
                          : DASH.warning
                      }
                    />
                  }
                />
              );
            })
          )}
        </ChartCard>

        {/* ۳ — تراز کارکرد */}
        <ChartCard title="تراز کارکرد" hint="اضافه‌کاری / کسری">
          {isEmpty ? (
            <EmptyState />
          ) : (
            balances.map((row) => {
              const positive = row.balanceHours > 0;
              const negative = row.balanceHours < 0;
              const color = positive
                ? DASH.success
                : negative
                ? DASH.danger
                : DASH.faint;
              const width =
                (Math.abs(row.balanceHours) / balanceMax) * 50; // half-width axis

              return (
                <ChartRow
                  key={row.workerId}
                  name={row.name}
                  value={`${positive ? "+" : negative ? "−" : ""}${formatHours(
                    Math.abs(row.balanceHours)
                  )} ساعت`}
                  valueColor={color}
                  bar={
                    <div
                      className="relative h-[9px]"
                      style={{ direction: "ltr" }}
                    >
                      <span
                        className="absolute -bottom-[3px] -top-[3px] left-1/2 w-px"
                        style={{ background: DASH.line }}
                        aria-hidden="true"
                      />
                      <span
                        className="absolute top-0 h-[9px] rounded-[3px]"
                        style={{
                          width: `${width}%`,
                          background: color,
                          ...(row.balanceHours >= 0
                            ? { left: "50%" }
                            : { right: "50%" }),
                        }}
                      />
                    </div>
                  }
                />
              );
            })
          )}
        </ChartCard>

        {/* ۴ — مقایسه حضور */}
        <ChartCard
          title="مقایسه حضور"
          hint={
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <i
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: DASH.success }}
                />
                حضور
              </span>
              <span className="inline-flex items-center gap-1">
                <i
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: DASH.warning }}
                />
                مرخصی
              </span>
              <span className="inline-flex items-center gap-1">
                <i
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: DASH.danger }}
                />
                غیبت
              </span>
            </span>
          }
        >
          {isEmpty ? (
            <EmptyState />
          ) : (
            rows.map((row) => {
              const total = Math.max(
                row.requiredWorkingDays,
                row.attendanceDays + row.leaveDays + row.absenceDays,
                1
              );
              const segment = (days: number, background: string) => (
                <span
                  className="block h-full"
                  style={{ width: `${(days / total) * 100}%`, background }}
                />
              );

              return (
                <ChartRow
                  key={row.workerId}
                  name={row.name}
                  value={`${formatCount(row.attendanceDays)}/${formatCount(
                    row.requiredWorkingDays
                  )} روز`}
                  valueColor={DASH.faint}
                  bar={
                    /*
                      `direction: rtl` here, unlike the single-value bars: this
                      one is a stack, and it has to start from the same (right)
                      edge they fill from, or the two chart kinds would read as
                      growing in opposite directions.
                    */
                    <div
                      className="flex h-[9px] overflow-hidden rounded-full"
                      style={{ background: DASH.track, direction: "rtl" }}
                    >
                      {segment(row.attendanceDays, DASH.success)}
                      {segment(row.leaveDays, DASH.warning)}
                      {segment(row.absenceDays, DASH.danger)}
                    </div>
                  }
                />
              );
            })
          )}
        </ChartCard>
      </div>
    </section>
  );
};

export default ManagerComparisonCharts;
