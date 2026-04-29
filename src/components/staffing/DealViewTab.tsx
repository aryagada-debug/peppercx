import React, { useMemo, useState } from "react";
import { formatINR } from "@/lib/csvTargets";
import { ChevronDown, ChevronRight, Search, Users, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Deal, StaffingAssignment, Person } from "@/data/staffingData";
import { BopmFilter, dealMatchesBopm } from "@/components/access/BopmFilter";

const STAFFING_BUCKETS = ["Already Staffed", "No Staffing Needed", "Staffing Needed"] as const;
type StaffingBucket = typeof STAFFING_BUCKETS[number];

// Human-readable role labels for the staffing drill-down (mirrors MatrixTab ROLE_COLS)
const ROLE_LABELS: Record<string, string> = {
  vsd: "VSD",
  principal_bopm: "Principal BOPM",
  senior_bopm: "Senior BOPM",
  bopm: "BOPM",
  content_lead_2026: "Content Lead (2026)",
  senior_editor: "Senior Editor",
  managing_editor: "Managing Editor",
  content_lead: "Content Lead",
  seo_leader: "SEO Leader",
  seo_group_head: "Group Head",
  sr_seo_manager: "Sr SEO Manager",
  seo_manager: "SEO Manager",
  sr_seo_analyst: "Sr SEO Analyst",
  seo_analyst: "SEO Analyst",
  strategy_cd: "Strategy CD",
  strategy_acd: "Strategy ACD",
  strategy_sr: "Sr Strategist",
  cd_copy: "CD - Copy",
  acd_copy: "ACD - Copy",
  sr_copywriter: "Sr Copywriter",
  jr_copywriter: "Jr Copywriter",
  sr_cd_art: "Sr CD - Art",
  acd_art: "ACD - Art",
  art_director: "Art Director",
  sr_designer: "Sr Designer",
  jr_designer: "Jr Designer",
  production_head: "Production Head",
  ad_video_pm: "AD - Video PM",
  video_pm: "Video PM/ACPPM",
  video_editor_1: "Video Editor 1",
  video_editor_2: "Video Editor 2",
  video_editor_3: "Video Editor 3",
  video_editor_4: "Video Editor 4",
  video_editor_5: "Video Editor 5",
  influencer: "Influencer Team",
  perf_growth: "Performance & Growth",
};
const roleLabel = (key: string) => ROLE_LABELS[key] || key.replace(/_/g, " ");

const fmtCurrency = (n: number | undefined) => {
  return formatINR(Number(n) || 0);
};

function classifyStaffing(deal: Deal): StaffingBucket {
  const s = (deal.staffingStatus || "").toLowerCase().trim();
  if (s.includes("already") || s.includes("staffed")) return "Already Staffed";
  if (s.includes("not needed") || s.includes("no staffing") || s === "no") return "No Staffing Needed";
  if (s.includes("needed") || s.includes("required") || s.includes("open")) return "Staffing Needed";
  // Fallback: infer from assignments later — handled by caller
  return "Staffing Needed";
}

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
  onUpdateDeal?: (dealId: string, updates: Partial<Deal>) => void;
}

const ALL = "All";
const DEAL_TYPE_OPTIONS = [ALL, "Retainer", "Non-Retainer", "Pilot"] as const;
const DEAL_STATUS_OPTIONS = [ALL, "Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal Completed Successfully", "Deal Churned / Lost"] as const;
const TYPE_EDIT_OPTIONS = ["Retainer", "Non-Retainer", "Pilot"] as const;
const STATUS_EDIT_OPTIONS = ["Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal Completed Successfully", "Deal Churned / Lost"] as const;
const STAFFING_EDIT_OPTIONS: StaffingBucket[] = ["Already Staffed", "Staffing Needed", "No Staffing Needed"];

export function DealViewTab({ deals, people, assignments, onUpdateDeal }: Props) {
  const [dealType, setDealType] = useState<typeof DEAL_TYPE_OPTIONS[number]>(ALL);
  const [dealStatus, setDealStatus] = useState<typeof DEAL_STATUS_OPTIONS[number]>("Active Deal");
  const [vsdFilter, setVsdFilter] = useState<string>(ALL);
  const [bopmFilter, setBopmFilter] = useState<string>(ALL);
  const [expandedVsd, setExpandedVsd] = useState<Set<string>>(new Set());
  const [expandedDeal, setExpandedDeal] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const personMap = useMemo(() => {
    const m: Record<string, Person> = {};
    people.forEach(p => { m[p.id] = p; });
    return m;
  }, [people]);

  // Pre-compute set of dealIds that have at least one assignment — avoids O(deals × assignments) per render
  const dealIdsWithAssignments = useMemo(() => {
    const s = new Set<string>();
    assignments.forEach(a => s.add(a.dealId));
    return s;
  }, [assignments]);

  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      if (dealType !== ALL && d.dealType !== dealType) return false;
      if (dealStatus !== ALL && d.dealStatus !== dealStatus) return false;
      if (vsdFilter !== ALL) {
        const v = d.vsd?.trim() || "Yet to be assigned";
        if (v !== vsdFilter) return false;
      }
      if (bopmFilter !== ALL && !dealMatchesBopm(d as any, bopmFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(d.dealName.toLowerCase().includes(q) || d.account.toLowerCase().includes(q) || (d.vsd || "").toLowerCase().includes(q))) {
          return false;
        }
      }
      return true;
    });
  }, [deals, dealType, dealStatus, vsdFilter, bopmFilter, search]);

  const vsdOptions = useMemo(() => {
    const set = new Set<string>();
    deals.forEach(d => set.add(d.vsd?.trim() || "Yet to be assigned"));
    return [ALL, ...Array.from(set).sort((a, b) => {
      if (a === "Yet to be assigned") return 1;
      if (b === "Yet to be assigned") return -1;
      return a.localeCompare(b);
    })];
  }, [deals]);

  // Compute deal bucket — prefer explicit staffingStatus, fall back to assignments presence
  const dealBucket = (d: Deal): StaffingBucket => {
    if (d.staffingStatus) return classifyStaffing(d);
    return dealIdsWithAssignments.has(d.id) ? "Already Staffed" : "Staffing Needed";
  };

  // Group by VSD
  const vsdGroups = useMemo(() => {
    const map = new Map<string, Deal[]>();
    filteredDeals.forEach(d => {
      const v = d.vsd?.trim() || "Yet to be assigned";
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(d);
    });
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === "Yet to be assigned") return 1;
      if (b[0] === "Yet to be assigned") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredDeals]);

  const rows = useMemo(() => {
    return vsdGroups.map(([vsd, list]) => {
      const counts: Record<StaffingBucket, number> = {
        "Already Staffed": 0,
        "No Staffing Needed": 0,
        "Staffing Needed": 0,
      };
      list.forEach(d => { counts[dealBucket(d)]++; });
      return { vsd, deals: list, counts, total: list.length };
    });
  }, [vsdGroups, dealIdsWithAssignments]);

  const totals = useMemo(() => {
    const t: Record<StaffingBucket, number> = { "Already Staffed": 0, "No Staffing Needed": 0, "Staffing Needed": 0 };
    let total = 0;
    rows.forEach(r => {
      STAFFING_BUCKETS.forEach(b => { t[b] += r.counts[b]; });
      total += r.total;
    });
    return { counts: t, total };
  }, [rows]);

  const toggle = (vsd: string) => {
    setExpandedVsd(prev => {
      const next = new Set(prev);
      if (next.has(vsd)) next.delete(vsd); else next.add(vsd);
      return next;
    });
  };

  const colorFor = (bucket: StaffingBucket, value: number) => {
    if (value === 0) return "text-muted-foreground/40";
    if (bucket === "Already Staffed") return "text-positive font-semibold";
    if (bucket === "Staffing Needed") return "text-destructive font-semibold";
    return "text-foreground";
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* Filters on top */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search deals, accounts, VSDs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-ui text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-caption text-muted-foreground">VSD</label>
          <select
            value={vsdFilter}
            onChange={e => setVsdFilter(e.target.value)}
            className="h-9 px-3 rounded-lg bg-card border border-border text-ui text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none max-w-[200px]"
          >
            {vsdOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-caption text-muted-foreground">BOPM</label>
          <BopmFilter
            value={bopmFilter}
            onChange={setBopmFilter}
            scopedVsd={vsdFilter !== ALL && vsdFilter !== "Yet to be assigned" ? vsdFilter : undefined}
            className="h-9 w-[200px] text-ui"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-caption text-muted-foreground">Deal Type</label>
          <select
            value={dealType}
            onChange={e => setDealType(e.target.value as typeof DEAL_TYPE_OPTIONS[number])}
            className="h-9 px-3 rounded-lg bg-card border border-border text-ui text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
          >
            {DEAL_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-caption text-muted-foreground">Deal Status</label>
          <select
            value={dealStatus}
            onChange={e => setDealStatus(e.target.value as typeof DEAL_STATUS_OPTIONS[number])}
            className="h-9 px-3 rounded-lg bg-card border border-border text-ui text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
          >
            {DEAL_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* VSD Pivot Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left py-3 px-4 text-caption font-medium text-muted-foreground uppercase tracking-wider">VSD</th>
              {STAFFING_BUCKETS.map(b => (
                <th key={b} className={cn(
                  "text-center py-3 px-4 text-caption font-medium uppercase tracking-wider",
                  b === "Already Staffed" ? "text-positive" : b === "Staffing Needed" ? "text-destructive" : "text-muted-foreground"
                )}>{b}</th>
              ))}
              <th className="text-right py-3 px-4 text-caption font-medium text-muted-foreground uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isExp = expandedVsd.has(r.vsd);
              return (
                <React.Fragment key={r.vsd}>
                  <tr className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => toggle(r.vsd)}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {isExp ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className={cn("text-foreground", r.vsd === "Yet to be assigned" && "italic text-muted-foreground")}>{r.vsd}</span>
                      </div>
                    </td>
                    {STAFFING_BUCKETS.map(b => (
                      <td key={b} className="text-center py-3 px-4 font-mono tabular-nums">
                        <span className={colorFor(b, r.counts[b])}>{r.counts[b]}</span>
                      </td>
                    ))}
                    <td className="text-right py-3 px-4 font-mono tabular-nums font-medium text-foreground">{r.total}</td>
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={5} className="p-0 bg-accent/5">
                        <div className="px-8 py-3">
                          <table className="w-full text-caption">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="text-left py-1 pr-4 font-medium">Deal</th>
                                <th className="text-left py-1 pr-4 font-medium">Account</th>
                                <th className="text-left py-1 pr-4 font-medium">Type</th>
                                <th className="text-left py-1 pr-4 font-medium">Status</th>
                                <th className="text-right py-1 pr-4 font-medium">MRR</th>
                                <th className="text-center py-1 font-medium">Staffing</th>
                                <th className="text-center py-1 font-medium w-8">Team</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.deals.map(d => {
                                const b = dealBucket(d);
                                const dealAssigns = assignments.filter(a => a.dealId === d.id);
                                const isDealExp = expandedDeal.has(d.id);
                                const totalPct = dealAssigns.reduce((s, a) => s + (a.allocationPct || 0), 0);
                                const totalHours = Math.round(totalPct / 100 * 160);
                                return (
                                  <React.Fragment key={d.id}>
                                    <tr className="border-t border-border/30">
                                      <td className="py-1.5 pr-4">
                                        <Link to={`/deals/${d.id}`} className="text-primary hover:underline">{d.dealName}</Link>
                                      </td>
                                      <td className="py-1.5 pr-4 text-muted-foreground">{d.account}</td>
                                      <td className="py-1.5 pr-4">
                                        <select
                                          value={d.dealType || ""}
                                          onChange={e => onUpdateDeal?.(d.id, { dealType: e.target.value as Deal["dealType"] })}
                                          className="h-6 px-1 -ml-1 text-caption bg-transparent border border-transparent hover:border-border focus:border-primary rounded text-foreground focus:outline-none"
                                        >
                                          {!TYPE_EDIT_OPTIONS.includes(d.dealType as any) && d.dealType && (
                                            <option value={d.dealType}>{d.dealType}</option>
                                          )}
                                          {!d.dealType && <option value="">—</option>}
                                          {TYPE_EDIT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                      </td>
                                      <td className="py-1.5 pr-4">
                                        <select
                                          value={d.dealStatus || ""}
                                          onChange={e => onUpdateDeal?.(d.id, { dealStatus: e.target.value })}
                                          className="h-6 px-1 -ml-1 text-caption bg-transparent border border-transparent hover:border-border focus:border-primary rounded text-foreground focus:outline-none max-w-[180px]"
                                        >
                                          {!STATUS_EDIT_OPTIONS.includes(d.dealStatus as any) && d.dealStatus && (
                                            <option value={d.dealStatus}>{d.dealStatus}</option>
                                          )}
                                          {!d.dealStatus && <option value="">—</option>}
                                          {STATUS_EDIT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                      </td>
                                      <td className="py-1.5 pr-4 text-right font-mono text-foreground">{fmtCurrency(d.mrr)}</td>
                                      <td className="py-1.5 text-center">
                                        <select
                                          value={STAFFING_EDIT_OPTIONS.includes(d.staffingStatus as StaffingBucket) ? d.staffingStatus : b}
                                          onChange={e => onUpdateDeal?.(d.id, { staffingStatus: e.target.value })}
                                          className={cn(
                                            "h-6 px-1.5 text-[10px] font-medium rounded border border-transparent hover:border-border focus:border-primary focus:outline-none cursor-pointer",
                                            b === "Already Staffed" ? "bg-[hsl(var(--success-bg))] text-positive" :
                                            b === "Staffing Needed" ? "bg-[hsl(var(--danger-bg))] text-destructive" :
                                            "bg-secondary text-muted-foreground"
                                          )}
                                        >
                                          {STAFFING_EDIT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                      </td>
                                      <td className="py-1.5 text-center">
                                        <button
                                          type="button"
                                          onClick={() => setExpandedDeal(prev => {
                                            const n = new Set(prev);
                                            if (n.has(d.id)) n.delete(d.id); else n.add(d.id);
                                            return n;
                                          })}
                                          className="inline-flex items-center gap-1 px-1.5 h-6 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                          title="Show staffing details"
                                        >
                                          <Users className="h-3 w-3" />
                                          <span className="font-mono tabular-nums">{dealAssigns.length}</span>
                                          {isDealExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        </button>
                                      </td>
                                    </tr>
                                    {isDealExp && (
                                      <tr>
                                        <td colSpan={7} className="p-0 bg-secondary/20">
                                          <div className="px-6 py-3">
                                             {dealAssigns.length === 0 ? (
                                               <div className="flex items-center justify-between gap-3 flex-wrap">
                                                 <div className="text-caption text-muted-foreground italic">No team members assigned yet.</div>
                                                 <Link
                                                   to={`/staffing?tab=matrix&deal=${encodeURIComponent(d.id)}`}
                                                   className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20 text-[11px] font-medium transition-colors"
                                                 >
                                                   <UserPlus className="h-3 w-3" />
                                                   Add team in Staffing
                                                 </Link>
                                               </div>
                                             ) : (
                                              <table className="w-full text-[11px]">
                                                <thead>
                                                  <tr className="text-muted-foreground border-b border-border/40">
                                                    <th className="text-left py-1 pr-4 font-medium uppercase tracking-wider text-[10px]">Person</th>
                                                    <th className="text-left py-1 pr-4 font-medium uppercase tracking-wider text-[10px]">Role</th>
                                                    <th className="text-right py-1 pr-4 font-medium uppercase tracking-wider text-[10px]">Allocation %</th>
                                                    <th className="text-right py-1 font-medium uppercase tracking-wider text-[10px]">Hours / month</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {dealAssigns.map(a => {
                                                    const p = personMap[a.personId];
                                                    const hours = Math.round((a.allocationPct || 0) / 100 * 160);
                                                    return (
                                                      <tr key={a.id} className="border-b border-border/20">
                                                        <td className="py-1.5 pr-4 text-foreground">{p?.name || <span className="text-muted-foreground italic">Unknown</span>}</td>
                                                        <td className="py-1.5 pr-4 text-muted-foreground">{roleLabel(a.roleKey)}</td>
                                                        <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-foreground">{a.allocationPct}%</td>
                                                        <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">{hours} h</td>
                                                      </tr>
                                                    );
                                                  })}
                                                  <tr className="bg-secondary/30 font-medium">
                                                    <td className="py-1.5 pr-4 text-muted-foreground uppercase tracking-wider text-[10px]">Total</td>
                                                    <td className="py-1.5 pr-4 text-muted-foreground">{dealAssigns.length} {dealAssigns.length === 1 ? "person" : "people"}</td>
                                                    <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-foreground">{totalPct.toFixed(1)}%</td>
                                                    <td className="py-1.5 text-right font-mono tabular-nums text-foreground">{totalHours} h</td>
                                                  </tr>
                                                </tbody>
                                              </table>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {/* Totals row */}
            <tr className="border-t-2 border-border bg-secondary/40 font-medium">
              <td className="py-3 px-4 text-foreground">Total</td>
              {STAFFING_BUCKETS.map(b => (
                <td key={b} className={cn(
                  "text-center py-3 px-4 font-mono tabular-nums font-semibold",
                  b === "Already Staffed" ? "text-positive" : b === "Staffing Needed" ? "text-destructive" : "text-foreground"
                )}>{totals.counts[b]}</td>
              ))}
              <td className="text-right py-3 px-4 font-mono tabular-nums font-semibold text-foreground">{totals.total}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">No deals match the current filters.</div>
      )}
    </div>
  );
}