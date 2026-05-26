import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useStaffingQueries } from "@/hooks/queries/useStaffingQueries";
import { useStaffingMutations } from "@/hooks/queries/useStaffingMutations";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UsersTab } from "@/pages/admin/UsersTab";
import { AccessControlsTab } from "@/pages/admin/AccessControlsTab";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrencyVersion } from "@/contexts/CurrencyContext";
import { PeopleReportingTable } from "@/components/settings/PeopleReportingTable";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

const tabs = [
  "People & Reporting",
  "Users & Roles",
  "Access Controls",
  "Notifications",
  "Data Sync",
] as const;
type SettingsTab = typeof tabs[number];

export default function SettingsPage() {
  useCurrencyVersion();
  const [activeTab, setActiveTab] = useState<SettingsTab>("People & Reporting");
  const { people, loading } = useStaffingQueries();
  const { addPerson, updatePerson, deletePerson } = useStaffingMutations();
  const { isActuallyAdmin } = useUserRole();
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const handleDeletePerson = async () => {
    if (!confirmDelete) return;
    try {
      await deletePerson(confirmDelete.id);
      toast.success(`${confirmDelete.name} removed`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    } finally {
      setConfirmDelete(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-3 py-4">
        <h1 className="mb-6 text-subhead font-semibold tracking-tight text-foreground">Settings</h1>

        <div className="mb-6 border-b border-border">
          <div className="-mb-px flex gap-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "border-b-2 px-4 py-2.5 text-ui font-medium transition-colors",
                  activeTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "People & Reporting" && (
          <PeopleReportingTable
            people={people}
            onAdd={addPerson}
            onUpdate={updatePerson}
            onRequestDelete={(p) => setConfirmDelete({ id: p.id, name: p.name })}
          />
        )}

        {activeTab === "Users & Roles" && (
          isActuallyAdmin ? (
            <UsersTab />
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Admin access required.</p>
            </div>
          )
        )}

        {activeTab === "Access Controls" && (
          isActuallyAdmin ? (
            <AccessControlsTab />
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Admin access required.</p>
            </div>
          )
        )}

        {activeTab === "Notifications" && (
          <NotificationsPanel />
        )}

        {activeTab === "Data Sync" && (
          isActuallyAdmin ? (
            <DataSyncPanel />
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Admin access required.</p>
            </div>
          )
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the person from People &amp; Reporting. Their staffing assignments
              will be unlinked. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePerson}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// ── Notifications panel ────────────────────────────────────────────────────
function NotificationsPanel() {
  const { user } = useAuth();
  const [optIn, setOptIn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("weekly_summary_opt_in").eq("user_id", user.id).maybeSingle();
      setOptIn(data?.weekly_summary_opt_in !== false);
      setLoading(false);
    })();
  }, [user]);
  const onToggle = async (v: boolean) => {
    setOptIn(v);
    await supabase.from("profiles").update({ weekly_summary_opt_in: v }).eq("user_id", user!.id);
    toast.success(v ? "You'll get the weekly summary on Slack every Monday" : "Weekly summary turned off");
  };
  const sendTest = async () => {
    if (!user?.email) return;
    setSendingTest(true);
    const { data, error } = await supabase.functions.invoke("weekly-summary-slack", { body: { onlyEmail: user.email } });
    setSendingTest(false);
    if (error) toast.error(error.message);
    else if (!(data as any)?.results?.length) toast.error("No matching Slack user found for your account");
    else if ((data as any).results[0].sent === false) toast.error("Send failed: " + ((data as any).results[0].error || "unknown"));
    else toast.success("Test summary sent — check your Slack DMs");
  };
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Weekly Slack summary</h2>
        <p className="text-xs text-muted-foreground mt-1">Every Monday at 10:00 IST you'll get a Slack DM recapping last week's tasks, MBRs and RGY updates plus what still needs attention. Scoped to your role: admins see all, VSDs see their team, BOPMs see their deals.</p>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium text-foreground">DM me the weekly summary</p>
          <p className="text-[11px] text-muted-foreground">Delivered via Slack to your linked account</p>
        </div>
        <Switch checked={optIn} onCheckedChange={onToggle} disabled={loading} />
      </div>
      <div className="border-t border-border pt-4">
        <button onClick={sendTest} disabled={sendingTest} className="text-xs text-primary hover:underline disabled:opacity-50">
          {sendingTest ? "Sending…" : "Send me a test Slack DM now"}
        </button>
      </div>
    </div>
  );
}

// ── Data Sync panel ────────────────────────────────────────────────────────
function DataSyncPanel() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);
    setRuns(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  const runNow = async () => {
    setSyncing(true);
    toast.info("Sync started — this can take a couple of minutes");
    const { error } = await supabase.functions.invoke("sheets-sync-deals", { body: { manual: true } });
    setSyncing(false);
    if (error) toast.error(error.message);
    else toast.success("Sync completed");
    load();
  };

  const latest = runs[0];
  const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Google Sheets sync</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Pulls deal master + financials from the published sheet every 3 hours. Blank cells are preserved; new deals auto-appear; app-only fields (RGY, MBR, tasks, SoW, staffing) are never overwritten.
            </p>
          </div>
          <button
            onClick={runNow}
            disabled={syncing}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {syncing && <Loader2 className="h-3 w-3 animate-spin" />}
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : latest ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 border-t border-border pt-4">
            <Stat label="Last run" value={fmt(latest.started_at)} />
            <Stat
              label="Status"
              value={latest.status}
              tone={latest.status === "success" ? "green" : latest.status === "running" ? "blue" : "red"}
            />
            <Stat label="Deals" value={String(latest.deals_upserted ?? 0)} />
            <Stat label="Financial cells" value={String(latest.financials_upserted ?? 0)} />
            <Stat label="Skipped" value={String(latest.rows_skipped ?? 0)} />
          </div>
        ) : (
          <div className="text-xs text-muted-foreground border-t border-border pt-4">No sync has run yet.</div>
        )}

        {Array.isArray(latest?.error_log) && latest.error_log.length > 0 && (
          <div className="border-t border-border pt-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Recent errors</div>
            <ul className="space-y-1 text-xs text-red-600 max-h-40 overflow-auto">
              {latest.error_log.slice(0, 8).map((e: any, i: number) => (
                <li key={i} className="font-mono text-[11px]">{typeof e === "string" ? e : JSON.stringify(e)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border">
          <h3 className="text-xs font-medium text-foreground">Recent runs</h3>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-secondary/30 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Started</th>
              <th className="text-left px-4 py-2 font-medium">Finished</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">Deals</th>
              <th className="text-right px-4 py-2 font-medium">Financials</th>
              <th className="text-right px-4 py-2 font-medium">Skipped</th>
              <th className="text-left px-4 py-2 font-medium">Trigger</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-border/50">
                <td className="px-4 py-2">{fmt(r.started_at)}</td>
                <td className="px-4 py-2">{fmt(r.finished_at)}</td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2 text-right">{r.deals_upserted ?? 0}</td>
                <td className="px-4 py-2 text-right">{r.financials_upserted ?? 0}</td>
                <td className="px-4 py-2 text-right">{r.rows_skipped ?? 0}</td>
                <td className="px-4 py-2">{r.triggered_by || "cron"}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No runs yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" | "blue" }) {
  const toneCls =
    tone === "green" ? "text-emerald-600" :
    tone === "red" ? "text-red-600" :
    tone === "blue" ? "text-blue-600" : "text-foreground";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-medium mt-0.5", toneCls)}>{value}</div>
    </div>
  );
}

