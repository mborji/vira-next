import React, { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Users,
  Clock,
  Coffee,
  CheckCircle,
  XCircle,
  Edit,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
  ClipboardList,
  ArrowRight,
  Eye,
  type LucideIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { WorkerDashboard } from "@/components/dashboard/WorkerDashboard";
import { TimeLogTable } from "@/components/dashboard/TimeLogTable";
import {
  DayOffRequestTable,
  type DayOffRequestRow,
} from "@/components/dashboard/DayOffRequestTable";
import type { OverviewProfile } from "@/components/worker/overview/ProfileSummaryCard";
import {
  getCurrentJalaliDate,
  getJalaliMonthName,
  getDaysInJalaliMonth,
  formatDateForDB,
  gregorianToJalali,
  formatJalaliDate,
} from "@/utils/jalali";
import { cn, convertToPersianDigits, formatDecimalHoursToTime } from "@/lib/utils";
// Single source of truth for the company's 9-hour day. Never redeclare these
// as local constants — that is how the manager panel drifted from the employee
// dashboard before.
import {
  ACCEPTED_DAY_OFF_HOURS,
  HOLIDAY_HOURS,
  formatCount,
  formatHours,
} from "@/components/worker/overview/workerStats";
import { ANNUAL_LEAVE_DAYS } from "@/components/worker/overview/monthlyWorkQuota";
// Presentation-only palette + the derived per-employee figures the redesigned
// summary cards and the comparison charts read. Neither adds a request.
import { DASH, TINTS, WORKER_TYPE_BADGE } from "./dashboardTheme";
import {
  buildManagerWorkerStats,
  type ManagerWorkerStats,
} from "./managerSummaryStats";
import { ManagerComparisonCharts } from "./ManagerComparisonCharts";

type DashboardSectionId =
  | "summary"
  | "time-logs"
  | "day-off-requests"
  | "holidays"
  | "pending";

const DASHBOARD_SECTIONS: {
  id: DashboardSectionId;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "summary", label: "خلاصه کارمندان", icon: Users },
  { id: "time-logs", label: "ساعات کاری", icon: Clock },
  { id: "day-off-requests", label: "درخواست‌های مرخصی", icon: Coffee },
  { id: "holidays", label: "مدیریت تعطیلی‌ها", icon: Calendar },
  { id: "pending", label: "در انتظار بررسی", icon: ClipboardList },
];

/**
 * Toolbar chip styling of the reference design, shared by the three `Select`
 * triggers so they line up with the month pill and the arrow buttons.
 * Purely visual — it overrides shadcn's defaults through `twMerge`.
 */
const TOOLBAR_FIELD =
  "h-[34px] rounded-[9px] border-[#E2E8F0] bg-white px-3.5 text-[13px] text-[#334155]";

/** The two 34×34 month-arrow buttons. */
const TOOLBAR_ICON_BUTTON =
  "h-[34px] w-[34px] shrink-0 rounded-[9px] border-[#E2E8F0] bg-white p-0 text-[#64748B] hover:bg-[#F8FAFA] hover:text-[#0F172A]";

interface Worker {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  worker_type?: "full_time" | "part_time";
}

/**
 * The server rejects an approval that would exceed the annual leave cap with a
 * plain-English 400 (`…limit reached for Jalali year 1405 (max 26)`), which
 * `ApiClient.handleResponse` rethrows verbatim. Showing the generic
 * «خطا در بروزرسانی» there hides the one thing the manager needs to know.
 *
 * NOTE: the cap is written twice — `ANNUAL_LEAVE_DAYS` here and a literal `26`
 * in `server/routes/workers.js`. The number in the message is read back from the
 * server so the two can never disagree on screen.
 */
const describeLeaveError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : "";
  if (/limit reached/i.test(message)) {
    const cap = Number(message.match(/max (\d+)/)?.[1] ?? ANNUAL_LEAVE_DAYS);
    return `سقف مرخصی سالانه پر شده است — این کارمند تمام ${formatCount(
      cap
    )} روز مرخصی سال جلالی خود را استفاده کرده و درخواست دیگری قابل تأیید نیست.`;
  }
  return message || "خطا در بروزرسانی درخواست مرخصی";
};

const getInitials = (name: string): string => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  if (parts.length === 1) return parts[0].charAt(0);
  return `${parts[0].charAt(0)} ${parts[1].charAt(0)}`;
};

interface TimeLog {
  id: string;
  worker_id: string;
  date: string;
  start_time: string;
  end_time: string;
  hours_worked: string;
  description: string;
  worker_name: string;
  start_time_2?: string | null;
  end_time_2?: string | null;
}

interface DayOffRequest {
  id: string;
  worker_id: string;
  request_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  worker_name: string;
  created_at: string;
}

interface WorkerSummary {
  worker_id: string;
  worker_name: string;
  total_hours: number;
  days_worked: number;
  approved_days_off: number;
}

interface Holiday {
  id: string;
  holiday_date: string;
  title?: string | null;
}

export const WorkerManagement: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [workerSummaries, setWorkerSummaries] = useState<WorkerSummary[]>([]);
  const [selectedTimeLog, setSelectedTimeLog] = useState<TimeLog | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editStartTime2, setEditStartTime2] = useState("");
  const [editEndTime2, setEditEndTime2] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentJalaliDate());
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("all");
  const [activeSection, setActiveSection] = useState("summary");
  const [holidayDate, setHolidayDate] = useState(() => ({
    jy: getCurrentJalaliDate().jy,
    jm: getCurrentJalaliDate().jm,
    jd: 1,
  }));
  const [holidayTitle, setHolidayTitle] = useState("");
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  /**
   * Employee whose full personal dashboard is open. `null` shows the
   * management panel itself.
   */
  const [inspectedWorker, setInspectedWorker] = useState<Worker | null>(null);

  const currentDate = getCurrentJalaliDate();
  /**
   * `currentDate` is a fresh object on every render, so it can never be a stable
   * `useMemo` dependency. These three primitives can — they only change when the
   * day does.
   */
  const { jy: todayJy, jm: todayJm, jd: todayJd } = currentDate;

  const queryClient = useQueryClient();

  // Declared above the effects on purpose: the `calculateWorkerSummaries` effect
  // lists `dayOffRequests` in its dependency array, so a later `const` would
  // throw a TDZ ReferenceError (same trap as `todayDateStr` in WorkerDashboard).

  /**
   * Leave requests are the one slice of this panel on TanStack Query. The month
   * range is part of the key, so changing month or employee refetches, and a
   * decision below only has to invalidate the key instead of re-running a
   * hand-rolled fetch.
   */
  const leaveRange = useMemo(
    () => ({
      startDate: formatDateForDB(selectedMonth.jy, selectedMonth.jm, 1),
      endDate: formatDateForDB(
        selectedMonth.jy,
        selectedMonth.jm,
        getDaysInJalaliMonth(selectedMonth.jy, selectedMonth.jm)
      ),
    }),
    [selectedMonth.jy, selectedMonth.jm]
  );

  const scopedWorkerId =
    selectedWorkerId && selectedWorkerId !== "all" ? selectedWorkerId : "";

  const dayOffQuery = useQuery({
    queryKey: [
      "day-off-requests",
      leaveRange.startDate,
      leaveRange.endDate,
      scopedWorkerId || "all",
    ],
    enabled: workers.length > 0,
    queryFn: async (): Promise<DayOffRequest[]> => {
      const params: Record<string, string> = { ...leaveRange };
      if (scopedWorkerId) params.workerId = scopedWorkerId;
      const data = await apiClient.getDayOffRequests(params);
      return (data || []).map((request: DayOffRequest) => ({
        ...request,
        status: request.status as DayOffRequest["status"],
      }));
    },
  });

  const dayOffRequests = useMemo(
    () => dayOffQuery.data ?? [],
    [dayOffQuery.data]
  );

  useEffect(() => {
    if (!dayOffQuery.isError) return;
    toast({
      title: "خطا",
      description: "خطا در دریافت درخواست‌های مرخصی",
      variant: "destructive",
    });
  }, [dayOffQuery.isError]);

  /** Only meaningful for a single employee — the endpoint counts one worker. */
  const leaveRemainingQuery = useQuery({
    queryKey: ["day-off-remaining", scopedWorkerId, selectedMonth.jy],
    enabled: Boolean(scopedWorkerId),
    queryFn: () =>
      apiClient.getDayOffRequestRemaining({
        workerId: scopedWorkerId,
        year: String(selectedMonth.jy),
      }),
  });

  const decideDayOff = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "approved" | "rejected";
    }) => apiClient.updateDayOffRequest(id, { status, admin_notes: null }),
    onSuccess: (_data, { status }) => {
      toast({
        title: "موفقیت",
        description: `درخواست مرخصی ${
          status === "approved" ? "تایید" : "رد"
        } شد`,
      });
      queryClient.invalidateQueries({ queryKey: ["day-off-requests"] });
      queryClient.invalidateQueries({ queryKey: ["day-off-remaining"] });
    },
    onError: (error) => {
      toast({
        title: "خطا",
        description: describeLeaveError(error),
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    fetchWorkers();
  }, []);

  useEffect(() => {
    if (workers.length > 0) {
      fetchTimeLogs();
      fetchHolidays();
    }
  }, [selectedMonth.jy, selectedMonth.jm, selectedWorkerId, workers.length]);

  useEffect(() => {
    calculateWorkerSummaries();
  }, [workers, timeLogs, dayOffRequests, holidays, selectedWorkerId]);

  useEffect(() => {
    setHolidayDate((prev) => {
      const maxDay = getDaysInJalaliMonth(selectedMonth.jy, selectedMonth.jm);
      return {
        jy: selectedMonth.jy,
        jm: selectedMonth.jm,
        jd: Math.min(prev.jd, maxDay),
      };
    });
  }, [selectedMonth.jy, selectedMonth.jm]);

  const fetchWorkers = async () => {
    try {
      const data = await apiClient.getWorkers();
      setWorkers(data || []);
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در دریافت لیست کارمندان",
        variant: "destructive",
      });
    }
  };

  const changeWorkerType = async (
    worker: Worker,
    workerType: "full_time" | "part_time"
  ) => {
    try {
      await apiClient.updateWorkerType(worker.id, workerType);
      setWorkers((prev) =>
        prev.map((item) =>
          item.id === worker.id ? { ...item, worker_type: workerType } : item
        )
      );
      toast({
        title: "موفقیت",
        description: "نوع همکاری کارمند بروزرسانی شد",
      });
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در بروزرسانی نوع همکاری",
        variant: "destructive",
      });
    }
  };

  const fetchTimeLogs = async () => {
    const startDate = formatDateForDB(selectedMonth.jy, selectedMonth.jm, 1);
    const endDate = formatDateForDB(
      selectedMonth.jy,
      selectedMonth.jm,
      getDaysInJalaliMonth(selectedMonth.jy, selectedMonth.jm)
    );

    try {
      const params: any = { startDate, endDate };
      if (selectedWorkerId && selectedWorkerId !== "all") {
        params.workerId = selectedWorkerId;
      }
      const data = await apiClient.getTimeLogs(params);
      setTimeLogs(data || []);
    } catch (error) {
      console.error("Error fetching time logs:", error);
      toast({
        title: "خطا",
        description: "خطا در دریافت ساعات کاری",
        variant: "destructive",
      });
      setTimeLogs([]);
    }
  };

  const fetchHolidays = async () => {
    const startDate = formatDateForDB(selectedMonth.jy, selectedMonth.jm, 1);
    const endDate = formatDateForDB(
      selectedMonth.jy,
      selectedMonth.jm,
      getDaysInJalaliMonth(selectedMonth.jy, selectedMonth.jm)
    );

    try {
      const data = await apiClient.getHolidays({ startDate, endDate });
      setHolidays(data || []);
    } catch (error) {
      setHolidays([]);
    }
  };

  const convertTimeToHours = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours + (minutes || 0) / 60;
  };

  const calculateWorkerSummaries = () => {
    const filteredWorkers =
      selectedWorkerId && selectedWorkerId !== "all"
        ? workers.filter((worker) => worker.user_id === selectedWorkerId)
        : workers;

    const summaries = filteredWorkers.map((worker) => {
      const workerLogs = timeLogs.filter(
        (log) => log.worker_id === worker.user_id
      );
      const workerDayOffs = dayOffRequests.filter(
        (req) => req.worker_id === worker.user_id && req.status === "approved"
      );

      return {
        worker_id: worker.user_id,
        worker_name: worker.full_name || "نامشخص",
        total_hours:
          workerLogs.reduce(
            (sum, log) => sum + convertTimeToHours(log.hours_worked),
            0
          ) +
          workerDayOffs.length * ACCEPTED_DAY_OFF_HOURS +
          (worker.worker_type === "part_time" ? 0 : holidays.length * HOLIDAY_HOURS),
        days_worked: workerLogs.length,
        approved_days_off: workerDayOffs.length,
      };
    });

    setWorkerSummaries(summaries);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setSelectedMonth((prev) => {
      if (direction === "prev") {
        if (prev.jm === 1) {
          return { jy: prev.jy - 1, jm: 12, jd: prev.jd };
        } else {
          return { ...prev, jm: prev.jm - 1 };
        }
      } else {
        if (prev.jm === 12) {
          return { jy: prev.jy + 1, jm: 1, jd: prev.jd };
        } else {
          return { ...prev, jm: prev.jm + 1 };
        }
      }
    });
  };

  const calculateHoursTime = (
    start1: string,
    end1: string,
    start2?: string,
    end2?: string
  ): string => {
    const timeToMinutes = (timeString: string): number => {
      if (!timeString) return 0;
      const [hours, minutes] = timeString.split(":").map(Number);
      return hours * 60 + minutes;
    };

    let totalDiffMinutes = 0;

    if (start1 && end1) {
      const startMinutes1 = timeToMinutes(start1);
      let endMinutes1 = timeToMinutes(end1);

      if (endMinutes1 < startMinutes1) {
        endMinutes1 += 1440;
      }

      const diffMinutes1 = Math.max(0, endMinutes1 - startMinutes1);
      totalDiffMinutes += diffMinutes1;
    } else {
      return "00:00";
    }

    if (start2 && end2) {
      const startMinutes2 = timeToMinutes(start2);
      let endMinutes2 = timeToMinutes(end2);

      if (endMinutes2 < startMinutes2) {
        endMinutes2 += 1440;
      }

      const diffMinutes2 = Math.max(0, endMinutes2 - startMinutes2);
      totalDiffMinutes += diffMinutes2;
    }

    const hours = Math.floor(totalDiffMinutes / 60);
    const minutes = totalDiffMinutes % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
    // if (!start || !end) return "00:00";

    // const [startHour, startMinute] = start.split(":").map(Number);
    // const [endHour, endMinute] = end.split(":").map(Number);

    // const startMinutes = startHour * 60 + startMinute;
    // const endMinutes = endHour * 60 + endMinute;

    // const diffMinutes = Math.max(0, endMinutes - startMinutes);
    // const hours = Math.floor(diffMinutes / 60);
    // const minutes = diffMinutes % 60;

    // return `${hours.toString().padStart(2, "0")}:${minutes
    //   .toString()
    //   .padStart(2, "0")}`;
  };

  const timeToMinutes = (timeString: string): number => {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const isOverlap = (
    s1: string,
    e1: string,
    s2: string,
    e2: string
  ): boolean => {
    const min1Start = timeToMinutes(s1);
    const min1End = timeToMinutes(e1);
    const min2Start = timeToMinutes(s2);
    const min2End = timeToMinutes(e2);

    if (min2Start <= 0 || min2End <= 0) return false;

    const overlaps = min1Start < min2End && min2Start < min1End;

    return overlaps;
  };

  const updateTimeLog = async () => {
    if (!selectedTimeLog) return;

    const isSegment2Filled = !!(editStartTime2 || editEndTime2);
    const isSegment2Complete = !!(editStartTime2 && editEndTime2);

    if (isSegment2Filled && !isSegment2Complete) {
      toast({
        title: "خطا",
        description: "در بخش دوم کار، باید زمان شروع و پایان آن را کامل کنید",
        variant: "destructive",
      });
      return;
    }

    if (isSegment2Complete) {
      if (
        isOverlap(editStartTime, editEndTime, editStartTime2!, editEndTime2!)
      ) {
        toast({
          title: "خطا",
          description:
            "بخش دوم کار نباید با بخش اول همپوشانی زمانی داشته باشد. لطفاً زمان‌ها را بررسی کنید.",
          variant: "destructive",
        });
        return;
      }
    }

    const hoursWorked = calculateHoursTime(
      editStartTime,
      editEndTime,
      editStartTime2,
      editEndTime2
    );

    try {
      await apiClient.updateTimeLog(selectedTimeLog.id, {
        start_time: editStartTime + ":00",
        end_time: editEndTime + ":00",
        start_time_2: editStartTime2 ? editStartTime2 + ":00" : null,
        end_time_2: editEndTime2 ? editEndTime2 + ":00" : null,
        hours_worked: hoursWorked + ":00",
        description: editDescription,
      });

      toast({
        title: "موفقیت",
        description: "ساعات کاری بروزرسانی شد",
      });

      setIsEditDialogOpen(false);
      fetchTimeLogs();
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در بروزرسانی ساعات کاری",
        variant: "destructive",
      });
    }
  };

  const resetHolidayForm = () => {
    setEditingHolidayId(null);
    setHolidayTitle("");
    setHolidayDate((prev) => ({ ...prev, jd: 1 }));
  };

  const saveHoliday = async () => {
    try {
      const holidayDateForDb = formatDateForDB(
        holidayDate.jy,
        holidayDate.jm,
        holidayDate.jd
      );

      if (editingHolidayId) {
        await apiClient.updateHoliday(editingHolidayId, {
          holiday_date: holidayDateForDb,
          title: holidayTitle || null,
        });
      } else {
        await apiClient.createHoliday({
          holiday_date: holidayDateForDb,
          title: holidayTitle || null,
        });
      }

      toast({
        title: "موفقیت",
        description: editingHolidayId
          ? "تعطیلی با موفقیت بروزرسانی شد"
          : "تعطیلی با موفقیت ثبت شد",
      });

      resetHolidayForm();
      fetchHolidays();
    } catch (error: any) {
      toast({
        title: "خطا",
        description: error?.message || "خطا در ذخیره تعطیلی",
        variant: "destructive",
      });
    }
  };

  const editHoliday = (holiday: Holiday) => {
    const jalaliDate = gregorianToJalali(new Date(holiday.holiday_date));
    setEditingHolidayId(holiday.id);
    setHolidayTitle(holiday.title || "");
    setHolidayDate(jalaliDate);
  };

  const removeHoliday = async (holidayId: string) => {
    try {
      await apiClient.deleteHoliday(holidayId);
      toast({
        title: "موفقیت",
        description: "تعطیلی با موفقیت حذف شد",
      });
      if (editingHolidayId === holidayId) {
        resetHolidayForm();
      }
      fetchHolidays();
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در حذف تعطیلی",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (timeLog: TimeLog) => {
    setSelectedTimeLog(timeLog);
    setEditStartTime(
      timeLog.start_time ? timeLog.start_time.substring(0, 5) : ""
    );
    setEditEndTime(timeLog.end_time ? timeLog.end_time.substring(0, 5) : "");
    setEditStartTime2(
      timeLog.start_time_2 ? timeLog.start_time_2.substring(0, 5) : ""
    );
    setEditEndTime2(
      timeLog.end_time_2 ? timeLog.end_time_2.substring(0, 5) : ""
    );
    setEditDescription(timeLog.description || "");
    setIsEditDialogOpen(true);
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const jalali = gregorianToJalali(date);
    return formatJalaliDate(jalali);
  };

  const pendingRequests = useMemo(
    () => dayOffRequests.filter((req) => req.status === "pending"),
    [dayOffRequests]
  );

  const visibleLeaveRequests = useMemo(
    () =>
      leaveStatusFilter === "all"
        ? dayOffRequests
        : dayOffRequests.filter((req) => req.status === leaveStatusFilter),
    [dayOffRequests, leaveStatusFilter]
  );

  /**
   * The extra per-employee figures the redesigned summary cards and the
   * comparison charts show: required hours, balance, absences, late days and
   * total delay.
   *
   * **No new data source.** Everything is derived in the browser from state this
   * panel already holds for the selected month — `workerSummaries` (the existing
   * credited hours / days worked / approved leave), `timeLogs`, `dayOffRequests`
   * and `holidays`. The three figures the panel showed before are passed
   * straight through, never recomputed, so they cannot drift.
   */
  const workerStatsById = useMemo(() => {
    const map = new Map<string, ManagerWorkerStats>();

    workerSummaries.forEach((summary) => {
      const worker = workers.find(
        (item) => item.user_id === summary.worker_id
      );

      map.set(
        summary.worker_id,
        buildManagerWorkerStats({
          month: { jy: selectedMonth.jy, jm: selectedMonth.jm },
          today: { jy: todayJy, jm: todayJm, jd: todayJd },
          workerId: summary.worker_id,
          // Part-timers are neither credited nor charged holiday hours — the
          // same rule `calculateWorkerSummaries` above already applies.
          countHolidayHours: worker?.worker_type !== "part_time",
          timeLogs: timeLogs.filter(
            (log) => log.worker_id === summary.worker_id
          ),
          dayOffRequests: dayOffRequests.filter(
            (request) => request.worker_id === summary.worker_id
          ),
          holidays,
          workedHours: summary.total_hours,
          attendanceDays: summary.days_worked,
          leaveDays: summary.approved_days_off,
        })
      );
    });

    return map;
  }, [
    workerSummaries,
    workers,
    timeLogs,
    dayOffRequests,
    holidays,
    selectedMonth.jy,
    selectedMonth.jm,
    todayJy,
    todayJm,
    todayJd,
  ]);

  /** The same list, in the panel's own order, for the comparison charts. */
  const comparisonRows = useMemo(
    () =>
      workerSummaries
        .map((summary) => {
          const stats = workerStatsById.get(summary.worker_id);
          return stats ? { ...stats, name: summary.worker_name } : null;
        })
        .filter((row): row is ManagerWorkerStats & { name: string } =>
          Boolean(row)
        ),
    [workerSummaries, workerStatsById]
  );

  // Drill-down: reuse the employee dashboard itself rather than
  // re-implementing attendance, balance, delay and leave views here.
  if (inspectedWorker) {
    const profile: OverviewProfile = {
      fullName: inspectedWorker.full_name,
      email: inspectedWorker.email,
      workerType: inspectedWorker.worker_type ?? null,
    };

    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setInspectedWorker(null)}
        >
          <ArrowRight className="ms-2 h-4 w-4" />
          بازگشت به مدیریت کارمندان
        </Button>

        <Card className="overflow-hidden">
          <WorkerDashboard
            workerId={inspectedWorker.user_id}
            workerProfile={profile}
            title={`جزئیات کارکرد — ${
              inspectedWorker.full_name || inspectedWorker.email
            }`}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-[18px]">
      {/*
        Heading first, toolbar second — the project's existing order, kept on
        purpose. The reference file lists the toolbar first, but it is written
        back-to-front throughout, and under the app's global `dir="rtl"` copying
        that would push «مدیریت کارمندان» to the left edge.
      */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2
          className="persian-heading m-0 text-[21px] font-extrabold"
          style={{ color: DASH.ink }}
        >
          مدیریت کارمندان
        </h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border"
              style={{
                background: DASH.card,
                borderColor: DASH.line,
                color: DASH.subtle,
              }}
            >
              <Users className="h-4 w-4" />
            </span>
            <Select
              value={selectedWorkerId || "all"}
              onValueChange={(value) =>
                setSelectedWorkerId(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className={cn(TOOLBAR_FIELD, "w-44")}>
                <SelectValue placeholder="انتخاب کارمند" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه کارمندان</SelectItem>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.user_id}>
                    {worker.full_name || worker.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                {Array.from(
                  { length: 10 },
                  (_, i) => currentDate.jy - 5 + i
                ).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year.toLocaleString("fa-IR", { useGrouping: false })}
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
          <div className="flex items-center gap-2">
            {/*
              «ماه قبل» sits on the right and points right, «ماه بعد» on the
              left pointing left — the existing RTL-correct arrangement, kept.
            */}
            <Button
              variant="outline"
              size="sm"
              className={TOOLBAR_ICON_BUTTON}
              aria-label="ماه قبل"
              onClick={() => navigateMonth("prev")}
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
              {selectedMonth.jy.toLocaleString("fa-IR", {
                useGrouping: false,
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              className={TOOLBAR_ICON_BUTTON}
              aria-label="ماه بعد"
              onClick={() => navigateMonth("next")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeSection} className="space-y-[18px]" dir="rtl">
        {/*
          «منوی بخش‌ها». The five entries keep the order they have always had —
          خلاصه کارمندان first — which is `DASHBOARD_SECTIONS`. The reference
          file lists them the other way round; that file is written back-to-front
          and its order is deliberately ignored here.
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
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            role="tablist"
            aria-label="منوی بخش‌ها"
          >
            {DASHBOARD_SECTIONS.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;
              const displayLabel = label;

              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveSection(id)}
                  className={cn(
                    "flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl p-4 text-center transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive ? "border-0 font-bold" : "border"
                  )}
                  style={
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
                        }
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {/*
                    `text-white` is REQUIRED on the selected tile, it is not a
                    duplicate of the button's inline colour: `.persian-body` is a
                    component-layer rule that applies `text-foreground`, and that
                    beats the white the button passes down by inheritance — which
                    left dark text on the green fill. A utility-layer class wins
                    over the component layer, so it puts the label back to white.
                  */}
                  <span
                    className={cn(
                      "persian-body text-[13px] font-semibold leading-snug",
                      isActive && "text-white"
                    )}
                  >
                    {displayLabel}
                  </span>
                  {id === "pending" && pendingRequests.length > 0 && (
                    <Badge
                      variant={isActive ? "secondary" : "destructive"}
                      className={cn(
                        "px-1.5 py-0 text-[10px]",
                        // Same reason: white count on a translucent white chip,
                        // so every piece of text on a selected tile is white and
                        // still readable against the green.
                        isActive &&
                          "border-transparent bg-white/20 text-white hover:bg-white/20"
                      )}
                    >
                      {pendingRequests.length.toLocaleString("fa-IR")}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <TabsContent value="summary" className="space-y-8">
          {/*
            «تحلیل و مقایسه مدیریتی» — new in this design, and the reference
            places it above the employee list, so that is where it goes. It adds
            no request: `comparisonRows` is derived from the month's data this
            panel has already loaded.
          */}
          <ManagerComparisonCharts
            rows={comparisonRows}
            monthLabel={`${getJalaliMonthName(
              selectedMonth.jm
            )} ${selectedMonth.jy.toLocaleString("fa-IR", {
              useGrouping: false,
            })}`}
          />

          <section className="space-y-3.5">
            <h3
              className="persian-heading m-0 flex items-center gap-2 text-lg font-extrabold"
              style={{ color: DASH.ink }}
            >
              <Users className="h-[19px] w-[19px]" style={{ color: DASH.primary }} />
              خلاصه عملکرد کارمندان
            </h3>

            {workerSummaries.length === 0 ? (
              <div
                className="persian-body rounded-2xl border py-16 text-center text-sm"
                style={{
                  background: DASH.card,
                  borderColor: DASH.cardLine,
                  color: DASH.faint,
                }}
              >
                کارمندی برای نمایش وجود ندارد
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {workerSummaries.map((summary) => {
                  const worker = workers.find(
                    (item) => item.user_id === summary.worker_id
                  );
                  const workerType = worker?.worker_type || "full_time";
                  const badge = WORKER_TYPE_BADGE[workerType];
                  const stats = workerStatsById.get(summary.worker_id);

                  /**
                   * Over quota → teal bar and a teal figure; under it → amber
                   * bar and a red figure. With no quota for the month (a month
                   * still in the future) the card simply reads as “on target”.
                   */
                  const onTarget =
                    !stats || summary.total_hours >= stats.requiredHours;

                  return (
                    <div
                      key={summary.worker_id}
                      className="flex flex-col rounded-2xl border p-[18px] transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                      style={{
                        background: DASH.card,
                        borderColor: DASH.cardLine,
                      }}
                    >
                      {/* Identity — name block on the start side, type badge on the end side. */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="persian-heading flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                            style={{ background: DASH.primary }}
                          >
                            {getInitials(summary.worker_name)}
                          </span>
                          <div className="min-w-0">
                            <b
                              className="persian-heading block truncate text-sm font-extrabold"
                              style={{ color: DASH.ink }}
                            >
                              {summary.worker_name}
                            </b>
                            {worker?.email && (
                              <span
                                dir="ltr"
                                className="block truncate text-right text-[11px]"
                                style={{ color: DASH.faint }}
                              >
                                {worker.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className="persian-body shrink-0 whitespace-nowrap rounded-full px-[11px] py-1 text-[11px] font-semibold"
                          style={{ background: badge.bg, color: badge.fg }}
                        >
                          {badge.label}
                        </span>
                      </div>

                      {/* «کارکرد ماه» — credited hours against the month's quota. */}
                      <div className="mt-3.5 flex items-center justify-between gap-2 text-xs">
                        <span className="persian-body" style={{ color: DASH.subtle }}>
                          کارکرد ماه
                        </span>
                        <b
                          dir="ltr"
                          className="[font-variant-numeric:tabular-nums]"
                          style={{ color: onTarget ? DASH.primary : DASH.danger }}
                        >
                          {convertToPersianDigits(
                            formatDecimalHoursToTime(summary.total_hours)
                          )}
                          {" / "}
                          {convertToPersianDigits(
                            formatDecimalHoursToTime(stats?.requiredHours ?? 0)
                          )}
                        </b>
                      </div>
                      {/*
                        No `direction` override here: the track inherits the
                        app's RTL, so the fill grows from the start (right) edge
                        the way every other bar on this page does.
                      */}
                      <div
                        className="mt-1.5 h-2 overflow-hidden rounded-full"
                        style={{ background: DASH.track }}
                      >
                        <span
                          className="block h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${stats?.completionPercent ?? 0}%`,
                            background: onTarget ? DASH.primary : DASH.warning,
                          }}
                        />
                      </div>

                      {/*
                        The three figures the panel has always shown, in the
                        order it has always shown them: مجموع ساعات، روزهای
                        کاری، مرخصی تایید شده. The reference lists them
                        back-to-front; that order is ignored on purpose.
                      */}
                      <div className="mt-3.5 grid grid-cols-3 gap-2">
                        <div
                          className="rounded-xl border px-2 py-3 text-center"
                          style={{
                            background: TINTS.emerald.bg,
                            borderColor: TINTS.emerald.border,
                          }}
                        >
                          <Clock
                            className="mx-auto h-[17px] w-[17px]"
                            style={{ color: TINTS.emerald.icon }}
                          />
                          <div
                            dir="ltr"
                            className="persian-heading mt-1 text-[15px] font-extrabold"
                            style={{ color: TINTS.emerald.value }}
                          >
                            {convertToPersianDigits(
                              formatDecimalHoursToTime(summary.total_hours)
                            )}
                          </div>
                          <div
                            className="persian-body text-[10px]"
                            style={{ color: TINTS.emerald.label }}
                          >
                            مجموع ساعات
                          </div>
                        </div>
                        <div
                          className="rounded-xl border px-2 py-3 text-center"
                          style={{
                            background: TINTS.sky.bg,
                            borderColor: TINTS.sky.border,
                          }}
                        >
                          <Calendar
                            className="mx-auto h-[17px] w-[17px]"
                            style={{ color: TINTS.sky.icon }}
                          />
                          <div
                            className="persian-heading mt-1 text-[17px] font-extrabold"
                            style={{ color: TINTS.sky.value }}
                          >
                            {summary.days_worked.toLocaleString("fa-IR")}
                          </div>
                          <div
                            className="persian-body text-[10px]"
                            style={{ color: TINTS.sky.label }}
                          >
                            روزهای کاری
                          </div>
                        </div>
                        <div
                          className="rounded-xl border px-2 py-3 text-center"
                          style={{
                            background: TINTS.amber.bg,
                            borderColor: TINTS.amber.border,
                          }}
                        >
                          <Coffee
                            className="mx-auto h-[17px] w-[17px]"
                            style={{ color: TINTS.amber.icon }}
                          />
                          <div
                            className="persian-heading mt-1 text-[17px] font-extrabold"
                            style={{ color: TINTS.amber.value }}
                          >
                            {summary.approved_days_off.toLocaleString("fa-IR")}
                          </div>
                          <div
                            className="persian-body text-[10px]"
                            style={{ color: TINTS.amber.label }}
                          >
                            مرخصی تایید شده
                          </div>
                        </div>
                      </div>

                      {/*
                        خلاصه عملکرد — the dashed footnote row, in the order the
                        panel asks for: حضور → تأخیر → اضافه‌کاری → غیبت, with
                        کسری kept last so nothing that was already on the card is
                        lost.

                        Every figure comes from `stats`, which is derived from the
                        month's own time logs, leave requests and holidays (see
                        `managerSummaryStats.ts`). Nothing here is a placeholder,
                        and no endpoint was added for it: غیبت is
                        `absenceDays` — elapsed working days with neither a time
                        log nor approved leave — and تأخیر is `lateDays`, working
                        days clocked in after ۰۹:۳۰, both straight out of the
                        employee dashboard's own `buildWorkerMonthStats`.
                      */}
                      {stats && (
                        <div
                          className="persian-body mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-dashed pt-3 text-[11px]"
                          style={{
                            borderColor: DASH.cardLine,
                            color: DASH.faint,
                          }}
                        >
                          <span>
                            حضور:{" "}
                            <b style={{ color: DASH.primary }}>
                              {formatCount(stats.attendanceDays)} روز
                            </b>
                          </span>
                          <span>
                            تأخیر:{" "}
                            <b style={{ color: DASH.warning }}>
                              {formatCount(stats.lateDays)} بار
                            </b>
                          </span>
                          <span>
                            اضافه‌کاری:{" "}
                            <b style={{ color: DASH.success }}>
                              {formatHours(stats.overtimeHours)} ساعت
                            </b>
                          </span>
                          <span>
                            غیبت:{" "}
                            <b style={{ color: DASH.danger }}>
                              {formatCount(stats.absenceDays)} روز
                            </b>
                          </span>
                          <span>
                            کسری:{" "}
                            <b style={{ color: DASH.danger }}>
                              {formatHours(stats.deficitHours)} ساعت
                            </b>
                          </span>
                        </div>
                      )}

                      {/*
                        Unchanged actions: the drill-down into the employee's own
                        dashboard and the employment-type control. Restyled only.
                      */}
                      <div
                        className="mt-3.5 border-t pt-3.5"
                        style={{ borderColor: DASH.cardLine }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="mb-3 w-full rounded-[10px] border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFA]"
                          disabled={!worker}
                          onClick={() => worker && setInspectedWorker(worker)}
                        >
                          <Eye className="ms-2 h-4 w-4" />
                          مشاهده جزئیات کارکرد
                        </Button>
                        <Label
                          className="persian-body mb-1.5 block text-[11px]"
                          style={{ color: DASH.faint }}
                        >
                          نوع همکاری
                        </Label>
                        {worker ? (
                          <Select
                            value={workerType}
                            onValueChange={(value) =>
                              changeWorkerType(
                                worker,
                                value as "full_time" | "part_time"
                              )
                            }
                          >
                            <SelectTrigger
                              className={cn(TOOLBAR_FIELD, "w-full")}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full_time">تمام وقت</SelectItem>
                              <SelectItem value="part_time">پاره وقت</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            className="persian-body text-sm"
                            style={{ color: DASH.faint }}
                          >
                            -
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="time-logs">
          <Card className="rounded-2xl border-[#EAEEED] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                ساعات کاری ثبت شده
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimeLogTable
                logs={timeLogs}
                workers={workers}
                onEdit={(log) => openEditDialog(log as TimeLog)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="day-off-requests">
          <Card className="rounded-2xl border-[#EAEEED] shadow-none">
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                  <Coffee className="h-5 w-5" />
                  مدیریت مرخصی‌ها
                </CardTitle>
                {leaveRemainingQuery.data ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {`${formatCount(
                      leaveRemainingQuery.data.approvedCount
                    )} روز از ${formatCount(
                      leaveRemainingQuery.data.limit
                    )} روز مرخصی سال ${formatCount(
                      leaveRemainingQuery.data.year
                    )} استفاده شده — ${formatCount(
                      leaveRemainingQuery.data.remaining
                    )} روز باقی مانده.`}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    برای دیدن مانده مرخصی سالانه، یک کارمند را از بالای صفحه
                    انتخاب کنید.
                  </p>
                )}
              </div>
              <Select
                value={leaveStatusFilter}
                onValueChange={setLeaveStatusFilter}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                  <SelectItem value="pending">در انتظار</SelectItem>
                  <SelectItem value="approved">تأیید شده</SelectItem>
                  <SelectItem value="rejected">رد شده</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {dayOffQuery.isPending && workers.length > 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  در حال دریافت درخواست‌ها…
                </div>
              ) : (
                <DayOffRequestTable
                  requests={visibleLeaveRequests as DayOffRequestRow[]}
                  workers={workers}
                  onDecide={(id, status) => decideDayOff.mutate({ id, status })}
                  decidingId={
                    decideDayOff.isPending
                      ? decideDayOff.variables?.id ?? null
                      : null
                  }
                  emptyLabel={
                    leaveStatusFilter === "all"
                      ? "برای این بازه هیچ درخواست مرخصی‌ای ثبت نشده است."
                      : "درخواستی با این وضعیت در این بازه وجود ندارد."
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holidays">
          <Card className="rounded-2xl border-[#EAEEED] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                مدیریت تعطیلی‌های رسمی (تاریخ شمسی)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <Label>سال</Label>
                  <Select
                    value={holidayDate.jy.toString()}
                    onValueChange={(value) =>
                      setHolidayDate((prev) => ({
                        ...prev,
                        jy: parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        { length: 10 },
                        (_, i) => currentDate.jy - 5 + i
                      ).map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year.toLocaleString("fa-IR", { useGrouping: false })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ماه</Label>
                  <Select
                    value={holidayDate.jm.toString()}
                    onValueChange={(value) => {
                      const jm = parseInt(value);
                      setHolidayDate((prev) => ({
                        ...prev,
                        jm,
                        jd: Math.min(prev.jd, getDaysInJalaliMonth(prev.jy, jm)),
                      }));
                    }}
                  >
                    <SelectTrigger>
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
                <div>
                  <Label>روز</Label>
                  <Select
                    value={holidayDate.jd.toString()}
                    onValueChange={(value) =>
                      setHolidayDate((prev) => ({
                        ...prev,
                        jd: parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        {
                          length: getDaysInJalaliMonth(
                            holidayDate.jy,
                            holidayDate.jm
                          ),
                        },
                        (_, i) => i + 1
                      ).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day.toLocaleString("fa-IR", { useGrouping: false })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>عنوان تعطیلی (اختیاری)</Label>
                  <Input
                    value={holidayTitle}
                    onChange={(e) => setHolidayTitle(e.target.value)}
                    placeholder="مثال: تعطیل رسمی"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveHoliday}>
                  {editingHolidayId ? "بروزرسانی تعطیلی" : "ثبت تعطیلی"}
                </Button>
                {editingHolidayId && (
                  <Button variant="outline" onClick={resetHolidayForm}>
                    انصراف از ویرایش
                  </Button>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>تاریخ شمسی</TableHead>
                    <TableHead>عنوان</TableHead>
                    <TableHead>عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell>
                        {convertToPersianDigits(formatDateDisplay(holiday.holiday_date))}
                      </TableCell>
                      <TableCell>{holiday.title || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => editHoliday(holiday)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeHoliday(holiday.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kept deliberately: the same pending requests are also decidable inline
            in «درخواست‌های مرخصی», but the user wants this tab to stay as it was. */}
        <TabsContent value="pending">
          <Card className="rounded-2xl border-[#EAEEED] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coffee className="h-5 w-5" />
                درخواست‌های در انتظار بررسی
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام کارمند</TableHead>
                    <TableHead>تاریخ مرخصی</TableHead>
                    <TableHead>دلیل</TableHead>
                    <TableHead>تاریخ درخواست</TableHead>
                    <TableHead>عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.worker_name}
                      </TableCell>
                      <TableCell>
                        {convertToPersianDigits(
                          formatDateDisplay(request.request_date)
                        )}
                      </TableCell>
                      <TableCell>{request.reason}</TableCell>
                      <TableCell>
                        {convertToPersianDigits(
                          formatDateDisplay(request.created_at)
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={decideDayOff.isPending}
                            onClick={() =>
                              decideDayOff.mutate({
                                id: request.id,
                                status: "approved",
                              })
                            }
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={decideDayOff.isPending}
                            onClick={() =>
                              decideDayOff.mutate({
                                id: request.id,
                                status: "rejected",
                              })
                            }
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ویرایش ساعات کاری</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-start-time">زمان شروع</Label>
                <Input
                  id="edit-start-time"
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-end-time">زمان پایان</Label>
                <Input
                  id="edit-end-time"
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-10">
              <Label className="font-semibold mb-2 flex justify-between items-center">
                بخش دوم کار (اختیاری)
                {(editStartTime2 || editEndTime2) && (
                  <Button
                    onClick={() => {
                      setEditStartTime2("");
                      setEditEndTime2("");
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 ml-1" />
                    حذف بخش دوم
                  </Button>
                )}
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime2">زمان شروع</Label>
                  <Input
                    id="startTime2"
                    type="time"
                    value={editStartTime2}
                    onChange={(e) => setEditStartTime2(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="endTime2">زمان پایان</Label>
                  <Input
                    id="endTime2"
                    type="time"
                    value={editEndTime2}
                    onChange={(e) => setEditEndTime2(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {editStartTime && editEndTime && (
              <div className="text-sm text-muted-foreground text-center">
                مجموع:{" "}
                {convertToPersianDigits(
                  calculateHoursTime(
                    editStartTime,
                    editEndTime,
                    editStartTime2,
                    editEndTime2
                  )
                )}
              </div>
            )}

            <div>
              <Label htmlFor="edit-description">توضیحات</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <Button onClick={updateTimeLog} className="w-full">
              بروزرسانی
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
