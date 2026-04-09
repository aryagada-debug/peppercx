import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Client } from "@/hooks/useClients";

const LEAD_SOURCES = ["Inbound", "Outbound", "Referral"];
const ACCOUNT_STATUSES = ["Active", "Inactive", "Prospect", "Churned"];
const GEOGRAPHIES = ["India", "US", "UK", "Middle East", "Southeast Asia", "Europe", "Global"];
const INDUSTRIES = [
  "Technology", "FMCG", "BFSI", "Healthcare", "Education", "E-commerce",
  "Real Estate", "Automotive", "Travel & Hospitality", "Media & Entertainment",
  "SaaS", "D2C", "Manufacturing", "Logistics", "Other",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (client: Omit<Client, "id">) => Promise<any>;
  initial?: Partial<Client>;
  title?: string;
}

export function ClientFormDialog({ open, onOpenChange, onSubmit, initial, title = "Add Client" }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<Client, "id">>({
    name: initial?.name || "",
    website: initial?.website || "",
    salesPoc: initial?.salesPoc || "",
    industry: initial?.industry || "",
    pcCode: initial?.pcCode || "",
    accountStatus: initial?.accountStatus || "Active",
    signingEntity: initial?.signingEntity || "",
    geography: initial?.geography || "",
    dailyPocName: initial?.dailyPocName || "",
    dailyPocPhone: initial?.dailyPocPhone || "",
    dailyPocLinkedin: initial?.dailyPocLinkedin || "",
    homPocName: initial?.homPocName || "",
    homPocPhone: initial?.homPocPhone || "",
    homPocLinkedin: initial?.homPocLinkedin || "",
    leadSource: initial?.leadSource || "",
    competitorInvolved: initial?.competitorInvolved || "",
    notes: initial?.notes || "",
    billingAddress: initial?.billingAddress || "",
    gstNumber: initial?.gstNumber || "",
    contractSignedDate: initial?.contractSignedDate || null,
    ndaSigned: initial?.ndaSigned || false,
  });

  const set = (key: keyof typeof form, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSubmit(form);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh] px-6 pb-6">
          <div className="space-y-6 pt-4">
            {/* Basic Info */}
            <Section title="Basic Information">
              <Field label="Client Name *">
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Air India Express" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Website">
                  <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://..." />
                </Field>
                <Field label="PC Code">
                  <Input value={form.pcCode} onChange={e => set("pcCode", e.target.value)} placeholder="PC-XXXX" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Industry">
                  <Select value={form.industry} onValueChange={v => set("industry", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Geography">
                  <Select value={form.geography} onValueChange={v => set("geography", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{GEOGRAPHIES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Account Status">
                  <Select value={form.accountStatus} onValueChange={v => set("accountStatus", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ACCOUNT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Lead Source">
                  <Select value={form.leadSource} onValueChange={v => set("leadSource", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{LEAD_SOURCES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sales POC">
                  <Input value={form.salesPoc} onChange={e => set("salesPoc", e.target.value)} />
                </Field>
                <Field label="Signing Entity">
                  <Input value={form.signingEntity} onChange={e => set("signingEntity", e.target.value)} />
                </Field>
              </div>
              <Field label="Competitor Involved">
                <Input value={form.competitorInvolved} onChange={e => set("competitorInvolved", e.target.value)} />
              </Field>
            </Section>

            {/* POC Info */}
            <Section title="Daily POC">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Name"><Input value={form.dailyPocName} onChange={e => set("dailyPocName", e.target.value)} /></Field>
                <Field label="Phone"><Input value={form.dailyPocPhone} onChange={e => set("dailyPocPhone", e.target.value)} /></Field>
                <Field label="LinkedIn"><Input value={form.dailyPocLinkedin} onChange={e => set("dailyPocLinkedin", e.target.value)} /></Field>
              </div>
            </Section>

            <Section title="Head of Marketing POC">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Name"><Input value={form.homPocName} onChange={e => set("homPocName", e.target.value)} /></Field>
                <Field label="Phone"><Input value={form.homPocPhone} onChange={e => set("homPocPhone", e.target.value)} /></Field>
                <Field label="LinkedIn"><Input value={form.homPocLinkedin} onChange={e => set("homPocLinkedin", e.target.value)} /></Field>
              </div>
            </Section>

            {/* Billing & Legal */}
            <Section title="Billing & Legal">
              <div className="grid grid-cols-2 gap-3">
                <Field label="GST Number"><Input value={form.gstNumber} onChange={e => set("gstNumber", e.target.value)} /></Field>
                <Field label="Contract Signed Date"><Input type="date" value={form.contractSignedDate || ""} onChange={e => set("contractSignedDate", e.target.value || null)} /></Field>
              </div>
              <Field label="Billing Address">
                <Textarea value={form.billingAddress} onChange={e => set("billingAddress", e.target.value)} rows={2} />
              </Field>
              <div className="flex items-center gap-2">
                <Checkbox checked={form.ndaSigned} onCheckedChange={v => set("ndaSigned", !!v)} id="nda" />
                <Label htmlFor="nda">NDA Signed</Label>
              </div>
            </Section>

            <Field label="Notes">
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Any additional notes..." />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving || !form.name.trim()}>
                {saving ? "Saving..." : "Save Client"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-ui font-bold text-foreground mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-caption text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
