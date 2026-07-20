import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  Save,
  Send,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { convertToPersianDigits } from "@/lib/utils";

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

interface ContactRequestModalProps {
  submission: ContactSubmission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const ContactRequestModal = ({
  submission,
  open,
  onOpenChange,
  onUpdate,
}: ContactRequestModalProps) => {
  const { toast } = useToast();
  const [status, setStatus] = useState(submission?.status || "pending");
  const [adminNotes, setAdminNotes] = useState(submission?.admin_notes || "");
  const [saving, setSaving] = useState(false);
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [newResponse, setNewResponse] = useState("");
  const [sendingResponse, setSendingResponse] = useState(false);

  const isAuthenticatedUser = submission?.user_id !== null;

  // Fetch responses when submission changes
  useEffect(() => {
    if (submission && isAuthenticatedUser) {
      fetchResponses();
    } else {
      setResponses([]);
    }
  }, [submission, isAuthenticatedUser]);

  const fetchResponses = async () => {
    if (!submission) return;

    try {
      const data = await apiClient.getTicketResponses(submission.id);
      setResponses(data || []);
    } catch (error) {
      console.error("Error fetching responses:", error);
    }
  };

  const handleSave = async () => {
    if (!submission) return;

    setSaving(true);
    try {
      await apiClient.updateSubmission(submission.id, {
        status,
        admin_notes: adminNotes,
      });

      toast({
        title: "ذخیره شد",
        description: "تغییرات با موفقیت ذخیره شد.",
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "خطا",
        description: "خطا در ذخیره تغییرات",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendResponse = async () => {
    if (!submission || !newResponse.trim()) return;

    setSendingResponse(true);
    try {
      await apiClient.addTicketResponse(
        submission.id,
        newResponse.trim(),
        true
      );

      toast({
        title: "پاسخ ارسال شد",
        description: "پاسخ شما با موفقیت ارسال شد.",
      });

      setNewResponse("");
      fetchResponses();
    } catch (error: any) {
      toast({
        title: "خطا",
        description: "خطا در ارسال پاسخ",
        variant: "destructive",
      });
    } finally {
      setSendingResponse(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">در انتظار</Badge>;
      case "in_progress":
        return <Badge variant="outline">در حال بررسی</Badge>;
      case "resolved":
        return <Badge variant="default">حل شده</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!submission) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="persian-heading text-xl">
            جزئیات درخواست
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* User Type Indicator */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            {isAuthenticatedUser ? (
              <>
                <ShieldCheck className="w-5 h-5 text-green-500" />
                <div>
                  <p className="persian-body font-medium text-green-700">
                    کاربر عضو
                  </p>
                  <p className="persian-body text-sm text-muted-foreground">
                    امکان پاسخگویی موجود است
                  </p>
                </div>
              </>
            ) : (
              <>
                <UserX className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="persian-body font-medium text-orange-700">
                    کاربر مهمان
                  </p>
                  <p className="persian-body text-sm text-muted-foreground">
                    فقط مشاهده اطلاعات
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="persian-body text-sm text-muted-foreground">
                  نام
                </p>
                <p className="persian-body font-medium">{submission.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="persian-body text-sm text-muted-foreground">
                  ایمیل
                </p>
                <p className="persian-body font-medium ltr-content">
                  {submission.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="persian-body text-sm text-muted-foreground">
                  تلفن
                </p>
                <p className="persian-body font-medium ltr-content">
                  {convertToPersianDigits(submission.phone)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="persian-body text-sm text-muted-foreground">
                  تاریخ ارسال
                </p>
                <p className="persian-body font-medium">
                  {new Date(submission.created_at).toLocaleDateString("fa-IR")}
                </p>
              </div>
            </div>
          </div>

          {/* Subject */}
          <div>
            <p className="persian-body text-sm text-muted-foreground mb-2">
              موضوع
            </p>
            <p className="persian-body font-medium text-lg">
              {submission.subject}
            </p>
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              <p className="persian-body text-sm text-muted-foreground">
                پیام اصلی
              </p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <p className="persian-body whitespace-pre-wrap leading-relaxed">
                {submission.message}
              </p>
            </div>
          </div>

          {/* Responses Section - Only for authenticated users */}
          {isAuthenticatedUser && (
            <div>
              <h3 className="persian-heading text-lg font-semibold mb-4">
                گفتگو
              </h3>

              {/* Existing Responses */}
              {responses.length > 0 && (
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
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
                          {response.is_admin_response ? "پشتیبانی" : "کاربر"}
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
              )}

              {/* New Response Input */}
              <div className="space-y-3">
                <Label className="persian-body">پاسخ جدید</Label>
                <Textarea
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  placeholder="پاسخ خود را اینجا بنویسید..."
                  className="min-h-24"
                />
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
                      ارسال پاسخ
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Admin Controls */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="persian-heading text-lg font-semibold">
              مدیریت درخواست
            </h3>

            {/* Status */}
            <div className="space-y-2">
              <Label className="persian-body">وضعیت</Label>
              <div className="flex items-center gap-4">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">در انتظار</SelectItem>
                    <SelectItem value="in_progress">در حال بررسی</SelectItem>
                    <SelectItem value="resolved">حل شده</SelectItem>
                  </SelectContent>
                </Select>
                {getStatusBadge(status)}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                "در حال ذخیره..."
              ) : (
                <>
                  <Save className="w-4 h-4 ml-1" />
                  ذخیره تغییرات
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactRequestModal;
