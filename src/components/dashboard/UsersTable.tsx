import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// `TooltipProvider` is already mounted once in App.tsx — do not nest another.
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Activity, Eye, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
// The employee cell is imported, not re-implemented: «ساعات کاری» exports it so
// every table in the panel shows an identical avatar + name + e-mail block
// («مدیریت مرخصی‌ها» already does the same).
import { WorkerCell } from "@/components/dashboard/TimeLogTable";

const EM_DASH = "—";

export interface UsersTableClient {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  is_active: boolean;
  submission_count?: number;
}

/**
 * Role pills, built on the exact recipe «ساعات کاری» uses for its نوع column
 * (`WORKER_TYPE_STYLES`): an outline badge, `rounded-full px-3 py-0.5
 * text-[11px]`, tinted border + surface + text, with a dark-mode triplet.
 */
const ROLE_STYLES: Record<string, { label: string; className: string }> = {
  admin: {
    label: "مدیر",
    className:
      "border-red-200/70 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-300",
  },
  super_admin: {
    label: "مدیر ارشد",
    className:
      "border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/60 dark:text-red-200",
  },
  worker: {
    label: "کارمند",
    className:
      "border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-300",
  },
  client: {
    label: "کاربر",
    className:
      "border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-300",
  },
};

/** Same shape as «ساعات کاری»'s `STATUS_STYLES`, for فعال / غیرفعال. */
const ACTIVE_STYLES = {
  active: {
    label: "فعال",
    description: "این کاربر می‌تواند وارد سیستم شود.",
    badge:
      "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  inactive: {
    label: "غیرفعال",
    description: "دسترسی این کاربر به سیستم بسته است.",
    badge:
      "border-orange-200/70 bg-orange-50 text-orange-700 dark:border-orange-800/60 dark:bg-orange-950/50 dark:text-orange-300",
  },
} as const;

/**
 * One entry per column, holding both the width and the alignment — the same
 * contract as «ساعات کاری»'s `COLUMNS`, and for the same reasons: the table is
 * `table-fixed`, so a long name can never widen a column, and `align` is applied
 * to the `<th>` **and** its `<td>`s explicitly rather than inherited (a cell
 * carrying `dir="ltr"` resolves `text-start` against its own direction and would
 * otherwise drift away from its header).
 */
const COLUMNS = {
  user: { width: "w-[240px]", align: "text-start" },
  role: { width: "w-[100px]", align: "text-center" },
  status: { width: "w-[170px]", align: "text-start" },
  submissions: { width: "w-[110px]", align: "text-center" },
  activity: { width: "w-[150px]", align: "text-center" },
  joined: { width: "w-[120px]", align: "text-center" },
  actions: { width: "w-[70px]", align: "text-center" },
} as const;

/** `<th>` classes for a column — base styling plus its width and alignment. */
const headClass = (key: keyof typeof COLUMNS): string =>
  cn("h-11 text-xs font-bold", COLUMNS[key].width, COLUMNS[key].align);

const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const style = ROLE_STYLES[role];
  if (!style) {
    return <span className="text-xs text-muted-foreground">{role}</span>;
  }
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-3 py-0.5 text-[11px]", style.className)}
    >
      {style.label}
    </Badge>
  );
};

/**
 * The فعال / غیرفعال pill explains itself on hover — and on tap, because the
 * trigger is a real `<button>`, exactly as «ساعات کاری»'s status badge is.
 */
const ActiveBadge: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const style = ACTIVE_STYLES[isActive ? "active" : "inactive"];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="cursor-help rounded-full">
          <Badge
            variant="outline"
            className={cn(
              "rounded-full px-3 py-0.5 text-[11px]",
              style.badge
            )}
          >
            {style.label}
          </Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-xs leading-5">
        {style.description}
      </TooltipContent>
    </Tooltip>
  );
};

const SubmissionCount: React.FC<{ count?: number }> = ({ count }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80">
    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
    {(count ?? 0).toLocaleString("fa-IR")}
  </span>
);

const LastActivity: React.FC<{ label: string | null }> = ({ label }) =>
  label ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80">
      <Activity className="h-3.5 w-3.5 text-emerald-500" />
      <span dir="ltr">{label}</span>
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">بدون فعالیت</span>
  );

export interface UsersTableProps {
  clients: UsersTableClient[];
  /**
   * Pre-formatted «آخرین فعالیت» per `user_id`, or absent for "no activity".
   * The caller formats it, so this table introduces no second date rule.
   */
  activityLabelByUserId: Record<string, string>;
  /** Pre-formatted «تاریخ عضویت», produced by the caller for the same reason. */
  formatJoinedAt: (client: UsersTableClient) => string;
  onView: (client: UsersTableClient) => void;
  onToggleActive: (client: UsersTableClient, isActive: boolean) => void;
  emptyLabel?: string;
  className?: string;
}

/**
 * «لیست کاربران سیستم».
 *
 * Deliberately a mirror of `TimeLogTable` («ساعات کاری»): the same table shell,
 * the same header row, the same 44px header / `py-3` body rhythm, the same
 * `rounded-full` outline pills, the same icon-only ghost action, the same dashed
 * empty state and the same "one card per row" mobile fallback. Only the columns
 * differ.
 *
 * It is presentation only — every value arrives through props, and the two
 * writes it can trigger (`onView`, `onToggleActive`) are the panel's existing
 * handlers, unchanged.
 */
export const UsersTable: React.FC<UsersTableProps> = ({
  clients,
  activityLabelByUserId,
  formatJoinedAt,
  onView,
  onToggleActive,
  emptyLabel = "کاربری برای نمایش وجود ندارد.",
  className,
}) => {
  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* دسکتاپ: جدول با اسکرول افقی */}
      <div className="hidden overflow-x-auto md:block">
        <Table className="min-w-[960px] table-fixed">
          <TableHeader>
            {/* `TableHead` in ui/table.tsx is physically `text-left`, while the cells
                inherit `text-right` from the RTL root — so every heading would sit on
                the opposite edge from its own column. `text-start` is logical and the
                child selector outranks it. */}
            <TableRow className="border-b border-border/60 bg-muted/50 hover:bg-muted/50">
              <TableHead className={headClass("user")}>کاربر</TableHead>
              <TableHead className={headClass("role")}>نقش</TableHead>
              <TableHead className={headClass("status")}>وضعیت</TableHead>
              <TableHead className={headClass("submissions")}>
                تعداد درخواست
              </TableHead>
              <TableHead className={headClass("activity")}>
                آخرین فعالیت
              </TableHead>
              <TableHead className={headClass("joined")}>تاریخ عضویت</TableHead>
              <TableHead className={headClass("actions")}>عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow
                key={client.id}
                className="border-b border-border/50 align-middle transition-colors hover:bg-muted/30"
              >
                <TableCell className={cn("py-3", COLUMNS.user.align)}>
                  <WorkerCell
                    name={client.full_name || "بدون نام"}
                    email={client.email || ""}
                  />
                </TableCell>
                <TableCell className={cn("py-3", COLUMNS.role.align)}>
                  <RoleBadge role={client.role} />
                </TableCell>
                <TableCell className={cn("py-3", COLUMNS.status.align)}>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={client.is_active}
                      onCheckedChange={(checked) =>
                        onToggleActive(client, checked)
                      }
                      aria-label={
                        client.is_active
                          ? "غیرفعال کردن کاربر"
                          : "فعال کردن کاربر"
                      }
                    />
                    <ActiveBadge isActive={client.is_active} />
                  </div>
                </TableCell>
                <TableCell className={cn("py-3", COLUMNS.submissions.align)}>
                  <SubmissionCount count={client.submission_count} />
                </TableCell>
                <TableCell className={cn("py-3", COLUMNS.activity.align)}>
                  <LastActivity
                    label={activityLabelByUserId[client.user_id] ?? null}
                  />
                </TableCell>
                <TableCell
                  className={cn(
                    "py-3 text-xs font-medium text-foreground/80",
                    COLUMNS.joined.align
                  )}
                >
                  {/* `dir` on the span, never on the cell — see COLUMNS. */}
                  <span dir="ltr">{formatJoinedAt(client)}</span>
                </TableCell>
                <TableCell className={cn("py-3", COLUMNS.actions.align)}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    aria-label="مشاهده جزئیات کاربر"
                    onClick={() => onView(client)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* موبایل: هر ردیف یک کارت */}
      <div className="space-y-3 md:hidden">
        {clients.map((client) => (
          <div
            key={client.id}
            className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <WorkerCell
                name={client.full_name || "بدون نام"}
                email={client.email || ""}
              />
              <ActiveBadge isActive={client.is_active} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground" dir="ltr">
                {formatJoinedAt(client)}
              </span>
              <RoleBadge role={client.role} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
              <span>
                <span className="text-muted-foreground">درخواست‌ها: </span>
                <SubmissionCount count={client.submission_count} />
              </span>
              <span>
                <span className="text-muted-foreground">آخرین فعالیت: </span>
                <LastActivity
                  label={activityLabelByUserId[client.user_id] ?? null}
                />
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Switch
                checked={client.is_active}
                onCheckedChange={(checked) => onToggleActive(client, checked)}
                aria-label={
                  client.is_active ? "غیرفعال کردن کاربر" : "فعال کردن کاربر"
                }
              />
              <span className="text-xs text-muted-foreground">
                {client.is_active ? "کاربر فعال است" : "کاربر غیرفعال است"}
              </span>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => onView(client)}
            >
              <Eye className="ms-2 h-4 w-4" />
              مشاهده
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsersTable;
