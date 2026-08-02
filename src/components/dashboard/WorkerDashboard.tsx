import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { WorkerCalendar } from "@/components/worker/WorkerCalendar";
import { WorkerOverview } from "@/components/worker/overview/WorkerOverview";
import { MetricDetailDialog } from "@/components/worker/overview/MetricDetailDialog";
import { CLICKABLE_CARD_CLASS } from "@/components/worker/overview/OverviewStatCard";
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
import { apiClient } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChangePassword } from "@/components/auth/ChangePassword";
import {
  formatDateForDB,
  getDaysInJalaliMonth,
  getCurrentJalaliDate,
  getJalaliMonthName,
} from "@/utils/jalali";
import { cn, convertToPersianDigits, formatDecimalHoursToTime } from "@/lib/utils";
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
 */
export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({
  workerId,
  workerProfile,
  title,
  showPasswordTab,
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
  const [totalHours, setTotalHours] = useState(0);
  /** Summary card whose detail dialog is open, `null` when nothing is open. */
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const currentDate = getCurrentJalaliDate();

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

  useEffect(() => {
    const workedHoursTotal = timeLogs.reduce((sum, log) => {
      const d = log.hours_worked_str || "0:00";
      const [hours, minutes] = (d || "0:00").split(":").map(Number);
      return sum + hours + (minutes || 0) / 60;
    }, 0);
    const approvedDayOffHours =
      dayOffRequests.filter((request) => request.status === "approved").length *
      ACCEPTED_DAY_OFF_HOURS;
    const holidayHours = isPartTime ? 0 : holidays.length * HOLIDAY_HOURS;
    setTotalHours(workedHoursTotal + approvedDayOffHours + holidayHours);
  }, [timeLogs, dayOffRequests, holidays, isPartTime]);

  useEffect(() => {
    fetchTimeLogs();
    fetchDayOffRequests();
    fetchYearlyDayOffRequests();
    fetchYearlyTimeLogs();
    fetchHolidays();
  }, [
    fetchTimeLogs,
    fetchDayOffRequests,
    fetchYearlyDayOffRequests,
    fetchYearlyTimeLogs,
    fetchHolidays,
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

  const todayDateStr = formatDateForDB(
    currentDate.jy,
    currentDate.jm,
    currentDate.jd
  );

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
      totalHours,
      isPartTime,
    ]
  );

  /** Makes a summary card behave like a button for mouse and keyboard alike. */
  const metricCardProps = (metric: MetricKey, label: string) => ({
    role: "button" as const,
    tabIndex: 0,
    title: `نمایش جزئیات ${label}`,
    "aria-label": `نمایش جزئیات ${label}`,
    onClick: () => setActiveMetric(metric),
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setActiveMetric(metric);
      }
    },
    className: CLICKABLE_CARD_CLASS,
  });

  const withPasswordTab = showPasswordTab ?? !isInspecting;

  return (
    <div className={cn("space-y-6 p-6", className)}>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">
          {title ??
            (isInspecting
              ? displayedProfile.fullName || "جزئیات کارکرد"
              : "داشبورد کارمند")}
        </h1>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedMonth.jy.toString()}
                onValueChange={(value) =>
                  setSelectedMonth({ ...selectedMonth, jy: parseInt(value) })
                }
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: 10 },
                    (_, i) => currentDate.jy - 5 + i
                  ).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedMonth.jm.toString()}
                onValueChange={(value) =>
                  setSelectedMonth({ ...selectedMonth, jm: parseInt(value) })
                }
              >
                <SelectTrigger className="w-32">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("prev")}
              disabled={!canNavigate("prev")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-32 text-center">
              {getJalaliMonthName(selectedMonth.jm)}{" "}
              {selectedMonth.jy.toLocaleString("fa-IR", { useGrouping: false })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("next")}
              disabled={!canNavigate("next")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card {...metricCardProps("today", "ساعات امروز")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ساعات امروز</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {convertToPersianDigits(formatDecimalHoursToTime(hoursToday))}{" "}
              ساعت
            </div>
            <p className="text-xs text-muted-foreground">
              {hoursToday > 0 ? "ثبت شده برای امروز" : "برای امروز ثبت نشده"}
            </p>
          </CardContent>
        </Card>
        <Card {...metricCardProps("worked", "مجموع این ماه")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مجموع این ماه</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {convertToPersianDigits(formatDecimalHoursToTime(totalHours))}{" "}
              ساعت
            </div>
            <p className="text-xs text-muted-foreground">ساعات کاری ماه جاری</p>
          </CardContent>
        </Card>
        <Card {...metricCardProps("attendance", "روزهای کاری")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">روزهای کاری</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {daysWorked.toLocaleString("fa-IR")} روز
            </div>
            <p className="text-xs text-muted-foreground">از ابتدای ماه</p>
          </CardContent>
        </Card>
        <Card {...metricCardProps("pendingLeave", "درخواست مرخصی")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">درخواست مرخصی</CardTitle>
            <Coffee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingRequests.toLocaleString("fa-IR")}
            </div>
            <p className="text-xs text-muted-foreground">در انتظار بررسی</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4" dir="rtl">
        <TabsList
          className={cn(
            "grid w-full",
            withPasswordTab ? "grid-cols-3" : "grid-cols-2"
          )}
        >
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
          <TabsTrigger value="calendar">
            {isInspecting ? "تقویم کاری" : "تقویم کاری من"}
          </TabsTrigger>
          {withPasswordTab && (
            <TabsTrigger value="settings">تغییر رمز عبور</TabsTrigger>
          )}
        </TabsList>

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
};
