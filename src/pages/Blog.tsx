import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, ChevronLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { SEOHead } from "@/components/seo/SEOHead";

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  created_at: string;
  featured_image_url?: string;
  author_id: string;
}

const Blog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const data = await apiClient.request("/blogs?published=true");
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast({
        variant: "destructive",
        title: "خطا",
        description: "خطا در بارگذاری مقالات",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-pulse">بارگذاری مقالات...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="مقالات فنی - ویراپ"
        description="مطالعه آخرین مقالات فنی و آموزشی در زمینه توسعه نرم‌افزار، هوش تجاری، تحلیل داده و فناوری‌های نوین از کارشناسان ویراپ"
        keywords="مقالات فنی، آموزش برنامه نویسی، هوش تجاری، تحلیل داده، DevOps، نوآوری تکنولوژی، بلاگ فنی"
        url="https://virap.ir/blog"
        image="https://virap.ir/AboutUsTeam.jpg"
      />
      <div className="min-h-screen relative">
        {/* Header */}
        <section className="py-20 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center fade-in-up">
              <h1 className="persian-heading text-4xl md:text-6xl font-bold text-foreground mb-6">
                مقالات و آموزش‌ها{" "}
              </h1>
              <p className="persian-body text-xl text-muted-foreground leading-relaxed">
                آخرین مطالب در زمینه توسعه نرم‌افزار، فناوری و نوآوری‌های دنیای
                تکنولوژی{" "}
              </p>
            </div>
          </div>
        </section>

        {posts.length === 0 ? (
          <section className="py-20 relative z-10">
            <p className="text-muted-foreground persian-body">
              هنوز مقاله‌ای منتشر نشده است.
            </p>
          </section>
        ) : (
          <section className="py-20 relative z-10">
            <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map((post) => (
                  <Link key={post.id} to={`/blog/${post.slug}`}>
                    <Card className="h-full hover:shadow-lg transition-all duration-300 group cursor-pointer">
                      {post.featured_image_url && (
                        <div className="aspect-video overflow-hidden rounded-t-lg">
                          <img
                            src={post.featured_image_url}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl persian-heading line-clamp-2 group-hover:text-primary transition-colors">
                          {post.title}
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground persian-body">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>{formatDate(post.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User size={14} />
                            <span>نویسنده</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground persian-body line-clamp-3 mb-4">
                          {post.excerpt}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="persian-body">
                            مقاله فنی
                          </Badge>
                          <div className="flex items-center gap-1 text-primary group-hover:gap-2 transition-all">
                            <span className="text-sm persian-body">
                              ادامه مطلب
                            </span>
                            <ChevronLeft size={14} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
};

export default Blog;
