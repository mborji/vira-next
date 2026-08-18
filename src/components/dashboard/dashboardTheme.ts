/**
 * The management dashboard's visual palette — the exact hex values of the
 * reference design («داشبورد مدیریت پرسنل»).
 *
 * These are *presentation only*. Nothing here participates in any calculation,
 * fetch, role check or routing decision; every value is a CSS colour string.
 *
 * Why literal hex and not the project's `hsl(var(--…))` tokens: the reference
 * design was approved as a fixed light-theme palette and the panel is expected
 * to look identical to it. Keeping the values in this one module means a future
 * switch to design tokens is a single-file change rather than a hunt through
 * three components.
 */
export const DASH = {
  /** Brand teal — bars, avatars, the selected section tile. */
  primary: "#0D9488",
  /** Darker teal — headings on teal tints, the active section tile's fill. */
  primaryDark: "#0F766E",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",

  /** Near-black headings. */
  ink: "#0F172A",
  /** Body text on white. */
  body: "#334155",
  /** Secondary body text. */
  muted: "#475569",
  /** Captions. */
  subtle: "#64748B",
  /** Hints, e-mail addresses, disabled marks. */
  faint: "#94A3B8",

  /** Control borders (buttons, selects, chips). */
  line: "#E2E8F0",
  /** Card borders. */
  cardLine: "#EAEEED",
  /** Section-tile borders. */
  tileLine: "#E7ECEB",
  /** Progress-bar / chart track. */
  track: "#F1F5F4",
  /** Neutral chart fill for a zero value. */
  zeroFill: "#E2E8F0",

  /** Page background. */
  page: "#F4F7F6",
  /** Card background. */
  card: "#FFFFFF",

  /** Welcome banner. */
  heroBg: "linear-gradient(120deg,#ECFDF5 0%,#F0FDFA 55%,#EFFBFF 100%)",
  heroLine: "#D6F0EA",
} as const;

/**
 * Toolbar chip styling of the reference design — the month pill, the year /
 * month `Select` triggers and any other 34px control that sits in a panel
 * header. Shared by the management panel and the employee dashboard so the two
 * toolbars are literally the same chip.
 *
 * Purely visual: it overrides shadcn's defaults through `twMerge`.
 */
export const TOOLBAR_FIELD =
  "h-[34px] rounded-[9px] border-[#E2E8F0] bg-white px-3.5 text-[13px] text-[#334155]";

/** The 34×34 icon buttons beside it (the month arrows). */
export const TOOLBAR_ICON_BUTTON =
  "h-[34px] w-[34px] shrink-0 rounded-[9px] border-[#E2E8F0] bg-white p-0 text-[#64748B] hover:bg-[#F8FAFA] hover:text-[#0F172A]";

/**
 * «منوی بخش‌ها» tile — the section switcher shared by the management panel and
 * the employee dashboard. Both render the same shape: a white card with a faint
 * caption and a grid of icon tiles, the selected one filled in `primaryDark`.
 *
 * NOTE the `text-white` that call sites put on the *label* of a selected tile is
 * required and is not a duplicate of the inline colour — `.persian-body` is a
 * component-layer rule applying `text-foreground`, and a utility class is what
 * beats it. See the comments at the call sites.
 */
export const SECTION_TILE_BASE = [
  "flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl p-4 text-center transition-all",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
].join(" ");

/** Inline style of a selected / unselected «منوی بخش‌ها» tile. */
export const sectionTileStyle = (isActive: boolean) =>
  isActive
    ? {
        background: DASH.primaryDark,
        color: "#FFFFFF",
        boxShadow: "0 6px 16px rgba(15,118,110,.28)",
      }
    : {
        background: DASH.card,
        borderColor: DASH.tileLine,
        color: DASH.muted,
      };

/** Employment-type badge colours, keyed by `profiles.worker_type`. */
export const WORKER_TYPE_BADGE = {
  full_time: { label: "تمام‌وقت", bg: "#F0FDFA", fg: "#0F766E" },
  part_time: { label: "پاره‌وقت", bg: "#FFF7ED", fg: "#C2410C" },
} as const;

/** The three mini tiles under an employee card, and the KPI card accents. */
export interface TintedSurface {
  bg: string;
  border: string;
  icon: string;
  value: string;
  label: string;
}

export const TINTS = {
  teal: {
    bg: "#F0FDFA",
    border: "#CFF3EC",
    icon: "#0D9488",
    value: "#134E4A",
    label: "#0F766E",
  },
  emerald: {
    bg: "#ECFDF5",
    border: "#C9F1DE",
    icon: "#047857",
    value: "#065F46",
    label: "#059669",
  },
  sky: {
    bg: "#EFF6FF",
    border: "#D7E7FE",
    icon: "#1D4ED8",
    value: "#1E3A8A",
    label: "#2563EB",
  },
  amber: {
    bg: "#FEF9EC",
    border: "#F6ECCF",
    icon: "#B45309",
    value: "#92400E",
    label: "#A16207",
  },
  orange: {
    bg: "#FFF7ED",
    border: "#FBE7CB",
    icon: "#F59E0B",
    value: "#7C2D12",
    label: "#B45309",
  },
  rose: {
    bg: "#FFF1F3",
    border: "#FBDDE2",
    icon: "#F43F5E",
    value: "#881337",
    label: "#BE123C",
  },
  violet: {
    bg: "#F5F3FF",
    border: "#E4DEFC",
    icon: "#8B5CF6",
    value: "#4C1D95",
    label: "#6D28D9",
  },
  indigo: {
    bg: "#EEF0FF",
    border: "#E2E4FB",
    icon: "#6366F1",
    value: "#312E81",
    label: "#4338CA",
  },
} satisfies Record<string, TintedSurface>;

export type TintName = keyof typeof TINTS;
