import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

type Counts = { pending: number; failed: number; done: number };

export function CreatorCompassSyncCard() {
  const { isActuallyAdmin } = useUserRole();
  const [counts, setCounts] = useState<Counts>({ pending: 0, failed: 0, done: 0 });
  const [lastError, setLastError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sync_outbox")
      .select("status, last_error, updated_at")
      .order("updated_at", { ascending: false })
      .limit(2000);
    if (error) {
      setLoading(false);
      return;
    }
    const rows = data ?? [];
    setCounts({
      pending: rows.filter((r) => r.status === "pending").length,
      failed: rows.filter((r) => r.status === "failed").length,
      done: rows.filter((r) => r.status === "done").length,
    });
    setLastError(rows.find((r) => r.status === "failed" && r.last_error)?.last_error ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isActuallyAdmin) load();
    else setLoading(false);
  }, [isActuallyAdmin, load]);

  if (!isActuallyAdmin) return null;

  const run = async (mode: "process" | "retry" | "backfill", label: string) => {
    setBusy(mode);
    const { data, error } = await supabase.functions.invoke("creator-compass-sync", { body: { mode } });
    setBusy(null);
    if (error) toast.error(error.message);
    else if ((data as any)?.ok === false) toast.error((data as any).error || "Sync failed");
    else toast.success(`${label}: ${(data as any)?.ok ?? 0} delivered, ${(data as any)?.failed ?? 0} failed`);
    load();
  };

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Creator Compass sync</p>
          <p className="text-[11px] text-muted-foreground">
            Deals and staffing changes are queued here and pushed to Creator Compass every minute.
          </p>
        </div>
        <button
          onClick={load}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Refresh sync status"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="flex gap-4 text-xs">
          <span className="text-muted-foreground">Pending: <span className="text-foreground font-medium">{counts.pending}</span></span>
          <span className="text-muted-foreground">Failed: <span className={counts.failed ? "text-destructive font-medium" : "text-foreground font-medium"}>{counts.failed}</span></span>
          <span className="text-muted-foreground">Delivered: <span className="text-foreground font-medium">{counts.done}</span></span>
        </div>
      )}

      {lastError && (
        <p className="text-[11px] text-destructive break-words">Last error: {lastError}</p>
      )}

      <div className="flex flex-wrap gap-4">
        <button onClick={() => run("process", "Sync run")} disabled={!!busy} className="text-xs text-primary hover:underline disabled:opacity-50">
          {busy === "process" ? "Running…" : "Run sync now"}
        </button>
        <button onClick={() => run("retry", "Retry")} disabled={!!busy} className="text-xs text-primary hover:underline disabled:opacity-50">
          {busy === "retry" ? "Retrying…" : "Retry failed"}
        </button>
        <button onClick={() => run("backfill", "Backfill")} disabled={!!busy} className="text-xs text-primary hover:underline disabled:opacity-50">
          {busy === "backfill" ? "Backfilling…" : "Backfill everything"}
        </button>
      </div>
    </div>
  );
}
