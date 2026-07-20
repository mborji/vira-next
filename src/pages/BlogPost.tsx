import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, ArrowLeft, Share2, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { getPlainTextFromHtml, normalizeRichTextValue } from "@/lib/richText";
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { SEOHead, createArticleSchema } from "@/components/seo/SEOHead";

interface BlogPost {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  created_at: string;
  updated_at: string;
  featured_image_url?: string;
  author_id: string;
}

interface RelatedBlog {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  created_at: string;
  featured_image_url?: string;
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedBlogs, setRelatedBlogs] = useState<RelatedBlog[]>([]);

  useEffect(() => {
    if (slug) {
      fetchPost();
      fetchRelatedBlogs();
    }
  }, [slug]);

  const fetchPost = async () => {
    try {
      const data = await apiClient.getBlogBySlug(slug!);
      setPost(data);
    } catch (error) {
      console.error("Error fetching post:", error);
      toast({
        variant: "destructive",
        title: "خطا",
        description: "مقاله یافت نشد",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedBlogs = async () => {
    try {
      const data = await apiClient.request('/blogs?published=true&limit=6');
      const filteredData = data.filter((blog: any) => blog.slug !== slug);
      setRelatedBlogs(filteredData || []);
    } catch (error) {
      console.error("Error fetching related blogs:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: post?.title,
        text: post?.excerpt,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "لینک کپی شد",
        description: "لینک مقاله در کلیپ‌بورد کپی شد",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-pulse">بارگذاری مقاله...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4 persian-heading">
            مقاله یافت نشد
          </h1>
          <p className="text-muted-foreground mb-8 persian-body">
            متأسفانه مقاله مورد نظر شما یافت نشد.
          </p>
          <Link to="/blog">
            <Button variant="outline" className="persian-body">
              <ArrowRight className="w-4 h-4 ml-2" />
              بازگشت به مقالات
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const normalizedContent = normalizeRichTextValue(post.content);
  const plainContent = getPlainTextFromHtml(normalizedContent);

  return (
    <>
      {post && (
        <SEOHead
          title={post.title}
          description={post.excerpt || plainContent.substring(0, 160)}
          keywords={`${post.title}, مقاله فنی, ویراپ, توسعه نرم افزار, هوش تجاری`}
          url={`https://virap.ir/blog/${post.slug}`}
          image={post.featured_image_url || "https://virap.ir/AboutUsTeam.jpg"}
          type="article"
          publishedTime={post.created_at}
          modifiedTime={post.updated_at}
          author="ویراپ"
          section="فناوری"
          schema={createArticleSchema({
            title: post.title,
            description: post.excerpt || plainContent.substring(0, 160),
            content: post.content,
            author: "ویراپ",
            publishedTime: post.created_at,
            modifiedTime: post.updated_at,
            image: post.featured_image_url,
            url: `https://virap.ir/blog/${post.slug}`
          })}
        />
      )}
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 py-6">
          <Link to="/blog">
            <Button variant="ghost" size="sm" className="persian-body">
              <ArrowRight className="w-4 h-4 ml-2" />
              بازگشت به مقالات
            </Button>
          </Link>
        </div>
      </div>

      <article className="py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Featured Image */}
          {post.featured_image_url && (
            <div className="aspect-video mb-8 rounded-lg overflow-hidden">
              <img
                src={post.featured_image_url}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Article Header */}
          <header className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary" className="persian-body">
                مقاله فنی
              </Badge>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 persian-heading">
              {post.title}
            </h1>

            <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-6 text-muted-foreground persian-body">
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  <span>{formatDate(post.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User size={16} />
                  <span>نویسنده</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="persian-body"
              >
                <Share2 className="w-4 h-4 ml-2" />
                اشتراک‌گذاری
              </Button>
            </div>

            {post.excerpt && (
              <div className="bg-muted/50 rounded-lg p-6 mb-8">
                <p className="text-lg text-foreground/90 persian-body leading-relaxed">
                  {post.excerpt}
                </p>
              </div>
            )}
          </header>

          {/* Article Content */}
          <div className="prose prose-lg max-w-none persian-body text-justify">
            <div
              className="leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-r-2 [&_blockquote]:border-primary/30 [&_blockquote]:pr-4 [&_h1]:mb-6 [&_h1]:mt-12 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-foreground [&_h2]:mb-6 [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mb-4 [&_h3]:mt-10 [&_h3]:text-xl [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pr-6 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pr-6"
              dangerouslySetInnerHTML={{ __html: normalizedContent }}
            />
          </div>

          {/* Article Footer */}
          <footer className="mt-16 pt-8 border-t">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground persian-body">
                آخرین بروزرسانی: {formatDate(post.updated_at)}
              </p>

              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="persian-body"
              >
                <Share2 className="w-4 h-4 ml-2" />
                اشتراک‌گذاری
              </Button>
            </div>
          </footer>
        </div>
      </article>

      {/* Related Blogs Section */}
      {relatedBlogs.length > 0 && (
        <section className="py-16 bg-gradient-to-b from-muted/10 to-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="persian-heading text-2xl md:text-4xl font-bold text-foreground mb-4">
                مقالات مرتبط
              </h2>
              <p className="persian-body text-muted-foreground">
                سایر مطالب جذاب و آموزشی ما
              </p>
            </div>

            <div className="relative max-w-6xl mx-auto">
              <Carousel
                opts={{
                  align: "start",
                  loop: true,
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-2 md:-ml-4">
                  {relatedBlogs.map((blog) => (
                    <CarouselItem key={blog.id} className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3">
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
                          <div className="p-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <Calendar className="w-4 h-4" />
                              <span className="persian-body">
                                {formatDate(blog.created_at)}
                              </span>
                            </div>
                            <h3 className="persian-heading text-lg font-semibold text-foreground mb-2 line-clamp-2">
                              {blog.title}
                            </h3>
                            {blog.excerpt && (
                              <p className="persian-body text-muted-foreground text-sm leading-relaxed line-clamp-2">
                                {blog.excerpt}
                              </p>
                            )}
                          </div>
                        </Card>
                      </Link>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden md:flex -right-12 bg-card border-card-border text-foreground hover:bg-accent hover:text-accent-foreground" />
                <CarouselNext className="hidden md:flex -left-12 bg-card border-card-border text-foreground hover:bg-accent hover:text-accent-foreground" />
              </Carousel>
            </div>

            <div className="text-center mt-8">
              <Link to="/blog">
                <Button 
                  variant="outline" 
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
    </div>
    </>
  );
};

export default BlogPost;
