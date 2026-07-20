import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import ClientDashboard from "@/components/dashboard/ClientDashboard";
import { WorkerDashboard } from "@/components/dashboard/WorkerDashboard";
import { Loader2 } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // For now, use the user data directly as profile since they have the same structure
        setProfile({
          id: user.id,
          user_id: user.id,
          full_name: user.full_name || null,
          role: user.role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="persian-body text-muted-foreground">
            در حال بارگذاری...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="persian-body text-muted-foreground">
            خطا در بارگذاری پروفایل
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {profile.role === "admin" ? (
        <AdminDashboard profile={profile} />
      ) : profile.role === "worker" ? (
        <WorkerDashboard />
      ) : (
        <ClientDashboard profile={profile} />
      )}
    </div>
  );
};

export default Dashboard;
