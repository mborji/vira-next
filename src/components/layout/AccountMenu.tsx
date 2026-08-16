import * as React from "react";
import { ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/hooks/useAuthStore";
import { getInitials } from "@/components/worker/overview/workerStats";
import { cn } from "@/lib/utils";

export interface AccountMenuProps {
  /**
   * Name shown on the trigger. Defaults to the signed-in user's own name, so
   * callers that already hold a `profile` can pass it and the rest can omit it.
   */
  fullName?: string | null;
  /**
   * Entries rendered ABOVE «خروج از حساب کاربری» — pass `DropdownMenuItem`s.
   * They must be children rather than a prop-array because Radix requires menu
   * items to be real descendants of `DropdownMenuContent`.
   */
  children?: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * The one account / user menu of the app — **managers only**.
 *
 * Every dashboard renders this same component, so the account list looks and
 * behaves identically wherever it appears. Entries that only one role has (the
 * manager's personal panel, for instance) are passed in as `children`.
 *
 * For anyone who is not a manager the component renders **nothing at all** —
 * see the role guard below. That is a render decision, not CSS: no trigger, no
 * dropdown, no empty flex child, so no gap is left behind in any layout.
 *
 * Logout reuses the project's existing `signOut` from the auth store; there is
 * deliberately no second logout implementation here. `signOut` drops the token
 * from `localStorage` via `apiClient.signOut()` and clears the user in the
 * store, and `pages/Dashboard.tsx` then redirects to `/auth` because its
 * `if (!user) return <Navigate to="/auth" replace />` guard starts to match.
 * Hiding this menu takes nothing away from that logic — non-managers still sign
 * out with the «خروج» button in the global `Header`, which is untouched.
 */
export const AccountMenu = ({
  fullName,
  children,
  align = "end",
  className,
}: AccountMenuProps) => {
  const { user, signOut } = useAuthStore();

  /**
   * The project's existing role check, read from the auth store — the same
   * expression `AdminDashboard` and `WorkerDashboard` already use. No new role
   * and no new permission concept. `super_admin` is included because it is a
   * manager here too: it reaches the very same management panel, and leaving it
   * out would strip that panel's own account menu.
   *
   * Guarding inside the shared component rather than at each call site means no
   * caller can put this menu in front of a non-manager by accident.
   */
  const isManager = user?.role === "admin" || user?.role === "super_admin";
  if (!isManager) return null;

  const name = fullName ?? user?.full_name ?? null;

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-full border border-border bg-card/70 py-1.5 pe-2 ps-3 text-sm text-muted-foreground backdrop-blur transition-colors",
            "hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "data-[state=open]:bg-card data-[state=open]:text-foreground",
            className
          )}
        >
          <span className="persian-body flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {getInitials(name, user?.email)}
          </span>
          <span className="persian-body hidden max-w-[10rem] truncate sm:inline">
            {name || "پروفایل"}
          </span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="persian-body text-muted-foreground">
          حساب کاربری
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {children}
        {children ? <DropdownMenuSeparator /> : null}

        {/*
          Always last in the list. Calls the existing store action — no new
          session handling, no duplicate logout path.
        */}
        <DropdownMenuItem
          className="persian-body gap-2"
          onSelect={() => signOut()}
        >
          <LogOut className="h-4 w-4 text-muted-foreground" />
          خروج از حساب کاربری
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AccountMenu;
