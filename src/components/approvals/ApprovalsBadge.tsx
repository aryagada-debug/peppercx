import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export function ApprovalsBadge() {
  const { canEditAll } = useUserRole();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!canEditAll) return;
    const refresh = async () => {
      const { count } = await (supabase as any)
        .from("approval_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "under_review"]);
      setCount(count || 0);
    };
    refresh();
    const ch = supabase
      .channel("approvals_badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_requests" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [canEditAll]);

  if (!canEditAll) return null;

  return (
    <Link
      to="/central-cx?tab=approvals"
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors relative"
      title="Approvals pipeline"
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      Approvals
      {count > 0 && (
        <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold">
          {count}
        </span>
      )}
    </Link>
  );
}
