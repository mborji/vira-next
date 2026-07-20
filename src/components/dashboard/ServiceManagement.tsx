import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, X, ChevronDown, Code2 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { convertToPersianDigits, iconMap } from "@/lib/utils";

const availableIcons: string[] = [
  "Code",
  "Smartphone",
  "Globe",
  "Heart",
  "Star",
  "Camera",
  "Settings",
  "Rocket",
  "User",
  "Feather",
  "Zap",
  "Calendar",
  "Briefcase",
  "Coffee",
  "Palette",
  "Code2",
  "Database",
  "BarChart3",
  "Brain",
  "Shield",
];

const DynamicIcon: React.FC<{
  name: string;
  size?: number;
  className?: string;
}> = ({ name, ...props }) => {
  const Icon = LucideIcons[
    name as keyof typeof LucideIcons
  ] as React.ComponentType<any>;
  return Icon ? <Icon {...props} /> : null;
};

interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
  features: string[];
  created_at: string;
  updated_at: string;
}

const ServiceManagement = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    icon: "",
    features: [""],
  });

  const SelectedIcon = formData.icon ? (
    <DynamicIcon name={formData.icon} size={20} className="mr-2" />
  ) : null;

  const handleSelectIcon = (iconName: string) => {
    setFormData({ ...formData, icon: iconName });
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const data = await apiClient.getServices();
      setServices(data);
    } catch (error) {
      toast.error("خطا در بارگذاری خدمات");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const features = formData.features.filter((f) => f.trim() !== "");

      if (editingService) {
        await apiClient.updateService(editingService.id, {
          ...formData,
          features,
        });
        toast.success("سرویس با موفقیت به روزرسانی شد");
      } else {
        await apiClient.createService({ ...formData, features });
        toast.success("سرویس جدید با موفقیت ایجاد شد");
      }

      setShowDialog(false);
      resetForm();
      fetchServices();
    } catch (error) {
      toast.error(
        editingService ? "خطا در به روزرسانی سرویس" : "خطا در ایجاد سرویس"
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("آیا از حذف این سرویس مطمئن هستید؟")) return;

    try {
      await apiClient.deleteService(id);
      toast.success("سرویس با موفقیت حذف شد");
      fetchServices();
    } catch (error) {
      toast.error("خطا در حذف سرویس");
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      title: service.title,
      description: service.description,
      icon: service.icon,
      features: service.features.length > 0 ? service.features : [""],
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({ title: "", description: "", icon: "", features: [""] });
    setEditingService(null);
  };

  const addFeature = () => {
    setFormData({ ...formData, features: [...formData.features, ""] });
  };

  const removeFeature = (index: number) => {
    const newFeatures = formData.features.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      features: newFeatures.length > 0 ? newFeatures : [""],
    });
  };

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  if (loading) {
    return <div className="flex justify-center p-8">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">مدیریت خدمات</h2>
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
        >
          <Plus className="h-4 w-4 ml-2" />
          سرویس جدید
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const IconComponent = iconMap[service.icon] || Code2;
          return (
            <Card key={service.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex gap-3">
                  <p className="text-xs text-primary">
                    <IconComponent name={service.icon} />
                  </p>
                  <h3 className="font-bold text-lg">{service.title}</h3>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(service)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(service.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {service.description}
              </p>
              <div className="mt-2">
                <p className="text-xs font-semibold mb-1">ویژگی ها:</p>
                <ul className="text-xs list-disc list-inside text-muted-foreground flex gap-3">
                  {service.features.map((feature, idx) => (
                    <li key={idx}>{feature}</li>
                  ))}
                </ul>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "اصلاح سرویس" : "سرویس جدید"}
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {/* Display the currently selected icon and its name */}
                    {formData.icon ? (
                      <>
                        {SelectedIcon}
                        {formData.icon}
                      </>
                    ) : (
                      "یک نماد انتخاب کنید..."
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-[300px] p-0">
                  {/* Icon Grid */}
                  <div className="grid grid-cols-4 max-h-[200px] overflow-y-auto p-2 gap-1">
                    {availableIcons.length > 0 ? (
                      availableIcons.map((iconName) => (
                        <Button
                          key={iconName}
                          variant={
                            formData.icon === iconName ? "default" : "ghost"
                          }
                          className="flex flex-col items-center justify-center h-16 w-full p-1"
                          onClick={() => handleSelectIcon(iconName)}
                        >
                          <DynamicIcon name={iconName} size={24} />
                        </Button>
                      ))
                    ) : (
                      <p className="col-span-4 text-center text-sm py-4 text-gray-500">
                        نماد یافت نشد.
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="description">توضیحات</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>ویژگی ها</Label>
                <Button type="button" size="sm" onClick={addFeature}>
                  <Plus className="h-4 w-4 ml-2" />
                  افزودن ویژگی
                </Button>
              </div>
              {formData.features.map((feature, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    value={feature}
                    onChange={(e) => updateFeature(index, e.target.value)}
                    placeholder={`ویژگی ${convertToPersianDigits(
                      (index + 1).toString()
                    )}`}
                  />
                  {formData.features.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFeature(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {editingService ? "به روزرسانی" : "ایجاد"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
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

export default ServiceManagement;
