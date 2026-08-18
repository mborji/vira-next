import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DASH } from "@/components/dashboard/dashboardTheme";

interface OverviewPanelProps {
  title: string;
  children: ReactNode;
  /** Removes the body padding — useful when the body is a full-bleed table. */
  flush?: boolean;
  className?: string;
  /**
   * Extra classes for the body wrapper. Lets a panel that is stretched to fill
   * its column (`h-full` + `flex flex-col`) pass the leftover height on to its
   * content instead of leaving a gap under it.
   */
  bodyClassName?: string;
  /** Optional icon rendered before the title (right of it under RTL). */
  icon?: ReactNode;
}

/**
 * Shared surface for the titled blocks of the employee overview
 * (leave summary, workload ratio, leave history).
 *
 * Redesigned to the reference: a white card on the `#EAEEED` hairline, 16px
 * radius and an 18px body — the same card the management panel uses, so the two
 * dashboards read as one design system. Colours are inline hex on purpose; see
 * `dashboardTheme.ts` for why this page does not run on the theme tokens.
 */
export const OverviewPanel = ({
  title,
  children,
  flush,
  className,
  bodyClassName,
  icon,
}: OverviewPanelProps) => (
  <section
    className={cn("rounded-2xl border bg-white", className)}
    style={{ borderColor: DASH.cardLine }}
  >
    {/*
      Icon then title — the same `CardTitle` shape the management panel's
      tables use, so a heading is laid out identically on both dashboards.
    */}
    <h3
      className="persian-heading flex items-center gap-2 px-[18px] pb-3 pt-[18px] text-sm font-bold"
      style={{ color: DASH.ink }}
    >
      {icon}
      {title}
    </h3>
    <div
      className={cn(flush ? "px-[18px] pb-2" : "px-[18px] pb-[18px]", bodyClassName)}
    >
      {children}
    </div>
  </section>
);

export default OverviewPanel;
