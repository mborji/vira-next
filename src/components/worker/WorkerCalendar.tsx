import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Check,
  Clock,
  Coffee,
  Pencil,
  Save,
  Trash2,
  Plus,
} from "lucide-react";
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
// Presentation-only palette shared with the manager panel and the employee
// dashboard. Colour strings, nothing else — see `dashboardTheme.ts`.
import { DASH } from "@/components/dashboard/dashboardTheme";
import { useWindowSize } from "../windowWidth/useWindowSize";
import { RotateCcw } from "lucide-react";

const MOBILE_WIDTH_THRESHOLD = 600;

/**
 * The reference design's calendar palette, hex for hex.
 *
 * Only the values the reference uses and `DASH` does not already carry live
 * here; everything else comes from `DASH`. Applied as inline `style`, so the
 * Tailwind JIT can never purge it and — like the rest of this redesign — the
 * calendar is a fixed light theme with no dark-mode variants.
 */
/*
 * CONTRAST PASS (2026-08-18, follow-up): the reference's own hairlines read too
 * faint once the calendar sits on the page's grey canvas, so the LINES and the
 * day-tile ICONS were stepped up by one shade each — nothing else. Fills, text
 * colours, tile size, spacing, type and layout are untouched, and no border was
 * added anywhere it did not already exist. The reference's original values are
 * kept beside each one so the step is visible and reversible.
 */
const CAL = {
  /** Day-tile border. Reference `#D3DBDA` — one step darker for definition. */
  tileLine: "#C3CECC",
  /**
   * The two hairlines under the header and above the legend.
   * Reference `#E4EAE9`.
   */
  divider: "#D7DFDE",
  /** Today's tile fill, and the header icon chip. */
  tealTint: "#F0FDFA",
  /** Worked-hours pill. */
  hoursBg: "#F1F5F4",
  hoursFg: "#475569",
  /**
   * Every non-working marker: weekly day off, official holiday, rejected leave.
   * `offLine` was the reference's `#FBDDE2`; the fill and the text are unchanged.
   */
  offBg: "#FFF1F3",
  offLine: "#F5CBD4",
  offFg: "#BE123C",
  /** «در انتظار» leave. `pendingLine` was `#FBEDCB`. */
  pendingBg: "#FFFBEB",
  pendingLine: "#F3DFB4",
  pendingFg: "#B45309",
  /**
   * The day-tile action icons at rest. Reference `#CBD5E1`, which disappeared
   * against the white tile; `DASH.faint` is legible without pulling attention
   * away from the day number. Hover / disabled behaviour is unchanged.
   */
  action: "#94A3B8",
} as const;

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

  /**
   * One day tile.
   *
   * REDESIGN NOTE — look only. The data this reads (`getDayInfo`), the edit
   * permission (`canEditDate`), the weekend rule (`NON_WORKING_WEEKDAYS`) and
   * the three dialog openers are exactly what they were; only the markup and
   * the colours changed, to the reference design's 118px rounded tile.
   *
   * ORDER IS PRESERVED: the day number comes first (so it sits on the RIGHT
   * under the app's global `dir="rtl"`) and the action icons second, and the
   * markers stack ساعت کارکرد → وضعیت مرخصی → تعطیلی. The reference file lists
   * both the other way round — it is written back-to-front throughout, exactly
   * like the two dashboard references before it, and its order is ignored here.
   */
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
    // Official holidays and the weekly days off share the same red numeral.
    const isNonWorkingDay = isWeekend || Boolean(holiday);

    const dateStr = formatDateForDB(selectedMonth.jy, selectedMonth.jm, day);
    const isToday = dateStr === today;
    const canEdit = canEditDate(selectedMonth.jy, selectedMonth.jm, day);

    /** Reference rule: a non-working numeral is red even when it is today. */
    const numberColor = isNonWorkingDay
      ? CAL.offFg
      : isToday
      ? DASH.primaryDark
      : DASH.body;

    const actionButton =
      "h-7 w-7 shrink-0 rounded-lg p-0 hover:bg-[#F1F5F4] hover:text-[#0F766E] disabled:opacity-40";

    return (
      <div
        key={day}
        className="flex min-h-[96px] flex-col rounded-[14px] border p-2.5 transition-shadow sm:min-h-[118px] sm:px-[11px]"
        style={
          isToday
            ? {
                background: CAL.tealTint,
                borderColor: DASH.primary,
                borderWidth: 1.5,
                boxShadow: "0 0 0 3px rgba(13,148,136,.10)",
              }
            : { background: DASH.card, borderColor: CAL.tileLine }
        }
      >
        <div className="flex items-start justify-between gap-1">
          <span
            className="persian-heading text-[15px] font-bold leading-none"
            style={{ color: numberColor }}
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
          <div
            className={cn("flex items-center gap-0.5", readOnly && "hidden")}
            style={{ color: CAL.action }}
          >
            <Button
              size="sm"
              variant="ghost"
              className={actionButton}
              aria-label="ثبت ساعات کاری"
              title="ثبت ساعات کاری"
              onClick={() =>
                openLogDialog(selectedMonth.jy, selectedMonth.jm, day)
              }
              disabled={!canEdit}
            >
              <Clock className="h-[15px] w-[15px]" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={actionButton}
              aria-label="درخواست مرخصی"
              title="درخواست مرخصی"
              onClick={() =>
                openDayOffDialog(selectedMonth.jy, selectedMonth.jm, day)
              }
              disabled={!canEdit}
            >
              <Coffee className="h-[15px] w-[15px]" />
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                className={actionButton}
                aria-label="ثبت تعطیلی رسمی"
                title="ثبت تعطیلی رسمی"
                onClick={() =>
                  openHolidayDialog(selectedMonth.jy, selectedMonth.jm, day)
                }
              >
                <Plus className="h-[15px] w-[15px]" />
              </Button>
            )}
          </div>
        </div>

        {/* Markers, pushed to the bottom of the tile by `mt-auto`. */}
        <div className="mt-auto flex flex-col items-center gap-1.5 pt-2">
          {timeLog && (
            <span
              dir="ltr"
              className="persian-heading rounded-lg px-3 py-1 text-xs font-semibold [font-variant-numeric:tabular-nums]"
              style={{ background: CAL.hoursBg, color: CAL.hoursFg }}
            >
              {timeLog.hours_worked
                ? convertToPersianDigits(timeLog.hours_worked.substring(0, 5))
                : "۰۰:۰۰"}
            </span>
          )}

          {dayOffRequest &&
            (dayOffRequest.status === "approved" ? (
              <span
                className="persian-body inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-white"
                style={{
                  background: DASH.primaryDark,
                  boxShadow: "0 4px 10px rgba(15,118,110,.28)",
                }}
              >
                <Check className="h-[13px] w-[13px]" strokeWidth={2.4} />
                تایید شده
              </span>
            ) : (
              <span
                className="persian-body rounded-full border px-3.5 py-1 text-[11px] font-semibold"
                style={
                  dayOffRequest.status === "pending"
                    ? {
                        background: CAL.pendingBg,
                        borderColor: CAL.pendingLine,
                        color: CAL.pendingFg,
                      }
                    : {
                        background: CAL.offBg,
                        borderColor: CAL.offLine,
                        color: CAL.offFg,
                      }
                }
              >
                {dayOffRequest.status === "pending" ? "در انتظار" : "رد شده"}
              </span>
            ))}

          {holiday ? (
            <span
              className="persian-body w-full rounded-[9px] px-2.5 py-1.5 text-center text-[11px] font-semibold leading-[1.6]"
              style={{ background: CAL.offBg, color: CAL.offFg }}
              title={holiday.title?.trim() || "تعطیل رسمی"}
            >
              {holiday.title?.trim() || "تعطیل رسمی"}
            </span>
          ) : (
            isWeekend && (
              <span
                className="persian-body rounded-full border px-3.5 py-1 text-[11px] font-semibold"
                style={{
                  background: CAL.offBg,
                  borderColor: CAL.offLine,
                  color: CAL.offFg,
                }}
              >
                تعطیل هفتگی
              </span>
            )
          )}
        </div>
      </div>
    );
  };

  if (isTooNarrow) {
    return (
      <div className="space-y-6">
        <div
          className="rounded-[20px] border bg-white p-4"
          style={{
            borderColor: DASH.cardLine,
            boxShadow: "0 1px 2px rgba(15,23,42,.03)",
          }}
        >
          <div className="flex min-h-[400px] w-full flex-col items-center justify-center rounded-2xl p-4 text-center">
            <RotateCcw
              className="mb-4 h-12 w-12"
              style={{ color: DASH.primary }}
            />
            <h2
              className="persian-heading mb-2 text-xl font-extrabold"
              style={{ color: DASH.ink }}
            >
              لطفاً دستگاه خود را بچرخانید
            </h2>
            <p className="persian-body text-sm" style={{ color: DASH.subtle }}>
              برای نمایش صحیح تقویم و جدول زمانی، لطفاً گوشی خود را به حالت افقی
              بچرخانید.
            </p>
          </div>
        </div>
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
      {/*
        The calendar card of the reference design: white on the `#EAEEED`
        hairline, 20px radius, a hairline-separated header, the 7-column grid
        and a legend footer. Colours are inline hex (see `CAL` / `DASH`) for the
        same reason the rest of this redesign is — a fixed light theme that
        cannot be purged by the JIT.
      */}
      <div
        className="rounded-[20px] border bg-white px-4 pb-[26px] pt-[22px] sm:px-6"
        style={{
          borderColor: DASH.cardLine,
          boxShadow: "0 1px 2px rgba(15,23,42,.03)",
        }}
      >
        {/* Header: title block first (right in RTL), status pill second. */}
        <div
          className="flex flex-wrap items-start justify-between gap-4 border-b pb-[18px]"
          style={{ borderColor: CAL.divider }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: CAL.tealTint, color: DASH.primary }}
            >
              <Calendar className="h-[21px] w-[21px]" />
            </span>
            <div>
              <h2
                className="persian-heading m-0 text-xl font-extrabold"
                style={{ color: DASH.ink }}
              >
                {getJalaliMonthName(selectedMonth.jm)}{" "}
                {selectedMonth.jy.toLocaleString("fa-IR", {
                  useGrouping: false,
                })}
              </h2>
              <p
                className="persian-body m-0 mt-[3px] text-xs"
                style={{ color: DASH.subtle }}
              >
                مجموع ساعات کاری:{" "}
                <b
                  dir="ltr"
                  className="inline-block font-bold [font-variant-numeric:tabular-nums]"
                  style={{ color: DASH.primaryDark }}
                >
                  {convertToPersianDigits(formatDecimalHoursToTime(totalHours))}
                </b>{" "}
                ساعت
              </p>
            </div>
          </div>

          {/*
            The same two notices as before, under the same conditions — only
            their styling changed, to the reference's pill.
          */}
          <div className="flex flex-wrap items-center gap-2.5">
            {readOnly ? (
              <span
                className="persian-body inline-flex max-w-full items-center gap-1.5 rounded-full border px-[13px] py-[7px] text-xs font-semibold"
                style={{
                  background: CAL.hoursBg,
                  borderColor: DASH.line,
                  color: CAL.hoursFg,
                }}
              >
                نمای فقط‌خواندنی — ثبت و ویرایش از بخش «ساعات کاری» پنل مدیریت
                انجام می‌شود
              </span>
            ) : (
              !isAdmin &&
              selectedMonth.jm == currentDate.jm && (
                <span
                  className="persian-body inline-flex items-center gap-1.5 rounded-full border px-[13px] py-[7px] text-xs font-semibold"
                  style={{
                    background: "#FFF7ED",
                    borderColor: "#FBE7CB",
                    color: CAL.pendingFg,
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  ویرایش فقط برای ماه جاری
                </span>
              )
            )}
          </div>
        </div>

        {/* Weekday header — شنبه first, the project's own order. */}
        <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEK_DAY_LABELS.map((day) => (
            <div
              key={day.short}
              title={day.full}
              className="persian-body pb-1 text-center text-[13px] font-bold"
              /*
                The reference paints every weekday label the same grey. The two
                non-working columns keep a red label here on purpose — that is
                information the calendar already carried, and the brief was to
                restyle what is shown, not to drop it. The red is the
                reference's own `#BE123C`.
              */
              style={{ color: day.off ? CAL.offFg : DASH.subtle }}
            >
              {day.short}
            </div>
          ))}
        </div>

        <div className="mt-0.5 grid grid-cols-7 gap-1.5 sm:gap-2">
          {/* Leading blanks are transparent in the reference — no tile, no border. */}
          {Array.from({ length: startIndex }).map((_, i) => (
            <div
              key={`empty-${i}`}
              aria-hidden="true"
              className="min-h-[96px] sm:min-h-[118px]"
            />
          ))}
          {days.map((day) => renderCalendarDay(day))}
        </div>

        {/* Legend — the same three entries as before, as reference swatches. */}
        <div
          className="mt-[18px] flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4 text-xs"
          style={{ borderColor: CAL.divider, color: DASH.subtle }}
        >
          <span className="persian-body inline-flex items-center gap-[7px]">
            <i
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded border"
              style={{ background: CAL.offBg, borderColor: CAL.offLine }}
            />
            تعطیل هفتگی — پنجشنبه و جمعه
          </span>
          <span className="persian-body inline-flex items-center gap-[7px]">
            <i
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded"
              style={{ background: CAL.offBg, border: `1px solid ${CAL.offFg}` }}
            />
            تعطیل رسمی — عنوان تعطیلی
          </span>
          <span className="persian-body inline-flex items-center gap-[7px]">
            <i
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded"
              style={{
                background: CAL.tealTint,
                border: `1.5px solid ${DASH.primary}`,
              }}
            />
            امروز
          </span>
        </div>
      </div>

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
