import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { convertToPersianDigits } from "@/lib/utils";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { getPlainTextFromHtml, sanitizeRichText } from "@/lib/richText";

interface Project {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  tags: string[];
  client: string;
  link: string;
  created_at: string;
  updated_at: string;
}

const ProjectManagement = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image: "",
    category: "",
    tags: [""],
    client: "",
    link: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const data = await apiClient.getProjects();
      setProjects(data);
    } catch (error) {
      toast.error("خطا در بارگذاری پروژه ها");
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string> => {
    if (!imageFile) return formData.image;
    return apiClient.uploadProjectImage(imageFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const tags = formData.tags.filter((t) => t.trim() !== "");
      const description = sanitizeRichText(formData.description);

      if (!getPlainTextFromHtml(description)) {
        toast.error("توضیحات پروژه الزامی است");
        return;
      }

      let imageUrl = formData.image;
      if (imageFile) {
        imageUrl = await uploadImage();
      } else if (imageUrl.startsWith("data:")) {
        toast.error("لطفاً تصویر پروژه را دوباره انتخاب کنید");
        return;
      }

      const projectData = { ...formData, description, tags, image: imageUrl };

      if (editingProject) {
        await apiClient.updateProject(editingProject.id, projectData);
        toast.success("پروژه با موفقیت به روزرسانی شد");
      } else {
        await apiClient.createProject(projectData);
        toast.success("پروژه با موفقیت ایجاد شد");
      }

      setShowDialog(false);
      resetForm();
      fetchProjects();
    } catch (error) {
      toast.error(
        editingProject ? "خطا در به روزرسانی پروژه" : "خطا در ایجاد پروژه"
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("آیا از حذف این پروژه مطمئن هستید؟")) return;

    try {
      await apiClient.deleteProject(id);
      toast.success("پروژه با موفقیت حذف شد");
      fetchProjects();
    } catch (error) {
      toast.error("خطا در حذف پروژه");
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      title: project.title,
      description: project.description,
      image: project.image,
      category: project.category,
      tags: project.tags.length > 0 ? project.tags : [""],
      client: project.client,
      link: project.link,
    });
    setImageFile(null);
    setImagePreview(project.image || "");
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      image: "",
      category: "",
      tags: [""],
      client: "",
      link: "",
    });
    setEditingProject(null);
    setImageFile(null);
    setImagePreview("");
  };

  const addTag = () => {
    setFormData({ ...formData, tags: [...formData.tags, ""] });
  };

  const removeTag = (index: number) => {
    const newTags = formData.tags.filter((_, i) => i !== index);
    setFormData({ ...formData, tags: newTags.length > 0 ? newTags : [""] });
  };

  const updateTag = (index: number, value: string) => {
    const newTags = [...formData.tags];
    newTags[index] = value;
    setFormData({ ...formData, tags: newTags });
  };

  const handleDialogChange = (open: boolean) => {
    setShowDialog(open);
    if (!open) {
      resetForm();
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">مدیریت پروژه ها</h2>
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
        >
          <Plus className="h-4 w-4 ml-2" />
          پروژه جدید
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="p-4">
            {project.image && (
              <img
                src={project.image}
                alt={project.title}
                className="w-full h-40 object-cover rounded mb-3"
              />
            )}
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{project.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {project.category}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(project)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(project.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {getPlainTextFromHtml(project.description)}
            </p>
            {project.client && (
              <p className="text-xs mb-1">
                <strong>مشتری:</strong> {project.client}
              </p>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {project.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "اصلاح پروژه" : "پروژه جدید"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">عنوان</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="category">دسته بندی</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="image">تصویر پروژه</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {imagePreview && (
                <div className="mt-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-md"
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="description">توضیحات</Label>
              <RichTextEditor
                value={formData.description}
                onChange={(description) =>
                  setFormData({ ...formData, description })
                }
                placeholder="توضیحات پروژه را با متن، تیتر، لیست و لینک وارد کنید"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="client">مشتری</Label>
              <Input
                id="client"
                value={formData.client}
                onChange={(e) =>
                  setFormData({ ...formData, client: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="link">لینک</Label>
              <Input
                id="link"
                value={formData.link}
                onChange={(e) =>
                  setFormData({ ...formData, link: e.target.value })
                }
                placeholder="https://example.com"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>برچسب ها</Label>
                <Button type="button" size="sm" onClick={addTag}>
                  <Plus className="h-4 w-4 ml-2" />
                  افزودن برچسب
                </Button>
              </div>
              {formData.tags.map((tag, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    value={tag}
                    onChange={(e) => updateTag(index, e.target.value)}
                    placeholder={`برچسب ${convertToPersianDigits(
                      (index + 1).toString()
                    )}`}
                  />
                  {formData.tags.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTag(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {editingProject ? "به روزرسانی" : "ایجاد"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogChange(false)}
              >
                انصراف
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectManagement;
