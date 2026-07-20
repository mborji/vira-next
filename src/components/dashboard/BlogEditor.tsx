import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Eye, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/hooks/useAuthStore";
import { toast } from "@/hooks/use-toast";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { getPlainTextFromHtml, sanitizeRichText } from "@/lib/richText";

interface BlogPost {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  published: boolean;
  featured_image_url?: string;
}

interface BlogEditorProps {
  post: BlogPost | null;
  onClose: (shouldRefresh?: boolean) => void;
}

export const BlogEditor = ({ post, onClose }: BlogEditorProps) => {
  const { user } = useAuthStore();
  const [loading, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    excerpt: "",
    slug: "",
    published: false,
    featured_image_url: "",
  });

  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        slug: post.slug,
        published: post.published,
        featured_image_url: post.featured_image_url || "",
      });
      setImagePreview(post.featured_image_url || "");
      setImageFile(null);
      return;
    }

    setFormData({
      title: "",
      content: "",
      excerpt: "",
      slug: "",
      published: false,
      featured_image_url: "",
    });
    setImagePreview("");
    setImageFile(null);
  }, [post]);

  const generateSlug = (title: string) => {
    const persianToEnglish: { [key: string]: string } = {
      ا: "a",
      ب: "b",
      پ: "p",
      ت: "t",
      ث: "s",
      ج: "j",
      چ: "ch",
      ح: "h",
      خ: "kh",
      د: "d",
      ذ: "z",
      ر: "r",
      ز: "z",
      ژ: "zh",
      س: "s",
      ش: "sh",
      ص: "s",
      ض: "d",
      ط: "t",
      ظ: "z",
      ع: "a",
      غ: "gh",
      ف: "f",
      ق: "q",
      ک: "k",
      گ: "g",
      ل: "l",
      م: "m",
      ن: "n",
      و: "v",
      ه: "h",
      ی: "y",
      " ": "-",
      "‌": "-",
    };

    return title
      .split("")
      .map((char) => persianToEnglish[char] || char)
      .join("")
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, "")
      .replace(/\-+/g, "-")
      .replace(/^\-|\-$/g, "");
  };

  const handleTitleChange = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      title,
      slug: post ? prev.slug : generateSlug(title),
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadBanner = async () => {
    if (!imageFile) {
      return formData.featured_image_url;
    }

    return apiClient.uploadBlogImage(imageFile);
  };

  const handleSave = async (publish: boolean = false) => {
    if (!user) return;

    const content = sanitizeRichText(formData.content);

    if (!formData.title.trim() || !getPlainTextFromHtml(content)) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: "عنوان و محتوای مقاله الزامی است",
      });
      return;
    }

    setSaving(true);

    try {
      let featuredImageUrl = formData.featured_image_url;
      if (imageFile) {
        featuredImageUrl = await uploadBanner();
      } else if (featuredImageUrl.startsWith("data:")) {
        toast({
          variant: "destructive",
          title: "خطا",
          description: "لطفاً بنر مقاله را دوباره انتخاب کنید",
        });
        return;
      }

      const postData = {
        ...formData,
        content,
        published: publish,
        author_id: user.id,
        featured_image_url: featuredImageUrl,
      };

      if (post) {
        // Update existing post
        await apiClient.updateBlog(post.id, postData);
      } else {
        // Create new post
        await apiClient.createBlog(postData);
      }

      toast({
        title: "موفق",
        description: post
          ? publish
            ? "مقاله ذخیره و منتشر شد"
            : "مقاله ذخیره شد"
          : publish
          ? "مقاله ایجاد و منتشر شد"
          : "مقاله ایجاد شد",
      });

      onClose(true);
    } catch (error) {
      console.error("Error saving post:", error);
      toast({
        variant: "destructive",
        title: "خطا",
        description: "خطا در ذخیره مقاله",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClose()}
            className="persian-body"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            بازگشت
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground persian-heading">
              {post ? "ویرایش مقاله" : "مقاله جدید"}
            </h2>
          </div>
        </div>
        <div className="flex flex-row items-center gap-2 mt-4 sm:mt-0 justify-end w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={loading}
            className="persian-body"
          >
            <Save className="w-4 h-4 ml-2" />
            ذخیره پیش‌نویس
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={loading}
            className="persian-body"
          >
            <Eye className="w-4 h-4 ml-2" />
            ذخیره و انتشار
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="persian-heading">محتوای مقاله</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title" className="persian-body">
                  عنوان
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="عنوان مقاله را وارد کنید"
                  className="persian-body"
                />
              </div>

              <div>
                <Label htmlFor="excerpt" className="persian-body">
                  خلاصه
                </Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      excerpt: e.target.value,
                    }))
                  }
                  placeholder="خلاصه‌ای کوتاه از مقاله"
                  className="persian-body"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="content" className="persian-body">
                  محتوا
                </Label>
                <RichTextEditor
                  value={formData.content}
                  onChange={(content) =>
                    setFormData((prev) => ({
                      ...prev,
                      content,
                    }))
                  }
                  placeholder="محتوای مقاله را با تیتر، لیست، نقل‌قول و لینک وارد کنید"
                  className="persian-body"
                  editorClassName="min-h-[400px]"
                />
                <p className="text-sm text-muted-foreground mt-1 persian-body">
                  از نوار ابزار برای تیتر، لیست، لینک و قالب‌بندی متن استفاده کنید
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="persian-heading">تنظیمات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="slug" className="persian-body">
                  آدرس مقاله
                </Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="blog-post-url"
                  className="persian-body text-left"
                  dir="ltr"
                />
                <p className="text-sm text-muted-foreground mt-1 persian-body">
                  آدرس مقاله در وبسایت
                </p>
              </div>

              <div>
                <Label htmlFor="featured_image" className="persian-body">
                  بنر مقاله
                </Label>
                <Input
                  id="featured_image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview && (
                  <div className="mt-3 overflow-hidden rounded-md border">
                    <img
                      src={imagePreview}
                      alt="Blog banner preview"
                      className="aspect-video w-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Switch
                  dir="rtl"
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(published) =>
                    setFormData((prev) => ({ ...prev, published }))
                  }
                />
                <Label htmlFor="published" className="persian-body">
                  انتشار مقاله
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
