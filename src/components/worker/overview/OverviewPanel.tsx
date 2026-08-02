import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OverviewPanelProps {
  title: string;
  children: ReactNode;
  /** Removes the body padding — useful when the body is a full-bleed table. */
  flush?: boolean;
  className?: string;
}

/**
 * Shared surface for the titled blocks of the employee overview
 * (leave summary, workload ratio, leave history).
 */
export const OverviewPanel = ({
  title,
  children,
  flush,
  className,
}: OverviewPanelProps) => (
  <section
    className={cn(
      "rounded-xl border border-border bg-card shadow-sm",
      className
    )}
  >
    <h3 className="persian-heading px-5 pb-3 pt-4 text-base font-bold text-foreground">
      {title}
    </h3>
    <div className={cn(flush ? "px-5 pb-2" : "px-5 pb-5")}>{children}</div>
  </section>
);

export default OverviewPanel;
