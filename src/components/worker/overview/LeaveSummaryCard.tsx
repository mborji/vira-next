import { cn, convertToPersianDigits } from "@/lib/utils";
import { DASH } from "@/components/dashboard/dashboardTheme";
import { OverviewPanel } from "./OverviewPanel";
import { formatCount, type LeaveSummary } from "./workerStats";

interface LeaveSummaryCardProps {
  summary: LeaveSummary;
  /** Jalali year the summary covers, shown in the panel title. */
  yearLabel?: string;
  className?: string;
}

const ROWS: Array<{
  key: keyof LeaveSummary;
  label: string;
  unit: string;
  tone: string;
}> = [
  {
    key: "pending",
    label: "مرخصی در انتظار",
    unit: "مورد",
    tone: DASH.warning,
  },
  {
    key: "approved",
    label: "مرخصی تأیید شده",
    unit: "روز",
    tone: DASH.success,
  },
  {
    key: "rejected",
    label: "مرخصی رد شده",
    unit: "مورد",
    tone: DASH.danger,
  },
];

/**
 * Leave counts for the selected Jalali year, plus the employee's leave balance:
 * how many days of the yearly allowance are already spent and how many are
 * left. Only approved requests are counted as used — a request still awaiting
 * review must not eat into the balance.
 *
 * The panel is written to stretch (`h-full` + `flex flex-col`) so it can absorb
 * the leftover height of its column; the balance block is pinned to the bottom
 * with `mt-auto`.
 *
 * Redesign notes: colours are the reference's flat hex (see `dashboardTheme.ts`)
 * and the balance block is its soft `#F8FAFA` tile. The three rows and the two
 * balance figures keep the ORDER the project already had — استفاده‌شده before
 * مانده — even though the reference lists them the other way round.
 */
export const LeaveSummaryCard = ({
  summary,
  yearLabel,
  className,
}: LeaveSummaryCardProps) => {
  const { used, entitlement, remaining, overused } = summary;

  /** How much of the allowance is spent, clamped for the progress bar. */
  const usedPercent =
    entitlement > 0 ? Math.min(100, Math.round((used / entitlement) * 100)) : 0;

  const isOverused = overused > 0;
  const isLow = !isOverused && remaining > 0 && remaining <= 5;

  const remainingTone =
    isOverused || remaining === 0
      ? DASH.danger
      : isLow
      ? DASH.warning
      : DASH.success;

  const barTone =
    isOverused || remaining === 0
      ? DASH.danger
      : isLow
      ? DASH.warning
      : DASH.primary;

  return (
    <OverviewPanel
      title={yearLabel ? `خلاصه مرخصی‌ها — ${yearLabel}` : "خلاصه مرخصی‌ها"}
      className={cn("flex h-full flex-col", className)}
      bodyClassName="flex flex-1 flex-col"
    >
      {/*
        HEIGHT DISTRIBUTION — this is what makes «خلاصه مرخصی‌ها» end on the
        same line as «سوابق مرخصی من» without looking stretched:

        the list is `flex-1` and every row is `flex-1` too, so the three rows
        share whatever height the card gains from its column instead of huddling
        at the top and leaving one big hole above the balance block. The hairline
        between rows is what makes that spread read as a deliberate list rather
        than as empty space — drop it and the rows look adrift.

        `py-2.5` is the FLOOR: when the card is short the rows are exactly as
        tight as they were before. Content, values and order are untouched.
      */}
      <dl className="flex flex-1 flex-col">
        {ROWS.map((row, index) => (
          <div
            key={row.key}
            className={cn(
              "flex flex-1 items-center justify-between gap-4 py-2.5 text-[13px]",
              index < ROWS.length - 1 && "border-b"
            )}
            style={
              index < ROWS.length - 1
                ? { borderColor: DASH.track }
                : undefined
            }
          >
            <dt className="persian-body" style={{ color: DASH.subtle }}>
              {row.label}
            </dt>
            <dd
              className="persian-heading font-bold [font-variant-numeric:tabular-nums]"
              style={{ color: row.tone }}
            >
              {formatCount(summary[row.key])}{" "}
              <span className="text-[11px] font-medium">{row.unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      {/* Leave balance — pinned to the bottom so the card can grow with its column. */}
      <div className="mt-auto pt-4">
        <div
          className="rounded-[13px] border p-[15px]"
          style={{ background: "#F8FAFA", borderColor: "#EEF2F2" }}
        >
          <div className="flex items-start justify-between gap-4">
            {/* استفاده‌شده first (right in RTL), مانده second — project order. */}
            <div className="text-center">
              <p
                className="persian-heading text-[22px] font-extrabold leading-tight [font-variant-numeric:tabular-nums]"
                style={{ color: DASH.ink }}
              >
                {formatCount(used)}{" "}
                <span className="text-[11px] font-medium">روز</span>
              </p>
              <p
                className="persian-body mt-0.5 text-[11px]"
                style={{ color: DASH.faint }}
              >
                مرخصی استفاده‌شده
              </p>
            </div>
            <div className="text-center">
              <p
                className="persian-heading text-[22px] font-extrabold leading-tight [font-variant-numeric:tabular-nums]"
                style={{ color: remainingTone }}
              >
                {formatCount(remaining)}{" "}
                <span className="text-[11px] font-medium">روز</span>
              </p>
              <p
                className="persian-body mt-0.5 text-[11px]"
                style={{ color: DASH.faint }}
              >
                مانده مرخصی
              </p>
            </div>
          </div>

          {/*
            RTL-correct like the «نسبت کارکرد به موظفی» bar: no `direction`
            override, so the fill grows from the right edge leftwards.
          */}
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full"
            style={{ background: "#E7ECEB" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={entitlement}
            aria-valuenow={used}
            aria-label="میزان مرخصی استفاده‌شده از سقف سالانه"
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${usedPercent}%`, background: barTone }}
            />
          </div>

          <p
            className="persian-body mt-2.5 text-[11px] leading-[1.9]"
            style={{ color: DASH.primaryDark }}
          >
            سقف مرخصی سالانه{" "}
            <span className="font-semibold [font-variant-numeric:tabular-nums]">
              {formatCount(entitlement)} روز کاری
            </span>{" "}
            است و تاکنون{" "}
            <span
              dir="ltr"
              className="inline-block font-semibold [font-variant-numeric:tabular-nums]"
            >
              {convertToPersianDigits(String(usedPercent))}٪
            </span>{" "}
            آن استفاده شده است.
            {isOverused && (
              <>
                {" "}
                <span
                  className="font-semibold"
                  style={{ color: DASH.danger }}
                >
                  {formatCount(overused)} روز بیش از سقف ثبت شده است.
                </span>
              </>
            )}
          </p>
        </div>
      </div>
    </OverviewPanel>
  );
};

export default LeaveSummaryCard;
