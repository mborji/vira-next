import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  Home,
  Info,
  Briefcase,
  FolderOpen,
  Phone,
  Shield,
  LogOut,
  FileText,
} from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const location = useLocation();
  const { user, signOut } = useAuthStore();

  useEffect(() => {
    if (user) {
      setUserRole(user.role);
    } else {
      setUserRole(null);
    }
  }, [user]);

  const navItems = [
    { path: "/", label: "خانه", icon: Home },
    { path: "/about", label: "درباره ما", icon: Info },
    { path: "/services", label: "خدمات", icon: Briefcase },
    { path: "/projects", label: "پروژه‌ها", icon: FolderOpen },
    { path: "/blog", label: "مقالات", icon: FileText },
    { path: "/contact", label: "تماس", icon: Phone },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 text-primary font-bold text-xl"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center">
              <img
                src="/vira.png"
                alt="ویرا افزار پاسارگاد"
                className="w-6 h-6"
              />
            </div>
            <div>
              <h1 className="persian-heading md:text-xl text-lg text-foreground">
                ویرا افزار پاسارگاد
              </h1>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 lg:px-3 py-2 text-sm font-medium transition-colors duration-200 rounded-lg persian-body ${
                    isActive(item.path)
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Auth Actions */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="outline" size="sm" className="persian-body">
                    <Shield className="w-4 h-4 ml-2" />
                    {userRole === "admin" ? "پنل مدیریت" : "داشبورد"}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="persian-body"
                >
                  <LogOut className="w-4 h-4 ml-2" />
                  خروج
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button variant="outline" size="sm" className="persian-body">
                  ورود / ثبت نام
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="py-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg persian-body transition-colors ${
                      isActive(item.path)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Mobile Auth Section */}
              <div className="px-4 pt-2 border-t border-border mt-2 space-y-2">
                {user ? (
                  <>
                    <Link
                      to="/dashboard"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors persian-body"
                    >
                      <Shield size={20} />
                      <span>
                        {userRole === "admin" ? "پنل مدیریت" : "داشبورد"}
                      </span>
                    </Link>
                    <button
                      onClick={() => {
                        signOut();
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors persian-body w-full text-right"
                    >
                      <LogOut size={20} />
                      <span>خروج</span>
                    </button>
                  </>
                ) : (
                  <Link to="/auth" onClick={() => setIsOpen(false)}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full persian-body"
                    >
                      ورود / ثبت نام
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
