import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Admin access required</h2>
        <p className="text-muted-foreground">Your account does not have admin permissions.</p>
      </div>
    );
  }
  return <>{children}</>;
}
