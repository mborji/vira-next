import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  User,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/hooks/useAuthStore";
import { apiClient } from "@/lib/api";
import { SEOHead } from "@/components/seo/SEOHead";

const contactSchema = z.object({
  name: z.string().min(2, "نام باید حداقل ۲ کاراکتر باشد"),
  email: z.string().email("ایمیل معتبر وارد کنید"),
  phone: z.string().min(10, "شماره تلفن معتبر وارد کنید"),
  subject: z.string().min(1, "لطفاً موضوع را انتخاب کنید"),
  message: z.string().min(10, "پیام باید حداقل ۱۰ کاراکتر باشد"),
});

type ContactForm = z.infer<typeof contactSchema>;

const Contact = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuthStore();

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    },
  });

  // Auto-fill form for authenticated users
  useEffect(() => {
    if (user) {
      // Pre-fill form fields
      if (user.full_name) {
        form.setValue("name", user.full_name);
      }
      if (user.email) {
        form.setValue("email", user.email);
      }
    }
  }, [user, form]);

  const handleSubmit = async (data: ContactForm) => {
    setLoading(true);
    try {
      // Prepare submission data
      const submissionData = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        subject: data.subject,
        message: data.message,
        user_id: user?.id || null,
      };

      // Save to database
      await apiClient.submitContact(submissionData);

      toast({
        title: "پیام شما ارسال شد",
        description: user
          ? "درخواست شما ثبت شد و می‌توانید وضعیت آن را در داشبورد خود مشاهده کنید."
          : "تشکر از تماس شما. در اسرع وقت پاسخ خواهیم داد.",
      });

      form.reset();

      // Redirect to dashboard if user is logged in
      if (user) {
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 2000);
      }
    } catch (error: any) {
      toast({
        title: "خطا در ارسال پیام",
        description: error.message || "مشکلی پیش آمد. لطفاً دوباره تلاش کنید.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const contactInfo = [
    {
      icon: Phone,
      title: "تلفن تماس",
      value: "۰۲۱-۸۶۰۹۶۳۶۸",
      description: "شنبه تا چهارشنبه، ۹ تا ۱۸",
    },
    {
      icon: Mail,
      title: "ایمیل",
      value: "info@viraap.co",
      description: "پاسخ در کمتر از ۲۴ ساعت",
    },
    {
      icon: MapPin,
      title: "آدرس دفتر",
      value: "تهران، کارگر شمالی، خیابان نهم",
      description: "پلاک ۸۲، واحد ۱",
    },
    {
      icon: Clock,
      title: "ساعات کاری",
      value: "شنبه تا چهارشنبه",
      description: "۹:۰۰ تا ۱۸:۰۰",
    },
  ];

  const services = [
    "توسعه نرم‌افزار",
    "هوش تجاری",
    "تحلیل داده",
    "برنامه های غیرمتمرکز",
    "امنیت سایبری",
    "هوش مصنوعی",
    "مشاوره فناوری",
  ];

  return (
    <>
      <SEOHead
        title="تماس با ما - ویراپ"
        description="با تیم متخصص ویراپ در ارتباط باشید. درخواست مشاوره رایگان، سوالات فنی و همکاری در پروژه‌های نرم‌افزاری"
        keywords="تماس با ویراپ، مشاوره رایگان، درخواست پروژه، پشتیبانی فنی، همکاری، آدرس، تلفن"
        url="https://virap.ir/contact"
        image="https://virap.ir/AboutUsTeam.jpg"
      />
      <div className="bg-background">
        {/* Hero Section */}
        <section className="py-20 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center fade-in-up">
              <h1 className="persian-heading text-4xl md:text-6xl font-bold text-foreground mb-6">
                تماس با ما
              </h1>
              <p className="persian-body text-xl text-muted-foreground leading-relaxed">
                آماده پاسخگویی به سوالات شما و ارائه بهترین راه‌حل‌ها هستیم
              </p>
            </div>
          </div>
        </section>

        {/* Contact Info Cards */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
              {contactInfo.map((info, index) => (
                <Card
                  key={index}
                  className="p-6 text-center hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center mx-auto mb-4">
                    <info.icon className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="persian-heading text-lg font-semibold text-foreground mb-2 text-center">
                    {info.title}
                  </h3>
                  <p className="persian-body font-medium text-primary mb-1 text-center">
                    {info.value}
                  </p>
                  <p className="persian-body text-sm text-muted-foreground text-center">
                    {info.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Form & Map */}
        <section className="pb-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Contact Form */}
              <div className="fade-in-up">
                <Card className="p-8">
                  <div className="mb-8">
                    <h2 className="persian-heading text-3xl font-bold text-foreground mb-4">
                      فرم تماس
                    </h2>
                    <p className="persian-body text-muted-foreground leading-relaxed">
                      پیام خود را برای ما ارسال کنید تا در اسرع وقت با شما تماس
                      بگیریم
                    </p>
                  </div>

                  <form
                    onSubmit={form.handleSubmit(handleSubmit)}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="persian-body">
                          نام و نام خانوادگی
                        </Label>
                        <div className="relative">
                          <User className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="name"
                            {...form.register("name")}
                            className="pr-10"
                            placeholder="نام خود را وارد کنید"
                          />
                        </div>
                        {form.formState.errors.name && (
                          <p className="text-sm text-destructive persian-body">
                            {form.formState.errors.name.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="persian-body">
                          شماره تماس
                        </Label>
                        <div className="relative">
                          <Phone className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="phone"
                            {...form.register("phone")}
                            className="pr-10 ltr-content"
                            placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                          />
                        </div>
                        {form.formState.errors.phone && (
                          <p className="text-sm text-destructive persian-body">
                            {form.formState.errors.phone.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="persian-body">
                        ایمیل
                      </Label>
                      <div className="relative">
                        <Mail className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          {...form.register("email")}
                          className="pr-10 ltr-content"
                          placeholder="example@email.com"
                        />
                      </div>
                      {form.formState.errors.email && (
                        <p className="text-sm text-destructive persian-body">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject" className="persian-body">
                        موضوع
                      </Label>
                      <select
                        id="subject"
                        {...form.register("subject")}
                        className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground persian-body"
                      >
                        <option value="">انتخاب کنید...</option>
                        {services.map((service, index) => (
                          <option key={index} value={service}>
                            {service}
                          </option>
                        ))}
                        <option value="other">سایر موارد</option>
                      </select>
                      {form.formState.errors.subject && (
                        <p className="text-sm text-destructive persian-body">
                          {form.formState.errors.subject.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message" className="persian-body">
                        پیام شما
                      </Label>
                      <div className="relative">
                        <MessageSquare className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Textarea
                          id="message"
                          {...form.register("message")}
                          className="pr-10 min-h-32"
                          placeholder="پیام خود را اینجا بنویسید..."
                        />
                      </div>
                      {form.formState.errors.message && (
                        <p className="text-sm text-destructive persian-body">
                          {form.formState.errors.message.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full px-8 py-4 rounded-lg font-medium text-primary-foreground bg-accent accent-gradient shadow-lg hover:shadow-xl hover:bg-accent hover:scale-105 active:scale-95 transition-all duration-300"
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      ) : (
                        <Send className="w-5 h-5 ml-2" />
                      )}
                      ارسال پیام
                    </Button>
                  </form>
                </Card>
              </div>

              {/* Map & Additional Info */}
              <div className="space-y-8 fade-in-scale">
                {/* Map */}
                <Card className="overflow-hidden">
                  <div className="h-64 bg-muted flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <iframe
                        src="https://www.google.com/maps/embed?pb=!1m21!1m12!1m3!1d1619.5151808640526!2d51.39059857535066!3d35.72547181442255!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m6!3e6!4m0!4m3!3m2!1d35.72550447664093!2d51.39124230548214!5e0!3m2!1sen!2sfr!4v1755330176702!5m2!1sen!2sfr"
                        width="600"
                        height="450"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      ></iframe>
                    </div>
                  </div>
                </Card>

                {/* FAQ */}
                <Card className="p-6">
                  <h3 className="persian-heading text-xl font-semibold text-foreground mb-6">
                    سوالات متداول
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="persian-body font-medium text-foreground mb-2">
                        زمان پاسخگویی چقدر است؟
                      </h4>
                      <p className="persian-body text-sm text-muted-foreground">
                        معمولاً در کمتر از ۲۴ ساعت پاسخ داده می‌شود.
                      </p>
                    </div>
                    <div>
                      <h4 className="persian-body font-medium text-foreground mb-2">
                        آیا مشاوره اولیه رایگان است؟
                      </h4>
                      <p className="persian-body text-sm text-muted-foreground">
                        بله، جلسه مشاوره اولیه کاملاً رایگان است.
                      </p>
                    </div>
                    <div>
                      <h4 className="persian-body font-medium text-foreground mb-2">
                        چگونه می‌توانم پروژه‌ام را شروع کنم؟
                      </h4>
                      <p className="persian-body text-sm text-muted-foreground">
                        فقط کافی است فرم را پر کنید یا با ما تماس بگیرید.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Contact;
