import { useUserRole, ROLE_LABELS, type AppRole } from "@/hooks/useUserRole";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function RoleSwitcher() {
  const { isActuallyAdmin, viewAsRole, setViewAsRole } = useUserRole();

  if (!isActuallyAdmin) return null;

  const previewRoles: AppRole[] = ["member", "user", "view_only"];

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-xs">
      <button
        onClick={() => setViewAsRole(null)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-sm transition-colors",
          !viewAsRole ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        title="View as Admin"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Admin
      </button>
      {previewRoles.map((r) => (
        <button
          key={r}
          onClick={() => setViewAsRole(r)}
          className={cn(
            "px-2.5 py-1 rounded-sm transition-colors",
            viewAsRole === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          title={`Preview as ${ROLE_LABELS[r]}`}
        >
          {ROLE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}
