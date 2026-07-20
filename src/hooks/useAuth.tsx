import { create } from "zustand";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  worker_type?: "full_time" | "part_time";
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isInitialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => void;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  isInitialized: false,

  initialize: async () => {
    if (!apiClient.isAuthenticated()) {
      set({ isInitialized: true });
      return;
    }

    try {
      const user = await apiClient.getCurrentUser();
      set({ user, isInitialized: true });
    } catch (error) {
      console.error("Failed to initialize auth:", error);
      apiClient.signOut();
      set({ user: null, isInitialized: true });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const response = await apiClient.signIn(email, password);
      set({ user: response.user, loading: false });
      toast.success("خوش آمدید!");
    } catch (error) {
      set({ loading: false });
      toast.error(error instanceof Error ? error.message : "خطا در ورود");
      throw error;
    }
  },

  signUp: async (email: string, password: string, fullName: string) => {
    set({ loading: true });
    try {
      await apiClient.signUp(email, password, fullName);
      set({ loading: false });
      toast.success("حساب کاربری با موفقیت ایجاد شد. لطفاً وارد شوید.");
    } catch (error) {
      set({ loading: false });
      toast.error(error instanceof Error ? error.message : "خطا در ثبت نام");
      throw error;
    }
  },

  signOut: () => {
    apiClient.signOut();
    set({ user: null });
    toast.success("با موفقیت خارج شدید");
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    if (!get().user) {
      toast.error("کاربر احراز هویت نشده است.");
      return;
    }

    set({ loading: true });
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      set({ loading: false });
      toast.success("رمز عبور با موفقیت تغییر کرد");
    } catch (error) {
      set({ loading: false });
      toast.error(
        error instanceof Error ? error.message : "خطا در تغییر رمز عبور"
      );
      throw error;
    }
  },
}));
