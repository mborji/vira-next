import React, { useState, useEffect } from "react";
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
} from "@/components/worker/overview/workerStats";

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

interface Worker {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  worker_type?: "full_time" | "part_time";
}

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
  const [dayOffRequests, setDayOffRequests] = useState<DayOffRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [workerSummaries, setWorkerSummaries] = useState<WorkerSummary[]>([]);
  const [selectedTimeLog, setSelectedTimeLog] = useState<TimeLog | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editStartTime2, setEditStartTime2] = useState("");
  const [editEndTime2, setEditEndTime2] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentJalaliDate());
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
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

  useEffect(() => {
    fetchWorkers();
  }, []);

  useEffect(() => {
    if (workers.length > 0) {
      fetchTimeLogs();
      fetchDayOffRequests();
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

  const fetchDayOffRequests = async () => {
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
      const data = await apiClient.getDayOffRequests(params);
      const typedData = (data || []).map((request) => ({
        ...request,
        status: request.status as "pending" | "approved" | "rejected",
      }));
      setDayOffRequests(typedData);
    } catch (error) {
      console.error("Error fetching day off requests:", error);
      toast({
        title: "خطا",
        description: "خطا در دریافت درخواست‌های مرخصی",
        variant: "destructive",
      });
      setDayOffRequests([]);
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

  const handleDayOffRequest = async (
    requestId: string,
    status: "approved" | "rejected"
  ) => {
    try {
      await apiClient.updateDayOffRequest(requestId, {
        status,
        admin_notes: adminNotes || null,
      });

      toast({
        title: "موفقیت",
        description: `درخواست مرخصی ${
          status === "approved" ? "تایید" : "رد"
        } شد`,
      });

      setAdminNotes("");
      fetchDayOffRequests();
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در بروزرسانی درخواست مرخصی",
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

  const pendingRequests = dayOffRequests.filter(
    (req) => req.status === "pending"
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">مدیریت کارمندان</h2>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-start">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedWorkerId || "all"}
              onValueChange={(value) =>
                setSelectedWorkerId(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-48">
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
          <div className="flex items-center gap-2 w-full sm:w-auto">
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
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("prev")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="min-w-[120px] text-center">
              {getJalaliMonthName(selectedMonth.jm)}{" "}
              {selectedMonth.jy.toLocaleString("fa-IR", {
                useGrouping: false,
              })}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("next")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeSection} className="space-y-6" dir="rtl">
        <Card className="p-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            منوی بخش‌ها
          </p>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2"
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
                    "flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-3 text-center transition-all min-h-[88px]",
                    "hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent/50"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isActive ? "text-primary-foreground" : "text-primary"
                    )}
                  />
                  <span className="text-xs sm:text-sm font-medium leading-snug">
                    {displayLabel}
                  </span>
                  {id === "pending" && pendingRequests.length > 0 && (
                    <Badge
                      variant={isActive ? "secondary" : "destructive"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {pendingRequests.length.toLocaleString("fa-IR")}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                خلاصه عملکرد کارمندان
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workerSummaries.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  کارمندی برای نمایش وجود ندارد
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {workerSummaries.map((summary) => {
                    const worker = workers.find(
                      (item) => item.user_id === summary.worker_id
                    );
                    const workerType = worker?.worker_type || "full_time";

                    return (
                      <div
                        key={summary.worker_id}
                        className="flex flex-col overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-primary/[0.04] p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-sm font-bold text-primary-foreground shadow-sm ring-2 ring-primary/15">
                            {getInitials(summary.worker_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-foreground">
                              {summary.worker_name}
                            </p>
                            {worker?.email && (
                              <p
                                dir="ltr"
                                className="truncate text-right text-xs text-muted-foreground"
                              >
                                {worker.email}
                              </p>
                            )}
                          </div>
                          <Badge
                            className={cn(
                              "shrink-0 border-transparent font-medium",
                              workerType === "full_time"
                                ? "bg-primary/10 text-primary hover:bg-primary/10"
                                : "bg-accent/20 text-accent-foreground hover:bg-accent/20"
                            )}
                          >
                            {workerType === "full_time" ? "تمام‌وقت" : "پاره‌وقت"}
                          </Badge>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="rounded-lg border border-teal-200/70 bg-gradient-to-br from-teal-50 to-teal-100/40 p-3 text-center dark:border-teal-800/50 dark:from-teal-950/40 dark:to-teal-900/20">
                            <Clock className="mx-auto mb-1 h-4 w-4 text-teal-600 dark:text-teal-400" />
                            <div className="text-sm font-bold text-teal-900 dark:text-teal-100">
                              {convertToPersianDigits(
                                formatDecimalHoursToTime(summary.total_hours)
                              )}
                            </div>
                            <div className="mt-0.5 text-[11px] text-teal-700/80 dark:text-teal-300/80">
                              مجموع ساعات
                            </div>
                          </div>
                          <div className="rounded-lg border border-sky-200/70 bg-gradient-to-br from-sky-50 to-sky-100/40 p-3 text-center dark:border-sky-800/50 dark:from-sky-950/40 dark:to-sky-900/20">
                            <Calendar className="mx-auto mb-1 h-4 w-4 text-sky-600 dark:text-sky-400" />
                            <div className="text-sm font-bold text-sky-900 dark:text-sky-100">
                              {summary.days_worked.toLocaleString("fa-IR")}
                            </div>
                            <div className="mt-0.5 text-[11px] text-sky-700/80 dark:text-sky-300/80">
                              روزهای کاری
                            </div>
                          </div>
                          <div className="rounded-lg border border-amber-200/70 bg-gradient-to-br from-amber-50 to-amber-100/40 p-3 text-center dark:border-amber-800/50 dark:from-amber-950/40 dark:to-amber-900/20">
                            <Coffee className="mx-auto mb-1 h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <div className="text-sm font-bold text-amber-900 dark:text-amber-100">
                              {summary.approved_days_off.toLocaleString("fa-IR")}
                            </div>
                            <div className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-300/80">
                              مرخصی تایید شده
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 border-t border-border/60 pt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="mb-3 w-full"
                            disabled={!worker}
                            onClick={() => worker && setInspectedWorker(worker)}
                          >
                            <Eye className="ms-2 h-4 w-4" />
                            مشاهده جزئیات کارکرد
                          </Button>
                          <Label className="mb-1.5 block text-xs text-muted-foreground">
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
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="full_time">تمام وقت</SelectItem>
                                <SelectItem value="part_time">پاره وقت</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time-logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                ساعات کاری ثبت شده
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام کارمند</TableHead>
                    <TableHead>تاریخ</TableHead>
                    <TableHead>ساعات کاری</TableHead>
                    <TableHead>توضیحات</TableHead>
                    <TableHead>عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {log.worker_name}
                      </TableCell>
                      <TableCell>
                        {convertToPersianDigits(formatDateDisplay(log.date))}
                      </TableCell>
                      <TableCell>
                        {log.hours_worked
                          ? convertToPersianDigits(
                              log.hours_worked.substring(0, 5)
                            )
                          : "۰۰:۰۰"}
                      </TableCell>
                      <TableCell>{log.description || "-"}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(log)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="day-off-requests">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coffee className="h-5 w-5" />
                همه درخواست‌های مرخصی
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام کارمند</TableHead>
                    <TableHead>تاریخ مرخصی</TableHead>
                    <TableHead>دلیل</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>تاریخ درخواست</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dayOffRequests.map((request) => (
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
                        <Badge
                          variant={
                            request.status === "approved"
                              ? "default"
                              : request.status === "rejected"
                              ? "destructive"
                              : "outline"
                          }
                        >
                          {request.status === "pending"
                            ? "در انتظار"
                            : request.status === "approved"
                            ? "تایید شده"
                            : "رد شده"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {convertToPersianDigits(
                          formatDateDisplay(request.created_at)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holidays">
          <Card>
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

        <TabsContent value="pending">
          <Card>
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
                            onClick={() =>
                              handleDayOffRequest(request.id, "approved")
                            }
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              handleDayOffRequest(request.id, "rejected")
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
