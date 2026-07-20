import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/hooks/useAuthStore";
import { Eye, EyeOff, Mail, Lock, User, Code } from "lucide-react";

const Auth = () => {
  const { user, loading, signIn, signUp, initialize } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    confirmPassword: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return;

    try {
      await signIn(formData.email, formData.password);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      // Error handling is done in the signIn function
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.fullName) return;

    if (formData.password !== formData.confirmPassword) {
      return;
    }

    await signUp(formData.email, formData.password, formData.fullName);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 py-12 px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-persian">خوش آمدید</h1>
          <p className="text-muted-foreground mt-2 text-persian">
            وارد حساب کاربری خود شوید یا ثبت نام کنید
          </p>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-accent rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <img
                src="/vira.png"
                alt="ویرا افزار پاسارگاد"
                className="w-6 h-6 text-primary-foreground"
              />
            </div>
            <CardTitle className="text-2xl text-persian">ویراپ</CardTitle>
            <CardDescription className="text-persian">
              پنل مدیریت و احراز هویت
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin" className="text-persian">
                  ورود
                </TabsTrigger>
                <TabsTrigger value="signup" className="text-persian">
                  ثبت نام
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-persian">
                      ایمیل
                    </Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="pr-10 ltr text-right"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-persian">
                      رمز عبور
                    </Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="رمز عبور خود را وارد کنید"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="pr-10 pl-10"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-accent accent-gradient hover:scale-[1.02] hover:bg-accent transition-transform text-persian"
                    disabled={loading}
                  >
                    {loading ? "در حال ورود..." : "ورود"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-persian">
                      نام کامل
                    </Label>
                    <div className="relative">
                      <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        name="fullName"
                        type="text"
                        placeholder="نام کامل خود را وارد کنید"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className="pr-10"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-persian">
                      ایمیل
                    </Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="pr-10 ltr text-right"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-persian">
                      رمز عبور
                    </Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="حداقل ۶ کاراکتر"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="pr-10 pl-10"
                        required
                        minLength={6}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-persian">
                      تکرار رمز عبور
                    </Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        name="confirmPassword"
                        type="password"
                        placeholder="رمز عبور را مجدد وارد کنید"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="pr-10"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-accent accent-gradient hover:bg-accent hover:scale-[1.02] transition-transform text-persian"
                    disabled={loading}
                  >
                    {loading ? "در حال ثبت نام..." : "ثبت نام"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground text-persian">
            با ورود یا ثبت نام، شما با
            <span className="text-primary"> شرایط استفاده </span>و
            <span className="text-primary"> حریم خصوصی </span>
            ما موافقت می‌کنید.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
