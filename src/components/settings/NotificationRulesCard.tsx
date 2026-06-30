import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Bell, Loader2, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface RuleRow {
  event_key: string;
  display_name: string;
  description: string;
  enabled: boolean;
  to_tokens: string[];
  cc_tokens: string[];
  extra_to: string[];
  extra_cc: string[];
  subject_template: string;
  body_template: string;
}

interface CapLead {
  bucket: string;
  display_name: string;
  leads: string[];
}

const TOKEN_HINTS = ["{vsd}", "{principal_bopm}", "{senior_bopm}", "{bopm}", "{capability_lead}", "{assignee}", "{assignee_manager}"];

function splitCsv(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export function NotificationRulesCard() {
  const { isActuallyAdmin } = useUserRole();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [leads, setLeads] = useState<CapLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testTo, setTestTo] = useState<Record<string, string>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const load = async () => {
    const [r, l] = await Promise.all([
      supabase.from("notification_rules").select("*").order("event_key"),
      supabase.from("capability_leads").select("*").order("bucket"),
    ]);
    setRules((r.data as RuleRow[]) || []);
    setLeads((l.data as CapLead[]) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const patchRule = (key: string, patch: Partial<RuleRow>) => {
    setRules((rs) => rs.map((r) => (r.event_key === key ? { ...r, ...patch } : r)));
  };

  const saveRule = async (rule: RuleRow) => {
    setSavingKey(rule.event_key);
    const { error } = await supabase.from("notification_rules").update({
      enabled: rule.enabled,
      to_tokens: rule.to_tokens,
      cc_tokens: rule.cc_tokens,
      extra_to: rule.extra_to,
      extra_cc: rule.extra_cc,
      subject_template: rule.subject_template,
      body_template: rule.body_template,
    }).eq("event_key", rule.event_key);
    setSavingKey(null);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  const sendTest = async (rule: RuleRow) => {
    const to = (testTo[rule.event_key] || "").trim();
    if (!/@/.test(to)) { toast.error("Enter a valid test email"); return; }
    setTestingKey(rule.event_key);
    const { data, error } = await supabase.functions.invoke("send-app-email", {
      body: { action: "send_test_rule", eventKey: rule.event_key, to },
    });
    setTestingKey(null);
    if (error) { toast.error(error.message); return; }
    if (data && typeof data === "object" && "error" in (data as object)) {
      toast.error((data as { error: string }).error);
      return;
    }
    toast.success(`Test sent to ${to}`);
  };

  const saveLeads = async (lead: CapLead) => {
    setSavingKey(`lead:${lead.bucket}`);
    const { error } = await supabase.from("capability_leads").update({ leads: lead.leads }).eq("bucket", lead.bucket);
    setSavingKey(null);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  if (loading) {
    return (
      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">Loading rules…</p>
      </div>
    );
  }

  const disabled = !isActuallyAdmin;

  return (
    <div className="border-t border-border pt-4 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Notification rules</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Configure who gets notified for each system event. Tokens are expanded per deal: {TOKEN_HINTS.join(" ")}.
        Free-form emails can be added under "Extra To" / "Extra CC" (comma-separated).
        {disabled && <span className="text-warning"> Admin access required to edit.</span>}
      </p>

      <div className="space-y-3">
        {rules.map((r) => (
          <div key={r.event_key} className="rounded-md border border-border bg-background p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-foreground">{r.display_name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{r.description}</div>
                <div className="text-[10px] font-mono text-muted-foreground/70 mt-1">{r.event_key}</div>
              </div>
              <Switch
                checked={r.enabled}
                onCheckedChange={(v) => patchRule(r.event_key, { enabled: v })}
                disabled={disabled}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Field label="To (tokens)">
                <Input value={r.to_tokens.join(", ")} onChange={(e) => patchRule(r.event_key, { to_tokens: splitCsv(e.target.value) })} disabled={disabled} placeholder="{vsd}, {capability_lead}" />
              </Field>
              <Field label="CC (tokens)">
                <Input value={r.cc_tokens.join(", ")} onChange={(e) => patchRule(r.event_key, { cc_tokens: splitCsv(e.target.value) })} disabled={disabled} placeholder="{assignee_manager}" />
              </Field>
              <Field label="Extra To (emails)">
                <Input value={r.extra_to.join(", ")} onChange={(e) => patchRule(r.event_key, { extra_to: splitCsv(e.target.value) })} disabled={disabled} placeholder="arya.gada@peppercontent.io" />
              </Field>
              <Field label="Extra CC (emails)">
                <Input value={r.extra_cc.join(", ")} onChange={(e) => patchRule(r.event_key, { extra_cc: splitCsv(e.target.value) })} disabled={disabled} placeholder="" />
              </Field>
              <Field label="Subject template" className="md:col-span-2">
                <Input value={r.subject_template} onChange={(e) => patchRule(r.event_key, { subject_template: e.target.value })} disabled={disabled} placeholder="Subject with {deal_label}" />
              </Field>
              <Field label="Body template (HTML allowed)" className="md:col-span-2">
                <Textarea
                  rows={5}
                  value={r.body_template || ""}
                  onChange={(e) => patchRule(r.event_key, { body_template: e.target.value })}
                  disabled={disabled}
                  placeholder="e.g. Hi team, <b>{deal_label}</b> needs your attention. Capability: {capability}."
                />
              </Field>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-64"
                  placeholder="test@peppercontent.io"
                  value={testTo[r.event_key] || ""}
                  onChange={(e) => setTestTo((m) => ({ ...m, [r.event_key]: e.target.value }))}
                  disabled={disabled}
                />
                <Button size="sm" variant="secondary" onClick={() => sendTest(r)} disabled={disabled || testingKey === r.event_key}>
                  {testingKey === r.event_key ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Send test
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={() => saveRule(r)} disabled={disabled || savingKey === r.event_key}>
                {savingKey === r.event_key ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Save
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2">
        <h4 className="text-xs font-semibold text-foreground mb-1">Capability lead routing</h4>
        <p className="text-[11px] text-muted-foreground mb-2">Used to resolve {"{capability_lead}"} based on the deal's capability + geo.</p>
        <div className="space-y-2">
          {leads.map((l) => (
            <div key={l.bucket} className="rounded-md border border-border bg-background p-2 flex items-center gap-2">
              <div className="w-40 text-xs">
                <div className="font-medium text-foreground">{l.display_name}</div>
                <div className="text-[10px] font-mono text-muted-foreground/70">{l.bucket}</div>
              </div>
              <Input
                className="flex-1"
                value={l.leads.join(", ")}
                onChange={(e) => setLeads((ls) => ls.map((x) => x.bucket === l.bucket ? { ...x, leads: splitCsv(e.target.value) } : x))}
                disabled={disabled}
                placeholder="name@peppercontent.io, other@peppercontent.io"
              />
              <Button size="sm" variant="outline" onClick={() => saveLeads(l)} disabled={disabled || savingKey === `lead:${l.bucket}`}>
                {savingKey === `lead:${l.bucket}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[11px] text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}