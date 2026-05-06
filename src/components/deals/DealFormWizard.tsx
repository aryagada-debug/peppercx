import { useState, useRef } from "react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Plus, Trash2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client } from "@/hooks/useClients";
import { CurrencyInput } from "@/components/ui/currency-input";

const PODS = ["Integrated", "India B2B", "US B2B", "FMCG", "BFSI"] as const;
const DEAL_TYPES = ["Retainer", "Non-Retainer", "Pilot"] as const;
const PEPPER_BUS = ["Pepper SEO/GEO+Content", "Pepper Content", "Pepper Creative", "Integrated", "Content Studio"] as const;
const DEAL_STATUSES = ["Won", "Negotiation", "Pipeline", "Lost"] as const;
const PAYMENT_TERMS = ["Net 15", "Net 30", "Net 45", "Net 60", "Advance", "Milestone-based"] as const;

interface PersonOption { id: string; name: string; role_title: string; designation: string | null; }

interface SoWItem { scope: string; revenueShare: number; teamCapability: string; }
interface SuccessMetric { name: string; value: string; unit: string; frequency: string; }

interface DealFormData {
  dealName: string;
  dealType: string;
  startDate: string;
  endDate: string;
  mrr: string;
  totalDealValue: string;
  retainerDealValue: string;
  nonRetainerDealValue: string;
  inputCurrency: string;
  vsd: string;
  principalBopm: string;
  seniorBopm: string;
  bopm: string;
  paymentTerms: string;
  pepperBusinessUnit: string;
  pod: string;
  dealStatus: string;
  pcCode: string;
  capabilityLine: string;
  customerType: string;
  sowItems: SoWItem[];
  successMetrics: SuccessMetric[];
  projectedOutcomes: string;
  baselineMetrics: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  preSelectedClientId?: string;
  onCreateClient: () => void;
  onSubmit: (clientId: string, data: DealFormData) => Promise<void>;
}

const STEPS = ["Select Client", "Deal Details", "Scope of Work", "Outcomes & Metrics"];

export function DealFormWizard({ open, onOpenChange, clients, preSelectedClientId, onCreateClient, onSubmit }: Props) {
  const [step, setStep] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState(preSelectedClientId || "");
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [people, setPeople] = useState<PersonOption[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase.from("staffing_people")
      .select("id, name, role_title, designation")
      .eq("tbh", false)
      .order("name")
      .then(({ data }) => setPeople((data as PersonOption[]) || []));
  }, [open]);

  const peopleByRole = (role: string) => people.filter(p => (p.role_title || "").trim().toLowerCase() === role.toLowerCase());

  const [form, setForm] = useState<DealFormData>({
    dealName: "", dealType: "Retainer", startDate: "", endDate: "",
    mrr: "", totalDealValue: "", retainerDealValue: "", nonRetainerDealValue: "",
    inputCurrency: "INR",
    vsd: "", principalBopm: "", seniorBopm: "", bopm: "",
    paymentTerms: "", pepperBusinessUnit: "", pod: "", dealStatus: "Won",
    pcCode: "", capabilityLine: "", customerType: "",
    sowItems: [{ scope: "", revenueShare: 0, teamCapability: "" }],
    successMetrics: [{ name: "", value: "", unit: "", frequency: "" }],
    projectedOutcomes: "", baselineMetrics: "",
  });

  const set = (key: keyof DealFormData, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const canNext = () => {
    if (step === 0) return !!selectedClientId;
    if (step === 1) return !!form.dealName.trim();
    return true;
  };

  const handleSubmit = async () => {
    setSaving(true);
    await onSubmit(selectedClientId, form);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Create New Deal</DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <button
                  onClick={() => i < step && setStep(i)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium transition-colors",
                    i === step ? "bg-primary text-primary-foreground" :
                    i < step ? "bg-accent text-accent-foreground cursor-pointer" :
                    "bg-secondary text-muted-foreground"
                  )}
                >
                  <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                  {s}
                </button>
                {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] px-6 pb-6">
          <div className="pt-4 space-y-4">
            {/* Step 0: Select Client */}
            {step === 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientPopoverOpen}
                        className="flex-1 justify-start font-normal"
                      >
                        {selectedClientId
                          ? clients.find(c => c.id === selectedClientId)?.name ?? "Select client…"
                          : "Search clients…"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Type client name…" value={clientSearch} onValueChange={setClientSearch} />
                        <CommandList>
                          <CommandEmpty>
                            No clients found.{" "}
                            <button onClick={() => { setClientPopoverOpen(false); onCreateClient(); }} className="text-primary hover:underline">
                              Create one
                            </button>
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredClients.map(c => (
                              <CommandItem
                                key={c.id}
                                value={`${c.name} ${c.industry} ${c.geography}`}
                                onSelect={() => {
                                  setSelectedClientId(c.id);
                                  setClientPopoverOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedClientId === c.id ? "opacity-100" : "opacity-0")} />
                                <div>
                                  <p className="font-medium">{c.name}</p>
                                  <p className="text-caption text-muted-foreground">{c.industry} • {c.geography}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="sm" onClick={onCreateClient}>
                    <Plus className="h-4 w-4 mr-1" /> New Client
                  </Button>
                </div>
                {selectedClientId && (() => {
                  const sel = clients.find(c => c.id === selectedClientId);
                  return sel ? (
                    <div className="border border-primary/30 bg-accent/40 rounded-lg px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{sel.name}</p>
                        <p className="text-caption text-muted-foreground">{sel.industry} • {sel.geography}</p>
                      </div>
                      <span className="text-primary text-caption font-medium">Selected ✓</span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Step 1: Deal Details */}
            {step === 1 && (
              <div className="space-y-4">
                <Field label="Deal Name *">
                  <Input value={form.dealName} onChange={e => set("dealName", e.target.value)} placeholder="e.g. Air India_Jan-2025" />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Deal Type">
                    <Select value={form.dealType} onValueChange={v => set("dealType", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DEAL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Deal Status">
                    <Select value={form.dealStatus} onValueChange={v => set("dealStatus", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DEAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="PC Code">
                    <Input value={form.pcCode} onChange={e => set("pcCode", e.target.value)} placeholder="PC-XXXX" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start Date"><Input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} /></Field>
                  <Field label="End Date"><Input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Pepper Business Unit">
                    <Select value={form.pepperBusinessUnit} onValueChange={v => set("pepperBusinessUnit", v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{PEPPER_BUS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Pod">
                    <Select value={form.pod} onValueChange={v => set("pod", v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{PODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="MRR">
                    <CurrencyInput
                      valueInr={form.mrr}
                      onChangeInr={(n) => set("mrr", n ? String(n) : "")}
                      defaultCurrency={form.inputCurrency as any}
                      onCurrencyChange={(c) => set("inputCurrency", c)}
                    />
                  </Field>
                  <Field label="Total Deal Value">
                    <CurrencyInput
                      valueInr={form.totalDealValue}
                      onChangeInr={(n) => set("totalDealValue", n ? String(n) : "")}
                      defaultCurrency={form.inputCurrency as any}
                      onCurrencyChange={(c) => set("inputCurrency", c)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Retainer Value">
                    <CurrencyInput
                      valueInr={form.retainerDealValue}
                      onChangeInr={(n) => set("retainerDealValue", n ? String(n) : "")}
                      defaultCurrency={form.inputCurrency as any}
                      onCurrencyChange={(c) => set("inputCurrency", c)}
                    />
                  </Field>
                  <Field label="Non-Retainer Value">
                    <CurrencyInput
                      valueInr={form.nonRetainerDealValue}
                      onChangeInr={(n) => set("nonRetainerDealValue", n ? String(n) : "")}
                      defaultCurrency={form.inputCurrency as any}
                      onCurrencyChange={(c) => set("inputCurrency", c)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Payment Terms">
                    <Select value={form.paymentTerms} onValueChange={v => set("paymentTerms", v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Customer Type">
                    <Input value={form.customerType} onChange={e => set("customerType", e.target.value)} placeholder="e.g. Enterprise" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="VSD">
                    <PersonCombobox value={form.vsd} onChange={v => set("vsd", v)} options={peopleByRole("VSD")} placeholder="Select VSD" />
                  </Field>
                  <Field label="Principal BOPM">
                    <PersonCombobox value={form.principalBopm} onChange={v => set("principalBopm", v)} options={peopleByRole("Principal BOPM")} placeholder="Select Principal BOPM" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Senior BOPM">
                    <PersonCombobox value={form.seniorBopm} onChange={v => set("seniorBopm", v)} options={peopleByRole("Senior BOPM")} placeholder="Select Senior BOPM" />
                  </Field>
                  <Field label="Junior BOPM">
                    <PersonCombobox value={form.bopm} onChange={v => set("bopm", v)} options={peopleByRole("BOPM")} placeholder="Select BOPM" />
                  </Field>
                </div>
                <Field label="Capability Line">
                  <Input value={form.capabilityLine} onChange={e => set("capabilityLine", e.target.value)} />
                </Field>
              </div>
            )}

            {/* Step 2: Scope of Work */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-ui font-bold text-foreground">SoW Line Items</h3>
                  <Button variant="outline" size="sm" onClick={() => set("sowItems", [...form.sowItems, { scope: "", revenueShare: 0, teamCapability: "" }])}>
                    <Plus className="h-4 w-4 mr-1" /> Add Item
                  </Button>
                </div>
                {form.sowItems.map((item, idx) => (
                  <div key={idx} className="border border-border rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-caption text-muted-foreground font-medium">Item {idx + 1}</span>
                      {form.sowItems.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => set("sowItems", form.sowItems.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <Field label="Scope">
                      <Input value={item.scope} onChange={e => {
                        const items = [...form.sowItems];
                        items[idx] = { ...items[idx], scope: e.target.value };
                        set("sowItems", items);
                      }} placeholder="e.g. Content Strategy & Execution" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Revenue Share">
                        <CurrencyInput
                          valueInr={item.revenueShare || ""}
                          onChangeInr={(n) => {
                            const items = [...form.sowItems];
                            items[idx] = { ...items[idx], revenueShare: n };
                            set("sowItems", items);
                          }}
                        />
                      </Field>
                      <Field label="Team / Capability">
                        <Input value={item.teamCapability} onChange={e => {
                          const items = [...form.sowItems];
                          items[idx] = { ...items[idx], teamCapability: e.target.value };
                          set("sowItems", items);
                        }} placeholder="e.g. SEO, Content, Creative" />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 3: Outcomes & Metrics */}
            {step === 3 && (
              <div className="space-y-4">
                <Field label="Projected Outcomes">
                  <Textarea value={form.projectedOutcomes} onChange={e => set("projectedOutcomes", e.target.value)} rows={3} placeholder="Describe expected outcomes..." />
                </Field>
                <Field label="Baseline Metrics">
                  <Textarea value={form.baselineMetrics} onChange={e => set("baselineMetrics", e.target.value)} rows={2} placeholder="Current baseline..." />
                </Field>

                <div className="flex items-center justify-between">
                  <h3 className="text-ui font-bold text-foreground">Success Metrics</h3>
                  <Button variant="outline" size="sm" onClick={() => set("successMetrics", [...form.successMetrics, { name: "", value: "", unit: "", frequency: "" }])}>
                    <Plus className="h-4 w-4 mr-1" /> Add Metric
                  </Button>
                </div>
                {form.successMetrics.map((m, idx) => (
                  <div key={idx} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-caption text-muted-foreground font-medium">Metric {idx + 1}</span>
                      {form.successMetrics.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => set("successMetrics", form.successMetrics.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Metric Name">
                        <Input value={m.name} onChange={e => {
                          const metrics = [...form.successMetrics];
                          metrics[idx] = { ...metrics[idx], name: e.target.value };
                          set("successMetrics", metrics);
                        }} placeholder="e.g. Organic Traffic" />
                      </Field>
                      <Field label="Target Value">
                        <Input value={m.value} onChange={e => {
                          const metrics = [...form.successMetrics];
                          metrics[idx] = { ...metrics[idx], value: e.target.value };
                          set("successMetrics", metrics);
                        }} placeholder="e.g. 50000" />
                      </Field>
                      <Field label="Unit">
                        <Input value={m.unit} onChange={e => {
                          const metrics = [...form.successMetrics];
                          metrics[idx] = { ...metrics[idx], unit: e.target.value };
                          set("successMetrics", metrics);
                        }} placeholder="e.g. visits/month" />
                      </Field>
                      <Field label="Frequency">
                        <Input value={m.frequency} onChange={e => {
                          const metrics = [...form.successMetrics];
                          metrics[idx] = { ...metrics[idx], frequency: e.target.value };
                          set("successMetrics", metrics);
                        }} placeholder="e.g. Monthly" />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Nav */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <Button variant="ghost" onClick={() => step > 0 ? setStep(step - 1) : onOpenChange(false)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving || !form.dealName.trim()}>
              {saving ? "Creating..." : "Create Deal"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
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

function PersonCombobox({
  value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: PersonOption[]; placeholder: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
          <ChevronRight className="h-3.5 w-3.5 opacity-50 rotate-90" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No people found.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem value="__clear__" onSelect={() => { onChange(""); setOpen(false); }}>
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  <span className="text-muted-foreground">Clear selection</span>
                </CommandItem>
              )}
              {options.map(p => (
                <CommandItem key={p.id} value={p.name} onSelect={() => { onChange(p.name); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === p.name ? "opacity-100" : "opacity-0")} />
                  <div>
                    <p className="font-medium">{p.name}</p>
                    {p.designation && <p className="text-caption text-muted-foreground">{p.designation}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
