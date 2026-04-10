import { AppLayout } from "@/components/layout/AppLayout";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2, Pencil, Check, X, Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback } from "react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { useDealDetail } from "@/hooks/useDealDetail";
import { EditableRGY } from "@/components/deals/EditableRGY";
import { FinancialsTab } from "@/components/deals/FinancialsTab";
import { TaskKanban } from "@/components/deals/TaskKanban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const fmtCurrency = (n: number | undefined) => {
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

const fmtDate = (d: string | undefined) => {
  if (!d) return "Not set";
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
};

const TABS = ["Overview", "Staffing", "Financials", "Tasks", "RGY Health", "MBR", "Onboarding"] as const;
type TabKey = typeof TABS[number];

const rgyColors: Record<string, string> = { G: "rgy-green", R: "rgy-red", Y: "rgy-yellow" };

// ── Editable Cell ──
function EditableCell({ value, onSave, type = "text", prefix = "", placeholder = "—" }: { value: string; onSave: (v: string) => void; type?: string; prefix?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input value={local} onChange={e => setLocal(e.target.value)} type={type} className="h-7 text-sm w-full" autoFocus onKeyDown={e => { if (e.key === "Enter") { onSave(local); setEditing(false); } if (e.key === "Escape") { setLocal(value); setEditing(false); } }} />
        <button onClick={() => { onSave(local); setEditing(false); }} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={() => { setLocal(value); setEditing(false); }} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1.5 cursor-pointer" onClick={() => setEditing(true)}>
      <span className={cn("text-sm font-medium", value ? "text-foreground" : "text-muted-foreground")}>{prefix}{value || placeholder}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ── Financial Metric Card ──
function FinancialMetricCard({ label, value, subLabel, onSave }: { label: string; value: string; subLabel: string; onSave: (v: string) => void }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <EditableCell value={value} onSave={onSave} type="number" prefix="₹" placeholder="—" />
      <p className="text-xs text-muted-foreground mt-0.5">{subLabel}</p>
    </div>
  );
}

// ── Team Member Row ──
function TeamMemberRow({ name, role, color, onSave }: { name: string; role: string; color: string; onSave: (v: string) => void }) {
  const initials = name && name !== "Not assigned"
    ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  const isUnassigned = !name || name === "Not assigned";

  return (
    <div className="flex items-center gap-3 py-2">
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0", color)}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <EditableCell value={isUnassigned ? "" : name} onSave={onSave} placeholder="Not assigned" />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{role}</span>
    </div>
  );
}

export default function DealDetail() {
  const { dealId } = useParams();
  const [activeTab, setActiveTab] = useState<TabKey>("Overview");
  const { deals, people, assignments, loading: staffLoading, updateDeal, updatePerson } = useStaffingData();
  const {
    sowItems, rgyWeekly, onboarding, financials, tasks, loading: detailLoading,
    toggleOnboardingStep, addSoWItem, updateSoWItem, deleteSoWItem,
    addRGYWeek, updateRGYWeek, addFinancial, updateFinancial, deleteFinancial,
    addTask, updateTask, deleteTask, seedOnboarding,
  } = useDealDetail(dealId);

  const deal = useMemo(() => deals.find(d => d.id === dealId), [deals, dealId]);
  const dealAssignments = useMemo(() => assignments.filter(a => a.dealId === dealId), [assignments, dealId]);
  const dealPeople = useMemo(() => {
    const personIds = new Set(dealAssignments.map(a => a.personId));
    return people.filter(p => personIds.has(p.id));
  }, [dealAssignments, people]);

  const onboardingPct = useMemo(() => {
    if (!onboarding.length) return 0;
    return Math.round((onboarding.filter(s => s.completed).length / onboarding.length) * 100);
  }, [onboarding]);

  const handleDealFieldSave = useCallback((field: string, value: string) => {
    if (!dealId) return;
    const numFields = ["mrr", "totalDealValue", "retainerDealValue", "nonRetainerDealValue", "netDealValue"];
    const v = numFields.includes(field) ? Number(value) || undefined : value;
    updateDeal(dealId, { [field]: v });
    toast.success("Updated");
  }, [dealId, updateDeal]);

  // Progress & renewal calculations
  const progressInfo = useMemo(() => {
    if (!deal?.startDate || !deal?.endDate) return null;
    const start = new Date(deal.startDate);
    const end = new Date(deal.endDate);
    const today = new Date();
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const pct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
    const daysRemaining = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    return { pct, daysRemaining, totalDays, startLabel: fmtDate(deal.startDate), endLabel: fmtDate(deal.endDate) };
  }, [deal?.startDate, deal?.endDate]);

  // Current week's RGY for overview
  const currentRGY = useMemo(() => {
    if (rgyWeekly.length > 0) return rgyWeekly[0];
    return null;
  }, [rgyWeekly]);

  const handleRGYSave = useCallback((dims: any[]) => {
    if (!dealId) return;
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekStart = monday.toISOString().split("T")[0];

    const rgyData: Record<string, string> = {};
    const planParts: string[] = [];
    dims.forEach(d => {
      rgyData[d.key] = d.value;
      if (d.planOfAction) planParts.push(`${d.label}: ${d.planOfAction}`);
    });

    if (currentRGY && currentRGY.weekStart === weekStart) {
      updateRGYWeek(currentRGY.id, {
        accountHealth: rgyData.accountHealth || "G",
        delivery: rgyData.delivery || "G",
        financeBilling: rgyData.financeBilling || "G",
        capabilitySeo: rgyData.capabilitySeo || "G",
        capabilityCreative: rgyData.capabilityCreative || "G",
        planOfAction: planParts.join("; "),
      });
    } else {
      addRGYWeek({
        dealId,
        weekStart,
        internal: rgyData.accountHealth || "G",
        customer: "G",
        delivery: rgyData.delivery || "G",
        consumption: "G",
        accountHealth: rgyData.accountHealth || "G",
        financeBilling: rgyData.financeBilling || "G",
        capabilitySeo: rgyData.capabilitySeo || "G",
        capabilityCreative: rgyData.capabilityCreative || "G",
        planOfAction: planParts.join("; "),
      });
    }
    toast.success("RGY health saved");
  }, [dealId, currentRGY, addRGYWeek, updateRGYWeek]);

  // SoW add
  const [addingSoW, setAddingSoW] = useState(false);
  const [newSoW, setNewSoW] = useState({ scope: "", revenueShare: 0, teamCapability: "" });

  if (staffLoading || detailLoading) {
    return <AppLayout><div className="p-8 flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  if (!deal) {
    return <AppLayout><div className="p-8"><Link to="/clients" className="text-primary hover:underline text-sm">← Back to Clients</Link><p className="mt-4 text-muted-foreground">Deal not found.</p></div></AppLayout>;
  }

  const subtitle = [deal.serviceLineTagging || deal.capabilityLine, deal.account].filter(Boolean).join(" · ");

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-6xl">
        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-6">
          <Link to="/clients" className="h-9 w-9 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors mt-1 shrink-0" aria-label="Back to clients">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">{deal.dealName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {deal.dealType}
            </span>
            <span className={cn(
              "inline-flex px-3 py-1 rounded-full text-xs font-medium",
              (deal.dealStatusCx || deal.dealStatus) === "Active"
                ? "bg-[hsl(142_60%_96%)] text-[hsl(142_60%_30%)]"
                : "bg-secondary text-muted-foreground"
            )}>
              {deal.dealStatusCx || deal.dealStatus}
            </span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="border-b border-border mb-6">
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>{tab}</button>
            ))}
          </div>
        </div>

        {/* ══════════ Overview ══════════ */}
        {activeTab === "Overview" && (
          <div className="space-y-6 animate-fade-in">
            {/* ── Financial Snapshot ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Financial Snapshot</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <FinancialMetricCard label="MRR" value={String(deal.mrr || "")} subLabel="Monthly recurring" onSave={v => handleDealFieldSave("mrr", v)} />
                <FinancialMetricCard label="Total Value" value={String(deal.totalDealValue || "")} subLabel="Contract total" onSave={v => handleDealFieldSave("totalDealValue", v)} />
                <FinancialMetricCard label="Retainer Value" value={String(deal.retainerDealValue || "")} subLabel="Of total value" onSave={v => handleDealFieldSave("retainerDealValue", v)} />
                <FinancialMetricCard label="Non-Retainer" value={String(deal.nonRetainerDealValue || "")} subLabel="Non-retainer portion" onSave={v => handleDealFieldSave("nonRetainerDealValue", v)} />
              </div>
            </div>

            {/* ── Contract Details + Team ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Contract Details */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Contract Details</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Payment Terms</span>
                    <EditableCell value={deal.paymentTerms || ""} onSave={v => handleDealFieldSave("paymentTerms", v)} placeholder="Not set" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Duration</span>
                    <EditableCell value={deal.duration || ""} onSave={v => handleDealFieldSave("duration", v)} placeholder="Not set" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Service Line</span>
                    <EditableCell value={deal.serviceLineTagging || deal.capabilityLine || ""} onSave={v => handleDealFieldSave("serviceLineTagging", v)} placeholder="Not set" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Start Date</span>
                    <EditableCell value={deal.startDate || ""} onSave={v => handleDealFieldSave("startDate", v)} type="date" placeholder="Not set" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">End Date</span>
                    <EditableCell value={deal.endDate || ""} onSave={v => handleDealFieldSave("endDate", v)} type="date" placeholder="Not set" />
                  </div>
                </div>

                {/* Progress bar */}
                {progressInfo && (
                  <div className="mt-5 pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>{progressInfo.startLabel}</span>
                      <span>{progressInfo.endLabel}</span>
                    </div>
                    <Progress value={progressInfo.pct} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {progressInfo.pct}% complete · {progressInfo.daysRemaining} days remaining
                    </p>
                    <div className="mt-3">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-[hsl(38_92%_95%)] text-[hsl(38_80%_35%)]">
                        Renews in {progressInfo.daysRemaining} days
                      </span>
                    </div>
                  </div>
                )}
                {!progressInfo && (
                  <div className="mt-5 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">Set start and end dates to see progress.</p>
                  </div>
                )}
              </div>

              {/* Team */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Team</h3>
                </div>
                <div className="divide-y divide-border">
                  <TeamMemberRow name={deal.vsd || ""} role="VSD" color="bg-teal-600" onSave={v => handleDealFieldSave("vsd", v)} />
                  <TeamMemberRow name={deal.principalBopm || ""} role="Principal BOPM" color="bg-primary" onSave={v => handleDealFieldSave("principalBopm", v)} />
                  <TeamMemberRow name={deal.seniorBopm || ""} role="Senior BOPM" color="bg-muted-foreground/60" onSave={v => handleDealFieldSave("seniorBopm", v)} />
                  <TeamMemberRow name={deal.bopm || ""} role="Junior BOPM" color="bg-muted-foreground/60" onSave={v => handleDealFieldSave("bopm", v)} />
                </div>
              </div>
            </div>

            {/* ── RGY + SoW ── */}
            <EditableRGY
              dimensions={[
                { key: "accountHealth", label: "Account Health", owner: "VSD", value: currentRGY?.accountHealth || "G", planOfAction: "" },
                { key: "delivery", label: "Delivery", owner: "BOPM", value: currentRGY?.delivery || "G", planOfAction: "" },
                { key: "financeBilling", label: "Finance / Billing", owner: "Finance", value: currentRGY?.financeBilling || "G", planOfAction: "" },
                { key: "capabilitySeo", label: "Capability — SEO", owner: "SEO", value: currentRGY?.capabilitySeo || "G", planOfAction: "" },
                { key: "capabilityCreative", label: "Capability — Creative", owner: "Creative", value: currentRGY?.capabilityCreative || "G", planOfAction: "" },
              ]}
              onSave={handleRGYSave}
            />

            {/* ── SoW ── */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Scope of Work
              </p>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <h3 className="text-sm font-medium text-foreground">SoW Items</h3>
                  <button
                    onClick={() => setAddingSoW(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add item
                  </button>
                </div>

                {/* Column headers */}
                <div className="flex items-center px-5 py-2 bg-secondary/40 border-b border-border">
                  <span className="flex-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Scope</span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-right w-40">Revenue share team</span>
                  <span className="w-8" />
                </div>

                {/* Add row */}
                {addingSoW && (
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-accent/5">
                    <div className="flex-1">
                      <Input value={newSoW.scope} onChange={e => setNewSoW(p => ({ ...p, scope: e.target.value }))} className="h-7 text-sm" placeholder="Scope description" />
                    </div>
                    <div className="w-40">
                      <Input value={newSoW.teamCapability} onChange={e => setNewSoW(p => ({ ...p, teamCapability: e.target.value }))} className="h-7 text-sm" placeholder="e.g. SEO" />
                    </div>
                    <div className="flex gap-1 w-8 justify-end">
                      <button onClick={() => { addSoWItem({ dealId: dealId!, ...newSoW }); setNewSoW({ scope: "", revenueShare: 0, teamCapability: "" }); setAddingSoW(false); }} className="text-primary"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setAddingSoW(false)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}

                {/* Items */}
                {sowItems.map((s, i) => (
                  <div key={s.id} className={cn(
                    "flex items-center px-5 py-3 group hover:bg-accent/5 transition-colors",
                    i < sowItems.length - 1 && "border-b border-border"
                  )}>
                    <div className="flex-1 min-w-0">
                      <EditableCell value={s.scope} onSave={v => updateSoWItem(s.id, { scope: v })} />
                    </div>
                    <div className="w-40 text-right">
                      <EditableCell value={s.teamCapability} onSave={v => updateSoWItem(s.id, { teamCapability: v })} />
                    </div>
                    <div className="w-8 flex justify-end">
                      <button onClick={() => deleteSoWItem(s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Empty state */}
                {sowItems.length === 0 && !addingSoW && (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm text-muted-foreground">No SoW items yet. Click 'Add item' to start.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ Staffing ══════════ */}
        {activeTab === "Staffing" && (
          <div className="animate-fade-in space-y-4">
            {dealPeople.length > 0 ? (
              (() => {
                const TEAM_ORDER = ["Operations", "SEO", "Content", "Content Strategy", "Creative Strategy", "Creative Art", "Creative Copy", "Video", "Performance & Growth", "Other"];
                const grouped = TEAM_ORDER
                  .map(cat => ({ category: cat, members: dealPeople.filter(p => p.roleCategory === cat) }))
                  .filter(g => g.members.length > 0);

                let totalCostWeek = 0;
                let totalHrsWeek = 0;
                let totalRevManaged = 0;
                const dealMrr = deal.mrr || 0;

                return (
                  <>
                    {(() => {
                      dealPeople.forEach(p => {
                        const alloc = dealAssignments.find(a => a.personId === p.id);
                        const pct = (alloc?.allocationPct || 0) / 100;
                        const hrs = pct * 40;
                        totalHrsWeek += hrs;
                        totalCostWeek += hrs * (p.hourlyRate || 0);
                        totalRevManaged += dealMrr * pct;
                      });
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="rounded-lg bg-secondary/50 p-4"><p className="metric-label">Team Size</p><p className="text-xl font-semibold text-foreground">{dealPeople.length}</p></div>
                          <div className="rounded-lg bg-secondary/50 p-4"><p className="metric-label">Total Hrs/Week</p><p className="text-xl font-semibold text-foreground">{totalHrsWeek.toFixed(1)}h</p></div>
                          <div className="rounded-lg bg-secondary/50 p-4"><p className="metric-label">Cost/Week</p><p className="text-xl font-semibold text-foreground">{fmtCurrency(totalCostWeek)}</p></div>
                          <div className="rounded-lg bg-secondary/50 p-4"><p className="metric-label">Revenue Managed</p><p className="text-xl font-semibold text-foreground">{fmtCurrency(totalRevManaged)}</p></div>
                        </div>
                      );
                    })()}

                    {grouped.map(group => (
                      <div key={group.category} className="bg-card border border-border rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-accent/20 border-b border-border flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.category}</span>
                          <span className="text-xs text-muted-foreground">{group.members.length} member{group.members.length > 1 ? "s" : ""}</span>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Name</th>
                              <th className="text-left py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Role</th>
                              <th className="text-left py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Pod</th>
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Allocation</th>
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Hrs/Week</th>
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Rate/Hr</th>
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Cost/Week</th>
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Rev Managed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.members.map(p => {
                              const alloc = dealAssignments.find(a => a.personId === p.id);
                              const pct = (alloc?.allocationPct || 0) / 100;
                              const hrs = pct * 40;
                              const costWeek = hrs * (p.hourlyRate || 0);
                              const revManaged = (deal.mrr || 0) * pct;
                              return (
                                <tr key={p.id} className="border-b border-border/50 hover:bg-accent/10">
                                  <td className="py-2.5 px-4 font-medium text-foreground">{p.name}{p.tbh && <span className="ml-1 text-xs text-warning">(TBH)</span>}{p.leaving && <span className="ml-1 text-xs text-destructive">(Leaving)</span>}</td>
                                  <td className="py-2.5 px-4 text-muted-foreground">{p.roleTitle || p.designation}</td>
                                  <td className="py-2.5 px-4 text-muted-foreground">{p.pod}</td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium">{alloc?.allocationPct || 0}%</td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted-foreground">{hrs.toFixed(1)}h</td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                                    <EditableCell value={String(p.hourlyRate || 0)} onSave={v => updatePerson(p.id, { hourlyRate: Number(v) || 0 })} type="number" prefix="₹" />
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted-foreground">{fmtCurrency(costWeek)}</td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted-foreground">{fmtCurrency(revManaged)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </>
                );
              })()
            ) : (
              <div className="bg-card border border-border rounded-xl text-center py-8 px-5"><p className="text-muted-foreground">No team members assigned to this deal.</p></div>
            )}
          </div>
        )}

        {/* ══════════ Financials ══════════ */}
        {activeTab === "Financials" && (
          <FinancialsTab rows={financials} dealId={dealId!} deal={deal ? { totalDealValue: deal.totalDealValue, mrr: deal.mrr } : undefined} onAdd={addFinancial} onUpdate={updateFinancial} onDelete={deleteFinancial} />
        )}

        {/* ══════════ Tasks ══════════ */}
        {activeTab === "Tasks" && (
          <TaskKanban tasks={tasks} dealId={dealId!} assignees={dealPeople.map(p => ({ id: p.id, name: p.name }))} onAdd={addTask} onUpdate={updateTask} onDelete={deleteTask} />
        )}

        {/* ══════════ RGY Health ══════════ */}
        {activeTab === "RGY Health" && (
          <div className="animate-fade-in">
            {rgyWeekly.length > 0 ? (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-accent/20 border-b border-border">
                      <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Week</th>
                      {["Acct Health", "Delivery", "Finance", "SEO", "Creative"].map(d => (
                        <th key={d} className="text-center py-2.5 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">{d}</th>
                      ))}
                      <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Plan of Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rgyWeekly.map(r => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="py-2.5 px-4 text-foreground font-mono text-xs">{r.weekStart}</td>
                        {[r.accountHealth || r.internal, r.delivery, r.financeBilling || "G", r.capabilitySeo || "G", r.capabilityCreative || "G"].map((val, i) => (
                          <td key={i} className="py-2.5 px-3 text-center">
                            <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold", rgyColors[val || "G"] || "rgy-na")}>{val || "G"}</span>
                          </td>
                        ))}
                        <td className="py-2.5 px-4 text-muted-foreground text-xs max-w-xs truncate">{r.planOfAction || r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl text-center py-8 px-5"><p className="text-muted-foreground">No weekly RGY data recorded yet. Set health status in the Overview tab.</p></div>
            )}
          </div>
        )}

        {/* ══════════ MBR ══════════ */}
        {activeTab === "MBR" && (
          <div className="animate-fade-in">
            <div className="bg-card border border-border rounded-xl text-center py-8 px-5">
              <p className="text-muted-foreground">MBR tracking for this deal is available in the <Link to="/mbr-tracker" className="text-primary hover:underline">MBR Tracker</Link>.</p>
            </div>
          </div>
        )}

        {/* ══════════ Onboarding ══════════ */}
        {activeTab === "Onboarding" && (
          <div className="animate-fade-in space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">Onboarding Progress</p>
                <span className={cn("text-sm font-semibold font-mono", onboardingPct === 100 ? "text-positive" : "text-foreground")}>{onboardingPct}%</span>
              </div>
              <Progress value={onboardingPct} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{onboarding.filter(s => s.completed).length} of {onboarding.length} steps completed</p>
            </div>
            {onboarding.length > 0 ? (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {(() => {
                  const categories = [...new Set(onboarding.map(s => s.category))];
                  return categories.map(cat => (
                    <div key={cat}>
                      <div className="px-4 py-2 bg-accent/20 border-b border-border">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</span>
                      </div>
                      {onboarding.filter(s => s.category === cat).map(step => (
                        <div key={step.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 hover:bg-accent/10 transition-colors">
                          <button onClick={() => toggleOnboardingStep(step.id)} className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0",
                            step.completed ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary"
                          )}>
                            {step.completed && <span className="text-[10px]">✓</span>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span className={cn("text-sm", step.completed ? "line-through text-muted-foreground" : "text-foreground")}>{step.stepName}</span>
                          </div>
                          {step.owner && <span className="text-xs text-muted-foreground">{step.owner}</span>}
                          {step.dueDate && <span className="text-xs font-mono text-muted-foreground">{step.dueDate}</span>}
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl text-center py-8 px-5">
                <p className="text-muted-foreground mb-3">No onboarding steps configured yet.</p>
                <Button variant="outline" onClick={() => { seedOnboarding(deal.dealType); toast.success("Onboarding checklist generated"); }}>
                  <Plus className="h-4 w-4 mr-1" /> Generate Checklist for {deal.dealType}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
