import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, Coffee, Save, Trash2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/hooks/useAuthStore";
import {
  getJalaliMonthName,
  getDaysInJalaliMonth,
  jalaliToGregorian,
  formatDateForDB,
} from "@/utils/jalali";
import {
  cn,
  convertToPersianDigits,
  formatDecimalHoursToTime,
} from "@/lib/utils";
import { NON_WORKING_WEEKDAYS } from "@/components/worker/overview/workerStats";
import { useWindowSize } from "../windowWidth/useWindowSize";
import { RotateCcw } from "lucide-react";

const MOBILE_WIDTH_THRESHOLD = 600;

/**
 * The single coloured element of a non-working day: the pill itself.
 * The day card stays white so the calendar keeps its clean look.
 */
const NON_WORKING_BADGE_CLASS =
  "mt-1 border-rose-200 bg-rose-50 text-[10px] font-medium text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300";

/** Persian week header — index 5 is پنجشنبه and index 6 is جمعه. */
const WEEK_DAY_LABELS = [
  { short: "ش", full: "شنبه" },
  { short: "ی", full: "یکشنبه" },
  { short: "د", full: "دوشنبه" },
  { short: "س", full: "سه‌شنبه" },
  { short: "چ", full: "چهارشنبه" },
  { short: "پ", full: "پنجشنبه", off: true },
  { short: "ج", full: "جمعه", off: true },
];

interface TimeLog {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  hours_worked: string;
  description: string;
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

interface WorkerCalendarProps {
  today: string;
  currentDate: { jy: number; jm: number; jd: number };
  selectedMonth: { jy: number; jm: number; jd: number };
  totalHours: number;
  timeLogs: TimeLog[];
  dayOffRequests: DayOffRequest[];
  holidays: Holiday[];
  isAdmin: boolean;
  selectedWorkerId?: string;
  /**
   * View-only calendar. Time logs and leave requests are always written for
   * the signed-in user, so a manager inspecting another employee must not be
   * offered the edit actions.
   */
  readOnly?: boolean;
  onDataChange: () => void;
}

export const WorkerCalendar: React.FC<WorkerCalendarProps> = ({
  today,
  currentDate,
  selectedMonth,
  totalHours,
  timeLogs,
  dayOffRequests,
  holidays,
  isAdmin,
  readOnly = false,
  onDataChange,
}) => {
  const { user } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState<{
    jy: number;
    jm: number;
    jd: number;
  } | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [startTime2, setStartTime2] = useState("");
  const [endTime2, setEndTime2] = useState("");
  const [description, setDescription] = useState("");
  const [dayOffReason, setDayOffReason] = useState("");
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [isDayOffDialogOpen, setIsDayOffDialogOpen] = useState(false);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [currentDayOffId, setCurrentDayOffId] = useState<string | null>(null);
  const [currentHolidayId, setCurrentHolidayId] = useState<string | null>(null);
  const [holidayTitle, setHolidayTitle] = useState("");
  const [dayOffRemaining, setDayOffRemaining] = useState<number | null>(null);
  const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false);

  const fetchDayOffRemaining = async () => {
    if (!user) return;
    try {
      const data = await apiClient.getDayOffRequestRemaining({
        workerId: user.id,
        year: String(currentDate.jy),
      });
      setDayOffRemaining(
        typeof data?.remaining === "number" ? data.remaining : null
      );
    } catch {
      setDayOffRemaining(null);
    }
  };

  useEffect(() => {
    fetchDayOffRemaining();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const { width } = useWindowSize();
  const isTooNarrow = width !== undefined && width < MOBILE_WIDTH_THRESHOLD;

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

  const saveTimeLog = async () => {
    if (!user || !selectedDate || !startTime || !endTime) return;

    const isSegment2Filled = !!(startTime2 || endTime2);
    const isSegment2Complete = !!(startTime2 && endTime2);

    if (isSegment2Filled && !isSegment2Complete) {
      toast({
        title: "خطا",
        description: "در بخش دوم کار، باید زمان شروع و پایان آن را کامل کنید",
        variant: "destructive",
      });
      return;
    }

    if (isSegment2Complete) {
      if (isOverlap(startTime, endTime, startTime2!, endTime2!)) {
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
      startTime,
      endTime,
      startTime2,
      endTime2
    );

    if (hoursWorked === "00:00") {
      toast({
        title: "خطا",
        description: "زمان پایان باید بعد از زمان شروع باشد",
        variant: "destructive",
      });
      return;
    }

    const dateStr = formatDateForDB(
      selectedDate.jy,
      selectedDate.jm,
      selectedDate.jd
    );

    const logData = {
      worker_id: user.id,
      date: dateStr,
      start_time: startTime + ":00",
      end_time: endTime + ":00",
      hours_worked: hoursWorked + ":00",
      description: description || null,
      start_time_2: startTime2 ? startTime2 + ":00" : null,
      end_time_2: endTime2 ? endTime2 + ":00" : null,
    };
    try {
      await apiClient.saveTimeLog(logData);

      toast({
        title: "موفقیت",
        description: "ساعات کاری با موفقیت ذخیره شد",
      });

      setIsLogDialogOpen(false);
      setStartTime("");
      setEndTime("");
      setDescription("");
      setStartTime2("");
      setEndTime2("");
      onDataChange();
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در ذخیره ساعات کاری",
        variant: "destructive",
      });
    }
  };

  const requestDayOff = async () => {
    if (!user || !selectedDate) return;

    const dateStr = formatDateForDB(
      selectedDate.jy,
      selectedDate.jm,
      selectedDate.jd
    );

    try {
      if (dayOffRemaining !== null && dayOffRemaining <= 0) {
        toast({
          title: "سقف مرخصی تکمیل شد",
          description: "سهمیه مرخصی تایید شده شما برای امسال تکمیل شده است",
          variant: "destructive",
        });
        return;
      }

      await apiClient.createDayOffRequest({
        worker_id: user.id,
        request_date: dateStr,
        reason: dayOffReason,
      });

      toast({
        title: "موفقیت",
        description: "درخواست مرخصی ثبت شد",
      });

      setIsDayOffDialogOpen(false);
      setDayOffReason("");
      fetchDayOffRemaining();
      onDataChange();
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در ثبت درخواست مرخصی",
        variant: "destructive",
      });
    }
  };

  const canEditDate = (jy: number, jm: number, jd: number) => {
    if (isAdmin) return true;

    // Workers can edit current month + 5 days into next month
    if (jy === currentDate.jy && jm === currentDate.jm) {
      return true; // Current month
    }

    const isNextMonthGracePeriod =
      (currentDate.jy === jy &&
        currentDate.jm === jm + 1 &&
        currentDate.jd <= 5) ||
      (jy === currentDate.jy - 1 &&
        jm === 12 &&
        currentDate.jm === 1 &&
        currentDate.jd <= 5);

    return isNextMonthGracePeriod;
  };

  const deleteTimeLog = async () => {
    if (!currentLogId) return;

    try {
      await apiClient.deleteTimeLog(currentLogId);
      toast({
        title: "موفقیت",
        description: "ساعات کاری حذف شد",
      });
      setIsLogDialogOpen(false);
      setCurrentLogId(null);
      setStartTime("");
      setEndTime("");
      setDescription("");
      onDataChange();
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در حذف ساعات کاری",
        variant: "destructive",
      });
    }
  };

  const deleteDayOff = async () => {
    if (!currentDayOffId) return;

    try {
      await apiClient.deleteDayOffRequest(currentDayOffId);
      toast({
        title: "موفقیت",
        description: "درخواست مرخصی حذف شد",
      });
      setIsDayOffDialogOpen(false);
      setCurrentDayOffId(null);
      setDayOffReason("");
      onDataChange();
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در حذف درخواست مرخصی",
        variant: "destructive",
      });
    }
  };

  const saveHoliday = async () => {
    if (!isAdmin || !selectedDate) return;
    const dateStr = formatDateForDB(
      selectedDate.jy,
      selectedDate.jm,
      selectedDate.jd
    );

    try {
      if (currentHolidayId) {
        await apiClient.updateHoliday(currentHolidayId, {
          title: holidayTitle || null,
        });
      } else {
        await apiClient.createHoliday({
          holiday_date: dateStr,
          title: holidayTitle || null,
        });
      }
      toast({
        title: "موفقیت",
        description: currentHolidayId
          ? "تعطیلی رسمی بروزرسانی شد"
          : "تعطیلی رسمی ثبت شد",
      });
      setIsHolidayDialogOpen(false);
      setCurrentHolidayId(null);
      setHolidayTitle("");
      onDataChange();
    } catch (error: any) {
      toast({
        title: "خطا",
        description: error?.message || "خطا در ثبت تعطیلی رسمی",
        variant: "destructive",
      });
    }
  };

  const deleteHoliday = async () => {
    if (!isAdmin || !currentHolidayId) return;
    try {
      await apiClient.deleteHoliday(currentHolidayId);
      toast({
        title: "موفقیت",
        description: "تعطیلی رسمی حذف شد",
      });
      setIsHolidayDialogOpen(false);
      setCurrentHolidayId(null);
      setHolidayTitle("");
      onDataChange();
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در حذف تعطیلی رسمی",
        variant: "destructive",
      });
    }
  };

  const openLogDialog = (jy: number, jm: number, jd: number) => {
    if (readOnly) return;
    if (!canEditDate(jy, jm, jd)) {
      toast({
        title: "دسترسی محدود",
        description: "شما فقط می‌توانید ماه جاری را ویرایش کنید",
        variant: "destructive",
      });
      return;
    }

    setSelectedDate({ jy, jm, jd });
    const dateStr = formatDateForDB(jy, jm, jd);
    const existingLog = timeLogs.find(
      (log) => log.date.substring(0, 10) === dateStr
    );

    if (existingLog) {
      setCurrentLogId(existingLog.id);
      setStartTime(
        existingLog.start_time ? existingLog.start_time.substring(0, 5) : ""
      );
      setEndTime(
        existingLog.end_time ? existingLog.end_time.substring(0, 5) : ""
      );
      setStartTime2(
        existingLog.start_time_2 ? existingLog.start_time_2.substring(0, 5) : ""
      );
      setEndTime2(
        existingLog.end_time_2 ? existingLog.end_time_2.substring(0, 5) : ""
      );
      setDescription(existingLog.description || "");
    } else {
      setCurrentLogId(null);
      setStartTime("");
      setEndTime("");
      setStartTime2("");
      setEndTime2("");
      setDescription("");
    }

    setIsLogDialogOpen(true);
  };

  const openDayOffDialog = (jy: number, jm: number, jd: number) => {
    if (readOnly) return;
    if (!canEditDate(jy, jm, jd)) {
      toast({
        title: "دسترسی محدود",
        description: "شما فقط می‌توانید ماه جاری را ویرایش کنید",
        variant: "destructive",
      });
      return;
    }

    setSelectedDate({ jy, jm, jd });
    const dateStr = formatDateForDB(jy, jm, jd);
    const existingRequest = dayOffRequests.find(
      (req) => req.request_date.substring(0, 10) === dateStr
    );

    if (existingRequest) {
      setCurrentDayOffId(existingRequest.id);
      setDayOffReason(existingRequest.reason || "");
    } else {
      setCurrentDayOffId(null);
      setDayOffReason("");
    }

    fetchDayOffRemaining();
    setIsDayOffDialogOpen(true);
  };

  const openHolidayDialog = (jy: number, jm: number, jd: number) => {
    if (readOnly || !isAdmin) return;
    setSelectedDate({ jy, jm, jd });
    const dateStr = formatDateForDB(jy, jm, jd);
    const existingHoliday = holidays.find(
      (holiday) => holiday.holiday_date.substring(0, 10) === dateStr
    );

    if (existingHoliday) {
      setCurrentHolidayId(existingHoliday.id);
      setHolidayTitle(existingHoliday.title || "");
    } else {
      setCurrentHolidayId(null);
      setHolidayTitle("");
    }

    setIsHolidayDialogOpen(true);
  };

  const getDayInfo = (jd: number) => {
    const dateStr = formatDateForDB(selectedMonth.jy, selectedMonth.jm, jd);
    const timeLog = timeLogs.find(
      (log) => log.date.substring(0, 10) === dateStr
    );
    const dayOffRequest = dayOffRequests.find(
      (req) => req.request_date.substring(0, 10) === dateStr
    );
    const holiday = holidays.find(
      (holidayItem) => holidayItem.holiday_date.substring(0, 10) === dateStr
    );

    return { timeLog, dayOffRequest, holiday };
  };

  const renderCalendarDay = (day: number) => {
    const { timeLog, dayOffRequest, holiday } = getDayInfo(day);
    const gregorianDate = jalaliToGregorian(
      selectedMonth.jy,
      selectedMonth.jm,
      day
    );
    const dayOfWeek = gregorianDate.getDay();

    // Thursday and Friday are the weekly days off in every month, not only in
    // the current one — official holidays are non-working days as well.
    const isWeekend = NON_WORKING_WEEKDAYS.includes(dayOfWeek);
    // Official holidays and the weekly days off share the same red numeral;
    // the day card itself stays white.
    const isNonWorkingDay = isWeekend || Boolean(holiday);

    const dateStr = formatDateForDB(selectedMonth.jy, selectedMonth.jm, day);
    const isToday = dateStr === today;
    const canEdit = canEditDate(selectedMonth.jy, selectedMonth.jm, day);

    return (
      <div
        key={day}
        className={cn(
          "min-h-24 border border-border bg-background p-2",
          isToday && "border-primary bg-primary/10 ring-1 ring-primary"
        )}
      >
        <div className="flex justify-between items-start mb-2">
          <span
            className={cn(
              "text-sm font-medium",
              isNonWorkingDay && "font-semibold text-rose-600 dark:text-rose-400"
            )}
            title={
              holiday
                ? holiday.title?.trim() || "تعطیل رسمی"
                : isWeekend
                ? "تعطیل هفتگی"
                : undefined
            }
          >
            {day.toLocaleString("fa-IR")}
          </span>
          <div className={cn("flex gap-1", readOnly && "hidden")}>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() =>
                openLogDialog(selectedMonth.jy, selectedMonth.jm, day)
              }
              disabled={!canEdit}
            >
              <Clock
                className={`h-3 w-3 ${!canEdit ? "text-muted-foreground" : ""}`}
              />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() =>
                openDayOffDialog(selectedMonth.jy, selectedMonth.jm, day)
              }
              disabled={!canEdit}
            >
              <Coffee
                className={`h-3 w-3 ${!canEdit ? "text-muted-foreground" : ""}`}
              />
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() =>
                  openHolidayDialog(selectedMonth.jy, selectedMonth.jm, day)
                }
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {timeLog && (
          <Badge variant="secondary" className="text-xs mb-1">
            {timeLog.hours_worked
              ? convertToPersianDigits(timeLog.hours_worked.substring(0, 5))
              : "۰۰:۰۰"}
          </Badge>
        )}

        {dayOffRequest && (
          <Badge
            variant={
              dayOffRequest.status === "approved"
                ? "default"
                : dayOffRequest.status === "rejected"
                ? "destructive"
                : "outline"
            }
            className="text-xs"
          >
            {dayOffRequest.status === "pending"
              ? "در انتظار"
              : dayOffRequest.status === "approved"
              ? "تایید شده"
              : "رد شده"}
          </Badge>
        )}

        {holiday ? (
          <Badge
            variant="outline"
            className={cn(NON_WORKING_BADGE_CLASS, "whitespace-normal")}
            title={holiday.title?.trim() || "تعطیل رسمی"}
          >
            {holiday.title?.trim() || "تعطیل رسمی"}
          </Badge>
        ) : (
          isWeekend && (
            <Badge variant="outline" className={NON_WORKING_BADGE_CLASS}>
              تعطیل هفتگی
            </Badge>
          )
        )}
      </div>
    );
  };

  if (isTooNarrow) {
    return (
      <div className="space-y-6">
        <Card className="flex items-center justify-center p-4">
          {/* The inner div must control the height. We use min-h-[400px] 
          or min-h-full to ensure it's tall enough to center the message, 
          without using h-screen which would overflow the Card.
        */}
          <div
            className="
            flex flex-col items-center justify-center 
            w-full 
            min-h-[400px] /* Ensure sufficient height for the message */ 
            text-center 
            bg-background/50 /* Optional: slightly different background for contrast */
            p-4 
            rounded-lg
          "
          >
            <RotateCcw className="w-12 h-12 text-blue-500 mb-4" />
            <h2 className="text-xl font-bold mb-2 persian-body">
              لطفاً دستگاه خود را بچرخانید
            </h2>
            <p className="text-gray-600 persian-body">
              برای نمایش صحیح تقویم و جدول زمانی، لطفاً گوشی خود را به حالت افقی
              بچرخانید.
            </p>

            {/* Optional: Show current width for debugging */}
            {/* <p className="mt-4 text-xs text-gray-400">عرض فعلی: {width}px</p> */}
          </div>
        </Card>
      </div>
    );
  }

  const daysInMonth = getDaysInJalaliMonth(selectedMonth.jy, selectedMonth.jm);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDayGregorian = jalaliToGregorian(
    selectedMonth.jy,
    selectedMonth.jm,
    1
  );
  const startDayOfWeek = firstDayGregorian.getDay(); // Sunday=0 ... Saturday=6
  const startIndex = startDayOfWeek === 6 ? 0 : startDayOfWeek + 1; // mapped to Persian week index

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {getJalaliMonthName(selectedMonth.jm)}{" "}
            {selectedMonth.jy.toLocaleString("fa-IR", { useGrouping: false })}
          </CardTitle>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>
              مجموع ساعات کاری:{" "}
              {convertToPersianDigits(formatDecimalHoursToTime(totalHours))}{" "}
              ساعت
            </span>
            {readOnly ? (
              <span className="text-muted-foreground">
                نمای فقط‌خواندنی — ثبت و ویرایش از بخش «ساعات کاری» پنل مدیریت
                انجام می‌شود
              </span>
            ) : (
              !isAdmin &&
              selectedMonth.jm == currentDate.jm && (
                <span className="text-amber-600">ویرایش فقط برای ماه جاری</span>
              )
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEK_DAY_LABELS.map((day) => (
              <div
                key={day.short}
                title={day.full}
                className={cn(
                  "py-2 text-center text-sm font-medium",
                  day.off && "font-semibold text-rose-600 dark:text-rose-400"
                )}
              >
                {day.short}
              </div>
            ))}
          </div>


          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startIndex }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-24 border border-border p-2 bg-background"
              />
            ))}
            {days.map((day) => renderCalendarDay(day))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(NON_WORKING_BADGE_CLASS, "mt-0")}
              >
                تعطیل هفتگی
              </Badge>
              پنجشنبه و جمعه
            </span>
            <span className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(NON_WORKING_BADGE_CLASS, "mt-0")}
              >
                عنوان تعطیلی
              </Badge>
              تعطیل رسمی
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-primary bg-primary/10" />
              امروز
            </span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
        <DialogContent className="overflow-y-scroll max-h-[calc(100vh-2rem)] sm:max-h-screen">
          <DialogHeader>
            <DialogTitle>ثبت ساعات کاری</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">زمان شروع</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endTime">زمان پایان</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-10">
              <Label className="font-semibold mb-2 flex justify-between items-center">
                بخش دوم کار (اختیاری)
                {(startTime2 || endTime2) && (
                  <Button
                    onClick={() => {
                      setStartTime2("");
                      setEndTime2("");
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
                    value={startTime2}
                    onChange={(e) => setStartTime2(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="endTime2">زمان پایان</Label>
                  <Input
                    id="endTime2"
                    type="time"
                    value={endTime2}
                    onChange={(e) => setEndTime2(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {startTime && endTime && (
              <div className="text-sm text-muted-foreground text-center">
                مجموع:{" "}
                {convertToPersianDigits(
                  calculateHoursTime(startTime, endTime, startTime2, endTime2)
                )}
              </div>
            )}
            <div>
              <Label htmlFor="description">توضیحات (اختیاری)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیحات کار انجام شده..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveTimeLog} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                ذخیره
              </Button>
              {currentLogId && (
                <Button
                  onClick={deleteTimeLog}
                  variant="destructive"
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  حذف
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDayOffDialogOpen} onOpenChange={setIsDayOffDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>درخواست مرخصی</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {dayOffRemaining === null
                ? "سهمیه باقی‌مانده: —"
                : `سهمیه باقی‌مانده (امسال): ${convertToPersianDigits(
                    String(dayOffRemaining)
                  )} از ۲۶`}
            </div>
            <div>
              <Label htmlFor="reason">دلیل مرخصی</Label>
              <Textarea
                id="reason"
                value={dayOffReason}
                onChange={(e) => setDayOffReason(e.target.value)}
                placeholder="دلیل درخواست مرخصی..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={requestDayOff}
                className="flex-1"
                disabled={dayOffRemaining !== null && dayOffRemaining <= 0}
              >
                <Coffee className="h-4 w-4 mr-2" />
                ثبت درخواست
              </Button>
              {currentDayOffId && (
                <Button
                  onClick={deleteDayOff}
                  variant="destructive"
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  حذف
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isHolidayDialogOpen} onOpenChange={setIsHolidayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ثبت تعطیلی رسمی</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="holiday-title">عنوان (اختیاری)</Label>
              <Input
                id="holiday-title"
                value={holidayTitle}
                onChange={(e) => setHolidayTitle(e.target.value)}
                placeholder="مثال: تعطیل رسمی"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveHoliday} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                ذخیره تعطیلی
              </Button>
              {currentHolidayId && (
                <Button
                  onClick={deleteHoliday}
                  variant="destructive"
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  حذف تعطیلی
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
