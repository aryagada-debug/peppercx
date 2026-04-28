import { Eye } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Inline banner shown at the top of a page when the current persona has
 * `read` access to that route (configured in Settings → Access Controls).
 * Hidden pages don't reach this — they're redirected at the router level.
 */
export function ReadOnlyBanner({ routeKey, label }: { routeKey: string; label?: string }) {
  const { isRouteReadOnly, isAdmin } = useUserRole();
  if (isAdmin) return null;
  if (!isRouteReadOnly(routeKey)) return null;
  return (
    <div className="mb-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-warning-foreground">
      <Eye className="h-3.5 w-3.5" />
      <span>
        <span className="font-medium">View only.</span>{" "}
        Your role has read-only access to {label || "this section"}. Ask an admin in Settings → Access Controls to enable editing.
      </span>
    </div>
  );
}