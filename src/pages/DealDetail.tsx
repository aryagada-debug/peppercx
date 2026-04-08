import { AppLayout } from "@/components/layout/AppLayout";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { useDealDetail } from "@/hooks/useDealDetail";
import { useMBRData } from "@/hooks/useMBRData";

const fmtCurrency = (n: number | undefined) => {
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

const TABS = ["Overview", "Staffing", "Revenue", "Targets", "RGY Health", "MBR", "Onboarding"] as const;
type TabKey = typeof TABS[number];

const rgyColors: Record<string, string> = { G: "rgy-green", R: "rgy-red", Y: "rgy-yellow" };

export default function DealDetail() {
  const { dealId } = useParams();
  const [activeTab, setActiveTab] = useState<TabKey>("Overview");
  const { deals, people, assignments, loading: staffLoading } = useStaffingData();
  const { sowItems, revenue, targets, rgyWeekly, onboarding, loading: detailLoading, toggleOnboardingStep } = useDealDetail(dealId);

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

  if (staffLoading || detailLoading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!deal) {
    return (
      <AppLayout>
        <div className="p-8">
          <Link to="/clients" className="text-primary hover:underline text-ui">← Back to Clients</Link>
          <p className="mt-4 text-muted-foreground">Deal not found.</p>
        </div>
      </AppLayout>
    );
  }

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
              <span className={cn(
                "inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium",
                deal.dealStatusCx === "Active" ? "text-positive bg-[hsl(var(--success-bg))]" : "text-muted-foreground bg-secondary"
              )}>{deal.dealStatusCx || deal.dealStatus}</span>
              <span className={cn(
                "inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent text-accent-foreground"
              )}>{deal.dealType}</span>
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

        {/* Overview Tab */}
        {activeTab === "Overview" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["Deal Type", deal.dealType], ["Service Line", deal.serviceLineTagging || deal.capabilityLine],
                ["Status", deal.dealStatusCx || deal.dealStatus], ["MRR", fmtCurrency(deal.mrr)],
                ["Retainer Value", fmtCurrency(deal.retainerDealValue)], ["Non-Retainer Value", fmtCurrency(deal.nonRetainerDealValue)],
                ["Total Value", fmtCurrency(deal.totalDealValue)], ["Duration", deal.duration || "—"],
                ["Location", deal.businessUnit], ["VSD", deal.vsd],
                ["Principal BOPM", deal.principalBopm || "—"], ["Senior BOPM", deal.seniorBopm || "—"],
                ["Junior BOPM", deal.bopm || "—"], ["Validation", deal.validation || "—"],
              ].map(([label, value]) => (
                <div key={label} className="data-card">
                  <p className="metric-label">{label}</p>
                  <p className="text-ui font-medium text-foreground mt-1">{value}</p>
                </div>
              ))}
            </div>

            {/* SoW Criteria */}
            <div className="data-card">
              <h3 className="text-ui font-bold text-foreground mb-3">Scope of Work</h3>
              {sowItems.length > 0 ? (
                <table className="w-full text-ui">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-caption uppercase tracking-wider text-muted-foreground font-medium">Scope</th>
                      <th className="text-right py-2 text-caption uppercase tracking-wider text-muted-foreground font-medium">Revenue Share</th>
                      <th className="text-left py-2 text-caption uppercase tracking-wider text-muted-foreground font-medium">Team</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sowItems.map(s => (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="py-2 text-foreground">{s.scope}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{fmtCurrency(s.revenueShare)}</td>
                        <td className="py-2"><span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent text-accent-foreground">{s.teamCapability}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted-foreground text-caption">No SoW items added yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Staffing Tab */}
        {activeTab === "Staffing" && (
          <div className="animate-fade-in">
            {dealPeople.length > 0 ? (
              <div className="data-card !p-0 overflow-hidden">
                <table className="w-full text-ui">
                  <thead>
                    <tr className="bg-accent/20 border-b border-border">
                      <th className="text-left py-2.5 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Name</th>
                      <th className="text-left py-2.5 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Role</th>
                      <th className="text-left py-2.5 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Category</th>
                      <th className="text-left py-2.5 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Pod</th>
                      <th className="text-right py-2.5 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealPeople.map(p => {
                      const alloc = dealAssignments.find(a => a.personId === p.id);
                      return (
                        <tr key={p.id} className="border-b border-border/50 hover:bg-accent/10">
                          <td className="py-2.5 px-4 font-medium text-foreground">{p.name}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">{p.roleTitle || p.designation}</td>
                          <td className="py-2.5 px-4"><span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent text-accent-foreground">{p.roleCategory}</span></td>
                          <td className="py-2.5 px-4 text-muted-foreground">{p.pod}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="font-mono tabular-nums font-medium">{alloc?.allocationPct || 0}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="data-card text-center py-8"><p className="text-muted-foreground">No team members assigned to this deal.</p></div>
            )}
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === "Revenue" && (
          <div className="animate-fade-in">
            {revenue.length > 0 ? (
              <div className="data-card !p-0 overflow-hidden">
                <table className="w-full text-ui">
                  <thead>
                    <tr className="bg-accent/20 border-b border-border">
                      {["Month", "MRR", "Contraction", "Delivered", "Invoiced", "Actuals", "Attainment"].map(h => (
                        <th key={h} className={cn("py-2.5 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium", h === "Month" ? "text-left" : "text-right")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.map(r => {
                      const att = r.mrr > 0 ? ((r.actuals / r.mrr) * 100) : 0;
                      return (
                        <tr key={r.id} className="border-b border-border/50">
                          <td className="py-2.5 px-4 text-foreground">{r.month}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">{fmtCurrency(r.mrr)}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-destructive">{fmtCurrency(r.contraction)}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">{fmtCurrency(r.delivered)}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">{fmtCurrency(r.invoiced)}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium">{fmtCurrency(r.actuals)}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                            <span className={cn(att >= 100 ? "text-positive" : att >= 90 ? "text-warning" : "text-destructive")}>{att.toFixed(1)}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="data-card text-center py-8"><p className="text-muted-foreground">No revenue data recorded yet.</p></div>
            )}
          </div>
        )}

        {/* Targets Tab */}
        {activeTab === "Targets" && (
          <div className="animate-fade-in space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {(() => {
                const ytdContraction = targets.reduce((s, t) => s + t.contractionTarget, 0);
                const ytdDelivery = targets.reduce((s, t) => s + t.deliveryTarget, 0);
                const ytdInvoicing = targets.reduce((s, t) => s + t.invoicingTarget, 0);
                return [
                  { label: "YTD Contraction Target", value: fmtCurrency(ytdContraction) },
                  { label: "YTD Delivery Target", value: fmtCurrency(ytdDelivery) },
                  { label: "YTD Invoicing Target", value: fmtCurrency(ytdInvoicing) },
                ].map(k => (
                  <div key={k.label} className="data-card">
                    <p className="metric-label">{k.label}</p>
                    <p className="metric-value mt-2">{k.value}</p>
                  </div>
                ));
              })()}
            </div>
            {targets.length > 0 ? (
              <div className="data-card !p-0 overflow-hidden">
                <table className="w-full text-ui">
                  <thead>
                    <tr className="bg-accent/20 border-b border-border">
                      {["Month", "Contraction", "Delivery", "Invoicing"].map(h => (
                        <th key={h} className={cn("py-2.5 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium", h === "Month" ? "text-left" : "text-right")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {targets.map(t => (
                      <tr key={t.id} className="border-b border-border/50">
                        <td className="py-2.5 px-4 text-foreground">{t.month}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">{fmtCurrency(t.contractionTarget)}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">{fmtCurrency(t.deliveryTarget)}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">{fmtCurrency(t.invoicingTarget)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="data-card text-center py-8"><p className="text-muted-foreground">No target data recorded yet.</p></div>
            )}
          </div>
        )}

        {/* RGY Health Tab (Weekly) */}
        {activeTab === "RGY Health" && (
          <div className="animate-fade-in">
            {rgyWeekly.length > 0 ? (
              <div className="data-card !p-0 overflow-hidden">
                <table className="w-full text-ui">
                  <thead>
                    <tr className="bg-accent/20 border-b border-border">
                      <th className="text-left py-2.5 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Week</th>
                      {["Internal", "Customer", "Delivery", "Consumption"].map(d => (
                        <th key={d} className="text-center py-2.5 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">{d}</th>
                      ))}
                      <th className="text-left py-2.5 px-4 text-caption uppercase tracking-wider text-muted-foreground font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rgyWeekly.map(r => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="py-2.5 px-4 text-foreground font-mono text-caption">{r.weekStart}</td>
                        {[r.internal, r.customer, r.delivery, r.consumption].map((val, i) => (
                          <td key={i} className="py-2.5 px-4 text-center">
                            <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-lg text-caption font-bold", rgyColors[val] || "rgy-na")}>{val}</span>
                          </td>
                        ))}
                        <td className="py-2.5 px-4 text-muted-foreground text-caption">{r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="data-card text-center py-8"><p className="text-muted-foreground">No weekly RGY data recorded yet.</p></div>
            )}
          </div>
        )}

        {/* MBR Tab */}
        {activeTab === "MBR" && (
          <div className="animate-fade-in">
            <div className="data-card text-center py-8">
              <p className="text-muted-foreground">MBR tracking for this deal is available in the <Link to="/mbr-tracker" className="text-primary hover:underline">MBR Tracker</Link>.</p>
            </div>
          </div>
        )}

        {/* Onboarding Tab */}
        {activeTab === "Onboarding" && (
          <div className="animate-fade-in space-y-4">
            {/* Progress bar */}
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

            {/* Checklist */}
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
              <div className="data-card text-center py-8"><p className="text-muted-foreground">No onboarding steps configured yet.</p></div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
