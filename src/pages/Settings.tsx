import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { UsersTab } from "@/pages/admin/UsersTab";
import { AccessControlsTab } from "@/pages/admin/AccessControlsTab";
import { UsageTab } from "@/pages/admin/UsageTab";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrencyVersion } from "@/contexts/CurrencyContext";
import Targets from "@/pages/Targets";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Loader2, Download, Mail, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { getCentralMailboxStatus, setCentralMailbox, sendCentralTest, sendAppEmail } from "@/lib/appEmail";
import { NotificationRulesCard } from "@/components/settings/NotificationRulesCard";
import { connectGmail, useGmailStatus } from "@/hooks/useGmail";

const tabs = [
  "Users & Roles",
  "Access Controls",
  "Usage",
  "Targets",
  "Notifications",
  "Staffing Exports",
] as const;
type SettingsTab = typeof tabs[number];

export default function SettingsPage() {
  useCurrencyVersion();
  const [activeTab, setActiveTab] = useState<SettingsTab>("Users & Roles");
  const { isActuallyAdmin } = useUserRole();

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

        {activeTab === "Usage" && (
          isActuallyAdmin ? (
            <UsageTab />
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Admin access required.</p>
            </div>
          )
        )}

        {activeTab === "Notifications" && (
          <NotificationsPanel />
        )}

        {activeTab === "Targets" && (
          <Targets embedded />
        )}

        {activeTab === "Staffing Exports" && (
          isActuallyAdmin ? (
            <StaffingExportsPanel />
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Admin access required.</p>
            </div>
          )
        )}
      </div>
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
      <CentralMailboxCard />
      <MbrReminderCard />
      <NotificationRulesCard />
    </div>
  );
}

// ── Central Mailbox Card ──────────────────────────────────────────────────
function CentralMailboxCard() {
  const { user } = useAuth();
  const { status: gmailStatus, refresh } = useGmailStatus();
  const [central, setCentral] = useState<{ connected: boolean; googleEmail: string | null; updatedAt: string | null }>({
    connected: false, googleEmail: null, updatedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const reload = useCallbackish(async () => {
    try { setCentral(await getCentralMailboxStatus()); } catch { /* ignore */ }
    setLoading(false);
  });

  useEffect(() => { void reload(); }, []);

  const isCurrentUserCentral = !!(
    gmailStatus.connected &&
    central.connected &&
    gmailStatus.googleEmail &&
    central.googleEmail &&
    gmailStatus.googleEmail.toLowerCase() === central.googleEmail.toLowerCase()
  );

  const handleConnect = async () => {
    try {
      await connectGmail(`${window.location.origin}/settings?tab=notifications`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't start Gmail connect");
    }
  };

  const handleSetCentral = async () => {
    setSaving(true);
    try {
      await setCentralMailbox();
      toast.success("Central mailbox set");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't set central mailbox");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!user?.email) return;
    setTesting(true);
    try {
      const data: any = await sendCentralTest(user.email);
      const r = data?.results?.[0];
      if (r?.ok === false) toast.error("Send failed: " + (r?.error || "unknown"));
      else toast.success(`Test sent to ${user.email}`);
    } catch (e: any) {
      toast.error(e?.message || "Test send failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Central notifications mailbox</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Staffing, RGY and MBR notification emails are sent from this Gmail account (e.g. <span className="font-mono">centralcx@peppercontent.io</span>).
        Sign in once as that user, then click "Use as central sender".
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Checking…</p>
      ) : central.connected ? (
        <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-positive" />
          <span className="text-xs text-foreground">Sending as <span className="font-mono">{central.googleEmail}</span></span>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-warning/5 px-3 py-2 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs text-foreground">No central mailbox set — notifications won't send.</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!gmailStatus.connected ? (
          <button onClick={handleConnect} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
            Connect Gmail (sign in as centralcx)
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground self-center">
            You're signed into Gmail as <span className="font-mono">{gmailStatus.googleEmail}</span>
          </span>
        )}
        {gmailStatus.connected && !isCurrentUserCentral && (
          <button onClick={handleSetCentral} disabled={saving} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/20 disabled:opacity-50">
            {saving ? "Saving…" : "Use this account as central sender"}
          </button>
        )}
        {gmailStatus.connected && (
          <button onClick={handleConnect} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/20">
            Switch Gmail account
          </button>
        )}
        {central.connected && (
          <button onClick={handleTest} disabled={testing} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent/20 disabled:opacity-50">
            <Send className="h-3 w-3" />
            {testing ? "Sending…" : `Send test to ${user?.email || "me"}`}
          </button>
        )}
      </div>
    </div>
  );
}

// Tiny indirection so we don't have to import useCallback twice in this file.
function useCallbackish<T extends (...args: any[]) => any>(fn: T) { return fn; }

// ── MBR Reminder Card ────────────────────────────────────────────────────
function MbrReminderCard() {
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string>("");

  const sendNow = async () => {
    setSending(true);
    setLastResult("");
    try {
      // Find all active retainer deals that don't have a logged MBR for current month.
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const monthStart = `${ym}-01`;
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextStart = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
      const { data: deals } = await supabase
        .from("staffing_deals")
        .select("id, deal_status");
      const activeIds = (deals || [])
        .filter((d: any) => ["Active Deal", "New Deal in SLA/PO", "Deal Disputed"].includes((d.deal_status || "").trim()))
        .map((d: any) => d.id as string);
      if (activeIds.length === 0) { toast.info("No active deals to remind."); setSending(false); return; }
      const { data: entries } = await supabase
        .from("mbr_entries")
        .select("deal_id, week_start, status")
        .in("deal_id", activeIds)
        .gte("week_start", monthStart)
        .lt("week_start", nextStart);
      const done = new Set((entries || []).filter((e: any) => e.status === "Done" || e.status === "Not Required").map((e: any) => e.deal_id));
      const pending = activeIds.filter((id) => !done.has(id));
      if (pending.length === 0) { toast.success("All caught up — no pending MBRs this month."); setSending(false); return; }
      sendAppEmail(pending.map((dealId) => ({ event: "mbr_reminder" as const, dealId, payload: { month: ym } })));
      setLastResult(`Queued reminders for ${pending.length} deal${pending.length === 1 ? "" : "s"}.`);
      toast.success(`Queued ${pending.length} MBR reminder${pending.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to queue MBR reminders");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-border pt-4 space-y-2">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">MBR reminders</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Email the deal's BOPM, Sr BOPM and VSD for every active deal that still has a pending MBR for the current month.
      </p>
      <div className="flex items-center gap-3">
        <button onClick={sendNow} disabled={sending} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {sending && <Loader2 className="h-3 w-3 animate-spin" />}
          {sending ? "Queuing…" : "Send MBR reminders now"}
        </button>
        {lastResult && <span className="text-[11px] text-muted-foreground">{lastResult}</span>}
      </div>
    </div>
  );
}

// ── Staffing Exports panel ─────────────────────────────────────────────────
function StaffingExportsPanel() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.storage
      .from("staffing-exports")
      .list("", { limit: 30, sortBy: { column: "name", order: "desc" } });
    if (error) toast.error(error.message);
    setFiles(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const generateNow = async () => {
    setGenerating(true);
    toast.info("Generating today's staffing export…");
    const { data, error } = await supabase.functions.invoke("staffing-daily-export", { body: {} });
    setGenerating(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.ok === false) { toast.error((data as any).error || "Export failed"); return; }
    toast.success(`Export ready — ${(data as any)?.deals ?? 0} deals`);
    load();
  };

  const download = async (name: string) => {
    const { data, error } = await supabase.storage.from("staffing-exports").createSignedUrl(name, 3600);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const fmtBytes = (b?: number) => {
    if (!b) return "—";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  };
  const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Daily staffing export</h2>
            <p className="text-xs text-muted-foreground mt-1">
              One row per deal, one column per role, with every staffed person and their allocation %. Generated automatically every day at 06:00 IST. Files older than 30 days are auto-deleted.
            </p>
          </div>
          <button
            onClick={generateNow}
            disabled={generating}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {generating && <Loader2 className="h-3 w-3 animate-spin" />}
            {generating ? "Generating…" : "Generate now"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border">
          <h3 className="text-xs font-medium text-foreground">Recent exports</h3>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-xs text-muted-foreground">Loading…</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-secondary/30 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">File</th>
                <th className="text-left px-4 py-2 font-medium">Generated</th>
                <th className="text-right px-4 py-2 font-medium">Size</th>
                <th className="text-right px-4 py-2 font-medium">Download</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.name} className="border-t border-border/50">
                  <td className="px-4 py-2 font-mono">{f.name}</td>
                  <td className="px-4 py-2">{fmtDate(f.created_at || f.updated_at)}</td>
                  <td className="px-4 py-2 text-right">{fmtBytes(f.metadata?.size)}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => download(f.name)} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Download className="h-3 w-3" /> Download
                    </button>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No exports yet — click “Generate now”.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


