import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone =
  | "teal"
  | "slate"
  | "emerald"
  | "blue"
  | "amber"
  | "rose";

/** Full class strings per tone so Tailwind's JIT compiler keeps them. */
const TONE_VALUE: Record<StatTone, string> = {
  teal: "text-teal-600 dark:text-teal-400",
  slate: "text-slate-700 dark:text-slate-200",
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-500 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
};

/** Hover / focus affordance shared by every clickable summary card. */
export const CLICKABLE_CARD_CLASS = cn(
  "cursor-pointer text-start transition-all duration-200",
  "hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md dark:hover:border-teal-700",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
);

interface OverviewStatCardProps {
  label: string;
  value: string;
  /** Short unit rendered after the number, e.g. «ساعت» / «روز» / «بار». */
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
 * Compact KPI tile used across the employee overview panel: muted label on top,
 * a large tone-coloured number and a small unit beside it. RTL by inheritance.
 * Clickable when `onClick` is given — it then renders as a real `<button>` so
 * keyboard and screen-reader users get the same behaviour as a mouse click.
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
      <div className="flex items-center justify-between gap-2">
        <p className="persian-body text-xs font-medium leading-none text-muted-foreground">
          {label}
        </p>
        {interactive && (
          <ChevronLeft
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:-translate-x-0.5 group-hover:text-teal-600 dark:group-hover:text-teal-400"
          />
        )}
      </div>
      <p className="mt-2.5 flex items-baseline gap-1.5">
        <span
          dir={ltrValue ? "ltr" : undefined}
          className={cn(
            "persian-heading text-2xl font-bold leading-none [font-variant-numeric:tabular-nums]",
            ltrValue && "inline-block",
            TONE_VALUE[tone]
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="persian-body text-xs text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
    </>
  );

  const shell = cn(
    "rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm",
    className
  );

  if (!interactive) {
    return (
      <div className={cn(shell, "transition-shadow duration-200 hover:shadow-md")}>
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
    >
      {body}
    </button>
  );
};

export default OverviewStatCard;
