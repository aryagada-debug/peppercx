import { AppLayout } from "@/components/layout/AppLayout";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback } from "react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { useDealDetail } from "@/hooks/useDealDetail";
import { EditableRGY } from "@/components/deals/EditableRGY";
import { FinancialsTab } from "@/components/deals/FinancialsTab";
import { TaskKanban } from "@/components/deals/TaskKanban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const fmtCurrency = (n: number | undefined) => {
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

const TABS = ["Overview", "Staffing", "Financials", "Tasks", "RGY Health", "MBR", "Onboarding"] as const;
type TabKey = typeof TABS[number];

const rgyColors: Record<string, string> = { G: "rgy-green", R: "rgy-red", Y: "rgy-yellow" };

// ── Editable Cell ──
function EditableCell({ value, onSave, type = "text", prefix = "" }: { value: string; onSave: (v: string) => void; type?: string; prefix?: string }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input value={local} onChange={e => setLocal(e.target.value)} type={type} className="h-7 text-ui w-full" autoFocus onKeyDown={e => { if (e.key === "Enter") { onSave(local); setEditing(false); } if (e.key === "Escape") { setLocal(value); setEditing(false); } }} />
        <button onClick={() => { onSave(local); setEditing(false); }} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={() => { setLocal(value); setEditing(false); }} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1 cursor-pointer" onClick={() => setEditing(true)}>
      <span className="text-ui font-medium text-foreground">{prefix}{value || "—"}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
    return <AppLayout><div className="p-8"><Link to="/clients" className="text-primary hover:underline text-ui">← Back to Clients</Link><p className="mt-4 text-muted-foreground">Deal not found.</p></div></AppLayout>;
  }

  const metadataFields: [string, string, string, string?][] = [
    ["Deal Type", "dealType", deal.dealType],
    ["Service Line", "serviceLineTagging", deal.serviceLineTagging || deal.capabilityLine],
    ["Status", "dealStatusCx", deal.dealStatusCx || deal.dealStatus],
    ["MRR", "mrr", String(deal.mrr || ""), "₹"],
    ["Retainer Value", "retainerDealValue", String(deal.retainerDealValue || ""), "₹"],
    ["Non-Retainer Value", "nonRetainerDealValue", String(deal.nonRetainerDealValue || ""), "₹"],
    ["Total Value", "totalDealValue", String(deal.totalDealValue || ""), "₹"],
    ["Duration", "duration", deal.duration || ""],
    ["Business Unit", "businessUnit", deal.businessUnit],
    ["VSD", "vsd", deal.vsd],
    ["Principal BOPM", "principalBopm", deal.principalBopm || ""],
    ["Senior BOPM", "seniorBopm", deal.seniorBopm || ""],
    ["Junior BOPM", "bopm", deal.bopm || ""],
    ["Payment Terms", "paymentTerms", deal.paymentTerms || ""],
    ["Start Date", "startDate", deal.startDate || ""],
    ["End Date", "endDate", deal.endDate || ""],
  ];

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/clients" className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-ui text-primary font-medium">{deal.dealId}</span>
              <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium", deal.dealStatusCx === "Active" ? "text-positive bg-[hsl(var(--success-bg))]" : "text-muted-foreground bg-secondary")}>{deal.dealStatusCx || deal.dealStatus}</span>
              <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent text-accent-foreground">{deal.dealType}</span>
            </div>
            <h1 className="text-subhead font-bold tracking-tight text-foreground">{deal.dealName}</h1>
            <p className="text-ui text-muted-foreground">{deal.account}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border mb-6">
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={cn(
                "px-4 py-2.5 text-ui font-medium transition-colors border-b-2 whitespace-nowrap",
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>{tab}</button>
            ))}
          </div>
        </div>

        {/* ── Overview ── */}
        {activeTab === "Overview" && (
          <div className="space-y-6 animate-fade-in">
            {/* Editable Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {metadataFields.map(([label, field, value, prefix]) => (
                <div key={label} className="data-card">
                  <p className="metric-label">{label}</p>
                  <div className="mt-1">
                    <EditableCell value={value} prefix="" onSave={v => handleDealFieldSave(field, v)} type={["mrr", "retainerDealValue", "nonRetainerDealValue", "totalDealValue"].includes(field) ? "number" : "text"} />
                  </div>
                </div>
              ))}
            </div>

            {/* Editable RGY in Overview */}
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

            {/* SoW Criteria — Editable */}
            <div className="data-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-ui font-bold text-foreground">Scope of Work</h3>
                <Button variant="outline" size="sm" onClick={() => setAddingSoW(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>
              <table className="w-full text-ui">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-caption uppercase tracking-wider text-muted-foreground font-medium">Scope</th>
                    <th className="text-right py-2 text-caption uppercase tracking-wider text-muted-foreground font-medium">Revenue Share</th>
                    <th className="text-left py-2 text-caption uppercase tracking-wider text-muted-foreground font-medium">Team</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {addingSoW && (
                    <tr className="border-b border-border/50 bg-accent/10">
                      <td className="py-2"><Input value={newSoW.scope} onChange={e => setNewSoW(p => ({ ...p, scope: e.target.value }))} className="h-7 text-ui" placeholder="Scope description" /></td>
                      <td className="py-2 px-2"><Input type="number" value={newSoW.revenueShare || ""} onChange={e => setNewSoW(p => ({ ...p, revenueShare: Number(e.target.value) }))} className="h-7 text-ui w-28 text-right" /></td>
                      <td className="py-2"><Input value={newSoW.teamCapability} onChange={e => setNewSoW(p => ({ ...p, teamCapability: e.target.value }))} className="h-7 text-ui" placeholder="e.g. SEO" /></td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button onClick={() => { addSoWItem({ dealId: dealId!, ...newSoW }); setNewSoW({ scope: "", revenueShare: 0, teamCapability: "" }); setAddingSoW(false); }} className="text-primary"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setAddingSoW(false)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {sowItems.map(s => (
                    <tr key={s.id} className="border-b border-border/50 group hover:bg-accent/10">
                      <td className="py-2"><EditableCell value={s.scope} onSave={v => updateSoWItem(s.id, { scope: v })} /></td>
                      <td className="py-2 text-right"><EditableCell value={String(s.revenueShare)} onSave={v => updateSoWItem(s.id, { revenueShare: Number(v) })} type="number" /></td>
                      <td className="py-2"><EditableCell value={s.teamCapability} onSave={v => updateSoWItem(s.id, { teamCapability: v })} /></td>
                      <td className="py-2">
                        <button onClick={() => deleteSoWItem(s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sowItems.length === 0 && !addingSoW && (
                    <tr><td colSpan={4} className="py-6 text-center text-muted-foreground text-caption">No SoW items yet. Click "Add Item" to start.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Staffing ── */}
        {activeTab === "Staffing" && (
          <div className="animate-fade-in space-y-4">
            {dealPeople.length > 0 ? (
              (() => {
                const TEAM_ORDER = ["Operations", "SEO", "Content", "Content Strategy", "Creative Strategy", "Creative Art", "Creative Copy", "Video", "Performance & Growth", "Other"];
                const grouped = TEAM_ORDER
                  .map(cat => ({
                    category: cat,
                    members: dealPeople.filter(p => p.roleCategory === cat),
                  }))
                  .filter(g => g.members.length > 0);

                let totalCostWeek = 0;
                let totalHrsWeek = 0;
                let totalRevManaged = 0;
                const dealMrr = deal.mrr || 0;

                return (
                  <>
                    {/* Summary KPIs */}
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
                          <div className="data-card"><p className="metric-label">Team Size</p><p className="text-subhead font-bold text-foreground">{dealPeople.length}</p></div>
                          <div className="data-card"><p className="metric-label">Total Hrs/Week</p><p className="text-subhead font-bold text-foreground">{totalHrsWeek.toFixed(1)}h</p></div>
                          <div className="data-card"><p className="metric-label">Cost/Week</p><p className="text-subhead font-bold text-foreground">{fmtCurrency(totalCostWeek)}</p></div>
                          <div className="data-card"><p className="metric-label">Revenue Managed</p><p className="text-subhead font-bold text-foreground">{fmtCurrency(totalRevManaged)}</p></div>
                        </div>
                      );
                    })()}

                    {grouped.map(group => (
                      <div key={group.category} className="data-card !p-0 overflow-hidden">
                        <div className="px-4 py-2 bg-accent/20 border-b border-border flex items-center justify-between">
                          <span className="text-caption font-bold uppercase tracking-wider text-muted-foreground">{group.category}</span>
                          <span className="text-caption text-muted-foreground">{group.members.length} member{group.members.length > 1 ? "s" : ""}</span>
                        </div>
                        <table className="w-full text-ui">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Name</th>
                              <th className="text-left py-2 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Role</th>
                              <th className="text-left py-2 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Pod</th>
                              <th className="text-right py-2 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Allocation</th>
                              <th className="text-right py-2 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Hrs/Week</th>
                              <th className="text-right py-2 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Rate/Hr</th>
                              <th className="text-right py-2 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Cost/Week</th>
                              <th className="text-right py-2 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Rev Managed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.members.map(p => {
                              const alloc = dealAssignments.find(a => a.personId === p.id);
                              const pct = (alloc?.allocationPct || 0) / 100;
                              const hrs = pct * 40;
                              const costWeek = hrs * (p.hourlyRate || 0);
                              const revManaged = dealMrr * pct;
                              return (
                                <tr key={p.id} className="border-b border-border/50 hover:bg-accent/10">
                                  <td className="py-2.5 px-4 font-medium text-foreground">{p.name}{p.tbh && <span className="ml-1 text-caption text-warning">(TBH)</span>}{p.leaving && <span className="ml-1 text-caption text-destructive">(Leaving)</span>}</td>
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
              <div className="data-card text-center py-8"><p className="text-muted-foreground">No team members assigned to this deal.</p></div>
            )}
          </div>
        )}

        {/* ── Financials (replaces Revenue + Targets) ── */}
        {activeTab === "Financials" && (
          <FinancialsTab
            rows={financials}
            dealId={dealId!}
            onAdd={addFinancial}
            onUpdate={updateFinancial}
            onDelete={deleteFinancial}
          />
        )}

        {/* ── Tasks Kanban ── */}
        {activeTab === "Tasks" && (
          <TaskKanban
            tasks={tasks}
            dealId={dealId!}
            assignees={dealPeople.map(p => ({ id: p.id, name: p.name }))}
            onAdd={addTask}
            onUpdate={updateTask}
            onDelete={deleteTask}
          />
        )}

        {/* ── RGY Health (Weekly History) ── */}
        {activeTab === "RGY Health" && (
          <div className="animate-fade-in">
            {rgyWeekly.length > 0 ? (
              <div className="data-card !p-0 overflow-hidden">
                <table className="w-full text-ui">
                  <thead>
                    <tr className="bg-accent/20 border-b border-border">
                      <th className="text-left py-2.5 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Week</th>
                      {["Acct Health", "Delivery", "Finance", "SEO", "Creative"].map(d => (
                        <th key={d} className="text-center py-2.5 px-3 text-caption uppercase tracking-wider text-muted-foreground font-medium">{d}</th>
                      ))}
                      <th className="text-left py-2.5 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Plan of Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rgyWeekly.map(r => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="py-2.5 px-4 text-foreground font-mono text-caption">{r.weekStart}</td>
                        {[r.accountHealth || r.internal, r.delivery, r.financeBilling || "G", r.capabilitySeo || "G", r.capabilityCreative || "G"].map((val, i) => (
                          <td key={i} className="py-2.5 px-3 text-center">
                            <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-lg text-caption font-bold", rgyColors[val || "G"] || "rgy-na")}>{val || "G"}</span>
                          </td>
                        ))}
                        <td className="py-2.5 px-4 text-muted-foreground text-caption max-w-xs truncate">{r.planOfAction || r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="data-card text-center py-8"><p className="text-muted-foreground">No weekly RGY data recorded yet. Set health status in the Overview tab.</p></div>
            )}
          </div>
        )}

        {/* ── MBR ── */}
        {activeTab === "MBR" && (
          <div className="animate-fade-in">
            <div className="data-card text-center py-8">
              <p className="text-muted-foreground">MBR tracking for this deal is available in the <Link to="/mbr-tracker" className="text-primary hover:underline">MBR Tracker</Link>.</p>
            </div>
          </div>
        )}

        {/* ── Onboarding ── */}
        {activeTab === "Onboarding" && (
          <div className="animate-fade-in space-y-4">
            <div className="data-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-ui font-bold text-foreground">Onboarding Progress</p>
                <span className={cn("text-ui font-bold font-mono", onboardingPct === 100 ? "text-positive" : "text-foreground")}>{onboardingPct}%</span>
              </div>
              <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${onboardingPct}%` }} />
              </div>
              <p className="text-caption text-muted-foreground mt-1">{onboarding.filter(s => s.completed).length} of {onboarding.length} steps completed</p>
            </div>
            {onboarding.length > 0 ? (
              <div className="data-card !p-0">
                {(() => {
                  const categories = [...new Set(onboarding.map(s => s.category))];
                  return categories.map(cat => (
                    <div key={cat}>
                      <div className="px-4 py-2 bg-accent/20 border-b border-border">
                        <span className="text-caption font-bold uppercase tracking-wider text-muted-foreground">{cat}</span>
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
                            <span className={cn("text-ui", step.completed ? "line-through text-muted-foreground" : "text-foreground")}>{step.stepName}</span>
                          </div>
                          {step.owner && <span className="text-caption text-muted-foreground">{step.owner}</span>}
                          {step.dueDate && <span className="text-caption font-mono text-muted-foreground">{step.dueDate}</span>}
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="data-card text-center py-8">
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
