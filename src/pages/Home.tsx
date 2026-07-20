import {
  ArrowLeft,
  ChevronDown,
  BarChart3,
  Code2,
  Database,
  Zap,
  Shield,
  Target,
  Brain,
  Calendar,
  CircleCheckBig,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { SEOHead, createServiceSchema } from "@/components/seo/SEOHead";
import { toast } from "sonner";
import { getPlainTextFromHtml } from "@/lib/richText";

interface Project {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  tags: string[];
  client: string;
  link: string;
}

const Home = () => {
  const [latestBlogs, setLatestBlogs] = useState<any[]>([]);

  useEffect(() => {
    fetchLatestBlogs();
    fetchProjects();
  }, []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLatestBlogs = async () => {
    try {
      const data = await apiClient.request("/blogs?published=true&limit=6");
      if (data) {
        setLatestBlogs(data);
      }
    } catch (error) {
      console.error("Error fetching latest blogs:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      const data = await apiClient.getProjects();
      setProjects(data);
    } catch (error) {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: BarChart3,
      title: "هوش تجاری",
      description:
        "تبدیل داده‌های خام به بینش‌های قابل اجرا برای تصمیم‌گیری بهتر و بهینه‌سازی عملکرد",
    },
    {
      icon: Brain,
      title: "راهکارهای هوش مصنوعی",
      description:
        "ارائه سیستم‌ها و ابزارهای مبتنی بر هوش مصنوعی برای بهبود فرآیندها، پیش‌بینی دقیق و تصمیم‌گیری هوشمند",
    },
    {
      icon: Code2,
      title: "توسعه نرم‌افزار",
      description:
        "طراحی و توسعه راه‌حل‌های نرم‌افزاری مدرن، امن و قابل اعتماد با جدیدترین تکنولوژی‌ها",
    },
    {
      icon: Database,
      title: "تحلیل داده",
      description:
        "استخراج الگوها و روندهای مهم از داده‌های پیچیده شما برای رشد کسب‌وکار",
    },
  ];

  const values = [
    {
      icon: Zap,
      title: "سرعت و کیفیت",
      description: "تحویل سریع پروژه‌ها با بالاترین کیفیت و استانداردهای روز",
    },
    {
      icon: Shield,
      title: "امنیت و قابلیت اعتماد",
      description: "حفاظت کامل از داده‌ها و اطلاعات با بالاترین سطح امنیت",
    },
    {
      icon: Target,
      title: "تمرکز بر نتیجه",
      description:
        "راه‌حل‌های هدفمند که مستقیماً به اهداف کسب‌وکار شما کمک می‌کند",
    },
  ];

  if (loading) {
    return <div className="flex justify-center p-8">در حال بارگذاری...</div>;
  }

  return (
    <>
      <SEOHead
        title="ویراپ - راهکارهای نرم‌افزاری پیشرفته"
        description="شرکت پیشرو در توسعه نرم‌افزار، هوش تجاری و تحلیل داده با تیمی از متخصصان مجرب برای تحویل بهترین راه‌حل‌های تکنولوژیکی"
        keywords="توسعه نرم افزار، هوش تجاری، تحلیل داده، هوش مصنوعی، DevOps، مشاوره IT، React، Power BI، داشبورد، ویراپ"
        url="https://virap.ir"
        image="https://virap.ir/AboutUsTeam.jpg"
        schema={createServiceSchema()}
      />
      <div>
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent via-primary/100 to-background/50"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-background/20 to-transparent"></div>
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="max-w-4xl mx-auto space-y-8 fade-in-up">
              <h1 className="persian-heading text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6">
                <p className="text-transparent bg-clip-text bg-accent block md:inline md:ml-4">
                  ویراپ
                </p>
                راهکارهای نرم‌افزاری پیشرفته
              </h1>

              <p className="persian-body text-lg md:text-xl text-muted-dark leading-relaxed max-w-3xl mx-auto">
                شرکت پیشرو در توسعه نرم‌افزار، هوش تجاری و تحلیل داده با تیمی از
                متخصصان مجرب برای تحویل بهترین راه‌حل‌های تکنولوژیکی
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
                <Link to="/contact">
                  <Button
                    size="lg"
                    className="btn-hero-primary text-lg px-8 py-4 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary"
                  >
                    شروع همکاری
                    <ArrowLeft className="w-5 h-5 mr-2" />
                  </Button>
                </Link>
                <Link to="/projects">
                  <Button
                    size="lg"
                    variant="outline"
                    style={{ backgroundColor: "hsl(var(--accent-light))" }}
                    className="btn-hero-secondary text-lg px-8 py-4 border-2 border-primary text-primary hover:bg-accent hover:text-secondary-foreground"
                  >
                    مشاهده نمونه کارها
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
            <ChevronDown className="w-8 h-8 text-muted-foreground" />
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-gradient-to-b from-background to-secondary/10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 fade-in-up">
              <h2 className="persian-heading text-3xl md:text-5xl font-bold text-foreground mb-6">
                خدمات حرفه‌ای ما
              </h2>
              <p className="persian-body text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                با استفاده از جدیدترین تکنولوژی‌ها و روش‌های نوآورانه،
                راه‌حل‌های منحصربه‌فرد ارائه می‌دهیم
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="service-card text-center p-8 bg-gradient-to-br from-card to-card/50 border-card-border hover:shadow-strong"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center mx-auto mb-6">
                    <feature.icon className="w-10 h-10 text-primary-foreground" />
                  </div>
                  <h3 className="persian-heading text-xl md:text-2xl font-semibold text-foreground mb-4">
                    {feature.title}
                  </h3>
                  <p className="persian-body text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-20 bg-gradient-to-br from-muted/20 to-accent/10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 fade-in-up">
              <h2 className="persian-heading text-3xl md:text-5xl font-bold text-foreground mb-6">
                چرا ویراپ؟
              </h2>
              <p className="persian-body text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                ارزش‌ها و اصولی که ما را در ارائه بهترین خدمات راهنمایی می‌کند
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {values.map((value, index) => (
                <div key={index} className="text-center fade-in-scale">
                  <div className="w-20 h-20 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
                    <value.icon className="w-10 h-10 text-accent" />
                  </div>
                  <h3 className="persian-heading text-xl md:text-2xl font-semibold text-foreground mb-4">
                    {value.title}
                  </h3>
                  <p className="persian-body text-muted-foreground leading-relaxed">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Latest Blogs Section */}
        {latestBlogs.length > 0 && (
          <section className="py-20 bg-gradient-to-br from-secondary/20 to-background">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16 fade-in-up">
                <h2 className="persian-heading text-3xl md:text-5xl font-bold text-foreground mb-6">
                  جدیدترین مقالات
                </h2>
                <p className="persian-body text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  آخرین مطالب و مقالات تخصصی ما در حوزه تکنولوژی و نرم‌افزار
                </p>
              </div>

              <div className="relative max-w-6xl mx-auto" dir="ltr">
                <Carousel
                  opts={{
                    align: "start",
                    loop: true,
                  }}
                  className="w-full"
                >
                  <CarouselContent className="-ml-2 md:-ml-4">
                    {latestBlogs.map((blog) => (
                      <CarouselItem
                        key={blog.id}
                        className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3"
                      >
                        <Link to={`/blog/${blog.slug}`}>
                          <Card className="service-card h-full overflow-hidden bg-gradient-to-br from-card to-card/50 border-card-border hover:shadow-strong transition-all duration-300">
                            {blog.featured_image_url && (
                              <div className="aspect-video overflow-hidden">
                                <img
                                  src={blog.featured_image_url}
                                  alt={blog.title}
                                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                />
                              </div>
                            )}
                            <div className="p-6">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                                <Calendar className="w-4 h-4" />
                                <span className="persian-body">
                                  {new Date(blog.created_at).toLocaleDateString(
                                    "fa-IR"
                                  )}
                                </span>
                              </div>
                              <h3
                                className="persian-heading text-lg font-semibold text-foreground mb-3 line-clamp-2"
                                style={{ textAlign: "right" }}
                              >
                                {blog.title}
                              </h3>
                              {blog.excerpt && (
                                <p
                                  className="persian-body text-muted-foreground text-sm leading-relaxed line-clamp-3"
                                  style={{ textAlign: "right" }}
                                >
                                  {blog.excerpt}
                                </p>
                              )}
                            </div>
                          </Card>
                        </Link>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="bg-card border-card-border text-foreground hover:bg-accent hover:text-accent-foreground" />
                  <CarouselNext className="bg-card border-card-border text-foreground hover:bg-accent hover:text-accent-foreground" />
                </Carousel>
              </div>

              <div className="text-center mt-12">
                <Link to="/blog">
                  <Button
                    variant="outline"
                    size="lg"
                    className="btn-hero-secondary border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    مشاهده همه مقالات
                    <ArrowLeft className="w-5 h-5 mr-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Featured Projects Section */}
        <section className="py-20 bg-gradient-to-br from-muted/10 to-accent/5">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 fade-in-up">
              <h2 className="persian-heading text-3xl md:text-5xl font-bold text-foreground mb-6">
                نمونه کارهای ما
              </h2>
              <p className="persian-body text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                نگاهی به برخی از پروژه‌های موفق و تجربه‌های ارزشمند ما
              </p>
            </div>

            <div className="relative max-w-6xl mx-auto" dir="ltr">
              <Carousel
                opts={{
                  align: "start",
                  loop: true,
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-2 md:-ml-4">
                  {projects.map((project) => (
                    <CarouselItem
                      key={project.id}
                      className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3"
                    >
                      <Card className="portfolio-card group h-full overflow-hidden bg-gradient-to-br from-card to-card/50 border-card-border hover:shadow-strong transition-all duration-300">
                        <div className="relative overflow-hidden">
                          <img
                            src={project.image}
                            alt={project.title}
                            className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="absolute bottom-4 right-4">
                              <Badge
                                variant="secondary"
                                className="bg-white/90 text-foreground"
                              >
                                <CircleCheckBig className="w-3 h-3 ml-1" />
                                تکمیل شده
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="p-6">
                          <div className="mb-3" style={{ textAlign: "right" }}>
                            <Badge
                              variant="secondary"
                              className="bg-primary/10 text-primary"
                            >
                              {project.category}
                            </Badge>
                          </div>

                          <h3
                            className="persian-heading text-lg md:text-xl font-semibold text-foreground mb-3 line-clamp-2"
                            style={{ textAlign: "right" }}
                          >
                            {project.title}
                          </h3>

                          <p
                            className="persian-body text-muted-foreground text-sm mb-4 leading-relaxed line-clamp-3"
                            style={{ textAlign: "right" }}
                          >
                            {getPlainTextFromHtml(project.description)}
                          </p>

                          <div className="space-y-3" dir="rtl">
                            <div style={{ textAlign: "right" }}>
                              <span className="persian-body text-sm font-medium text-foreground">
                                مشتری:{" "}
                              </span>
                              <span className="persian-body text-sm text-muted-foreground">
                                {project.client}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {project.tags.slice(0, 3).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-muted rounded-md text-xs text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                              {project.tags.length > 3 && (
                                <span className="px-2 py-1 bg-muted rounded-md text-xs text-muted-foreground">
                                  +
                                  {(project.tags.length - 3).toLocaleString(
                                    "fa-IR"
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="bg-card border-card-border text-foreground hover:bg-accent hover:text-accent-foreground" />
                <CarouselNext className="bg-card border-card-border text-foreground hover:bg-accent hover:text-accent-foreground" />
              </Carousel>
            </div>

            <div className="text-center mt-12">
              <Link to="/projects">
                <Button
                  variant="outline"
                  size="lg"
                  className="btn-hero-secondary border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  مشاهده همه پروژه‌ها
                  <ArrowLeft className="w-5 h-5 mr-2" />
                </Button>
              </Link>
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
              <Link to="/contact">
                <Button
                  size="lg"
                  className="bg-accent text-accent-foreground hover:bg-accent-light px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  تماس با ما
                  <ArrowLeft className="w-5 h-5 mr-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Home;
