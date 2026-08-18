import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { DASH } from "@/components/dashboard/dashboardTheme";

export type StatTone =
  | "teal"
  | "slate"
  | "emerald"
  | "blue"
  | "amber"
  | "rose";

/**
 * Value colours of the reference design, hex for hex — the same hues the
 * management panel uses (see `dashboardTheme.ts`).
 *
 * Literal colours rather than Tailwind classes, and no `dark:` variants, for
 * exactly the reason the management dashboard gives: the redesign was approved
 * as a fixed light-theme palette, inline styles cannot be purged by the JIT,
 * and the two dashboards have to stay identical without drifting apart.
 */
const TONE_VALUE: Record<StatTone, string> = {
  teal: DASH.primaryDark,
  slate: DASH.ink,
  emerald: DASH.success,
  blue: "#1D4ED8",
  amber: DASH.warning,
  rose: DASH.danger,
};

/** Hover / focus affordance shared by every clickable summary card. */
export const CLICKABLE_CARD_CLASS = cn(
  "cursor-pointer text-start transition-all duration-200",
  "hover:-translate-y-0.5 hover:border-[#CFF3EC] hover:shadow-md",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
);

interface OverviewStatCardProps {
  label: string;
  value: string;
  /** Short unit rendered under the number, e.g. «ساعت» / «روز» / «بار». */
  unit?: string;
  tone?: StatTone;
  /**
   * Renders the value left-to-right. Needed for composite values such as
   * `۸ / ۲۳`, which bidi would otherwise flip to `۲۳ / ۸` on an RTL page.
   */
  ltrValue?: boolean;
  /** When provided the card becomes a button that opens its detail view. */
  onClick?: () => void;
  className?: string;
}

/**
 * Compact KPI tile of the employee overview, in the reference design: a white
 * card, a muted label with a chevron beside it, the figure in the tone's colour
 * and the unit as a small caption underneath. RTL by inheritance.
 *
 * Clickable when `onClick` is given — it then renders as a real `<button>` so
 * keyboard and screen-reader users get the same behaviour as a mouse click.
 * Neither the props nor that contract changed in the redesign.
 */
export const OverviewStatCard = ({
  label,
  value,
  unit,
  tone = "slate",
  ltrValue,
  onClick,
  className,
}: OverviewStatCardProps) => {
  const interactive = Boolean(onClick);

  const body = (
    <>
      {/* Label first (right in RTL), chevron second — the project's order. */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="persian-body text-xs font-medium leading-none"
          style={{ color: DASH.subtle }}
        >
          {label}
        </span>
        {interactive && (
          <ChevronLeft
            aria-hidden="true"
            className="h-[15px] w-[15px] shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
            style={{ color: "#CBD5E1" }}
          />
        )}
      </div>

      <div
        dir={ltrValue ? "ltr" : undefined}
        className={cn(
          "persian-heading mt-2 text-xl font-extrabold leading-tight [font-variant-numeric:tabular-nums]",
          // An `ltr` island on an RTL page still has to hug the reading edge.
          ltrValue && "text-right"
        )}
        style={{ color: TONE_VALUE[tone] }}
      >
        {value}
      </div>

      {unit && (
        <div
          className="persian-body mt-px text-[11px]"
          style={{ color: DASH.faint }}
        >
          {unit}
        </div>
      )}
    </>
  );

  const shell = cn("rounded-[14px] border bg-white p-3.5 text-start", className);
  const shellStyle = { borderColor: DASH.cardLine };

  if (!interactive) {
    return (
      <div
        className={cn(shell, "transition-shadow duration-200 hover:shadow-md")}
        style={shellStyle}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={`نمایش جزئیات ${label}`}
      aria-label={`نمایش جزئیات ${label}`}
      className={cn("group w-full", shell, CLICKABLE_CARD_CLASS)}
      style={shellStyle}
    >
      {body}
    </button>
  );
};

export default OverviewStatCard;
