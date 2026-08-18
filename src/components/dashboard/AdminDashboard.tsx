import { useState, useEffect } from "react";
import {
  Users,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  UserCheck,
  UserX,
  Calendar,
  Mail,
  Shield,
  FileText,
  TrendingUp,
  Save,
  Briefcase,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Search,
  UserCircle,
  LayoutDashboard,
  KeyRound,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAuthStore } from "@/hooks/useAuthStore";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import ContactRequestModal from "./ContactRequestModal";
import { StatCard } from "./StatCard";
import { BlogManagement } from "./BlogManagement";
import { WorkerManagement } from "./WorkerManagement";
import ServiceManagement from "./ServiceManagement";
import ProjectManagement from "./ProjectManagement";
import { WorkerDashboard } from "@/components/dashboard/WorkerDashboard";
import {
  formatDateForDB,
  getDaysInJalaliMonth,
  getCurrentJalaliDate,
  getJalaliMonthName,
  gregorianToJalali,
  formatJalaliDate,
} from "@/utils/jalali";
import { ChangePassword } from "@/components/auth/ChangePassword";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AccountMenu } from "@/components/layout/AccountMenu";
// The users list is `UsersTable` now — a mirror of «ساعات کاری»'s `TimeLogTable`
// — so this file no longer builds a table of its own.
import { UsersTable } from "./UsersTable";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { convertToPersianDigits, formatDecimalHoursToTime } from "@/lib/utils";
import { useWindowSize } from "../windowWidth/useWindowSize";
// Presentation-only palette of the reference design. Colour strings, nothing else.
import { DASH } from "./dashboardTheme";

const MOBILE_WIDTH_THRESHOLD = 600;
// NOTE: no local ACCEPTED_DAY_OFF_HOURS / HOLIDAY_HOURS here. If this panel ever
// needs the company's 9-hour day, import it from
// `@/components/worker/overview/workerStats` — never redeclare it.

/** First-letter initials from a full name, for avatars. */
const getInitials = (name?: string | null): string => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  if (parts.length === 1) return parts[0].charAt(0);
  return `${parts[0].charAt(0)} ${parts[1].charAt(0)}`;
};

/** Format a Gregorian date string as a Persian (Jalali) date. */
const formatActivityDate = (dateStr: string): string =>
  convertToPersianDigits(formatJalaliDate(gregorianToJalali(new Date(dateStr))));

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: string;
  user_id: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  user?: {
    email: string;
    created_at: string;
  };
  submission_count?: number;
  last_submission?: string;
}

interface TimeLog {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  hours_worked: string;
  description: string;
  hours_worked_str: string;
}

interface DayOffRequest {
  id: string;
  request_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

interface Holiday {
  id: string;
  holiday_date: string;
  title?: string | null;
}

interface AdminDashboardProps {
  profile: Profile;
}

const AdminDashboard = ({ profile }: AdminDashboardProps) => {
  const { signOut, user } = useAuthStore();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [publishedBlogsCount, setPublishedBlogsCount] = useState(0);
  const [servicesCount, setServicesCount] = useState(0);
  const [projectsCount, setProjectsCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedSubmission, setSelectedSubmission] =
    useState<ContactSubmission | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [newRole, setNewRole] = useState<string>("");

  // Users list: attendance-based last activity + client-side filters
  const [lastActivityMap, setLastActivityMap] = useState<
    Record<string, string>
  >({});
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const currentDate = getCurrentJalaliDate();

  /**
   * Tab the manager lands on straight after signing in.
   *
   * An `admin` works out of «کارمندان» (the `WorkerManagement` panel), so that
   * tab opens by itself and its content is on screen with no click. A
   * `super_admin` keeps the original landing tab, «درخواست‌ها».
   *
   * This is presentation only — it picks the initially selected tab and touches
   * neither authentication nor the permissions of any tab. `Dashboard.tsx`
   * renders this component only once `profile` is loaded, so the role is
   * already known on first mount, so the initial state reads the right value.
   */
  const defaultTab = profile.role === "admin" ? "workers" : "submissions";

  /**
   * The tab bar is now CONTROLLED rather than `defaultValue`-uncontrolled.
   *
   * Reason: the top summary cards and the profile menu are the entry points for
   * the sections whose triggers were removed from the tab bar, and both need to
   * select a tab from outside `TabsList`. The tab *values* are unchanged, every
   * `TabsContent` is unchanged, and the landing tab is still `defaultTab`.
   */
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  /** Read-only «پروفایل من» dialog opened from the account menu. */
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);


  const fetchSubmissions = async () => {
    try {
      const data = await apiClient.getSubmissions();
      setSubmissions(data || []);
    } catch (error: any) {
      toast({
        title: "خطا",
        description: "خطا در بارگذاری درخواست‌ها",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const stats = await apiClient.getDashboardStats();
      setPublishedBlogsCount(stats.publishedBlogsCount || 0);
      setServicesCount(stats.servicesCount || 0);
      setProjectsCount(stats.projectsCount || 0);
      setTotalUsers(stats.totalUsers || 0);
    } catch (error: any) {
      console.error("خطا در دریافت اطلاعات داشبورد:", error);
    }
  };

  const updateClientStatusInState = (profileId: string, isActive: boolean) => {
    setClients((currentClients) =>
      currentClients.map((client) =>
        client.id === profileId ? { ...client, is_active: isActive } : client
      )
    );
    setSelectedClient((currentClient) =>
      currentClient?.id === profileId
        ? { ...currentClient, is_active: isActive }
        : currentClient
    );
  };

  const updateUserStatus = async (client: ClientProfile, isActive: boolean) => {
    const previousStatus = client.is_active;
    updateClientStatusInState(client.id, isActive);

    try {
      await apiClient.updateUserStatus(client.id, isActive);
      toast({
        title: "موفقیت",
        description: isActive
          ? "وضعیت کاربر به فعال تغییر کرد"
          : "وضعیت کاربر به غیرفعال تغییر کرد",
      });
    } catch (error) {
      updateClientStatusInState(client.id, previousStatus);
      toast({
        title: "خطا",
        description: "خطا در بروزرسانی وضعیت کاربر",
        variant: "destructive",
      });
    }
  };

  const updateUserRole = async () => {
    if (!selectedClient || !newRole) return;

    try {
      await apiClient.updateUserRole(selectedClient.id, newRole);

      toast({
        title: "موفقیت",
        description: "نقش کاربر با موفقیت بروزرسانی شد",
      });

      // Close the modal and refresh the list of clients
      setClientModalOpen(false);
      fetchClients(); // Make sure you have a function that fetches all clients
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در بروزرسانی نقش کاربر",
        variant: "destructive",
      });
    }
  };


  useEffect(() => {
    fetchSubmissions();
    fetchDashboardStats();
  }, []);

  const fetchClients = async () => {
    setClientsLoading(true);
    try {
      const data = await apiClient.getProfiles();
      setClients(
        (data || []).map((client: ClientProfile) => ({
          ...client,
          is_active: Boolean(client.is_active),
        }))
      );
    } catch (error: any) {
      toast({
        title: "خطا",
        description: "خطا در بارگذاری کاربران",
        variant: "destructive",
      });
    } finally {
      setClientsLoading(false);
    }
  };

  // Build a map of user_id -> most recent attendance/time-log date.
  // Reuses the existing time-logs endpoint (no filters => all workers).
  const fetchLastActivity = async () => {
    try {
      const logs = await apiClient.getTimeLogs();
      const map: Record<string, string> = {};
      (logs || []).forEach((log: { worker_id?: string; date?: string }) => {
        if (!log.worker_id || !log.date) return;
        const current = map[log.worker_id];
        if (!current || new Date(log.date) > new Date(current)) {
          map[log.worker_id] = log.date;
        }
      });
      setLastActivityMap(map);
    } catch (error) {
      // Non-blocking: the column falls back to the "no activity" placeholder.
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="persian-body">
            در انتظار
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="outline" className="persian-body">
            در حال بررسی
          </Badge>
        );
      case "resolved":
        return (
          <Badge variant="default" className="persian-body">
            حل شده
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="persian-body">
            {status}
          </Badge>
        );
    }
  };

  const stats = {
    total: submissions.length,
    pending: submissions.filter((s) => s.status === "pending").length,
    inProgress: submissions.filter((s) => s.status === "in_progress").length,
    resolved: submissions.filter((s) => s.status === "resolved").length,
  };

  const clientStats = {
    total: clients.length,
    admins: clients.filter((c) => c.role === "admin").length,
    clients: clients.filter((c) => c.role === "client").length,
    active: clients.filter((c) => c.is_active).length,
    recent: clients.filter((c) => {
      if (!c.last_submission) return false;
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return new Date(c.last_submission) > lastWeek;
    }).length,
  };

  // Client-side view filters for the users list (no API/logic changes).
  const normalizedUserQuery = userSearch.trim().toLowerCase();
  const filteredClients = clients.filter((client) => {
    const matchesRole = roleFilter === "all" || client.role === roleFilter;
    const matchesSearch =
      !normalizedUserQuery ||
      (client.full_name || "").toLowerCase().includes(normalizedUserQuery) ||
      (client.email || "").toLowerCase().includes(normalizedUserQuery);
    return matchesRole && matchesSearch;
  });
  const isUserFilterActive = normalizedUserQuery !== "" || roleFilter !== "all";

  /**
   * «آخرین فعالیت» already formatted, keyed by `user_id`.
   *
   * `lastActivityMap` and the way it is built are untouched — this only runs the
   * existing `formatActivityDate` over it here, so `UsersTable` stays purely
   * presentational and no second date convention can appear in the table.
   */
  const userActivityLabels = Object.fromEntries(
    Object.entries(lastActivityMap).map(([userId, date]) => [
      userId,
      formatActivityDate(date),
    ])
  );

  const openSubmissionModal = (submission: ContactSubmission) => {
    setSelectedSubmission(submission);
    setModalOpen(true);
  };

  const openClientModal = (client: ClientProfile) => {
    setSelectedClient(client);
    setNewRole(client.role);
    setClientModalOpen(true);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <Badge variant="destructive" className="persian-body">
            مدیر
          </Badge>
        );
      case "client":
        return (
          <Badge variant="default" className="persian-body">
            کاربر
          </Badge>
        );
      case "worker":
        return (
          <Badge variant="outline" className="persian-body">
            کارمند
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="persian-body">
            {role}
          </Badge>
        );
    }
  };

  /**
   * Single entry point for selecting a section, used by the tab bar itself, by
   * the clickable summary cards and by the account menu.
   *
   * The «کاربران» tab used to refresh its data from an `onClick` on its own
   * `TabsTrigger`. That trigger is gone (the top card replaces it), so the very
   * same two fetches live here instead — the behaviour is unchanged no matter
   * which control opens the section.
   */
  const goToTab = (tab: string) => {
    if (tab === "users") {
      fetchClients();
      fetchLastActivity();
    }
    setActiveTab(tab);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="persian-body text-muted-foreground">
            در حال بارگذاری...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/*
        Page shell of the reference design — the soft grey canvas and the
        1480px reading column. It lives here rather than in
        `pages/Dashboard.tsx` because that file also renders the employee and
        client dashboards, which this redesign deliberately leaves alone.
      */}
      <div className="min-h-screen" style={{ background: DASH.page }}>
      <div className="mx-auto w-full max-w-[1480px] space-y-5 px-4 pb-[70px] pt-6 sm:px-[30px]">
        {/*
          Header.

          COLOUR ONLY: this banner keeps the project's original fill and border
          — the `from-primary/10 via-card to-card` gradient on `border-border` —
          rather than the reference design's mint gradient. Everything else here
          (radius, padding, text, sizes, spacing, layout) is the new design and
          must stay as it is. It is deliberately the ONE surface on this page
          that still runs on the theme tokens; nothing else changes colour.
        */}
        <div className="relative overflow-hidden rounded-[20px] border border-border bg-gradient-to-br from-primary/10 via-card to-card px-5 py-6 sm:px-[34px] sm:py-[30px]">
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="flex flex-col gap-2.5">
              <span
                className="persian-body text-xs font-bold"
                style={{ color: DASH.primary }}
              >
                داشبورد مدیریتی
              </span>
              <h1
                className="persian-heading m-0 text-[26px] font-extrabold"
                style={{ color: DASH.ink }}
              >
                خوش آمدید، {profile.full_name || "ادمین"} 👋
              </h1>
              <p
                className="persian-body m-0 max-w-[520px] text-sm leading-[1.9]"
                style={{ color: DASH.subtle }}
              >
                خلاصه‌ای از وضعیت سیستم، کاربران و درخواست‌ها را اینجا می‌بینید.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                className="flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px]"
                style={{
                  background: DASH.card,
                  borderColor: DASH.line,
                  color: DASH.body,
                }}
              >
                <Calendar className="h-4 w-4" style={{ color: DASH.primary }} />
                <span className="persian-body">
                  {getJalaliMonthName(currentDate.jm)}{" "}
                  {currentDate.jy.toLocaleString("fa-IR", {
                    useGrouping: false,
                  })}
                </span>
              </div>

              {/*
                Account menu — the shared `AccountMenu`, so the manager's list
                is the very same component (and the very same logout) the
                employee and client dashboards render. Only the manager-only
                entries are passed in here: their profile, their personal
                employee dashboard and their password. The last two used to be
                top-level tabs; only their entry point moved here, the tab
                content and its logic are untouched.
              */}
              <AccountMenu
                fullName={profile.full_name}
                /*
                  Presentation only — the shared component keeps its own role
                  guard, its own entries and its own logout. `className` just
                  restyles the trigger chip to match the month chip beside it.
                */
                className="rounded-[10px] border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#334155] hover:bg-white"
              >
                <DropdownMenuItem
                  className="persian-body gap-2"
                  /*
                    Deferred by one tick on purpose: the menu and the dialog
                    are both focus-trapping layers, and opening the dialog in
                    the same commit that unmounts the menu makes the menu's
                    focus-restore fight the dialog's autofocus. Letting the
                    menu finish closing first keeps focus in the dialog.
                  */
                  onSelect={() =>
                    window.setTimeout(() => setProfileDialogOpen(true), 0)
                  }
                >
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  پروفایل من
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="persian-body gap-2"
                  onSelect={() => goToTab("calendar")}
                >
                  <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                  پنل شخصی من
                </DropdownMenuItem>
                {/*
                  The way back from «پنل شخصی من» to the management panel, for
                  managers only. `isAdmin` is the project's existing role check
                  (`user.role` is `admin` or `super_admin`) — no new role, no new
                  permission. It targets `defaultTab`, the exact same tab a
                  manager lands on after signing in, so switching panels and
                  logging in agree with each other.

                  Both panels are `TabsContent` of this one component, so the
                  switch is local state only: no navigation, no re-authentication,
                  the session is never touched.
                */}
                {isAdmin && (
                  <DropdownMenuItem
                    className="persian-body gap-2"
                    onSelect={() => goToTab(defaultTab)}
                  >
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    پنل مدیریت
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="persian-body gap-2"
                  onSelect={() => goToTab("settings")}
                >
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  تغییر رمز عبور
                </DropdownMenuItem>
              </AccountMenu>
            </div>
          </div>
        </div>

        {/*
          Stats Cards — these are now the primary shortcuts into the sections
          they summarise. Each one opens the section's existing tab; no new page
          or route is involved. Design, accents, icons and hints are unchanged;
          `onClick` alone turns a card into a full-card button.

          HIDDEN ON «پنل شخصی من» (`activeTab === "calendar"`). These five are
          management figures and management shortcuts; on the manager's own
          employee panel they belong to a different screen and their targets
          would jump the user straight back out of it. They are still rendered
          on every management tab, unchanged — this is a visibility condition on
          the row, nothing else. No query is skipped and no figure is
          recalculated: `stats`, `totalUsers`, `publishedBlogsCount`,
          `servicesCount` and `projectsCount` are fetched exactly as before, so
          the cards are correct the instant the manager returns via «پنل مدیریت».
        */}
        {activeTab !== "calendar" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              title="کل درخواست‌ها"
              value={stats.total.toLocaleString("fa-IR")}
              icon={MessageSquare}
              accent="teal"
              hint="درخواست‌های تماس"
              onClick={() => goToTab("submissions")}
              ariaLabel="رفتن به بخش درخواست‌ها"
            />
            <StatCard
              title="تعداد کاربران"
              value={totalUsers.toLocaleString("fa-IR")}
              icon={Users}
              accent="orange"
              hint="کاربران ثبت‌شده"
              onClick={() => goToTab("users")}
              ariaLabel="رفتن به بخش کاربران"
            />
            <StatCard
              title="مقالات منتشر شده"
              value={publishedBlogsCount.toLocaleString("fa-IR")}
              icon={FileText}
              accent="sky"
              hint="محتوای فعال بلاگ"
              onClick={() => goToTab("blogs")}
              ariaLabel="رفتن به بخش مقالات"
            />
            <StatCard
              title="خدمات ارائه شده"
              value={servicesCount.toLocaleString("fa-IR")}
              icon={Briefcase}
              accent="rose"
              hint="سرویس‌های تعریف‌شده"
              onClick={() => goToTab("services")}
              ariaLabel="رفتن به بخش خدمات"
            />
            <StatCard
              title="پروژه‌ها"
              value={projectsCount.toLocaleString("fa-IR")}
              icon={ClipboardCheck}
              accent="indigo"
              hint="پروژه‌های نمونه‌کار"
              onClick={() => goToTab("projects")}
              ariaLabel="رفتن به بخش پروژه‌ها"
            />
          </div>
        )}

        {/* Main Content */}
        <Tabs
          value={activeTab}
          onValueChange={goToTab}
          className="space-y-6"
          dir="rtl"
        >
          {/*
            There is deliberately NO `TabsList` here any more.

            It used to hold one leftover trigger labelled «کارمندان», which sat
            directly above `WorkerManagement`'s own «مدیریت کارمندان» heading and
            read as a duplicate. Every section is reached from elsewhere now: the
            five summary cards above, and پنل شخصی من / پنل مدیریت / تغییر رمز
            عبور from the account menu. `Tabs` stays because it is what switches
            the panels — Radix needs no `TabsList` for that, the controlled
            `value` is enough — and every `TabsContent` below is untouched.

            «مدیریت کارمندان» and its section menu («خلاصه کارمندان», «ساعات
            کاری», …) live inside `WorkerManagement` and were not touched.
          */}
          <TabsContent value="submissions">
            <div className="space-y-6">
              {/* Submission Stats Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="کل درخواست‌ها"
                  value={stats.total.toLocaleString("fa-IR")}
                  icon={MessageSquare}
                  accent="teal"
                />
                <StatCard
                  title="در انتظار"
                  value={stats.pending.toLocaleString("fa-IR")}
                  icon={Clock}
                  accent="amber"
                />
                <StatCard
                  title="در حال بررسی"
                  value={stats.inProgress.toLocaleString("fa-IR")}
                  icon={AlertCircle}
                  accent="sky"
                />
                <StatCard
                  title="حل شده"
                  value={stats.resolved.toLocaleString("fa-IR")}
                  icon={CheckCircle}
                  accent="emerald"
                />
              </div>

              <Card>
                <div className="p-6">
                  <h2 className="persian-heading text-xl font-semibold text-foreground mb-6">
                    درخواست‌های تماس
                  </h2>

                  {submissions.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="persian-body text-muted-foreground">
                        هنوز درخواستی ارسال نشده است
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {submissions.map((submission) => (
                        <Card key={submission.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="persian-heading font-medium text-foreground">
                                  {submission.name}
                                </h3>
                                {getStatusBadge(submission.status)}
                                {/* User Type Indicator */}
                                {submission.user_id ? (
                                  <Badge
                                    variant="outline"
                                    className="persian-body text-xs bg-green-50 text-green-700 border-green-200"
                                  >
                                    عضو
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="persian-body text-xs bg-orange-50 text-orange-700 border-orange-200"
                                  >
                                    مهمان
                                  </Badge>
                                )}
                              </div>
                              <p className="persian-body text-sm text-muted-foreground mb-1">
                                {submission.email} •{" "}
                                {convertToPersianDigits(submission.phone)}
                              </p>
                              <p className="persian-body font-medium text-sm mb-2">
                                {submission.subject}
                              </p>
                              <p className="persian-body text-sm text-muted-foreground line-clamp-2">
                                {submission.message}
                              </p>
                              <div className="flex justify-between items-center mt-2">
                                <p className="persian-body text-xs text-muted-foreground">
                                  {new Date(
                                    submission.created_at
                                  ).toLocaleDateString("fa-IR")}
                                </p>
                                {/* {submission.user_id && (
                                  <span className="persian-body text-xs text-green-600 font-medium">
                                    قابلیت پاسخگویی
                                  </span>
                                )} */}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto mt-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openSubmissionModal(submission)}
                            >
                              <Eye className="w-4 h-4 ml-1" />
                              {submission.user_id ? "پاسخگویی" : "مشاهده"}
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="space-y-6">
              {/* User Stats Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <StatCard
                  title="کل کاربران"
                  value={clientStats.total.toLocaleString("fa-IR")}
                  icon={Users}
                  accent="teal"
                />
                <StatCard
                  title="مدیران"
                  value={clientStats.admins.toLocaleString("fa-IR")}
                  icon={Shield}
                  accent="rose"
                />
                <StatCard
                  title="کاربران عادی"
                  value={clientStats.clients.toLocaleString("fa-IR")}
                  icon={UserCheck}
                  accent="violet"
                />
                <StatCard
                  title="کاربران فعال"
                  value={clientStats.active.toLocaleString("fa-IR")}
                  icon={UserCheck}
                  accent="emerald"
                />
                <StatCard
                  title="فعالیت هفته اخیر"
                  value={clientStats.recent.toLocaleString("fa-IR")}
                  icon={Calendar}
                  accent="sky"
                />
              </div>

              {/*
                Users Table.

                Same shell as «ساعات کاری» in the management panel:
                `Card` → `CardHeader` → `CardTitle` (icon + title) → `CardContent`,
                with the card-level filters living in the header the way
                «مدیریت مرخصی‌ها» already does. The table itself is `UsersTable`,
                which mirrors `TimeLogTable` column for column in structure —
                header rhythm, row height, pills, icon-only action, empty state
                and the mobile card fallback. Only the columns differ.

                Neither the data, the filters, the fetches nor the two write
                handlers (`openClientModal`, `updateUserStatus`) changed; the
                table only receives them.
              */}
              <Card className="rounded-2xl border-[#EAEEED] shadow-none">
                <CardHeader className="gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  {/* `min-w-0` so the title shrinks instead of overflowing the
                      card's padding when the search box and the role filter sit
                      beside it. */}
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      لیست کاربران سیستم
                    </CardTitle>
                    <p className="persian-body mt-1 text-xs text-muted-foreground">
                      {clientStats.total.toLocaleString("fa-IR")} کاربر ثبت‌شده
                      {isUserFilterActive
                        ? ` · ${filteredClients.length.toLocaleString(
                            "fa-IR"
                          )} نتیجه`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:w-64">
                      <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="جستجوی نام یا ایمیل..."
                        className="persian-body pe-9"
                        aria-label="جستجوی کاربر"
                      />
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="persian-body w-full sm:w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">همه نقش‌ها</SelectItem>
                        <SelectItem value="admin">مدیر</SelectItem>
                        <SelectItem value="worker">کارمند</SelectItem>
                        <SelectItem value="client">کاربر</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {clientsLoading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      <p className="persian-body mt-4 text-muted-foreground">
                        در حال بارگذاری...
                      </p>
                    </div>
                  ) : clients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                        <UserX className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="persian-heading mt-4 font-medium text-foreground">
                        هنوز کاربری ثبت‌نام نکرده است
                      </p>
                      <p className="persian-body mt-1 text-sm text-muted-foreground">
                        کاربران جدید پس از ثبت‌نام اینجا نمایش داده می‌شوند
                      </p>
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                        <Search className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="persian-heading mt-4 font-medium text-foreground">
                        نتیجه‌ای یافت نشد
                      </p>
                      <p className="persian-body mt-1 text-sm text-muted-foreground">
                        عبارت جستجو یا فیلتر نقش را تغییر دهید
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="persian-body mt-4"
                        onClick={() => {
                          setUserSearch("");
                          setRoleFilter("all");
                        }}
                      >
                        پاک کردن فیلترها
                      </Button>
                    </div>
                  ) : (
                    <UsersTable
                      clients={filteredClients}
                      /*
                        Both date columns are formatted HERE, by the component
                        that already owned that rule, so the table introduces no
                        second date convention. `formatActivityDate` is the
                        existing helper — same local-time `Date`, same Jalali
                        conversion — now used for «تاریخ عضویت» too so the two
                        columns and «ساعات کاری» all read ۱۴۰۵/۰۵/۰۱.
                      */
                      activityLabelByUserId={userActivityLabels}
                      formatJoinedAt={(client) =>
                        formatActivityDate(client.created_at)
                      }
                      onView={openClientModal}
                      onToggleActive={updateUserStatus}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="workers">
            <WorkerManagement />
          </TabsContent>

          {/*
            The manager's own personal panel — the very same dashboard a
            regular employee sees, scoped to the signed-in user. Reusing it
            keeps attendance, balance, delay and leave logic in one place.
            The password tab is hidden because this dashboard already has one,
            and so is the account menu: this panel's own header already shows
            it, and two account menus on one screen would be a duplicate.
          */}
          <TabsContent value="calendar">
            <WorkerDashboard
              title="پنل شخصی من"
              showPasswordTab={false}
              showAccountMenu={false}
              /*
                `embedded` is presentation only: this page already draws the
                grey canvas and the «خوش آمدید» banner above, so the employee
                dashboard renders its plain heading row instead of a second
                banner. Everything below the header is identical to what a
                regular employee sees.
              */
              embedded
              className="p-0"
            />
          </TabsContent>

          <TabsContent value="blogs">
            <BlogManagement />
          </TabsContent>

          <TabsContent value="services">
            <ServiceManagement />
          </TabsContent>

          <TabsContent value="projects">
            <ProjectManagement />
          </TabsContent>

          <TabsContent value="settings">
            <ChangePassword />
          </TabsContent>
        </Tabs>
      </div>
      </div>

      {/*
        «پروفایل من» — a read-only view of the signed-in manager's own account,
        built from data this component already holds (`profile` and the auth
        store `user`). No new page, route, API call or second profile system.
      */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="persian-heading text-xl">
              پروفایل من
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="persian-heading flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                {getInitials(profile.full_name)}
              </span>
              <div className="min-w-0">
                <p className="persian-heading truncate font-semibold text-foreground">
                  {profile.full_name || "بدون نام"}
                </p>
                <div className="mt-1">{getRoleBadge(profile.role)}</div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="persian-body text-sm text-muted-foreground">
                  ایمیل
                </span>
                <span className="truncate text-sm text-foreground">
                  {user?.email || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="persian-body text-sm text-muted-foreground">
                  نقش کاربری
                </span>
                <span className="persian-body text-sm text-foreground">
                  {profile.role}
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Request Modal */}
      <ContactRequestModal
        submission={selectedSubmission}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onUpdate={fetchSubmissions}
      />

      {/* Client Details Modal */}
      <Dialog open={clientModalOpen} onOpenChange={setClientModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="persian-heading text-xl">
              جزئیات کاربر
            </DialogTitle>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-6 pt-4">
              {/* User Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="persian-body text-sm text-muted-foreground">
                      نام کامل
                    </p>
                    <p className="persian-body font-medium">
                      {selectedClient.full_name || "نامشخص"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="persian-body text-sm text-muted-foreground">
                      ایمیل
                    </p>
                    <p className="persian-body font-medium ltr-content">
                      {selectedClient.email || "نامشخص"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="persian-body text-sm text-muted-foreground">
                      نقش
                    </p>
                    <div className="mt-1">
                      {getRoleBadge(selectedClient.role)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="persian-body text-sm text-muted-foreground">
                      تعداد درخواست‌ها
                    </p>
                    <p className="persian-body font-medium">
                      {selectedClient.submission_count.toLocaleString(
                        "fa-IR"
                      ) || "۰"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="persian-body text-sm text-muted-foreground">
                      تاریخ عضویت
                    </p>
                    <p className="persian-body font-medium">
                      {new Date(selectedClient.created_at).toLocaleDateString(
                        "fa-IR"
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="persian-body text-sm">وضعیت کاربر</Label>
                  <div className="flex items-center gap-3 rounded-md border p-3">
                    <Switch
                      checked={selectedClient.is_active}
                      onCheckedChange={(checked) =>
                        updateUserStatus(selectedClient, checked)
                      }
                      aria-label={
                        selectedClient.is_active
                          ? "غیرفعال کردن کاربر"
                          : "فعال کردن کاربر"
                      }
                    />
                    <span
                      className={`persian-body font-medium ${
                        selectedClient.is_active
                          ? "text-green-600"
                          : "text-orange-600"
                      }`}
                    >
                      {selectedClient.is_active ? "فعال" : "غیرفعال"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role-select" className="persian-body text-sm">
                    تغییر نقش کاربر
                  </Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger id="role-select" className="w-full">
                      <span>{getRoleBadge(newRole)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          {getRoleBadge("admin")}
                        </div>
                      </SelectItem>
                      <SelectItem value="worker">
                        <div className="flex items-center gap-2">
                          {getRoleBadge("worker")}
                        </div>
                      </SelectItem>
                      <SelectItem value="client">
                        <div className="flex items-center gap-2">
                          {getRoleBadge("client")}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedClient.last_submission && (
                  <div className="flex items-center gap-3 md:col-span-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="persian-body text-sm text-muted-foreground">
                        آخرین فعالیت
                      </p>
                      <p className="persian-body font-medium">
                        {new Date(
                          selectedClient.last_submission
                        ).toLocaleDateString("fa-IR")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Activity Summary */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="persian-body font-medium mb-2">خلاصه فعالیت</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="persian-body text-muted-foreground">
                      کل درخواست‌ها:
                    </span>
                    <span className="persian-body font-medium">
                      {selectedClient.submission_count.toLocaleString(
                        "fa-IR"
                      ) || "۰"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="persian-body text-muted-foreground">
                      وضعیت:
                    </span>
                    <span
                      className={`persian-body font-medium ${
                        selectedClient.is_active ? "text-green-600" : "text-orange-600"
                      }`}
                    >
                      {selectedClient.is_active ? "فعال" : "غیرفعال"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="pt-4">
            <Button
              onClick={updateUserRole}
              className="persian-body"
              disabled={newRole === selectedClient?.role}
            >
              <Save className="w-4 h-4 ml-2" />
              ذخیره تغییرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminDashboard;
