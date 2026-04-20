import { useUserRole } from "@/hooks/useUserRole";
import { ShieldCheck, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export function RoleSwitcher() {
  const { isActuallyAdmin, viewAsRole, setViewAsRole } = useUserRole();

  if (!isActuallyAdmin) return null;

  const viewingAsVSD = viewAsRole === "vsd";

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-xs w-full">
      <button
        onClick={() => setViewAsRole(null)}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-sm transition-colors",
          !viewingAsVSD ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        title="View as Admin"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Admin
      </button>
      <button
        onClick={() => setViewAsRole("vsd")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-sm transition-colors",
          viewingAsVSD ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        title="Preview the VSD experience"
      >
        <Eye className="h-3.5 w-3.5" />
        VSD
      </button>
    </div>
  );
}
