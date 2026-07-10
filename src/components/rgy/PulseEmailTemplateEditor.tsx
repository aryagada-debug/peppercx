import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { ChevronDown, ChevronRight, Mail, RotateCcw, Save } from "lucide-react";

type Tpl = {
  subject: string;
  greeting: string;
  body: string;
  cta_label: string;
  footer_note: string;
  updated_at?: string;
  updated_by?: string | null;
};

const DEFAULTS: Tpl = {
  subject: "How are we doing on {{account}} — {{deal_name}}?",
  greeting: "Hi {{first_name}},",
  body: "Your honest feedback shapes what we fix, build, and prioritise next on this engagement.\n\nIt takes about 4 minutes — and the whole team reads every response.",
  cta_label: "Share your feedback →",
  footer_note: "Sent by the Pepper Customer Success team. Reply to this email to reach us directly.",
};

const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "first_name", label: "First name" },
  { key: "recipient_name", label: "Recipient name" },
  { key: "account", label: "Account" },
  { key: "deal_name", label: "Deal name" },
  { key: "vsd", label: "VSD" },
  { key: "sender_name", label: "Sender" },
  { key: "link", label: "Survey link" },
];

function getSample() {
  return {
    first_name: "Ananya",
    recipient_name: "Ananya Sharma",
    account: "HDFC Bank",
    deal_name: "SEO Retainer",
    vsd: "Sumit",
    sender_name: "Pepper CX",
    link: `https://peppercx.lovable.app/survey/preview`,
  };
}

function render(str: string, vars: Record<string, string>) {
  return String(str || "").replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const BRAND_PRIMARY = "#5B34DA";
const BRAND_HEADER_BG = "#0C0359";
const BRAND_HEADER_ACCENT = "#B7A9EE";
const BRAND_BG = "#F4F0EA";
const BRAND_BORDER = "#ECE7F5";
const BRAND_TEXT = "#1E1633";
const BRAND_BODY = "#4A4358";
const BRAND_MUTED = "#9089A0";

function paragraphsHtml(body: string) {
  return body
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 16px 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${BRAND_BODY};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function buildPreviewHtml(tpl: Tpl): string {
  const SAMPLE = getSample();
  const headline = render(tpl.greeting, SAMPLE);
  const body = render(tpl.body, { ...SAMPLE, link: "" });
  const cta = render(tpl.cta_label, SAMPLE);
  const footer = render(tpl.footer_note, SAMPLE);
  const subject = render(tpl.subject, SAMPLE);
  const link = SAMPLE.link;
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BRAND_BG};font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="background:#fff;border-bottom:1px solid ${BRAND_BORDER};padding:10px 16px;font-size:12px;color:${BRAND_MUTED};">
    <div><b style="color:${BRAND_TEXT};">From</b> Pepper CX &lt;centralcx@peppercontent.io&gt;</div>
    <div><b style="color:${BRAND_TEXT};">To</b> ${escapeHtml(SAMPLE.recipient_name)} &lt;ananya@example.com&gt;</div>
    <div><b style="color:${BRAND_TEXT};">Subject</b> ${escapeHtml(subject)}</div>
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_BG};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(60,40,90,0.06);">
        <tr><td style="background-color:${BRAND_HEADER_BG};padding:24px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="left" valign="middle" style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">Pepper</td>
            <td align="right" valign="middle" style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:${BRAND_HEADER_ACCENT};">Pepper&nbsp;Pulse</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:44px 40px 8px 40px;">
          <h1 style="margin:0 0 18px 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;line-height:1.25;font-weight:700;color:${BRAND_TEXT};letter-spacing:-0.4px;">${escapeHtml(headline)}</h1>
          ${paragraphsHtml(body)}
        </td></tr>
        <tr><td align="left" style="padding:28px 40px 24px 40px;">
          <a href="${escapeHtml(link)}" target="_blank" style="display:inline-block;padding:15px 38px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;background-color:${BRAND_PRIMARY};">${escapeHtml(cta)}</a>
        </td></tr>
        <tr><td style="padding:0 40px 40px 40px;">
          <p style="margin:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${BRAND_BODY};">Thank you for taking a few moments to share your feedback. We truly appreciate your time and trust.</p>
        </td></tr>
        <tr><td style="padding:0 40px;"><div style="border-top:1px solid ${BRAND_BORDER};font-size:0;line-height:0;">&nbsp;</div></td></tr>
        <tr><td style="padding:24px 40px 36px 40px;">
          <p style="margin:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:${BRAND_MUTED};">${escapeHtml(footer)}</p>
          <div style="border-top:1px solid #EFEAF3;font-size:0;line-height:0;margin:16px 0 0 0;">&nbsp;</div>
          <p style="margin:16px 0 0 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:${BRAND_MUTED};">
            If the button doesn't work, copy this link into your browser:<br>
            <a href="${escapeHtml(link)}" style="color:${BRAND_PRIMARY};text-decoration:none;word-break:break-all;">${escapeHtml(link)}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

export default function PulseEmailTemplateEditor() {
  const { isAdmin, canEditAll } = useUserRole();
  const canEdit = !!(isAdmin || canEditAll);
  const [open, setOpen] = useState(false);
  const [tpl, setTpl] = useState<Tpl>(DEFAULTS);
  const [original, setOriginal] = useState<Tpl>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const greetingRef = useRef<HTMLInputElement | null>(null);
  const [focusedField, setFocusedField] = useState<"subject" | "greeting" | "body" | "cta" | "footer">("body");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pulse_email_templates" as any)
        .select("subject, greeting, body, cta_label, footer_note, updated_at")
        .eq("id", "default")
        .maybeSingle();
      const next: Tpl = data
        ? {
            subject: (data as any).subject || DEFAULTS.subject,
            greeting: (data as any).greeting || DEFAULTS.greeting,
            body: (data as any).body || DEFAULTS.body,
            cta_label: (data as any).cta_label || DEFAULTS.cta_label,
            footer_note: (data as any).footer_note || DEFAULTS.footer_note,
            updated_at: (data as any).updated_at,
          }
        : DEFAULTS;
      setTpl(next);
      setOriginal(next);
      setLoading(false);
    })();
  }, []);

  const previewSrc = useMemo(() => buildPreviewHtml(tpl), [tpl]);
  const dirty = JSON.stringify(tpl) !== JSON.stringify(original);

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("pulse_email_templates" as any)
      .upsert({
        id: "default",
        subject: tpl.subject,
        greeting: tpl.greeting,
        body: tpl.body,
        cta_label: tpl.cta_label,
        footer_note: tpl.footer_note,
        updated_by: u.user?.id || null,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setOriginal(tpl);
    toast({ title: "Email template saved", description: "Future Pulse invites will use this template." });
  };

  const reset = () => setTpl(DEFAULTS);

  const insertPlaceholder = (key: string) => {
    const token = `{{${key}}}`;
    const insertInto = (val: string, el: HTMLInputElement | HTMLTextAreaElement | null, setter: (v: string) => void) => {
      if (!el) { setter(val + token); return; }
      const start = el.selectionStart ?? val.length;
      const end = el.selectionEnd ?? val.length;
      const next = val.slice(0, start) + token + val.slice(end);
      setter(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    };
    if (focusedField === "subject") insertInto(tpl.subject, subjectRef.current, v => setTpl({ ...tpl, subject: v }));
    else if (focusedField === "greeting") insertInto(tpl.greeting, greetingRef.current, v => setTpl({ ...tpl, greeting: v }));
    else insertInto(tpl.body, bodyRef.current, v => setTpl({ ...tpl, body: v }));
  };

  return (
    <Card className="p-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Mail className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Email template</span>
          {!canEdit && <Badge variant="outline" className="text-[10px]">View only</Badge>}
          {dirty && <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100">Unsaved</Badge>}
        </div>
        <span className="text-xs text-muted-foreground">
          {open ? "Hide" : "Edit subject, body, CTA & preview"}
        </span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Subject</Label>
              <Input
                ref={subjectRef}
                value={tpl.subject}
                onFocus={() => setFocusedField("subject")}
                onChange={e => setTpl({ ...tpl, subject: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label className="text-xs">Greeting</Label>
              <Input
                ref={greetingRef}
                value={tpl.greeting}
                onFocus={() => setFocusedField("greeting")}
                onChange={e => setTpl({ ...tpl, greeting: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label className="text-xs">Body</Label>
              <Textarea
                ref={bodyRef}
                value={tpl.body}
                onFocus={() => setFocusedField("body")}
                onChange={e => setTpl({ ...tpl, body: e.target.value })}
                rows={7}
                disabled={!canEdit}
                placeholder="Use blank lines to separate paragraphs."
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use blank lines for paragraphs. The CTA button is added automatically — don't paste the link here.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">CTA button label</Label>
                <Input
                  value={tpl.cta_label}
                  onChange={e => setTpl({ ...tpl, cta_label: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label className="text-xs">Footer note</Label>
                <Input
                  value={tpl.footer_note}
                  onChange={e => setTpl({ ...tpl, footer_note: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Insert placeholder</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PLACEHOLDERS.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => insertPlaceholder(p.key)}
                    disabled={!canEdit}
                    className="px-2 py-0.5 rounded-md border text-[11px] hover:bg-secondary disabled:opacity-50"
                    title={`{{${p.key}}}`}
                  >
                    {p.label} <span className="text-muted-foreground">{`{{${p.key}}}`}</span>
                  </button>
                ))}
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset to default
                </Button>
                <Button size="sm" onClick={save} disabled={saving || !dirty}>
                  <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Saving…" : "Save template"}
                </Button>
              </div>
            )}
            {tpl.updated_at && (
              <p className="text-[11px] text-muted-foreground">
                Last saved {new Date(tpl.updated_at).toLocaleString()}
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs">Live preview</Label>
            <div className="mt-1 rounded-md border bg-secondary/30 overflow-hidden">
              <iframe
                title="Email preview"
                srcDoc={previewSrc}
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                className="w-full"
                style={{ height: 620, border: 0, background: "white" }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Sample data shown: <b>Ananya Sharma</b> · HDFC Bank — SEO Retainer. The CTA opens a preview survey in a new tab.
            </p>
          </div>
        </div>
      )}
      {loading && <p className="text-xs text-muted-foreground mt-2">Loading template…</p>}
    </Card>
  );
}