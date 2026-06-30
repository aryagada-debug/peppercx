import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { sendAppEmail } from "@/lib/appEmail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CurrencyInput } from "./CurrencyInput";
import {
  BU_OPTIONS,
  CAPABILITY_OPTIONS,
  Contact,
  EMAIL_RE,
  HandoverForm,
  INDUSTRY_OPTIONS,
  STAGE_OPTIONS,
  currencyHelper,
  emptyContact,
  emptyHandover,
  formatINR,
  generateReference,
  today,
} from "./constants";

const HANDOVER_LEADS = [
  "arya.gada@peppercontent.io",
  "anirudh@peppercontent.io",
  "priyanka.sharma@peppercontent.io",
];

const STEPS = ["Salesperson", "Client", "Documents", "Deal", "Review"] as const;
type StepIdx = 0 | 1 | 2 | 3 | 4;

type Props = { onSubmitted: () => void };

export function HandoverWizard({ onSubmitted }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<HandoverForm>(emptyHandover);
  const [step, setStep] = useState<StepIdx>(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ reference: string; submitted_at: string } | null>(null);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  // Prefill submitter
  useEffect(() => {
    if (user?.email && !form.sp_email) {
      setForm((f) => ({
        ...f,
        sp_email: user.email || "",
        sp_name: (user.user_metadata as any)?.full_name || f.sp_name,
      }));
    }
  }, [user]); // eslint-disable-line

  const set = <K extends keyof HandoverForm>(k: K, v: HandoverForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validateStep = (s: StepIdx): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!form.sp_name.trim()) e.sp_name = "Required";
      if (!form.sp_email.trim()) e.sp_email = "Required";
      else if (!EMAIL_RE.test(form.sp_email.trim())) e.sp_email = "Invalid email";
      if (!form.handover_date) e.handover_date = "Required";
    } else if (s === 1) {
      if (!form.company_name.trim()) e.company_name = "Required";
      if (!form.industry.trim()) e.industry = "Required";
      if (!form.website.trim()) e.website = "Required";
      if (!form.contacts.length) e["contact_0_name"] = "Add at least one contact";
      form.contacts.forEach((c, i) => {
        if (!c.name.trim()) e[`contact_${i}_name`] = "Required";
        if (!c.email.trim()) e[`contact_${i}_email`] = "Required";
        else if (!EMAIL_RE.test(c.email.trim())) e[`contact_${i}_email`] = "Invalid email";
      });
    } else if (s === 2) {
      if (!form.sow_url.trim()) e.sow_url = "Required";
    } else if (s === 3) {
      if (!form.stage) e.stage = "Required";
      if (!form.bu) e.bu = "Required";
      if (!form.capability) e.capability = "Required";
      if (!form.deal_type) e.deal_type = "Required";
      if (form.deal_type === "Retainer" && (form.mrr == null || form.mrr <= 0)) e.mrr = "Required for Retainer";
      if (form.total_amount == null || form.total_amount <= 0) e.total_amount = "Required";
      if (!form.start_date) e.start_date = "Required";
    }
    return e;
  };

  const focusFirstError = (e: Record<string, string>) => {
    const first = Object.keys(e)[0];
    if (!first) return;
    const node = fieldRefs.current[first];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      try { (node as HTMLInputElement).focus(); } catch {}
    }
  };

  const goTo = (target: StepIdx) => {
    if (target <= step || completed.has(target)) {
      setStep(target);
      setErrors({});
    }
  };

  const next = () => {
    const e = validateStep(step);
    setErrors(e);
    if (Object.keys(e).length) {
      focusFirstError(e);
      return;
    }
    setCompleted((c) => new Set(c).add(step));
    setStep((s) => Math.min(4, s + 1) as StepIdx);
  };

  const back = () => {
    setErrors({});
    setStep((s) => Math.max(0, s - 1) as StepIdx);
  };

  const submit = async () => {
    // Re-validate all steps
    for (let i = 0 as StepIdx; i <= 3; i = (i + 1) as StepIdx) {
      const e = validateStep(i);
      if (Object.keys(e).length) {
        setStep(i);
        setErrors(e);
        focusFirstError(e);
        return;
      }
    }
    setSubmitting(true);
    const reference = generateReference();
    const submitted_at = new Date().toISOString();
    const payload: any = {
      reference,
      submitter_user_id: user?.id || null,
      sp_name: form.sp_name.trim(),
      sp_email: form.sp_email.trim(),
      sp_team: form.sp_team.trim(),
      handover_date: form.handover_date || null,
      company_name: form.company_name.trim(),
      industry: form.industry.trim(),
      website: form.website.trim(),
      sow_url: form.sow_url.trim(),
      strategy_deck_url: form.strategy_deck_url.trim(),
      keywords_url: form.keywords_url.trim(),
      geo_audit_url: form.geo_audit_url.trim(),
      fireflies_url: form.fireflies_url.trim(),
      docs_notes: form.docs_notes.trim(),
      stage: form.stage,
      bu: form.bu,
      capability: form.capability,
      deal_type: form.deal_type,
      mrr: form.deal_type === "Retainer" ? form.mrr : null,
      total_amount: form.total_amount,
      duration_months: form.duration_months ? Number(form.duration_months) : null,
      start_date: form.start_date || null,
      vsd_suggested: "",
      deal_notes: form.deal_notes.trim(),
      contacts: form.contacts.filter((c) => c.name || c.email),
      status: "submitted",
    };
    const { error } = await supabase.from("deal_handovers" as any).insert(payload);
    setSubmitting(false);
    if (error) {
      toast({ title: "Failed to submit", description: error.message, variant: "destructive" });
      return;
    }
    sendAppEmail({
      event: "test",
      recipients: HANDOVER_LEADS,
      payload: {
        kind: "handover_submitted",
        company: payload.company_name,
        submitter: `${payload.sp_name} <${payload.sp_email}>`,
        reference,
      },
    });
    setConfirmation({ reference, submitted_at });
    onSubmitted();
  };

  const reset = () => {
    setForm(emptyHandover());
    setStep(0);
    setCompleted(new Set());
    setErrors({});
    setConfirmation(null);
  };

  if (confirmation) {
    return (
      <SubmittedStep
        form={form}
        reference={confirmation.reference}
        submitted_at={confirmation.submitted_at}
        onNew={reset}
      />
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <Progress step={step} completed={completed} onJump={goTo} />

      {step === 0 && (
        <Step1
          form={form}
          set={set}
          errors={errors}
          fieldRefs={fieldRefs}
        />
      )}
      {step === 1 && (
        <Step2
          form={form}
          set={set}
          errors={errors}
          fieldRefs={fieldRefs}
        />
      )}
      {step === 2 && (
        <Step3 form={form} set={set} errors={errors} fieldRefs={fieldRefs} />
      )}
      {step === 3 && (
        <Step4 form={form} set={set} errors={errors} fieldRefs={fieldRefs} />
      )}
      {step === 4 && <Review form={form} onEdit={(i) => setStep(i as StepIdx)} />}

      <div className="flex justify-between items-center pt-4 border-t">
        <Button variant="ghost" onClick={back} disabled={step === 0 || submitting}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < 4 ? (
          <Button onClick={next}>
            Continue <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit handover"}
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ─── Progress ───────────────────────────────────────────── */
function Progress({
  step,
  completed,
  onJump,
}: {
  step: number;
  completed: Set<number>;
  onJump: (s: StepIdx) => void;
}) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto">
      {STEPS.map((label, i) => {
        const isDone = completed.has(i) && i !== step;
        const isCurrent = i === step;
        const reachable = i <= step || completed.has(i);
        return (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onJump(i as StepIdx)}
              disabled={!reachable}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-xs border transition",
                isCurrent && "bg-primary text-primary-foreground border-primary",
                !isCurrent && isDone && "bg-muted border-border hover:bg-accent",
                !isCurrent && !isDone && "bg-background border-border text-muted-foreground",
                !reachable && "opacity-60 cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "h-5 w-5 inline-flex items-center justify-center rounded-full text-[10px]",
                  isCurrent ? "bg-primary-foreground text-primary" : "bg-muted text-foreground",
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

/* ─── Shared field building blocks ───────────────────────── */
type StepProps = {
  form: HandoverForm;
  set: <K extends keyof HandoverForm>(k: K, v: HandoverForm[K]) => void;
  errors: Record<string, string>;
  fieldRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
};

function FieldShell({
  id,
  label,
  required,
  error,
  children,
  hint,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>;
}
function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 }) {
  return <div className={cn("grid gap-3", cols === 2 ? "md:grid-cols-2" : "grid-cols-1")}>{children}</div>;
}

/* ─── Step 1: Salesperson ─────────────────────────────── */
function Step1({ form, set, errors, fieldRefs }: StepProps) {
  return (
    <div className="space-y-4">
      <SectionTitle>1. Salesperson</SectionTitle>
      <Grid>
        <FieldShell id="sp_name" label="Full name" required error={errors.sp_name}>
          <Input
            id="sp_name"
            ref={(n) => (fieldRefs.current.sp_name = n)}
            value={form.sp_name}
            onChange={(e) => set("sp_name", e.target.value)}
            placeholder="e.g. Aarav Mehta"
          />
        </FieldShell>
        <FieldShell id="sp_email" label="Work email" required error={errors.sp_email}>
          <Input
            id="sp_email"
            type="email"
            ref={(n) => (fieldRefs.current.sp_email = n)}
            value={form.sp_email}
            onChange={(e) => set("sp_email", e.target.value)}
            placeholder="name@peppercontent.io"
          />
        </FieldShell>
        <FieldShell id="sp_team" label="Sales team / region">
          <Input
            id="sp_team"
            value={form.sp_team}
            onChange={(e) => set("sp_team", e.target.value)}
            placeholder="e.g. India Enterprise"
          />
        </FieldShell>
        <FieldShell id="handover_date" label="Handover date" required error={errors.handover_date}>
          <Input
            id="handover_date"
            type="date"
            ref={(n) => (fieldRefs.current.handover_date = n)}
            value={form.handover_date}
            onChange={(e) => set("handover_date", e.target.value)}
          />
        </FieldShell>
      </Grid>
    </div>
  );
}

/* ─── Step 2: Client ──────────────────────────────────── */
function Step2({ form, set, errors, fieldRefs }: StepProps) {
  const updateContact = (i: number, k: keyof Contact, v: string) =>
    set("contacts", form.contacts.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));
  const add = () => set("contacts", [...form.contacts, emptyContact()]);
  const remove = (i: number) => set("contacts", form.contacts.filter((_, idx) => idx !== i));
  const [mode, setMode] = useState<"existing" | "new">(form.existing_client_id ? "existing" : "new");
  const [clients, setClients] = useState<Array<{ id: string; name: string; pc_code: string; industry: string }>>([]);
  const [clientSearch, setClientSearch] = useState("");
  useEffect(() => {
    if (mode !== "existing") return;
    supabase.from("clients").select("id, name, pc_code, industry").order("name").limit(500)
      .then(({ data }) => setClients((data as any[]) || []));
  }, [mode]);
  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 50);
    return clients.filter(c => c.name.toLowerCase().includes(q) || (c.pc_code || "").toLowerCase().includes(q)).slice(0, 50);
  }, [clientSearch, clients]);
  const pickExisting = (id: string) => {
    const c = clients.find(x => x.id === id);
    if (!c) return;
    set("existing_client_id", id);
    set("company_name", c.name);
    const ind = (INDUSTRY_OPTIONS as readonly string[]).includes(c.industry) ? c.industry : "Miscellaneous";
    set("industry", ind);
  };

  return (
    <div className="space-y-5">
      <SectionTitle>2. Client details</SectionTitle>
      <div className="flex gap-2">
        {(["existing", "new"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              if (m === "new") {
                set("existing_client_id", "");
                set("company_name", "");
                set("industry", "");
                set("website", "");
              }
            }}
            className={cn(
              "px-3 py-2 rounded-md border text-sm",
              mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent",
            )}
          >
            {m === "existing" ? "Existing client" : "New client"}
          </button>
        ))}
      </div>
      {mode === "existing" && (
        <Card className="p-3 space-y-2">
          <Input
            placeholder="Search by client name or PC code…"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
          <div className="max-h-56 overflow-y-auto border rounded-md divide-y">
            {filteredClients.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground">No matching clients.</div>
            )}
            {filteredClients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickExisting(c.id)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between gap-3",
                  form.existing_client_id === c.id && "bg-accent",
                )}
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.pc_code}</span>
              </button>
            ))}
          </div>
          {form.existing_client_id && (
            <p className="text-xs text-muted-foreground">Selected: <b>{form.company_name}</b>. Fields below are auto-filled; edit if needed.</p>
          )}
        </Card>
      )}
      <Grid>
        <FieldShell id="company_name" label="Company name" required error={errors.company_name}>
          <Input
            id="company_name"
            ref={(n) => (fieldRefs.current.company_name = n)}
            value={form.company_name}
            onChange={(e) => set("company_name", e.target.value)}
          />
        </FieldShell>
        <FieldShell id="industry" label="Industry" required error={errors.industry}>
          <div ref={(n) => (fieldRefs.current.industry = n)}>
            <Select value={form.industry} onValueChange={(v) => set("industry", v)}>
              <SelectTrigger id="industry"><SelectValue placeholder="Select industry" /></SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </FieldShell>
        <FieldShell id="website" label="Website" required error={errors.website}>
          <Input
            id="website"
            ref={(n) => (fieldRefs.current.website = n)}
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://…"
          />
        </FieldShell>
      </Grid>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Points of contact</SectionTitle>
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="h-3 w-3 mr-1" /> Add another contact
          </Button>
        </div>
        {form.contacts.map((c, i) => (
          <Card key={i} className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Contact {i + 1}</span>
              {form.contacts.length > 1 && (
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Remove
                </Button>
              )}
            </div>
            <Grid>
              <FieldShell id={`contact_${i}_name`} label="Name" required error={errors[`contact_${i}_name`]}>
                <Input
                  id={`contact_${i}_name`}
                  ref={(n) => (fieldRefs.current[`contact_${i}_name`] = n)}
                  value={c.name}
                  onChange={(e) => updateContact(i, "name", e.target.value)}
                />
              </FieldShell>
              <FieldShell id={`contact_${i}_role`} label="Designation">
                <Input
                  id={`contact_${i}_role`}
                  value={c.role}
                  onChange={(e) => updateContact(i, "role", e.target.value)}
                />
              </FieldShell>
              <FieldShell id={`contact_${i}_email`} label="Email" required error={errors[`contact_${i}_email`]}>
                <Input
                  id={`contact_${i}_email`}
                  type="email"
                  ref={(n) => (fieldRefs.current[`contact_${i}_email`] = n)}
                  value={c.email}
                  onChange={(e) => updateContact(i, "email", e.target.value)}
                />
              </FieldShell>
              <FieldShell id={`contact_${i}_phone`} label="Phone">
                <Input
                  id={`contact_${i}_phone`}
                  value={c.phone}
                  onChange={(e) => updateContact(i, "phone", e.target.value)}
                />
              </FieldShell>
            </Grid>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─── Step 3: Documents ───────────────────────────────── */
function DocSlot({
  id, label, required, value, error, onChange, fieldRefs,
}: {
  id: keyof HandoverForm & string;
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  fieldRefs: StepProps["fieldRefs"];
}) {
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `temp/${Date.now()}-${id}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("handover-docs").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("handover-docs").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      onChange(signed.signedUrl);
      toast({ title: "Uploaded", description: file.name });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };
  return (
    <FieldShell id={id} label={label} required={required} error={error}>
      <div className="flex gap-1 mb-1">
        {(["link", "upload"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "px-2 py-1 rounded text-[11px] border",
              mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent",
            )}
          >
            {m === "link" ? "Paste link" : "Upload file"}
          </button>
        ))}
      </div>
      {mode === "link" ? (
        <Input
          id={id}
          ref={(n) => (fieldRefs.current[id] = n)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
        />
      ) : (
        <div className="space-y-1">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
          <div className="flex gap-2 items-center">
            <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? "Uploading…" : value ? "Replace file" : "Choose file"}
            </Button>
            {value && (
              <a href={value} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate">
                View uploaded file
              </a>
            )}
          </div>
        </div>
      )}
    </FieldShell>
  );
}

function Step3({ form, set, errors, fieldRefs }: StepProps) {
  return (
    <div className="space-y-4">
      <SectionTitle>3. Documents shared</SectionTitle>
      <Grid>
        <DocSlot id="sow_url" label="SoW document" required value={form.sow_url} error={errors.sow_url} onChange={(v) => set("sow_url", v)} fieldRefs={fieldRefs} />
        <DocSlot id="strategy_deck_url" label="Strategy deck" value={form.strategy_deck_url} onChange={(v) => set("strategy_deck_url", v)} fieldRefs={fieldRefs} />
        <DocSlot id="keywords_url" label="Keywords & projections" value={form.keywords_url} onChange={(v) => set("keywords_url", v)} fieldRefs={fieldRefs} />
        <DocSlot id="geo_audit_url" label="GEO audit deck" value={form.geo_audit_url} onChange={(v) => set("geo_audit_url", v)} fieldRefs={fieldRefs} />
        <DocSlot id="fireflies_url" label="Fireflies link" value={form.fireflies_url} onChange={(v) => set("fireflies_url", v)} fieldRefs={fieldRefs} />
      </Grid>
      <FieldShell id="docs_notes" label="Notes on documents">
        <Textarea id="docs_notes" rows={3} value={form.docs_notes} onChange={(e) => set("docs_notes", e.target.value)} />
      </FieldShell>
    </div>
  );
}

/* ─── Step 4: Deal ────────────────────────────────────── */
function Step4({ form, set, errors, fieldRefs }: StepProps) {
  // Auto-calc total amount for retainer = MRR x duration
  useEffect(() => {
    if (form.deal_type !== "Retainer") return;
    const months = Number(form.duration_months || 0);
    if (form.mrr != null && months > 0) {
      const computed = Math.round(form.mrr * months);
      if (form.total_amount !== computed) set("total_amount", computed);
    }
  }, [form.deal_type, form.mrr, form.duration_months]); // eslint-disable-line
  const totalLocked = form.deal_type === "Retainer";
  return (
    <div className="space-y-4">
      <SectionTitle>4. Deal details</SectionTitle>
      <Grid>
        <FieldShell id="stage" label="Opportunity stage" required error={errors.stage}>
          <div ref={(n) => (fieldRefs.current.stage = n)}>
            <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
              <SelectTrigger id="stage"><SelectValue placeholder="Select stage" /></SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </FieldShell>
        <FieldShell id="bu" label="Pepper BU" required error={errors.bu}>
          <div ref={(n) => (fieldRefs.current.bu = n)}>
            <Select value={form.bu} onValueChange={(v) => set("bu", v)}>
              <SelectTrigger id="bu"><SelectValue placeholder="Select BU" /></SelectTrigger>
              <SelectContent>
                {BU_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </FieldShell>
        <FieldShell id="capability" label="Capability line" required error={errors.capability}>
          <div ref={(n) => (fieldRefs.current.capability = n)}>
            <Select value={form.capability} onValueChange={(v) => set("capability", v)}>
              <SelectTrigger id="capability"><SelectValue placeholder="Select capability" /></SelectTrigger>
              <SelectContent>
                {CAPABILITY_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </FieldShell>
        <FieldShell id="deal_type" label="Deal type" required error={errors.deal_type}>
          <div
            ref={(n) => (fieldRefs.current.deal_type = n)}
            className="flex gap-2"
          >
            {(["Retainer", "Non-retainer"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  set("deal_type", t);
                  if (t === "Non-retainer") set("mrr", null);
                }}
                className={cn(
                  "px-3 py-2 rounded-md border text-sm",
                  form.deal_type === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </FieldShell>
        {form.deal_type === "Retainer" && (
          <FieldShell id="mrr" label="MRR" required error={errors.mrr}>
            <CurrencyInput
              id="mrr"
              ref={(n) => (fieldRefs.current.mrr = n as HTMLElement | null)}
              value={form.mrr}
              onChange={(v) => set("mrr", v)}
              placeholder="e.g. 5,00,000"
            />
          </FieldShell>
        )}
        <FieldShell id="duration_months" label="Duration (months)">
          <Input
            id="duration_months"
            type="number"
            min={0}
            value={form.duration_months}
            onChange={(e) => set("duration_months", e.target.value)}
          />
        </FieldShell>
        <FieldShell
          id="total_amount"
          label="Total amount"
          required
          error={errors.total_amount}
          hint={totalLocked ? "Auto-calculated = MRR × Duration" : undefined}
        >
          <CurrencyInput
            id="total_amount"
            ref={(n) => (fieldRefs.current.total_amount = n as HTMLElement | null)}
            value={form.total_amount}
            onChange={(v) => set("total_amount", v)}
            placeholder="e.g. 60,00,000"
            disabled={totalLocked}
          />
        </FieldShell>
        <FieldShell id="start_date" label="Actual / Tentative start date" required error={errors.start_date}>
          <Input
            id="start_date"
            type="date"
            ref={(n) => (fieldRefs.current.start_date = n)}
            value={form.start_date}
            onChange={(e) => set("start_date", e.target.value)}
          />
        </FieldShell>
      </Grid>
      <FieldShell id="deal_notes" label="Special terms / context">
        <Textarea id="deal_notes" rows={3} value={form.deal_notes} onChange={(e) => set("deal_notes", e.target.value)} />
      </FieldShell>
    </div>
  );
}

/* ─── Review ──────────────────────────────────────────── */
function Review({ form, onEdit }: { form: HandoverForm; onEdit: (i: number) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Review &amp; submit</SectionTitle>
      <Group title="Salesperson" onEdit={() => onEdit(0)}>
        <Row k="Full name" v={form.sp_name} />
        <Row k="Work email" v={form.sp_email} />
        <Row k="Sales team / region" v={form.sp_team} />
        <Row k="Handover date" v={form.handover_date} />
      </Group>
      <Group title="Client" onEdit={() => onEdit(1)}>
        <Row k="Company" v={form.company_name} />
        <Row k="Industry" v={form.industry} />
        <Row k="Website" v={form.website} />
        <div className="text-sm">
          <div className="text-muted-foreground text-xs mb-1">Contacts</div>
          <ul className="space-y-1">
            {form.contacts.map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.name}</span>
                {c.role && <span className="text-muted-foreground"> — {c.role}</span>}
                <div className="text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ")}</div>
              </li>
            ))}
          </ul>
        </div>
      </Group>
      <Group title="Documents" onEdit={() => onEdit(2)}>
        <Row k="SoW" v={form.sow_url} />
        <Row k="Strategy deck" v={form.strategy_deck_url} />
        <Row k="Keywords & projections" v={form.keywords_url} />
        <Row k="GEO audit deck" v={form.geo_audit_url} />
        <Row k="Fireflies" v={form.fireflies_url} />
        <Row k="Notes" v={form.docs_notes} />
      </Group>
      <Group title="Deal" onEdit={() => onEdit(3)}>
        <Row k="Opportunity stage" v={form.stage} />
        <Row k="Pepper BU" v={form.bu} />
        <Row k="Capability line" v={form.capability} />
        <Row k="Deal type" v={form.deal_type} />
        {form.deal_type === "Retainer" && (
          <Row k="MRR" v={form.mrr != null ? `₹${formatINR(form.mrr)} ${currencyHelper(form.mrr).replace("= ", "(") + ")"}` : ""} />
        )}
        <Row k="Total amount" v={form.total_amount != null ? `₹${formatINR(form.total_amount)} ${currencyHelper(form.total_amount).replace("= ", "(") + ")"}` : ""} />
        <Row k="Duration" v={form.duration_months ? `${form.duration_months} months` : ""} />
        <Row k="Start date" v={form.start_date} />
        <Row k="Assigned VSD" v={form.vsd_suggested} />
        <Row k="Special terms" v={form.deal_notes} />
      </Group>
    </div>
  );
}

function Group({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
      </div>
      <div className="space-y-1">{children}</div>
    </Card>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex text-sm gap-3">
      <span className="text-muted-foreground w-40 flex-shrink-0">{k}</span>
      <span className="flex-1 break-words">{v || <span className="text-muted-foreground italic">—</span>}</span>
    </div>
  );
}

/* ─── Submitted confirmation ──────────────────────────── */
function SubmittedStep({
  form,
  reference,
  submitted_at,
  onNew,
}: {
  form: HandoverForm;
  reference: string;
  submitted_at: string;
  onNew: () => void;
}) {
  const buildDigest = () => {
    const lines: string[] = [];
    lines.push(`Handover ${reference}`);
    lines.push(`Submitted: ${new Date(submitted_at).toLocaleString()}`);
    lines.push("");
    lines.push("Salesperson");
    lines.push(`  ${form.sp_name} <${form.sp_email}>`);
    if (form.sp_team) lines.push(`  Team: ${form.sp_team}`);
    lines.push(`  Handover date: ${form.handover_date}`);
    lines.push("");
    lines.push("Client");
    lines.push(`  ${form.company_name}`);
    if (form.industry) lines.push(`  Industry: ${form.industry}`);
    lines.push(`  Website: ${form.website}`);
    lines.push("  Contacts:");
    form.contacts.forEach((c) => {
      lines.push(`   - ${c.name}${c.role ? ` (${c.role})` : ""} — ${c.email}${c.phone ? ` · ${c.phone}` : ""}`);
    });
    lines.push("");
    lines.push("Documents");
    if (form.sow_url) lines.push(`  SoW: ${form.sow_url}`);
    if (form.strategy_deck_url) lines.push(`  Strategy: ${form.strategy_deck_url}`);
    if (form.keywords_url) lines.push(`  Keywords: ${form.keywords_url}`);
    if (form.geo_audit_url) lines.push(`  GEO audit: ${form.geo_audit_url}`);
    if (form.fireflies_url) lines.push(`  Fireflies: ${form.fireflies_url}`);
    if (form.docs_notes) lines.push(`  Notes: ${form.docs_notes}`);
    lines.push("");
    lines.push("Deal");
    lines.push(`  Stage: ${form.stage}`);
    lines.push(`  BU: ${form.bu}`);
    lines.push(`  Capability: ${form.capability}`);
    lines.push(`  Type: ${form.deal_type}`);
    if (form.deal_type === "Retainer") lines.push(`  MRR: ₹${formatINR(form.mrr)} ${currencyHelper(form.mrr)}`);
    lines.push(`  Total: ₹${formatINR(form.total_amount)} ${currencyHelper(form.total_amount)}`);
    if (form.duration_months) lines.push(`  Duration: ${form.duration_months} months`);
    lines.push(`  Start: ${form.start_date}`);
    if (form.vsd_suggested) lines.push(`  Assigned VSD: ${form.vsd_suggested}`);
    if (form.deal_notes) lines.push(`  Notes: ${form.deal_notes}`);
    return lines.join("\n");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildDigest());
      toast({ title: "Copied", description: "Handover summary copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <Card className="p-8 space-y-4 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
        <Check className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold">Handover submitted</h2>
      <p className="text-sm text-muted-foreground">
        Reference <span className="font-mono font-medium text-foreground">{reference}</span><br />
        Arya, Anirudh and Priyanka have been notified.
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <Button variant="outline" onClick={copy}>
          <Copy className="h-4 w-4 mr-1" /> Copy handover summary
        </Button>
        <Button onClick={onNew}>New handover</Button>
      </div>
    </Card>
  );
}
