import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  children: React.ReactNode;
  routeKey?: string;
}

export function ProtectedRoute({ children, routeKey }: Props) {
  const { session, loading } = useAuth();
  const { visibleRoutes, loading: roleLoading, isAdmin } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Route-level visibility check
  if (routeKey && !isAdmin && !visibleRoutes.has(routeKey)) {
    return <Navigate to="/clients" replace />;
  }

  return <>{children}</>;
}
