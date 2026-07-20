import { useState, useEffect } from "react";
import {
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  FileText,
  Eye,
  Send,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/hooks/useAuthStore";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChangePassword } from "@/components/auth/ChangePassword";

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

interface TicketResponse {
  id: string;
  submission_id: string;
  message: string;
  is_admin_response: boolean;
  created_at: string;
  updated_at: string;
}

interface ClientDashboardProps {
  profile: Profile;
}

const ClientDashboard = ({ profile }: ClientDashboardProps) => {
  const { signOut, user } = useAuthStore();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] =
    useState<ContactSubmission | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [newResponse, setNewResponse] = useState("");
  const [sendingResponse, setSendingResponse] = useState(false);

  const fetchSubmissions = async () => {
    if (!user) return;

    try {
      const data = await apiClient.getUserSubmissions(user.id);
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

  useEffect(() => {
    fetchSubmissions();
  }, [user]);

  const fetchTicketResponses = async (submissionId: string) => {
    try {
      const data = await apiClient.getTicketResponses(submissionId);
      setResponses(data || []);
    } catch (error) {
      console.error("Error fetching responses:", error);
    }
  };

  const openTicketModal = (submission: ContactSubmission) => {
    setSelectedSubmission(submission);
    fetchTicketResponses(submission.id);
    setTicketModalOpen(true);
  };

  const handleSendResponse = async () => {
    if (!selectedSubmission || !newResponse.trim()) return;

    setSendingResponse(true);
    try {
      await apiClient.addTicketResponse(
        selectedSubmission.id,
        newResponse.trim(),
        false
      );

      toast({
        title: "پیام ارسال شد",
        description: "پیام شما با موفقیت ارسال شد.",
      });

      setNewResponse("");
      fetchTicketResponses(selectedSubmission.id);
    } catch (error: any) {
      toast({
        title: "خطا",
        description: "خطا در ارسال پیام",
        variant: "destructive",
      });
    } finally {
      setSendingResponse(false);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-orange-500" />;
      case "in_progress":
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case "resolved":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "closed":
        return <CheckCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <MessageSquare className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const stats = {
    total: submissions.length,
    pending: submissions.filter((s) => s.status === "pending").length,
    inProgress: submissions.filter((s) => s.status === "in_progress").length,
    resolved: submissions.filter((s) => s.status === "resolved").length,
    closed: submissions.filter((s) => s.status === "closed").length,
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
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="persian-heading text-3xl font-bold text-foreground mb-2">
            داشبورد شما
          </h1>
          <p className="persian-body text-muted-foreground">
            خوش آمدید {profile.full_name || "کاربر عزیز"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" asChild>
            <a href="/contact">
              <Plus className="w-4 h-4 ml-1" />
              درخواست جدید
            </a>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="submissions" className="space-y-4" dir="rtl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="submissions">درخواست‌های من</TabsTrigger>
          <TabsTrigger value="settings">تغییر رمز عبور</TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="space-y-6">
          {/* Stats Cards */}
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

          {/* Submissions List */}
          <Card>
            <div className="p-6">
              <h2 className="persian-heading text-xl font-semibold text-foreground mb-6">
                درخواست‌های شما
              </h2>

              {submissions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="persian-body text-muted-foreground mb-4">
                    شما هنوز درخواستی ارسال نکرده‌اید
                  </p>
                  <Button asChild>
                    <a href="/contact">
                      <Plus className="w-4 h-4 ml-1" />
                      ارسال اولین درخواست
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <Card
                      key={submission.id}
                      className="p-4 border-l-4 border-l-primary"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            {getStatusIcon(submission.status)}
                            <h3 className="persian-heading font-medium text-foreground">
                              {submission.subject}
                            </h3>
                            {getStatusBadge(submission.status)}
                          </div>

                          <p className="persian-body text-sm text-muted-foreground line-clamp-2 mb-3">
                            {submission.message}
                          </p>

                          {submission.admin_notes && (
                            <div className="bg-muted p-3 rounded-lg mb-3">
                              <p className="persian-body text-sm font-medium text-foreground mb-1">
                                پاسخ ادمین:
                              </p>
                              <p className="persian-body text-sm text-muted-foreground">
                                {submission.admin_notes}
                              </p>
                            </div>
                          )}

                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span className="persian-body">
                              ارسال شده:{" "}
                              {new Date(
                                submission.created_at
                              ).toLocaleDateString("fa-IR")}
                            </span>
                            {submission.updated_at !==
                              submission.created_at && (
                              <span className="persian-body">
                                آخرین بروزرسانی:{" "}
                                {new Date(
                                  submission.updated_at
                                ).toLocaleDateString("fa-IR")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openTicketModal(submission)}
                          >
                            <Eye className="w-4 h-4 ml-1" />
                            مشاهده
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <ChangePassword />
        </TabsContent>
      </Tabs>

      {/* Ticket Details Modal */}
      <Dialog open={ticketModalOpen} onOpenChange={setTicketModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="persian-heading text-xl">
              جزئیات تیکت
            </DialogTitle>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-6 pt-4">
              {/* Subject and Status */}
              <div className="flex items-center justify-between">
                <h3 className="persian-heading text-lg font-semibold">
                  {selectedSubmission.subject}
                </h3>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedSubmission.status)}
                </div>
              </div>

              {/* Original Message */}
              <div>
                <h4 className="persian-body font-medium mb-2">پیام اصلی:</h4>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="persian-body whitespace-pre-wrap">
                    {selectedSubmission.message}
                  </p>
                </div>
                <p className="persian-body text-xs text-muted-foreground mt-1">
                  {new Date(selectedSubmission.created_at).toLocaleDateString(
                    "fa-IR"
                  )}{" "}
                  -
                  {new Date(selectedSubmission.created_at).toLocaleTimeString(
                    "fa-IR"
                  )}
                </p>
              </div>

              {/* Admin Notes */}
              {selectedSubmission.admin_notes && (
                <div>
                  <h4 className="persian-body font-medium mb-2">
                    یادداشت پشتیبانی:
                  </h4>
                  <div className="bg-blue-50 p-4 rounded-lg border-r-4 border-blue-500">
                    <p className="persian-body whitespace-pre-wrap">
                      {selectedSubmission.admin_notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Conversation */}
              {responses.length > 0 && (
                <div>
                  <h4 className="persian-body font-medium mb-4">
                    گفتگو با پشتیبانی:
                  </h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {responses.map((response) => (
                      <div
                        key={response.id}
                        className={`p-3 rounded-lg ${
                          response.is_admin_response
                            ? "bg-blue-50 border-l-4 border-blue-500 mr-10"
                            : "bg-green-50 border-r-4 border-green-500 ml-10"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="persian-body text-xs font-medium text-muted-foreground">
                            {response.is_admin_response ? "پشتیبانی" : "شما"}
                          </span>
                          <span className="persian-body text-xs text-muted-foreground">
                            {new Date(response.created_at).toLocaleDateString(
                              "fa-IR"
                            )}{" "}
                            -
                            {new Date(response.created_at).toLocaleTimeString(
                              "fa-IR"
                            )}
                          </span>
                        </div>
                        <p className="persian-body text-sm whitespace-pre-wrap">
                          {response.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Response Section - Only if ticket is not closed */}
              {selectedSubmission.status !== "closed" && (
                <div>
                  <h4 className="persian-body font-medium mb-3">
                    ارسال پیام جدید:
                  </h4>
                  <div className="space-y-3">
                    <Textarea
                      value={newResponse}
                      onChange={(e) => setNewResponse(e.target.value)}
                      placeholder="پیام خود را اینجا بنویسید..."
                      className="min-h-24"
                    />
                    <div className="flex justify-between items-center">
                      <p className="persian-body text-xs text-muted-foreground">
                        پیام شما برای تیم پشتیبانی ارسال خواهد شد
                      </p>
                      <Button
                        onClick={handleSendResponse}
                        disabled={sendingResponse || !newResponse.trim()}
                        size="sm"
                      >
                        {sendingResponse ? (
                          "در حال ارسال..."
                        ) : (
                          <>
                            <Send className="w-4 h-4 ml-1" />
                            ارسال پیام
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {selectedSubmission.status === "closed" && (
                <div className="bg-gray-100 p-4 rounded-lg text-center">
                  <p className="persian-body text-muted-foreground">
                    این تیکت بسته شده است. برای مسائل جدید، لطفاً تیکت جدیدی
                    ایجاد کنید.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDashboard;
