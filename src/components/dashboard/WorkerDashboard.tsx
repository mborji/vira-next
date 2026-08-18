import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Calendar,
  Coffee,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { WorkerCalendar } from "@/components/worker/WorkerCalendar";
import { WorkerOverview } from "@/components/worker/overview/WorkerOverview";
import { MetricDetailDialog } from "@/components/worker/overview/MetricDetailDialog";
import type { OverviewProfile } from "@/components/worker/overview/ProfileSummaryCard";
import type {
  MetricDetailInput,
  MetricKey,
} from "@/components/worker/overview/metricDetails";
import {
  ACCEPTED_DAY_OFF_HOURS,
  HOLIDAY_HOURS,
} from "@/components/worker/overview/workerStats";
import { useAuthStore } from "@/hooks/useAuthStore";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { apiClient } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ChangePassword } from "@/components/auth/ChangePassword";
import {
  formatDateForDB,
  getDaysInJalaliMonth,
  getCurrentJalaliDate,
  getJalaliMonthName,
} from "@/utils/jalali";
import { cn, convertToPersianDigits, formatDecimalHoursToTime } from "@/lib/utils";
// Presentation only — the management dashboard's palette and its shared
// toolbar / section-tile styling, so the employee dashboard and the manager's
// panel are literally the same design system. Nothing here participates in a
// calculation, a fetch, a role check or a routing decision.
import {
  DASH,
  SECTION_TILE_BASE,
  TOOLBAR_FIELD,
  TOOLBAR_ICON_BUTTON,
  sectionTileStyle,
} from "./dashboardTheme";
import { StatCard } from "./StatCard";
import { useWindowSize } from "../windowWidth/useWindowSize";

const MOBILE_WIDTH_THRESHOLD = 600;

interface TimeLog {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  hours_worked: string;
  description: string;
  hours_worked_str: string;
  start_time_2?: string | null;
  end_time_2?: string | null;
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

type WorkerSectionId = "overview" | "calendar" | "settings";

export interface WorkerDashboardProps {
  /**
   * `user_id` of the employee to display — note this is `profiles.user_id`,
   * the same column `time_logs.worker_id` points at. Defaults to the
   * signed-in user, which is the regular employee's own panel.
   */
  workerId?: string;
  /**
   * Identity of that employee. Only needed when inspecting somebody else;
   * otherwise the signed-in user's own profile is used.
   */
  workerProfile?: OverviewProfile;
  /** Heading above the tabs. Defaults to «داشبورد کارمند». */
  title?: string;
  /**
   * «تغییر رمز عبور» only ever changes the signed-in user's own password, so
   * it is hidden while inspecting someone else and can be turned off by hosts
   * (such as the admin dashboard) that already offer it elsewhere.
   */
  showPasswordTab?: boolean;
  /**
   * Account menu in the panel header. On by default, because a regular
   * employee's dashboard is a whole page and needs a way out of the account.
   * Hosts that already render their own account menu around this component —
   * the admin dashboard — pass `false` so the screen never shows two.
   * It is hidden automatically while inspecting somebody else's records.
   */
  showAccountMenu?: boolean;
  /**
   * PRESENTATION ONLY. `true` when this dashboard is rendered inside another
   * panel that already provides the page canvas and its own «خوش آمدید» banner
   * — the manager's «پنل شخصی من» tab and the manager's employee drill-down.
   *
   * Embedded, the component drops the page background and the welcome banner
   * and falls back to a plain heading + toolbar row, so a screen never shows
   * two hero banners stacked on top of each other. Everything below the header
   * — the KPI cards, «منوی بخش‌ها» and the panels — is identical either way.
   */
  embedded?: boolean;
  className?: string;
}

/**
 * The employee dashboard — «نمای کلی», «تقویم کاری» and «تغییر رمز عبور».
 *
 * The same component serves three callers:
 *  - a regular employee looking at their own records,
 *  - a manager's own personal panel inside the admin dashboard,
 *  - a manager drilling into an employee from the management panel, in which
 *    case everything is read-only (see `isInspecting`).
 *
 * ─── ORDER IS A CONTRACT ───────────────────────────────────────────────────
 * The 2026-08-18 redesign rebuilt this screen's LOOK against the reference
 * design and left its data, its endpoints and its roles exactly as they were.
 * The render order is the project's own and must not be reshuffled:
 *
 *   header → 4 KPI cards (ساعات امروز · مجموع این ماه · روزهای کاری ·
 *   درخواست مرخصی) → «منوی بخش‌ها» (نمای کلی · تقویم کاری من · تغییر رمز عبور)
 *   → the selected panel
 *
 * The reference HTML lists several of its rows back-to-front; that file is the
 * source of the LOOK only, never of the order. Same rule as the management
 * panel — don't "fix" it back.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({
  workerId,
  workerProfile,
  title,
  showPasswordTab,
  showAccountMenu = true,
  embedded = false,
  className,
}) => {
  const { user } = useAuthStore();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentJalaliDate());
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [dayOffRequests, setDayOffRequests] = useState<DayOffRequest[]>([]);
  const [yearlyDayOffRequests, setYearlyDayOffRequests] = useState<
    DayOffRequest[]
  >([]);
  const [yearlyDayOffLoading, setYearlyDayOffLoading] = useState(false);
  const [yearlyTimeLogs, setYearlyTimeLogs] = useState<TimeLog[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [yearlyHolidays, setYearlyHolidays] = useState<Holiday[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  /** Summary card whose detail dialog is open, `null` when nothing is open. */
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);
  /**
   * Which panel «منوی بخش‌ها» is showing. This used to be Radix's own
   * uncontrolled `defaultValue`; the section menu needs to know which tile is
   * selected, so the value is held here instead. Presentation state only — the
   * default is still «نمای کلی» and no tab is a route.
   */
  const [activeSection, setActiveSection] =
    useState<WorkerSectionId>("overview");

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const currentDate = getCurrentJalaliDate();
  /** Today as a `YYYY-MM-DD` key. Declared here because the credited-hours
   * effect below depends on it. */
  const todayDateStr = formatDateForDB(
    currentDate.jy,
    currentDate.jm,
    currentDate.jd
  );

  /** Employee the panel is reading — the signed-in user unless told otherwise. */
  const targetWorkerId = workerId || user?.id || "";
  /** True when a manager is looking at somebody else's records. */
  const isInspecting = Boolean(workerId && workerId !== user?.id);
  /** Part-time employees are not credited holiday hours. */
  const isPartTime = isInspecting
    ? workerProfile?.workerType === "part_time"
    : user?.worker_type === "part_time";

  const { width } = useWindowSize();
  const isTooNarrow = width !== undefined && width < MOBILE_WIDTH_THRESHOLD;

  /** `startDate`/`endDate` of the selected month, plus the employee filter. */
  const monthParams = useCallback(
    () => ({
      startDate: formatDateForDB(selectedMonth.jy, selectedMonth.jm, 1),
      endDate: formatDateForDB(
        selectedMonth.jy,
        selectedMonth.jm,
        getDaysInJalaliMonth(selectedMonth.jy, selectedMonth.jm)
      ),
      workerId: targetWorkerId,
    }),
    [selectedMonth, targetWorkerId]
  );

  /** The same, widened to the whole selected Jalali year. */
  const yearParams = useCallback(() => {
    const year = selectedMonth.jy;
    return {
      startDate: formatDateForDB(year, 1, 1),
      endDate: formatDateForDB(year, 12, getDaysInJalaliMonth(year, 12)),
      workerId: targetWorkerId,
    };
  }, [selectedMonth.jy, targetWorkerId]);

  const fetchTimeLogs = useCallback(async () => {
    if (!targetWorkerId) return;

    try {
      const data = await apiClient.getTimeLogs(monthParams());
      setTimeLogs(data || []);
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در دریافت ساعات کاری",
        variant: "destructive",
      });
    }
  }, [targetWorkerId, monthParams]);

  const fetchDayOffRequests = useCallback(async () => {
    if (!targetWorkerId) return;

    try {
      const data = await apiClient.getDayOffRequests(monthParams());
      setDayOffRequests(
        (data || []).map((request) => ({
          ...request,
          status: request.status as "pending" | "approved" | "rejected",
        }))
      );
    } catch (error) {
      setDayOffRequests([]);
    }
  }, [targetWorkerId, monthParams]);

  /**
   * Leave records for the whole selected Jalali year — feeds the overview's
   * «خلاصه مرخصی‌ها» and «سوابق مرخصی من» blocks, which are not month-scoped.
   */
  const fetchYearlyDayOffRequests = useCallback(async () => {
    if (!targetWorkerId) return;

    setYearlyDayOffLoading(true);
    try {
      const data = await apiClient.getDayOffRequests(yearParams());
      setYearlyDayOffRequests(
        (data || []).map((request) => ({
          ...request,
          status: request.status as "pending" | "approved" | "rejected",
        }))
      );
    } catch (error) {
      setYearlyDayOffRequests([]);
    } finally {
      setYearlyDayOffLoading(false);
    }
  }, [targetWorkerId, yearParams]);

  /**
   * Time logs for the whole selected Jalali year — «تراز کارکرد» needs every
   * month from فروردین up to the selected one, not just this month.
   */
  const fetchYearlyTimeLogs = useCallback(async () => {
    if (!targetWorkerId) return;

    try {
      const data = await apiClient.getTimeLogs(yearParams());
      setYearlyTimeLogs(data || []);
    } catch (error) {
      setYearlyTimeLogs([]);
    }
  }, [targetWorkerId, yearParams]);

  const fetchHolidays = useCallback(async () => {
    const { startDate, endDate } = monthParams();

    try {
      const data = await apiClient.getHolidays({ startDate, endDate });
      setHolidays(data || []);
    } catch (error) {
      setHolidays([]);
    }
  }, [monthParams]);

  /**
   * Official holidays for the whole selected Jalali year — «تراز کارکرد»
   * credits every registered holiday, so it needs every month of the year,
   * not just the selected one.
   */
  const fetchYearlyHolidays = useCallback(async () => {
    const { startDate, endDate } = yearParams();

    try {
      const data = await apiClient.getHolidays({ startDate, endDate });
      setYearlyHolidays(data || []);
    } catch (error) {
      setYearlyHolidays([]);
    }
  }, [yearParams]);

  useEffect(() => {
    const workedHoursTotal = timeLogs.reduce((sum, log) => {
      const d = log.hours_worked_str || "0:00";
      const [hours, minutes] = (d || "0:00").split(":").map(Number);
      return sum + hours + (minutes || 0) / 60;
    }, 0);
    // Leave and holidays are only credited once the day has actually arrived,
    // matching `buildYearBalance` — otherwise a holiday later this month would
    // show up as overtime before its quota has been charged. For a past month
    // every day is already elapsed, so this filter changes nothing there.
    const hasHappened = (value?: string | null) =>
      Boolean(value) && String(value).substring(0, 10) <= todayDateStr;

    const approvedDayOffHours =
      dayOffRequests.filter(
        (request) =>
          request.status === "approved" && hasHappened(request.request_date)
      ).length * ACCEPTED_DAY_OFF_HOURS;
    const holidayHours = isPartTime
      ? 0
      : holidays.filter((holiday) => hasHappened(holiday.holiday_date)).length *
        HOLIDAY_HOURS;
    setTotalHours(workedHoursTotal + approvedDayOffHours + holidayHours);
  }, [timeLogs, dayOffRequests, holidays, isPartTime, todayDateStr]);

  useEffect(() => {
    fetchTimeLogs();
    fetchDayOffRequests();
    fetchYearlyDayOffRequests();
    fetchYearlyTimeLogs();
    fetchHolidays();
    fetchYearlyHolidays();
  }, [
    fetchTimeLogs,
    fetchDayOffRequests,
    fetchYearlyDayOffRequests,
    fetchYearlyTimeLogs,
    fetchHolidays,
    fetchYearlyHolidays,
  ]);

  /** Identity shown in the overview panel. */
  const displayedProfile = useMemo<OverviewProfile>(
    () =>
      workerProfile ?? {
        fullName: user?.full_name,
        email: user?.email,
        role: user?.role,
        workerType: user?.worker_type ?? null,
      },
    [workerProfile, user]
  );

  const navigateMonth = (direction: "prev" | "next") => {
    const newMonth = { ...selectedMonth };
    if (direction === "next") {
      if (newMonth.jm === 12) {
        newMonth.jy += 1;
        newMonth.jm = 1;
      } else {
        newMonth.jm += 1;
      }
    } else {
      if (newMonth.jm === 1) {
        newMonth.jy -= 1;
        newMonth.jm = 12;
      } else {
        newMonth.jm -= 1;
      }
    }
    setSelectedMonth(newMonth);
  };

  const canNavigate = (direction: "prev" | "next") => {
    if (isTooNarrow) return false;
    if (isAdmin) return true;

    // Workers can navigate through the current year
    const isSameMonth = (d1, d2) => d1.jy === d2.jy && d1.jm === d2.jm;

    const isSelectedMonthBeforeCurrentYearStart = () => {
      return selectedMonth.jy < currentDate.jy;
    };

    if (direction === "prev") {
      // Workers can't go to previous years. They can go back to the first month of the current year.
      // So, disable the 'prev' button if the selected month is the first month of the current year.
      return (
        !isSelectedMonthBeforeCurrentYearStart() &&
        !(selectedMonth.jy === currentDate.jy && selectedMonth.jm === 1)
      );
    }

    if (direction === "next") {
      // Workers cannot go to the next month if they are already in the current month.
      return !isSameMonth(selectedMonth, currentDate);
    }

    return false;
  };

  const convertTimeToHours = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours + (minutes || 0) / 60;
  };

  const hoursToday = convertTimeToHours(
    timeLogs.find((log) => log.date.substring(0, 10) === todayDateStr)
      ?.hours_worked || "0:00"
  );
  const daysWorked = new Set(timeLogs.map((log) => log.date)).size;
  const pendingRequests = dayOffRequests.filter(
    (req) => req.status === "pending"
  ).length;

  /** Live data every summary card's detail dialog is derived from. */
  const metricDetailInput = useMemo<MetricDetailInput>(
    () => ({
      month: selectedMonth,
      todayKey: todayDateStr,
      today: currentDate,
      timeLogs,
      dayOffRequests,
      holidays,
      yearTimeLogs: yearlyTimeLogs,
      yearDayOffRequests: yearlyDayOffRequests,
      yearHolidays: yearlyHolidays,
      workedHours: totalHours,
      countHolidayHours: !isPartTime,
    }),
    [
      selectedMonth,
      todayDateStr,
      currentDate,
      timeLogs,
      dayOffRequests,
      holidays,
      yearlyTimeLogs,
      yearlyDayOffRequests,
      yearlyHolidays,
      totalHours,
      isPartTime,
    ]
  );

  const withPasswordTab = showPasswordTab ?? !isInspecting;

  const headingText =
    title ??
    (isInspecting
      ? displayedProfile.fullName || "جزئیات کارکرد"
      : "داشبورد کارمند");

  /**
   * «منوی بخش‌ها» — the three panels, in the order this dashboard has always
   * had them. «تغییر رمز عبور» is still gated by `withPasswordTab`, the same
   * flag the tab trigger used; no new section, no new permission.
   */
  const sections: { id: WorkerSectionId; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: "نمای کلی", icon: LayoutGrid },
    {
      id: "calendar",
      label: isInspecting ? "تقویم کاری" : "تقویم کاری من",
      icon: Calendar,
    },
  ];
  if (withPasswordTab) {
    sections.push({ id: "settings", label: "تغییر رمز عبور", icon: Lock });
  }

  /** Month toolbar — the reference's 34px chips, shared with the manager panel. */
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2.5">
      {isAdmin && (
        <div className="flex items-center gap-2">
          <span
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border"
            style={{
              background: DASH.card,
              borderColor: DASH.line,
              color: DASH.subtle,
            }}
          >
            <Calendar className="h-4 w-4" />
          </span>
          <Select
            value={selectedMonth.jy.toString()}
            onValueChange={(value) =>
              setSelectedMonth({ ...selectedMonth, jy: parseInt(value) })
            }
          >
            <SelectTrigger className={cn(TOOLBAR_FIELD, "w-[86px]")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => currentDate.jy - 5 + i).map(
                (year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <Select
            value={selectedMonth.jm.toString()}
            onValueChange={(value) =>
              setSelectedMonth({ ...selectedMonth, jm: parseInt(value) })
            }
          >
            <SelectTrigger className={cn(TOOLBAR_FIELD, "w-[116px]")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "فروردین",
                "اردیبهشت",
                "خرداد",
                "تیر",
                "مرداد",
                "شهریور",
                "مهر",
                "آبان",
                "آذر",
                "دی",
                "بهمن",
                "اسفند",
              ].map((month, index) => (
                <SelectItem key={index + 1} value={(index + 1).toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2">
        {/*
          «ماه قبل» sits on the right and points right, «ماه بعد» on the left
          pointing left — the existing RTL-correct arrangement, kept.
        */}
        <Button
          variant="outline"
          size="sm"
          className={TOOLBAR_ICON_BUTTON}
          aria-label="ماه قبل"
          onClick={() => navigateMonth("prev")}
          disabled={!canNavigate("prev")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span
          className="persian-body flex h-[34px] min-w-[120px] items-center justify-center rounded-[9px] border px-4 text-[13px] font-semibold"
          style={{
            background: DASH.card,
            borderColor: DASH.line,
            color: DASH.body,
          }}
        >
          {getJalaliMonthName(selectedMonth.jm)}{" "}
          {selectedMonth.jy.toLocaleString("fa-IR", { useGrouping: false })}
        </span>
        <Button
          variant="outline"
          size="sm"
          className={TOOLBAR_ICON_BUTTON}
          aria-label="ماه بعد"
          onClick={() => navigateMonth("next")}
          disabled={!canNavigate("next")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/*
        The employee's account menu — the same shared component the admin
        panel and the client dashboard use, so «خروج از حساب کاربری» is in
        the same place for everyone. Hidden when this dashboard is embedded
        in a host that has its own menu, and while a manager is inspecting
        somebody else's records (the menu would then sit next to another
        person's name).
      */}
      {showAccountMenu && !isInspecting && (
        <AccountMenu className="rounded-[10px] border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#334155] hover:bg-white" />
      )}
    </div>
  );

  const content = (
    <div className={cn("space-y-5", className)}>
      {embedded ? (
        /* Embedded: a plain heading row — the host already shows the banner. */
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1
            className="persian-heading text-[22px] font-extrabold"
            style={{ color: DASH.ink }}
          >
            {headingText}
          </h1>
          {toolbar}
        </div>
      ) : (
        /*
          Welcome banner.

          COLOUR ONLY: this is the very same surface the manager's dashboard
          uses — the project's `from-primary/10 via-card to-card` gradient on
          `border-border`, at the same 20px radius and the same padding — so the
          two «خوش آمدید» boxes are indistinguishable. The reference file's mint
          gradient is deliberately NOT used here, exactly as it is not used
          there. Keep the two in step if either is ever restyled.
        */
        <div className="relative overflow-hidden rounded-[20px] border border-border bg-gradient-to-br from-primary/10 via-card to-card px-5 py-6 sm:px-[34px] sm:py-[30px]">
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="flex flex-col gap-2.5">
              <span
                className="persian-body text-xs font-bold"
                style={{ color: DASH.primary }}
              >
                {headingText}
              </span>
              <h1
                className="persian-heading m-0 text-[26px] font-extrabold"
                style={{ color: DASH.ink }}
              >
                خوش آمدید، {displayedProfile.fullName || "کاربر"} 👋
              </h1>
              <p
                className="persian-body m-0 max-w-[520px] text-sm leading-[1.9]"
                style={{ color: DASH.subtle }}
              >
                خلاصه‌ای از کارکرد، حضور و مرخصی‌های خود را در این ماه اینجا
                می‌بینید.
              </p>
            </div>
            {toolbar}
          </div>
        </div>
      )}

      {/*
        KPI cards — the same `StatCard` the management dashboard's five cards
        use, so a card is a card on both screens. The four keep their existing
        order and their existing behaviour: clicking one still opens that
        metric's `MetricDetailDialog`, nothing else.
      */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="ساعات امروز"
          value={`${convertToPersianDigits(
            formatDecimalHoursToTime(hoursToday)
          )} ساعت`}
          icon={Clock}
          accent="teal"
          hint={hoursToday > 0 ? "ثبت شده برای امروز" : "برای امروز ثبت نشده"}
          onClick={() => setActiveMetric("today")}
          ariaLabel="نمایش جزئیات ساعات امروز"
        />
        <StatCard
          title="مجموع این ماه"
          value={`${convertToPersianDigits(
            formatDecimalHoursToTime(totalHours)
          )} ساعت`}
          icon={TrendingUp}
          accent="sky"
          hint="ساعات کاری ماه جاری"
          onClick={() => setActiveMetric("worked")}
          ariaLabel="نمایش جزئیات مجموع این ماه"
        />
        <StatCard
          title="روزهای کاری"
          value={`${daysWorked.toLocaleString("fa-IR")} روز`}
          icon={Calendar}
          accent="orange"
          hint="از ابتدای ماه"
          onClick={() => setActiveMetric("attendance")}
          ariaLabel="نمایش جزئیات روزهای کاری"
        />
        <StatCard
          title="درخواست مرخصی"
          value={pendingRequests.toLocaleString("fa-IR")}
          icon={Coffee}
          accent="indigo"
          hint="در انتظار بررسی"
          onClick={() => setActiveMetric("pendingLeave")}
          ariaLabel="نمایش جزئیات درخواست‌های مرخصی"
        />
      </div>

      <Tabs
        value={activeSection}
        onValueChange={(value) => setActiveSection(value as WorkerSectionId)}
        className="space-y-[18px]"
        dir="rtl"
      >
        {/*
          «منوی بخش‌ها» — the section switcher of the reference design, the very
          same card the management panel renders. It replaces the old `TabsList`
          and switches the very same `TabsContent`s; `Tabs` needs no `TabsList`
          for that, the controlled `value` is enough.

          The three entries keep the order they have always had: نمای کلی ·
          تقویم کاری من · تغییر رمز عبور.
        */}
        <div
          className="rounded-2xl border px-[18px] py-4"
          style={{ background: DASH.card, borderColor: DASH.cardLine }}
        >
          <p
            className="persian-body mb-3 text-xs font-semibold"
            style={{ color: DASH.faint }}
          >
            منوی بخش‌ها
          </p>
          {/*
            One column PER SECTION, so the tiles always fill the row edge to
            edge and never leave a dead third column.

            A regular employee has three sections and gets `sm:grid-cols-3` —
            exactly the layout they already had. The manager's «پنل شخصی من» and
            the employee drill-down hide «تغییر رمز عبور» (`withPasswordTab`),
            so there the row is two tiles wide and would otherwise stop
            two-thirds of the way across. This is the only difference between
            the two, and it follows from the section count rather than from any
            role check — no new permission logic.
          */}
          <div
            className={cn(
              "grid grid-cols-2 gap-3",
              sections.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
            )}
            role="tablist"
            aria-label="منوی بخش‌ها"
          >
            {sections.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;

              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveSection(id)}
                  className={cn(
                    SECTION_TILE_BASE,
                    isActive ? "border-0 font-bold" : "border"
                  )}
                  style={sectionTileStyle(isActive)}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {/*
                    `text-white` is REQUIRED on the selected tile, it is not a
                    duplicate of the button's inline colour: `.persian-body` is
                    a component-layer rule that applies `text-foreground`, and
                    that beats the white the button passes down by inheritance.
                    A utility-layer class wins over the component layer.
                  */}
                  <span
                    className={cn(
                      "persian-body text-[13px] font-semibold leading-snug",
                      isActive && "text-white"
                    )}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <TabsContent value="overview">
          <WorkerOverview
            profile={displayedProfile}
            selectedMonth={selectedMonth}
            todayKey={todayDateStr}
            today={currentDate}
            timeLogs={timeLogs}
            dayOffRequests={dayOffRequests}
            yearlyDayOffRequests={yearlyDayOffRequests}
            yearlyDayOffLoading={yearlyDayOffLoading}
            yearlyTimeLogs={yearlyTimeLogs}
            holidays={holidays}
            yearlyHolidays={yearlyHolidays}
            countHolidayHours={!isPartTime}
            workedHours={totalHours}
            isSelf={!isInspecting}
            onMetricSelect={setActiveMetric}
          />
        </TabsContent>

        <TabsContent value="calendar">
          <WorkerCalendar
            today={todayDateStr}
            currentDate={currentDate}
            selectedMonth={selectedMonth}
            totalHours={totalHours}
            timeLogs={timeLogs}
            dayOffRequests={dayOffRequests}
            holidays={holidays}
            isAdmin={isAdmin}
            selectedWorkerId={targetWorkerId}
            // Time logs and leave requests are always written for the
            // signed-in user, so another employee's calendar is view-only.
            readOnly={isInspecting}
            onDataChange={() => {
              fetchTimeLogs();
              fetchDayOffRequests();
              fetchYearlyTimeLogs();
              fetchYearlyDayOffRequests();
              fetchHolidays();
              fetchYearlyHolidays();
            }}
          />
        </TabsContent>

        {withPasswordTab && (
          <TabsContent value="settings" className="space-y-6">
            <ChangePassword />
          </TabsContent>
        )}
      </Tabs>

      <MetricDetailDialog
        metric={activeMetric}
        onClose={() => setActiveMetric(null)}
        data={metricDetailInput}
      />
    </div>
  );

  if (embedded) return content;

  /*
    Page shell of the reference design — the soft grey canvas and the 1480px
    reading column, identical to the management dashboard's. Only the standalone
    employee page renders it; embedded, the host already provides one.
  */
  return (
    <div className="min-h-screen" style={{ background: DASH.page }}>
      <div className="mx-auto w-full max-w-[1480px] px-4 pb-[70px] pt-6 sm:px-[30px]">
        {content}
      </div>
    </div>
  );
};
