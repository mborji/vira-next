import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type StatAccent =
  | "teal"
  | "emerald"
  | "amber"
  | "sky"
  | "violet"
  | "rose"
  | "orange"
  | "indigo";

interface AccentStyle {
  /** left rail color */
  rail: string;
  /** icon chip background + icon color */
  chip: string;
  /** value number color */
  value: string;
  /** soft corner glow gradient */
  glow: string;
}

/**
 * Full, static Tailwind class strings per accent so the JIT compiler keeps them.
 * Every accent ships light + dark variants for both themes.
 */
const ACCENTS: Record<StatAccent, AccentStyle> = {
  teal: {
    rail: "bg-teal-500",
    chip: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    value: "text-teal-600 dark:text-teal-400",
    glow: "from-teal-500/[0.08]",
  },
  emerald: {
    rail: "bg-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
    glow: "from-emerald-500/[0.08]",
  },
  amber: {
    rail: "bg-amber-500",
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
    glow: "from-amber-500/[0.08]",
  },
  sky: {
    rail: "bg-sky-500",
    chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    value: "text-sky-600 dark:text-sky-400",
    glow: "from-sky-500/[0.08]",
  },
  violet: {
    rail: "bg-violet-500",
    chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    value: "text-violet-600 dark:text-violet-400",
    glow: "from-violet-500/[0.08]",
  },
  rose: {
    rail: "bg-rose-500",
    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    value: "text-rose-600 dark:text-rose-400",
    glow: "from-rose-500/[0.08]",
  },
  orange: {
    rail: "bg-orange-500",
    chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    value: "text-orange-600 dark:text-orange-400",
    glow: "from-orange-500/[0.08]",
  },
  indigo: {
    rail: "bg-indigo-500",
    chip: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    value: "text-indigo-600 dark:text-indigo-400",
    glow: "from-indigo-500/[0.08]",
  },
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  accent?: StatAccent;
  /** optional short caption under the value */
  hint?: string;
  className?: string;
}

/**
 * Premium KPI card — colored accent rail, icon chip, soft gradient glow,
 * large tabular value and a subtle hover lift. Purely presentational.
 */
export const StatCard = ({
  title,
  value,
  icon: Icon,
  accent = "teal",
  hint,
  className,
}: StatCardProps) => {
  const a = ACCENTS[accent];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-5",
        "shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md",
        className
      )}
    >
      {/* corner glow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent",
          a.glow
        )}
        aria-hidden="true"
      />
      {/* accent rail (start edge, RTL-aware) */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-4 start-0 w-1 rounded-e-full",
          a.rail
        )}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="persian-body text-sm font-medium text-muted-foreground">
            {title}
          </p>
          <p
            className={cn(
              "persian-heading mt-2 text-3xl font-bold leading-none [font-variant-numeric:tabular-nums]",
              a.value
            )}
          >
            {value}
          </p>
          {hint && (
            <p className="persian-body mt-2 text-xs text-muted-foreground">
              {hint}
            </p>
          )}
        </div>
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
            a.chip
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
};

export default StatCard;
