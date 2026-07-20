import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, ArrowLeft, CircleCheckBig } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import { apiClient } from "@/lib/api";
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

const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchProjects();
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

  return (
    <>
      <SEOHead
        title="نمونه کارها - ویراپ"
        description="مشاهده پروژه‌های موفق ویراپ در زمینه توسعه نرم‌افزار، هوش تجاری و سیستم‌های مدیریت برای سازمان‌ها و شرکت‌های مختلف"
        keywords="نمونه کار، پروژه های انجام شده، میز خدمت، سامانه مدیریت، CMS، هوش تجاری، DevOps، امحاء اسناد"
        url="https://virap.ir/projects"
        image="https://virap.ir/135.png"
      />
      <div className="min-h-screen relative">
        {/* Hero Section */}
        <section className="py-20 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center fade-in-up">
              <h1 className="persian-heading text-4xl md:text-6xl font-bold text-foreground mb-6">
                نمونه کارها
              </h1>
              <p className="persian-body text-xl text-muted-foreground leading-relaxed">
                نگاهی به برخی از پروژه‌های موفق ما{" "}
              </p>
            </div>
          </div>
        </section>

        {/* Projects Grid */}
        <section className="py-20 relative z-10">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {projects.map((project, index) => (
                <Card key={project.id} className="portfolio-card group">
                  <div className="relative overflow-hidden">
                    <img
                      src={project.image}
                      alt={project.title}
                      className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>

                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <Badge
                        variant="secondary"
                        className="bg-primary/10 text-primary"
                      >
                        {project.category}
                      </Badge>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <CircleCheckBig className="w-4 h-4 ml-1" />
                      </div>
                    </div>

                    <h3 className="persian-heading text-xl font-semibold text-foreground mb-3">
                      {project.title}
                    </h3>

                    <p className="persian-body text-muted-foreground text-sm mb-4 leading-relaxed">
                      {getPlainTextFromHtml(project.description)}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <span className="persian-body text-sm font-medium text-foreground">
                          مشتری:{" "}
                        </span>
                        <span className="persian-body text-sm text-muted-foreground">
                          {project.client}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {project.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-muted rounded-md text-xs text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-primary via-primary-dark to-primary text-primary-foreground">
          <div className="absolute inset-0 "></div>

          <div className="container mx-auto px-4 text-center relative z-10">
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
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Projects;
