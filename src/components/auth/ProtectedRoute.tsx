import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  children: React.ReactNode;
  routeKey?: string;
  adminOnly?: boolean;
  allowEmails?: string[];
}

export function ProtectedRoute({ children, routeKey, adminOnly, allowEmails }: Props) {
  const { session, loading, user } = useAuth();
  const { visibleRoutes, loading: roleLoading, isAdmin, isActuallyAdmin } = useUserRole();

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

  const isAdminUser = isAdmin || isActuallyAdmin;
  const emailAllowed = !!allowEmails && !!user?.email
    && allowEmails.map(e => e.toLowerCase()).includes(user.email.toLowerCase());
  if (adminOnly && !isAdminUser && !emailAllowed) {
    return <Navigate to="/home" replace />;
  }

  // Route-level visibility check
  if (routeKey && !isAdmin && !emailAllowed && !visibleRoutes.has(routeKey)) {
    return <Navigate to="/clients" replace />;
  }

  return <>{children}</>;
}
