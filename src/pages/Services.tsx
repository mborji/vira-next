import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Code2,
  Database,
  Brain,
  Shield,
  Zap,
  ArrowLeft,
  Globe,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SEOHead, createServiceSchema } from "@/components/seo/SEOHead";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { iconMap } from "@/lib/utils";

interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
  features: string[];
}

const Services = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const data = await apiClient.getServices();
        setServices(data);
      } catch (error) {
        toast.error("Failed to load services");
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  const process = [
    {
      step: "۱",
      title: "مشاوره اولیه",
      description: "درک دقیق نیازها و اهداف پروژه",
    },
    {
      step: "۲",
      title: "طراحی راه‌حل",
      description: "ارائه بهترین راه‌حل متناسب با نیاز شما",
    },
    {
      step: "۳",
      title: "توسعه و پیاده‌سازی",
      description: "اجرای پروژه با بالاترین کیفیت",
    },
    {
      step: "۴",
      title: "آزمایش و تحویل",
      description: "آزمایش کامل و تحویل پروژه",
    },
    {
      step: "۵",
      title: "پشتیبانی مداوم",
      description: "حمایت و به‌روزرسانی مستمر",
    },
  ];

  return (
    <>
      <SEOHead
        title="خدمات ما - ویراپ"
        description="خدمات حرفه‌ای ویراپ شامل توسعه نرم‌افزار، هوش تجاری، تحلیل داده، هوش مصنوعی و مشاوره DevOps برای رشد کسب‌وکار شما"
        keywords="خدمات نرم افزاری، توسعه اپلیکیشن، هوش تجاری، BI، داشبورد، تحلیل داده، هوش مصنوعی، AI، DevOps، مشاوره IT"
        url="https://virap.ir/services"
        image="https://virap.ir/AboutUsTeam.jpg"
        schema={createServiceSchema()}
      />
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="py-20 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center fade-in-up">
              <h1 className="persian-heading text-4xl md:text-6xl font-bold text-foreground mb-6">
                خدمات حرفه‌ای ما
              </h1>
              <p className="persian-body text-xl text-muted-foreground leading-relaxed">
                با استفاده از جدیدترین تکنولوژی‌ها و روش‌های نوین، راه‌حل‌های
                منحصر به فرد برای کسب‌وکار شما ارائه می‌دهیم
              </p>
            </div>
          </div>
        </section>

        {/* Services Grid */}
        <section className="py-20">
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map((service, index) => {
                const IconComponent = iconMap[service.icon] || Code2;
                return (
                  <Card
                    key={service.id || index}
                    className="service-card h-full"
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-primary via-primary/100 to-primary/80 shadow-xl shadow-primary-500 rounded-xl flex items-center justify-center mb-6">
                      <IconComponent className="w-8 h-8 text-white" />
                    </div>

                    <h3 className="persian-heading text-2xl font-semibold text-foreground mb-4">
                      {service.title}
                    </h3>

                    <p className="persian-body text-muted-foreground mb-6 leading-relaxed">
                      {service.description}
                    </p>

                    <ul className="space-y-2 mb-6">
                      {service.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="persian-body text-sm text-muted-foreground flex items-center"
                        >
                          <div className="w-2 h-2 bg-primary rounded-full ml-3 flex-shrink-0"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-6 border-t border-border">
                      <Link to="/contact">
                        <Button className="w-full" variant="outline">
                          درخواست مشاوره
                        </Button>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className="py-20 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 fade-in-up">
              <h2 className="persian-heading text-3xl md:text-4xl font-bold text-foreground mb-6">
                فرآیند همکاری
              </h2>
              <p className="persian-body text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                مراحل ساده و شفاف برای شروع همکاری با ما
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
              {process.map((item, index) => (
                <div key={index} className="text-center fade-in-scale">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl">
                    {item.step}
                  </div>
                  <h3 className="persian-heading text-lg font-semibold text-foreground mb-3">
                    {item.title}
                  </h3>
                  <p className="persian-body text-muted-foreground text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-primary via-primary-dark to-primary text-primary-foreground">
          <div className="absolute inset-0 "></div>

          <div className="container mx-auto px-4 text-center">
            <div className="max-w-3xl mx-auto fade-in-up">
              <Zap className="h-16 w-16 text-accent mx-auto mb-6" />
              <h2 className="persian-heading text-white text-3xl md:text-5xl font-bold mb-6">
                آماده شروع پروژه بعدی هستید؟
              </h2>
              <p className="persian-body text-lg md:text-xl mb-8 text-primary-foreground/90 leading-relaxed">
                با تیم متخصص ما تماس بگیرید و پروژه‌تان را به بهترین شکل ممکن به
                واقعیت تبدیل کنید
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/contact">
                  <Button
                    size="lg"
                    className="bg-accent text-accent-foreground hover:bg-accent-light hover:scale-105 px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    درخواست مشاوره رایگان
                    <ArrowLeft className="mr-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/projects">
                  <Button
                    variant="default"
                    size="lg"
                    className="border text-lg px-8 py-3 bg-primary/100 text hover:bg-primary/50"
                  >
                    مشاهده نمونه کارها
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Services;
