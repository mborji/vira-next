import { cn } from "@/lib/utils";
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

const ROLE_TONES: Record<string, string> = {
  super_admin: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
  admin: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  worker: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  client: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
};

const pill =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

interface ProfileSummaryCardProps {
  profile: OverviewProfile;
  className?: string;
}

/**
 * Identity card of the employee the panel is currently showing:
 * avatar with initials, full name, email and role / contract badges.
 */
export const ProfileSummaryCard = ({
  profile,
  className,
}: ProfileSummaryCardProps) => {
  const { fullName, email, role, workerType } = profile;
  const roleLabel = role ? ROLE_LABELS[role] : undefined;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-sm",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-base font-bold tracking-widest text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"
      >
        {getInitials(fullName, email)}
      </span>

      <div className="mt-2 flex flex-col items-center gap-1.5 text-center">
        <h3 className="persian-heading text-lg font-bold text-foreground">
          {fullName || email || "کاربر"}
        </h3>

        {email && (
          <a
            href={`mailto:${email}`}
            dir="ltr"
            className="text-xs text-teal-600 transition-colors hover:text-teal-700 hover:underline dark:text-teal-400"
          >
            {email}
          </a>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
          {workerType && (
            <span
              className={cn(
                pill,
                workerType === "full_time"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              )}
            >
              {workerType === "full_time" ? "تمام‌وقت" : "پاره‌وقت"}
            </span>
          )}
          {roleLabel && (
            <span className={cn(pill, ROLE_TONES[role as string])}>
              {roleLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSummaryCard;
