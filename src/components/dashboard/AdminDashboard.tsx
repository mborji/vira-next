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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/hooks/useAuthStore";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import ContactRequestModal from "./ContactRequestModal";
import { BlogManagement } from "./BlogManagement";
import { WorkerManagement } from "./WorkerManagement";
import ServiceManagement from "./ServiceManagement";
import ProjectManagement from "./ProjectManagement";
import { WorkerCalendar } from "@/components/worker/WorkerCalendar";
import {
  formatDateForDB,
  getDaysInJalaliMonth,
  getCurrentJalaliDate,
  getJalaliMonthName,
} from "@/utils/jalali";
import { ChangePassword } from "@/components/auth/ChangePassword";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { convertToPersianDigits, formatDecimalHoursToTime } from "@/lib/utils";
import { useWindowSize } from "../windowWidth/useWindowSize";

const MOBILE_WIDTH_THRESHOLD = 600;
const ACCEPTED_DAY_OFF_HOURS = 9;
const HOLIDAY_HOURS = 9;

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

  // Calendar state
  const [selectedMonth, setSelectedMonth] = useState(getCurrentJalaliDate());
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [dayOffRequests, setDayOffRequests] = useState<DayOffRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [totalHours, setTotalHours] = useState(0);

  const { width } = useWindowSize();
  const isTooNarrow = width !== undefined && width < MOBILE_WIDTH_THRESHOLD;

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const currentDate = getCurrentJalaliDate();

  const todayDateStr = formatDateForDB(
    currentDate.jy,
    currentDate.jm,
    currentDate.jd
  );

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

  const fetchTimeLogs = async () => {
    if (!user) return;

    const startDate = formatDateForDB(selectedMonth.jy, selectedMonth.jm, 1);
    const endDate = formatDateForDB(
      selectedMonth.jy,
      selectedMonth.jm,
      getDaysInJalaliMonth(selectedMonth.jy, selectedMonth.jm)
    );

    try {
      const data = await apiClient.getTimeLogs({
        startDate,
        endDate,
        workerId: user.id,
      });

      setTimeLogs(data || []);
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در دریافت ساعات کاری",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const workedHoursTotal = timeLogs.reduce((sum, log) => {
      const d = log.hours_worked_str || "0:00";
      const [hours, minutes] = (d || "0:00").split(":").map(Number);
      return sum + hours + (minutes || 0) / 60;
    }, 0);
    const approvedDayOffHours =
      dayOffRequests.filter((request) => request.status === "approved").length *
      ACCEPTED_DAY_OFF_HOURS;
    const holidayHours =
      user?.worker_type === "part_time" ? 0 : holidays.length * HOLIDAY_HOURS;
    setTotalHours(workedHoursTotal + approvedDayOffHours + holidayHours);
  }, [timeLogs, dayOffRequests, holidays, user?.worker_type]);

  const fetchDayOffRequests = async () => {
    if (!user) return;

    const startDate = formatDateForDB(selectedMonth.jy, selectedMonth.jm, 1);
    const endDate = formatDateForDB(
      selectedMonth.jy,
      selectedMonth.jm,
      getDaysInJalaliMonth(selectedMonth.jy, selectedMonth.jm)
    );

    try {
      const data = await apiClient.getDayOffRequests({
        startDate,
        endDate,
        workerId: user.id,
      });

      const typedData = (data || []).map((request) => ({
        ...request,
        status: request.status as "pending" | "approved" | "rejected",
      }));
      setDayOffRequests(typedData);
    } catch (error) {
      // Handle error silently
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

  useEffect(() => {
    fetchSubmissions();
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    if (user) {
      fetchTimeLogs();
      fetchDayOffRequests();
      fetchHolidays();
    }
  }, [user, selectedMonth]);

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
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="persian-heading text-3xl font-bold text-foreground mb-2">
              پنل مدیریت
            </h1>
            <p className="persian-body text-muted-foreground">
              خوش آمدید {profile.full_name || "ادمین"}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="persian-body text-sm text-muted-foreground mb-1">
                  کل درخواست‌ها
                </p>
                <p className="persian-heading text-3xl font-bold text-foreground">
                  {stats.total.toLocaleString("fa-IR")}
                </p>
              </div>
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="persian-body text-sm text-muted-foreground mb-1">
                  تعداد کاربران
                </p>
                <p className="persian-heading text-3xl font-bold text-orange-500">
                  {totalUsers.toLocaleString("fa-IR")}
                </p>
              </div>
              <Users className="w-8 h-8 text-orange-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="persian-body text-sm text-muted-foreground mb-1">
                  مقالات منتشر شده
                </p>
                <p className="persian-heading text-3xl font-bold text-blue-500">
                  {publishedBlogsCount.toLocaleString("fa-IR")}
                </p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="persian-body text-sm text-muted-foreground mb-1">
                  خدمات ارائه شده
                </p>
                <p className="persian-heading text-3xl font-bold text-red-400">
                  {servicesCount.toLocaleString("fa-IR")}
                </p>
              </div>
              <Briefcase className="w-8 h-8 text-red-400" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="persian-body text-sm text-muted-foreground mb-1">
                  پروژه‌ها
                </p>
                <p className="persian-heading text-3xl font-bold text-indigo-400">
                  {projectsCount.toLocaleString("fa-IR")}
                </p>
              </div>
              <ClipboardCheck className="w-8 h-8 text-indigo-400" />
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="submissions" className="space-y-6" dir="rtl">
          <TabsList className="grid w-full grid-cols-4 h-20">
            <TabsTrigger value="submissions" className="persian-body">
              درخواست‌ها
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="persian-body"
              onClick={fetchClients}
            >
              کاربران
            </TabsTrigger>
            <TabsTrigger value="workers" className="persian-body">
              کارمندان
            </TabsTrigger>
            <TabsTrigger value="calendar" className="persian-body">
              تقویم من
            </TabsTrigger>
            <TabsTrigger value="blogs" className="persian-body">
              مقالات
            </TabsTrigger>
            <TabsTrigger value="services" className="persian-body">
              خدمات
            </TabsTrigger>
            <TabsTrigger value="projects" className="persian-body">
              پروژه‌ها
            </TabsTrigger>
            <TabsTrigger value="settings" className="persian-body">
              تغییر رمز عبور
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submissions">
            <div className="space-y-6">
              {/* Submission Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="persian-body text-sm text-muted-foreground mb-1">
                        کل درخواست‌ها
                      </p>
                      <p className="persian-heading text-3xl font-bold text-foreground">
                        {stats.total.toLocaleString("fa-IR")}
                      </p>
                    </div>
                    <MessageSquare className="w-8 h-8 text-primary" />
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="persian-body text-sm text-muted-foreground mb-1">
                        در انتظار
                      </p>
                      <p className="persian-heading text-3xl font-bold text-orange-500">
                        {stats.pending.toLocaleString("fa-IR")}
                      </p>
                    </div>
                    <Clock className="w-8 h-8 text-orange-500" />
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="persian-body text-sm text-muted-foreground mb-1">
                        در حال بررسی
                      </p>
                      <p className="persian-heading text-3xl font-bold text-blue-500">
                        {stats.inProgress.toLocaleString("fa-IR")}
                      </p>
                    </div>
                    <AlertCircle className="w-8 h-8 text-blue-500" />
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="persian-body text-sm text-muted-foreground mb-1">
                        حل شده
                      </p>
                      <p className="persian-heading text-3xl font-bold text-green-500">
                        {stats.resolved.toLocaleString("fa-IR")}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </Card>
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="persian-body text-sm text-muted-foreground mb-1">
                        کل کاربران
                      </p>
                      <p className="persian-heading text-3xl font-bold text-foreground">
                        {clientStats.total.toLocaleString("fa-IR")}
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="persian-body text-sm text-muted-foreground mb-1">
                        مدیران
                      </p>
                      <p className="persian-heading text-3xl font-bold text-red-500">
                        {clientStats.admins.toLocaleString("fa-IR")}
                      </p>
                    </div>
                    <Shield className="w-8 h-8 text-red-500" />
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="persian-body text-sm text-muted-foreground mb-1">
                        کاربران عادی
                      </p>
                      <p className="persian-heading text-3xl font-bold text-green-500">
                        {clientStats.clients.toLocaleString("fa-IR")}
                      </p>
                    </div>
                    <UserCheck className="w-8 h-8 text-green-500" />
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="persian-body text-sm text-muted-foreground mb-1">
                        کاربران فعال
                      </p>
                      <p className="persian-heading text-3xl font-bold text-emerald-500">
                        {clientStats.active.toLocaleString("fa-IR")}
                      </p>
                    </div>
                    <UserCheck className="w-8 h-8 text-emerald-500" />
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="persian-body text-sm text-muted-foreground mb-1">
                        فعالیت هفته اخیر
                      </p>
                      <p className="persian-heading text-3xl font-bold text-blue-500">
                        {clientStats.recent.toLocaleString("fa-IR")}
                      </p>
                    </div>
                    <Calendar className="w-8 h-8 text-blue-500" />
                  </div>
                </Card>
              </div>

              {/* Users Table */}
              <Card>
                <div className="p-6">
                  <h2 className="persian-heading text-xl font-semibold text-foreground mb-6">
                    لیست کاربران سیستم
                  </h2>

                  {clientsLoading ? (
                    <div className="text-center py-12">
                      <p className="persian-body text-muted-foreground">
                        در حال بارگذاری...
                      </p>
                    </div>
                  ) : clients.length === 0 ? (
                    <div className="text-center py-12">
                      <UserX className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="persian-body text-muted-foreground">
                        هنوز کاربری ثبت نام نکرده است
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="persian-body">نام</TableHead>
                            <TableHead className="persian-body">
                              ایمیل
                            </TableHead>
                            <TableHead className="persian-body">نقش</TableHead>
                            <TableHead className="persian-body">
                              وضعیت
                            </TableHead>
                            <TableHead className="persian-body">
                              تعداد درخواست
                            </TableHead>
                            <TableHead className="persian-body">
                              آخرین فعالیت
                            </TableHead>
                            <TableHead className="persian-body">
                              تاریخ عضویت
                            </TableHead>
                            <TableHead className="persian-body">
                              عملیات
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clients.map((client) => (
                            <TableRow key={client.id}>
                              <TableCell className="persian-body font-medium">
                                {client.full_name || "بدون نام"}
                              </TableCell>
                              <TableCell className="persian-body">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-muted-foreground" />
                                  <span className="ltr-content text-sm">
                                    {client.email || "بدون ایمیل"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>{getRoleBadge(client.role)}</TableCell>
                              <TableCell className="persian-body">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={client.is_active}
                                    onCheckedChange={(checked) =>
                                      updateUserStatus(client, checked)
                                    }
                                    aria-label={
                                      client.is_active
                                        ? "غیرفعال کردن کاربر"
                                        : "فعال کردن کاربر"
                                    }
                                  />
                                  <span
                                    className={
                                      client.is_active
                                        ? "text-green-600"
                                        : "text-orange-600"
                                    }
                                  >
                                    {client.is_active ? "فعال" : "غیرفعال"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="persian-body">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                  {client.submission_count.toLocaleString(
                                    "fa-IR"
                                  ) || "۰"}
                                </div>
                              </TableCell>
                              <TableCell className="persian-body text-sm text-muted-foreground">
                                {client.last_submission
                                  ? new Date(
                                      client.last_submission
                                    ).toLocaleDateString("fa-IR")
                                  : "هرگز"}
                              </TableCell>
                              <TableCell className="persian-body text-sm text-muted-foreground">
                                {new Date(client.created_at).toLocaleDateString(
                                  "fa-IR"
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openClientModal(client)}
                                >
                                  <Eye className="w-4 h-4 ml-1" />
                                  مشاهده
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="workers">
            <WorkerManagement />
          </TabsContent>

          <TabsContent value="calendar">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    ساعات امروز
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {convertToPersianDigits(
                      formatDecimalHoursToTime(hoursToday)
                    )}{" "}
                    ساعت
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {hoursToday > 0
                      ? "ثبت شده برای امروز"
                      : "برای امروز ثبت نشده"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    مجموع این ماه
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {convertToPersianDigits(
                      formatDecimalHoursToTime(totalHours)
                    )}{" "}
                    ساعت
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ساعات کاری ماه جاری
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    روزهای کاری
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {daysWorked.toLocaleString("fa-IR")} روز
                  </div>
                  <p className="text-xs text-muted-foreground">از ابتدای ماه</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    درخواست مرخصی
                  </CardTitle>
                  <Coffee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {pendingRequests.toLocaleString("fa-IR")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    در انتظار بررسی
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-end my-2">
              <div className="flex items-center gap-4">
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
                    {selectedMonth.jy.toLocaleString("fa-IR", {
                      useGrouping: false,
                    })}
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

            <WorkerCalendar
              today={formatDateForDB(
                getCurrentJalaliDate().jy,
                getCurrentJalaliDate().jm,
                getCurrentJalaliDate().jd
              )}
              currentDate={getCurrentJalaliDate()}
              selectedMonth={selectedMonth}
              totalHours={totalHours}
              timeLogs={timeLogs}
              dayOffRequests={dayOffRequests}
              holidays={holidays}
              isAdmin={true}
              selectedWorkerId={user?.id || ""}
              onDataChange={() => {
                fetchTimeLogs();
                fetchDayOffRequests();
                fetchHolidays();
              }}
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
