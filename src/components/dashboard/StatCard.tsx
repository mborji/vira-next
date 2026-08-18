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
  /** Card fill. */
  bg: string;
  /** Card border. */
  border: string;
  /** Short rail hanging from the top edge. */
  rail: string;
  /** Card title. */
  title: string;
  /** Icon chip fill. */
  chipBg: string;
  /** Icon colour inside the chip. */
  chipFg: string;
  /** The big number. */
  value: string;
}

/**
 * The reference design's accent palette, hex for hex.
 *
 * Literal colours rather than Tailwind classes on purpose: the tinted card
 * fill / border / rail / chip / value are five related shades per accent, and a
 * class-per-shade table is both longer and at the mercy of the JIT purger.
 * These are inline `style` values, so nothing can purge them.
 *
 * The five accents the reference actually shows (teal, orange, sky, rose,
 * indigo) are copied exactly; emerald, amber and violet — used by the
 * submissions and users sub-cards — follow the same recipe on their own hue.
 */
const ACCENTS: Record<StatAccent, AccentStyle> = {
  teal: {
    bg: "#F0FDFA",
    border: "#CFF3EC",
    rail: "#0D9488",
    title: "#0F766E",
    chipBg: "#CCFBF1",
    chipFg: "#0D9488",
    value: "#134E4A",
  },
  emerald: {
    bg: "#ECFDF5",
    border: "#C9F1DE",
    rail: "#10B981",
    title: "#047857",
    chipBg: "#D1FAE5",
    chipFg: "#059669",
    value: "#064E3B",
  },
  amber: {
    bg: "#FFFBEB",
    border: "#FBEDCB",
    rail: "#F59E0B",
    title: "#B45309",
    chipBg: "#FEF3C7",
    chipFg: "#D97706",
    value: "#78350F",
  },
  sky: {
    bg: "#EFF6FF",
    border: "#D7E7FE",
    rail: "#3B82F6",
    title: "#1D4ED8",
    chipBg: "#DBEAFE",
    chipFg: "#3B82F6",
    value: "#1E3A8A",
  },
  violet: {
    bg: "#F5F3FF",
    border: "#E4DEFC",
    rail: "#8B5CF6",
    title: "#6D28D9",
    chipBg: "#EDE9FE",
    chipFg: "#8B5CF6",
    value: "#4C1D95",
  },
  rose: {
    bg: "#FFF1F3",
    border: "#FBDDE2",
    rail: "#F43F5E",
    title: "#BE123C",
    chipBg: "#FFE1E6",
    chipFg: "#F43F5E",
    value: "#881337",
  },
  orange: {
    bg: "#FFF7ED",
    border: "#FBE7CB",
    rail: "#F59E0B",
    title: "#B45309",
    chipBg: "#FEECC8",
    chipFg: "#F59E0B",
    value: "#7C2D12",
  },
  indigo: {
    bg: "#EEF0FF",
    border: "#E2E4FB",
    rail: "#6366F1",
    title: "#4338CA",
    chipBg: "#E0E3FF",
    chipFg: "#6366F1",
    value: "#312E81",
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
  /**
   * Makes the WHOLE card a navigation control. When provided the card renders
   * as a `<button>` instead of a `<div>`, so it is clickable and keyboard
   * focusable end to end (Enter / Space) — not just the label or the icon.
   * Omit it and the card stays purely presentational.
   */
  onClick?: () => void;
  /** Screen-reader label for the clickable variant; defaults to `title`. */
  ariaLabel?: string;
}

/**
 * KPI card of the management dashboard, in the reference design: a soft tinted
 * surface, a short accent rail hanging from the top edge, a matching icon chip,
 * the figure in the accent's darkest shade and a caption underneath.
 *
 * The props are unchanged — `title`, `value`, `icon`, `accent`, `hint`,
 * `className`, `onClick`, `ariaLabel` — so every call site keeps working and
 * the eight accent names still mean the same eight hues. Only the rendering
 * changed; the clickable variant is still opt-in through `onClick` alone.
 */
export const StatCard = ({
  title,
  value,
  icon: Icon,
  accent = "teal",
  hint,
  className,
  onClick,
  ariaLabel,
}: StatCardProps) => {
  const a = ACCENTS[accent];

  /** Shared shell — identical for the static and the clickable variant. */
  const shell = cn(
    "relative overflow-hidden rounded-2xl border p-[18px] pb-4 text-start",
    "transition-all duration-300",
    className
  );

  const body = (
    <>
      {/*
        Accent rail. `inset-inline-start` keeps it on the reading-side edge, so
        it sits top-right under RTL exactly as the reference shows it.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 h-1 w-11 rounded-b"
        style={{ insetInlineStart: 20, background: a.rail }}
      />

      <div className="flex items-start justify-between gap-3">
        <span
          className="persian-body text-[13px] font-semibold"
          style={{ color: a.title }}
        >
          {title}
        </span>
        <span
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl"
          style={{ background: a.chipBg, color: a.chipFg }}
        >
          <Icon className="h-[19px] w-[19px]" />
        </span>
      </div>

      <div
        className="persian-heading mt-1.5 text-3xl font-extrabold leading-none [font-variant-numeric:tabular-nums]"
        style={{ color: a.value }}
      >
        {value}
      </div>

      {hint && (
        <div className="persian-body mt-0.5 text-xs" style={{ color: "#6B7280" }}>
          {hint}
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? title}
        className={cn(
          shell,
          "w-full cursor-pointer hover:-translate-y-1 hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:translate-y-0"
        )}
        style={{ background: a.bg, borderColor: a.border }}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={shell} style={{ background: a.bg, borderColor: a.border }}>
      {body}
    </div>
  );
};

export default StatCard;
