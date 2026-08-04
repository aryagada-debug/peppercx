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
import { getCentralMailboxStatus, setCentralMailbox, sendCentralTest, sendAppEmail, checkCentralMailbox } from "@/lib/appEmail";
import { NotificationRulesCard } from "@/components/settings/NotificationRulesCard";
import { CreatorCompassSyncCard } from "@/components/settings/CreatorCompassSyncCard";
import { connectGmail, useGmailStatus } from "@/hooks/useGmail";
import { PeopleReportingTable } from "@/components/settings/PeopleReportingTable";
import { useStaffingQueries } from "@/hooks/queries/useStaffingQueries";
import { useStaffingMutations } from "@/hooks/queries/useStaffingMutations";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const tabs = [
  "Users & Roles",
  "Access Controls",
  "People",
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

        {activeTab === "People" && (
          isActuallyAdmin ? (
            <PeoplePanel />
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
      <NotificationRulesCard />
      <PulseGoogleFormCard />
      <CreatorCompassSyncCard />
    </div>
  );
}

// ── Pulse Google Form config card ─────────────────────────────────────────
function PulseGoogleFormCard() {
  const { isActuallyAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formId, setFormId] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [customWebhookUrl, setCustomWebhookUrl] = useState("");
  const [emailQuestion, setEmailQuestion] = useState("Email");
  const [npsQuestion, setNpsQuestion] = useState("");
  const [csatQuestion, setCsatQuestion] = useState("");
  const [commentQuestion, setCommentQuestion] = useState("");
  const [fieldMapJson, setFieldMapJson] = useState("{}");
  const [lastTest, setLastTest] = useState<{ ok: boolean; message: string; requestId?: string } | null>(null);

  useEffect(() => {
    if (!isActuallyAdmin) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("pulse_google_form_config" as any)
        .select("form_url, form_id, webhook_secret, field_map, email_question_title, webhook_url")
        .eq("id", "default")
        .maybeSingle();
      const row = data as any;
      if (row) {
        const map = (row.field_map || {}) as Record<string, string>;
        setFormUrl(row.form_url || "");
        setFormId(row.form_id || "");
        setWebhookSecret(row.webhook_secret || "");
        setCustomWebhookUrl(row.webhook_url || "");
        setEmailQuestion(row.email_question_title || map.email || "Email");
        setNpsQuestion(map.nps || "");
        setCsatQuestion(map.csat || "");
        setCommentQuestion(map.comment || "");
        setFieldMapJson(JSON.stringify(map, null, 2));
      }
      setLoading(false);
    })();
  }, [isActuallyAdmin]);

  if (!isActuallyAdmin) return null;

  const save = async () => {
    let fieldMap: any = {};
    try {
      fieldMap = fieldMapJson.trim() ? JSON.parse(fieldMapJson) : {};
      if (typeof fieldMap !== "object" || Array.isArray(fieldMap)) throw new Error("Must be a JSON object");
    } catch (e: any) {
      toast.error(`Field map JSON invalid: ${e?.message || "parse error"}`);
      return;
    }
    fieldMap = {
      ...fieldMap,
      ...(emailQuestion.trim() ? { email: emailQuestion.trim() } : {}),
      ...(npsQuestion.trim() ? { nps: npsQuestion.trim() } : {}),
      ...(csatQuestion.trim() ? { csat: csatQuestion.trim() } : {}),
      ...(commentQuestion.trim() ? { comment: commentQuestion.trim() } : {}),
    };
    delete fieldMap.tracking_token;
    setSaving(true);
    const { error } = await supabase
      .from("pulse_google_form_config" as any)
      .upsert({
        id: "default",
        form_url: formUrl.trim(),
        form_id: formId.trim(),
        webhook_secret: webhookSecret.trim(),
        webhook_url: customWebhookUrl.trim() || null,
        email_question_title: emailQuestion.trim() || "Email",
        field_map: fieldMap,
      });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      setFieldMapJson(JSON.stringify(fieldMap, null, 2));
      toast.success("Google Form settings saved");
    }
  };

  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL as string;
  const defaultWebhookUrl = `${supabaseUrl}/functions/v1/pulse-google-form-webhook`;
  const webhookUrl = customWebhookUrl.trim() || defaultWebhookUrl;

  const sendTestWebhook = async () => {
    setLastTest(null);
    setTesting(true);
    try {
      const { data: latestInvite, error: inviteError } = await supabase
        .from("survey_invites")
        .select("recipient_email, deal_name_snapshot")
        .eq("source", "google_form")
        .is("completed_at", null)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (inviteError) throw inviteError;
      const answerPayload: Record<string, string> = {};
      if (latestInvite?.recipient_email && emailQuestion.trim()) answerPayload[emailQuestion.trim()] = latestInvite.recipient_email;
      if (npsQuestion.trim()) answerPayload[npsQuestion.trim()] = "9";
      if (csatQuestion.trim()) answerPayload[csatQuestion.trim()] = "5";
      if (commentQuestion.trim()) answerPayload[commentQuestion.trim()] = "Diagnostics test only";
      const body = latestInvite?.recipient_email
        ? { secret: webhookSecret.trim(), test: true, answers: answerPayload }
        : { secret: webhookSecret.trim(), ping: true };
      const { data, error } = await supabase.functions.invoke("pulse-google-form-webhook", { body });
      if (error) throw error;
      const d = data as any;
      if (d?.ok && d?.test) {
        const msg = `Webhook reachable — email mapping works for ${latestInvite?.recipient_email || "latest invite"}`;
        setLastTest({ ok: true, message: msg, requestId: d.request_id });
        toast.success(msg);
      } else if (d?.ok) {
        const msg = d.has_field_map
          ? "Webhook reachable — secret OK, no open Google Form invite found to test email mapping"
          : "Webhook reachable — secret OK, but field mapping is empty";
        setLastTest({ ok: true, message: msg, requestId: d.request_id });
        toast.success(msg);
      } else {
        const msg = d?.diagnostic || d?.error || "unknown";
        setLastTest({ ok: false, message: msg, requestId: d?.request_id });
        toast.error(`Webhook returned: ${msg}`);
      }
    } catch (e: any) {
      const msg = e?.message || "Test failed";
      setLastTest({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const scriptSnippet = `const WEBHOOK_URL = '${webhookUrl}';
const WEBHOOK_SECRET = '${webhookSecret ? "PASTE_THE_SAME_SECRET_HERE" : "PASTE_WEBHOOK_SECRET_HERE"}';

function onFormSubmit(e) {
  const answers = {};
  for (const itemResponse of e.response.getItemResponses()) {
    answers[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
  }
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ secret: WEBHOOK_SECRET, answers }),
    muteHttpExceptions: true,
  });
}`;

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Pulse Google Form</h3>
        <p className="text-[11px] text-muted-foreground mt-1">
          When Pulse is sent in "Google Form" mode, each response is mapped back by the respondent's email address. Keep an email question in the form and make its title match below.
        </p>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
            <p className="text-xs font-medium text-foreground">Diagnostics</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              The backend has not received a Google Form callback until this test or Apps Script sends one. If the test works but real submissions don't appear, the Google Form trigger is not installed or is using the wrong script/secret.
            </p>
            {lastTest && (
              <p className={cn("mt-2 text-[11px]", lastTest.ok ? "text-positive" : "text-destructive")}>
                {lastTest.message}{lastTest.requestId ? ` · Request ${lastTest.requestId.slice(0, 8)}` : ""}
              </p>
            )}
          </div>
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Google Form URL (viewform)</span>
            <input value={formUrl} onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://docs.google.com/forms/d/e/…/viewform"
              className="w-full h-8 px-2 rounded border border-border bg-card text-xs" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Form ID (optional if URL set)</span>
            <input value={formId} onChange={(e) => setFormId(e.target.value)}
              placeholder="1FAIpQLSc…"
              className="w-full h-8 px-2 rounded border border-border bg-card text-xs" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Email question title</span>
            <input value={emailQuestion} onChange={(e) => setEmailQuestion(e.target.value)}
              placeholder="Email"
              className="w-full h-8 px-2 rounded border border-border bg-card text-xs" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Webhook shared secret</span>
            <input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="paste a long random string"
              className="w-full h-8 px-2 rounded border border-border bg-card text-xs font-mono" />
          </label>
          <label className="text-xs space-y-1 sm:col-span-2">
            <span className="text-muted-foreground">Apps Script webhook URL</span>
            <input
              value={customWebhookUrl}
              onChange={(e) => setCustomWebhookUrl(e.target.value)}
              placeholder={defaultWebhookUrl}
              className="w-full h-8 px-2 rounded border border-border bg-card text-xs font-mono"
            />
            <span className="block text-[11px] text-muted-foreground">
              Leave blank to use this app's built-in webhook (<span className="font-mono">{defaultWebhookUrl}</span>). Override with a custom endpoint if your Apps Script posts elsewhere. Current value used in the snippet below: <span className="font-mono">{webhookUrl}</span>.
            </span>
          </label>
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">NPS question title</span>
            <input value={npsQuestion} onChange={(e) => setNpsQuestion(e.target.value)}
              placeholder="How likely are you to recommend Pepper?"
              className="w-full h-8 px-2 rounded border border-border bg-card text-xs" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">CSAT question title</span>
            <input value={csatQuestion} onChange={(e) => setCsatQuestion(e.target.value)}
              placeholder="Overall satisfaction"
              className="w-full h-8 px-2 rounded border border-border bg-card text-xs" />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Comment question title</span>
            <input value={commentQuestion} onChange={(e) => setCommentQuestion(e.target.value)}
              placeholder="Any other feedback?"
              className="w-full h-8 px-2 rounded border border-border bg-card text-xs" />
          </label>
          <label className="text-xs space-y-1 sm:col-span-2">
            <span className="text-muted-foreground">Advanced field map (JSON)</span>
            <textarea value={fieldMapJson} onChange={(e) => setFieldMapJson(e.target.value)}
              rows={5}
              placeholder={`{\n  "email": "Email",\n  "nps": "How likely are you to recommend Pepper?",\n  "csat": "Overall satisfaction",\n  "comment": "Any other feedback?"\n}`}
              className="w-full px-2 py-1.5 rounded border border-border bg-card text-xs font-mono" />
            <span className="block text-[11px] text-muted-foreground">
              Question titles must match the Google Form exactly. The explicit fields above are saved into this JSON.
            </span>
          </label>
          <label className="text-xs space-y-1 sm:col-span-2">
            <span className="text-muted-foreground">Apps Script snippet</span>
            <textarea value={scriptSnippet} readOnly rows={11}
              className="w-full px-2 py-1.5 rounded border border-border bg-secondary/40 text-xs font-mono" />
          </label>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving || loading}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving…" : "Save Google Form settings"}
        </button>
        <button onClick={sendTestWebhook} disabled={testing || loading || !webhookSecret.trim()}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50">
          {testing ? "Testing…" : "Send test webhook"}
        </button>
      </div>
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
  const [authFailures, setAuthFailures] = useState(0);
  const [tokenBad, setTokenBad] = useState<string | null>(null);

  const reload = useCallbackish(async () => {
    try { setCentral(await getCentralMailboxStatus()); } catch { /* ignore */ }
    try {
      const check = await checkCentralMailbox();
      setTokenBad(check.ok ? null : (check.reason || "central_mailbox_unavailable"));
    } catch { /* ignore */ }
    try {
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      const { count } = await supabase
        .from("email_send_log")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", since)
        .in("error", [
          "central_mailbox_reauth_required",
          "central_mailbox_not_connected",
          "central_mailbox_missing_email",
          "gmail_oauth_not_configured",
        ]);
      setAuthFailures(count || 0);
    } catch { /* ignore */ }
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
      ) : tokenBad || authFailures > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5" />
          <span className="text-xs text-foreground">
            Central mailbox {tokenBad === "central_mailbox_reauth_required" ? "sign-in has expired" : "is not usable"} — emails are not sending.
            {authFailures > 0 && ` ${authFailures} notification${authFailures === 1 ? "" : "s"} failed in the last 14 days.`}{" "}
            Sign in as <span className="font-mono">centralcx@peppercontent.io</span> below and click
            "Use this account as central sender" to reconnect.
          </span>
        </div>
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
        {gmailStatus.connected && (
          <button onClick={handleSetCentral} disabled={saving} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/20 disabled:opacity-50">
            {saving
              ? "Saving…"
              : isCurrentUserCentral
                ? "Re-apply this account as central sender"
                : "Use this account as central sender"}
          </button>
        )}
        {gmailStatus.connected && (
          <button onClick={handleConnect} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/20">
            Switch Gmail account
          </button>
        )}
        {!gmailStatus.connected && (
          <span className="text-[11px] text-muted-foreground self-center">
            Connect Gmail first — the "Use this account as central sender" button appears once this browser session has a Gmail connection.
          </span>
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

// ── People panel (admin) ───────────────────────────────────────────────────
function PeoplePanel() {
  const { people, assignments, deals, loading } = useStaffingQueries();
  const { addPerson, updatePerson, deletePerson } = useStaffingMutations();
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Loading people…</p>
      </div>
    );
  }

  const handleDelete = async () => {
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

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">People directory</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Manage the reporting hierarchy, roles and capacity for everyone on the team. Changes here flow to Staffing, People Ops and every hierarchy-scoped view.
        </p>
      </div>
      <PeopleReportingTable
        people={people}
        assignments={assignments}
        deals={deals}
        onAdd={addPerson}
        onUpdate={updatePerson}
        onRequestDelete={(p) => setConfirmDelete({ id: p.id, name: p.name })}
      />
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the person from the directory. Their staffing assignments will be unlinked. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// MBR reminders are now sent by the mbr.reminder_bopm_digest cron rule.

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


