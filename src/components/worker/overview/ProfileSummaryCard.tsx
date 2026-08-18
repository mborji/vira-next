import { cn } from "@/lib/utils";
import { DASH, WORKER_TYPE_BADGE } from "@/components/dashboard/dashboardTheme";
import { getInitials } from "./workerStats";

export interface OverviewProfile {
  fullName?: string | null;
  email?: string;
  role?: string;
  workerType?: "full_time" | "part_time" | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "مدیر ارشد",
  admin: "ادمین",
  worker: "کارمند",
  client: "مشتری",
};

/**
 * Role pill colours, in the reference design's flat-tint style. They mirror the
 * `TINTS` families of `dashboardTheme.ts` (fuchsia has no tint of its own, so
 * «مدیر ارشد» keeps a matching hand-picked pair).
 */
const ROLE_TONES: Record<string, { bg: string; fg: string }> = {
  super_admin: { bg: "#FDF4FF", fg: "#A21CAF" },
  admin: { bg: "#F5F3FF", fg: "#6D28D9" },
  worker: { bg: "#EEF0FF", fg: "#4338CA" },
  client: { bg: "#F1F5F9", fg: "#334155" },
};

const pill =
  "inline-flex items-center rounded-full px-[11px] py-1 text-[11px] font-semibold";

interface ProfileSummaryCardProps {
  profile: OverviewProfile;
  className?: string;
}

/**
 * Identity card of the employee the panel is currently showing:
 * avatar with initials, full name, email and role / contract badges.
 *
 * Layout follows the reference — a 56px round avatar beside the name block
 * rather than above it. The avatar stays the FIRST child so it sits on the
 * reading edge (right) under the app's global `dir="rtl"`; the reference file
 * lists it last, but that file is written back-to-front throughout and its
 * order is deliberately ignored here.
 */
export const ProfileSummaryCard = ({
  profile,
  className,
}: ProfileSummaryCardProps) => {
  const { fullName, email, role, workerType } = profile;
  const roleLabel = role ? ROLE_LABELS[role] : undefined;
  const roleTone = role ? ROLE_TONES[role] : undefined;
  const typeBadge = workerType ? WORKER_TYPE_BADGE[workerType] : undefined;

  return (
    <div
      className={cn("rounded-2xl border bg-white p-5", className)}
      style={{ borderColor: DASH.cardLine }}
    >
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className="persian-heading flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-extrabold"
          style={{ background: "#CCFBF1", color: DASH.primaryDark }}
        >
          {getInitials(fullName, email)}
        </span>

        <div className="min-w-0">
          <h3
            className="persian-heading truncate text-base font-bold"
            style={{ color: DASH.ink }}
          >
            {fullName || email || "کاربر"}
          </h3>

          {email && (
            <a
              href={`mailto:${email}`}
              dir="ltr"
              className="mt-0.5 block truncate text-xs transition-colors hover:underline"
              style={{ color: DASH.faint }}
            >
              {email}
            </a>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {typeBadge && (
              <span
                className={cn(pill, "persian-body")}
                style={{ background: typeBadge.bg, color: typeBadge.fg }}
              >
                {typeBadge.label}
              </span>
            )}
            {roleLabel && roleTone && (
              <span
                className={cn(pill, "persian-body")}
                style={{ background: roleTone.bg, color: roleTone.fg }}
              >
                {roleLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSummaryCard;
