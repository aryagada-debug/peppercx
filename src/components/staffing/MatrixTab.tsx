import React, { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, Users, Building2, Plus, Trash2, ChevronDown, ChevronRight, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";

// ── Role catalog ────────────────────────────────────────────────────────────
const ROLE_COLS: { key: string; label: string; group: string }[] = [
  { key: "vsd", label: "VSD", group: "Leadership & PM" },
  { key: "principal_bopm", label: "Principal BOPM", group: "Leadership & PM" },
  { key: "senior_bopm", label: "Senior BOPM", group: "Leadership & PM" },
  { key: "bopm", label: "BOPM", group: "Leadership & PM" },

  { key: "content_lead_2026", label: "Content Lead (2026)", group: "Content" },
  { key: "senior_editor", label: "Senior Editor", group: "Content" },
  { key: "managing_editor", label: "Managing Editor", group: "Content" },
  { key: "content_lead", label: "Content Lead", group: "Content" },

  { key: "seo_leader", label: "SEO Leader", group: "SEO" },
  { key: "seo_group_head", label: "Group Head", group: "SEO" },
  { key: "sr_seo_manager", label: "Sr SEO Manager", group: "SEO" },
  { key: "seo_manager", label: "SEO Manager", group: "SEO" },
  { key: "sr_seo_analyst", label: "Sr SEO Analyst", group: "SEO" },
  { key: "seo_analyst", label: "SEO Analyst", group: "SEO" },

  { key: "strategy_cd", label: "Strategy CD", group: "Creative — Strategy" },
  { key: "strategy_acd", label: "Strategy ACD", group: "Creative — Strategy" },
  { key: "strategy_sr", label: "Sr Strategist", group: "Creative — Strategy" },

  { key: "cd_copy", label: "CD - Copy", group: "Creative — Copy" },
  { key: "acd_copy", label: "ACD - Copy", group: "Creative — Copy" },
  { key: "sr_copywriter", label: "Sr Copywriter", group: "Creative — Copy" },
  { key: "jr_copywriter", label: "Jr Copywriter", group: "Creative — Copy" },

  { key: "sr_cd_art", label: "Sr CD - Art", group: "Creative — Art" },
  { key: "acd_art", label: "ACD - Art", group: "Creative — Art" },
  { key: "art_director", label: "Art Director", group: "Creative — Art" },
  { key: "sr_designer", label: "Sr Designer", group: "Creative — Art" },
  { key: "jr_designer", label: "Jr Designer", group: "Creative — Art" },

  { key: "production_head", label: "Production Head", group: "Production / Video" },
  { key: "ad_video_pm", label: "AD - Video PM", group: "Production / Video" },
  { key: "video_pm", label: "Video PM/ACPPM", group: "Production / Video" },
  { key: "video_editor_1", label: "Video Editor 1", group: "Production / Video" },
  { key: "video_editor_2", label: "Video Editor 2", group: "Production / Video" },
  { key: "video_editor_3", label: "Video Editor 3", group: "Production / Video" },
  { key: "video_editor_4", label: "Video Editor 4", group: "Production / Video" },
  { key: "video_editor_5", label: "Video Editor 5", group: "Production / Video" },

  { key: "influencer", label: "Influencer Team", group: "Other Resources" },
  { key: "perf_growth", label: "Performance & Growth", group: "Other Resources" },
];

const ROLE_BY_KEY: Record<string, { label: string; group: string }> = Object.fromEntries(
  ROLE_COLS.map(r => [r.key, { label: r.label, group: r.group }])
);

const GROUP_ORDER = Array.from(new Set(ROLE_COLS.map(r => r.group)));

// Map role-key → which role_category(ies) and designation keywords are eligible.
// `categories` filters by staffing_people.role_category; `match` further refines by designation keyword.
const ROLE_FILTER: Record<string, { categories?: string[]; match?: RegExp }> = {
  vsd: { categories: ["Operations"], match: /vertical service delivery|vsd|avp|vp -|director - vertical/i },
  principal_bopm: { categories: ["Operations"], match: /principal|principle/i },
  senior_bopm: { categories: ["Operations"], match: /senior|sr\.?|group|director|avp|vp /i },
  bopm: { categories: ["Operations"], match: /bopm|business operations|account|project manager/i },

  content_lead_2026: { categories: ["Content"] },
  senior_editor: { categories: ["Content"], match: /senior editor|senior director|senior content/i },
  managing_editor: { categories: ["Content"], match: /editor|content lead|associate director/i },
  content_lead: { categories: ["Content"], match: /lead|manager|director/i },

  seo_leader: { categories: ["SEO"], match: /lead|director|head|vp|principal/i },
  seo_group_head: { categories: ["SEO"], match: /group head|head|principal/i },
  sr_seo_manager: { categories: ["SEO"], match: /senior|sr\.?|lead/i },
  seo_manager: { categories: ["SEO"], match: /manager/i },
  sr_seo_analyst: { categories: ["SEO"], match: /senior|sr\.?/i },
  seo_analyst: { categories: ["SEO"], match: /analyst|associate|executive/i },

  strategy_cd: { categories: ["Content Strategy", "Creative Art"], match: /director|cd|head/i },
  strategy_acd: { categories: ["Content Strategy", "Creative Art"], match: /associate|acd|manager/i },
  strategy_sr: { categories: ["Content Strategy"], match: /senior|sr\.?/i },

  cd_copy: { categories: ["Creative Copy"], match: /creative director|cd|director|head/i },
  acd_copy: { categories: ["Creative Copy"], match: /acd|associate|group head/i },
  sr_copywriter: { categories: ["Creative Copy"], match: /senior|sr\.?/i },
  jr_copywriter: { categories: ["Creative Copy"], match: /junior|jr\.?|copywriter/i },

  sr_cd_art: { categories: ["Creative Art"], match: /senior creative director|senior cd|senior director/i },
  acd_art: { categories: ["Creative Art"], match: /acd|associate creative/i },
  art_director: { categories: ["Creative Art"], match: /art director|creative director/i },
  sr_designer: { categories: ["Creative Art"], match: /senior designer|sr\.? designer/i },
  jr_designer: { categories: ["Creative Art"], match: /junior|jr\.?|graphic designer|designer/i },

  production_head: { categories: ["Video"], match: /head|director|lead/i },
  ad_video_pm: { categories: ["Video"], match: /associate director|ad |associate/i },
  video_pm: { categories: ["Video"], match: /pm|project manager|acppm|manager/i },
  video_editor_1: { categories: ["Video"], match: /editor/i },
  video_editor_2: { categories: ["Video"], match: /editor/i },
  video_editor_3: { categories: ["Video"], match: /editor/i },
  video_editor_4: { categories: ["Video"], match: /editor/i },
  video_editor_5: { categories: ["Video"], match: /editor/i },

  influencer: { match: /influencer/i },
  perf_growth: { match: /performance|growth|revenue|gtm|sales/i },
};

/** Filter eligible people for a given role key. Falls back to all people if no filter is defined. */
export function filterPeopleByRole(people: Person[], roleKey: string): Person[] {
  const f = ROLE_FILTER[roleKey];
  if (!f) return people;
  return people.filter(p => {
    if (f.categories && f.categories.length) {
      if (!p.roleCategory || !f.categories.includes(p.roleCategory)) return false;
    }
    if (f.match) {
      const hay = `${p.designation || ""} ${p.roleTitle || ""}`;
      if (!f.match.test(hay)) return false;
    }
    return true;
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmtCurrency = (n?: number) => {
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)} K`;
  return `₹${n}`;
};

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
  onUpdateDeal: (dealId: string, updates: Partial<Deal>) => void;
  onUpsertAssignment: (dealId: string, roleKey: string, personId: string, pct: number) => void;
}

export function MatrixTab({ deals, people, assignments, onUpdateDeal, onUpsertAssignment }: Props) {
  const [dealSearch, setDealSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "needs" | "staffed">("all");
  const [vsdFilter, setVsdFilter] = useState<string>("All");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(deals[0]?.id || null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(GROUP_ORDER));
  const [adding, setAdding] = useState<string | null>(null); // group key being added to

  // Auto-select first deal if current selection becomes invalid
  useEffect(() => {
    if (!selectedDealId && deals.length > 0) setSelectedDealId(deals[0].id);
  }, [deals, selectedDealId]);

  const personOptions = useMemo(
    () => people.filter(p => !p.tbh && !p.leaving),
    [people]
  );
  const personMap = useMemo(() => {
    const m: Record<string, Person> = {};
    people.forEach(p => { m[p.id] = p; });
    return m;
  }, [people]);

  // Total current allocation % per person across all deals (occupancy)
  const occupancyByPerson = useMemo(() => {
    const m: Record<string, number> = {};
    assignments.forEach(a => {
      m[a.personId] = (m[a.personId] || 0) + (a.allocationPct || 0);
    });
    return m;
  }, [assignments]);

  // Map dealId -> VSD (so we can group people by VSD for the picker filter)
  const vsdByDealId = useMemo(() => {
    const m: Record<string, string> = {};
    deals.forEach(d => { m[d.id] = d.vsd?.trim() || "Yet to be assigned"; });
    return m;
  }, [deals]);

  // For each VSD, set of personIds currently assigned to any of their deals
  const peopleByVsd = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    assignments.forEach(a => {
      const v = vsdByDealId[a.dealId];
      if (!v) return;
      if (!m[v]) m[v] = new Set();
      m[v].add(a.personId);
    });
    return m;
  }, [assignments, vsdByDealId]);

  // Index assignments by deal
  const assignmentsByDeal = useMemo(() => {
    const m: Record<string, StaffingAssignment[]> = {};
    assignments.forEach(a => {
      if (!m[a.dealId]) m[a.dealId] = [];
      m[a.dealId].push(a);
    });
    return m;
  }, [assignments]);

  const vsdOptions = useMemo(() => {
    const set = new Set<string>();
    deals.forEach(d => set.add(d.vsd?.trim() || "Yet to be assigned"));
    return ["All", ...Array.from(set).sort((a, b) => {
      if (a === "Yet to be assigned") return 1;
      if (b === "Yet to be assigned") return -1;
      return a.localeCompare(b);
    })];
  }, [deals]);

  // Filter deals
  const filteredDeals = useMemo(() => {
    const q = dealSearch.toLowerCase().trim();
    return deals.filter(d => {
      const has = (assignmentsByDeal[d.id] || []).length > 0;
      if (statusFilter === "needs" && has) return false;
      if (statusFilter === "staffed" && !has) return false;
      if (vsdFilter !== "All") {
        const v = d.vsd?.trim() || "Yet to be assigned";
        if (v !== vsdFilter) return false;
      }
      if (!q) return true;
      return (
        d.dealName.toLowerCase().includes(q) ||
        d.account.toLowerCase().includes(q) ||
        (d.pcCode || "").toLowerCase().includes(q) ||
        (d.vsd || "").toLowerCase().includes(q)
      );
    });
  }, [deals, dealSearch, statusFilter, vsdFilter, assignmentsByDeal]);

  const selectedDeal = useMemo(
    () => deals.find(d => d.id === selectedDealId) || null,
    [deals, selectedDealId]
  );

  const dealAssignments = selectedDeal ? (assignmentsByDeal[selectedDeal.id] || []) : [];
  const totalAlloc = dealAssignments.reduce((s, a) => s + (a.allocationPct || 0), 0);
  const totalHours = Math.round((totalAlloc / 100) * 160);

  // Group assignments by role group
  const assignmentsByGroup = useMemo(() => {
    const m: Record<string, StaffingAssignment[]> = {};
    GROUP_ORDER.forEach(g => { m[g] = []; });
    dealAssignments.forEach(a => {
      const g = ROLE_BY_KEY[a.roleKey]?.group || "Other Resources";
      if (!m[g]) m[g] = [];
      m[g].push(a);
    });
    return m;
  }, [dealAssignments]);

  const toggleGroup = (g: string) => setOpenGroups(prev => {
    const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n;
  });

  const handlePickPerson = (roleKey: string, personId: string) => {
    if (!selectedDeal) return;
    onUpsertAssignment(selectedDeal.id, roleKey, personId, 50); // sensible default 50%
    toast.success(`${personMap[personId]?.name || "Person"} assigned`);
    setAdding(null);
  };

  const handleChangePerson = (roleKey: string, personId: string, currentPct: number) => {
    if (!selectedDeal) return;
    onUpsertAssignment(selectedDeal.id, roleKey, personId, currentPct || 50);
  };

  const handleChangePct = (a: StaffingAssignment, pct: number) => {
    if (!selectedDeal) return;
    const clean = Math.max(0, Math.min(100, Number.isNaN(pct) ? 0 : pct));
    onUpsertAssignment(selectedDeal.id, a.roleKey, a.personId, clean);
  };

  const handleRemove = (a: StaffingAssignment) => {
    if (!selectedDeal) return;
    onUpsertAssignment(selectedDeal.id, a.roleKey, "", 0);
    toast.success("Assignment removed");
  };

  // Roles in this group not yet assigned (avoid duplicates in picker UI)
  const availableRolesForGroup = (group: string, currentRoleKey?: string) => {
    const usedKeys = new Set(dealAssignments.map(a => a.roleKey));
    return ROLE_COLS.filter(r => r.group === group && (r.key === currentRoleKey || !usedKeys.has(r.key)));
  };

  return (
    <div className="animate-fade-in grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
      {/* ── Left: Deal list ─────────────────────────────────────── */}
      <aside className="col-span-4 lg:col-span-3 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search deals…"
              value={dealSearch}
              onChange={e => setDealSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-ui text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex gap-1">
            {([
              { k: "all", label: "All" },
              { k: "needs", label: "Needs staffing" },
              { k: "staffed", label: "Staffed" },
            ] as const).map(t => (
              <button
                key={t.k}
                onClick={() => setStatusFilter(t.k)}
                className={cn(
                  "flex-1 h-7 px-2 rounded text-[11px] border transition-colors",
                  statusFilter === t.k
                    ? "bg-primary/10 border-primary/40 text-primary font-medium"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                )}
              >{t.label}</button>
            ))}
          </div>
          <select
            value={vsdFilter}
            onChange={e => setVsdFilter(e.target.value)}
            className="w-full h-8 px-2 rounded-md bg-background border border-border text-[11px] text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
          >
            {vsdOptions.map(o => <option key={o} value={o}>{o === "All" ? "All VSDs" : `VSD: ${o}`}</option>)}
          </select>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-1">
            {filteredDeals.length} deals
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredDeals.length === 0 ? (
            <div className="p-6 text-center text-caption text-muted-foreground">No deals match.</div>
          ) : (
            <ul>
              {filteredDeals.slice(0, 200).map(d => {
                const isActive = d.id === selectedDealId;
                const count = (assignmentsByDeal[d.id] || []).length;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => { setSelectedDealId(d.id); setAdding(null); }}
                      className={cn(
                        "w-full text-left px-3 py-2 border-b border-border/40 transition-colors",
                        isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary/40 border-l-2 border-l-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className={cn("text-ui font-medium truncate", isActive ? "text-foreground" : "text-foreground")}>
                            {d.dealName || "(unnamed)"}
                          </div>
                          <div className="text-caption text-muted-foreground truncate">{d.account}</div>
                        </div>
                        <span className={cn(
                          "shrink-0 inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-mono tabular-nums",
                          count === 0
                            ? "bg-[hsl(var(--danger-bg))] text-destructive"
                            : "bg-[hsl(var(--success-bg))] text-positive"
                        )}>
                          <Users className="h-2.5 w-2.5" /> {count}
                        </span>
                      </div>
                      {(d.pcCode || d.vsd) && (
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          {d.pcCode && <span className="font-mono">{d.pcCode}</span>}
                          {d.vsd && <span className="truncate">· {d.vsd}</span>}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
              {filteredDeals.length > 200 && (
                <li className="px-3 py-2 text-[10px] text-muted-foreground italic border-t border-border">
                  Showing first 200. Refine search to see more.
                </li>
              )}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Right: Deal detail / staffing builder ───────────────────── */}
      <section className="col-span-8 lg:col-span-9 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
        {!selectedDeal ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-ui">
            Select a deal to staff
          </div>
        ) : (
          <>
            {/* Deal header */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-caption text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{selectedDeal.account}</span>
                    {selectedDeal.pcCode && <span className="font-mono">· {selectedDeal.pcCode}</span>}
                  </div>
                  <h2 className="text-subhead font-bold text-foreground truncate mt-0.5">{selectedDeal.dealName || "(unnamed deal)"}</h2>
                </div>
                <div className="flex flex-wrap gap-3 text-right shrink-0">
                  <Stat label="MRR" value={fmtCurrency(selectedDeal.mrr)} />
                  <Stat label="TCV" value={fmtCurrency(selectedDeal.totalDealValue)} />
                  <Stat
                    label="Allocated"
                    value={`${totalAlloc.toFixed(0)}% · ${totalHours}h`}
                    tone={totalAlloc > 100 ? "warn" : totalAlloc > 0 ? "ok" : "muted"}
                  />
                </div>
              </div>

              {/* Inline editable selectors */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <SelectChip
                  label="Type"
                  value={selectedDeal.dealType || ""}
                  options={["Retainer", "Non-Retainer", "Pilot"]}
                  onChange={v => onUpdateDeal(selectedDeal.id, { dealType: v as Deal["dealType"] })}
                />
                <SelectChip
                  label="Status"
                  value={selectedDeal.dealStatus || ""}
                  options={["Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal Completed Successfully", "Deal Churned / Lost"]}
                  onChange={v => onUpdateDeal(selectedDeal.id, { dealStatus: v })}
                />
                <SelectChip
                  label="Staffing"
                  value={selectedDeal.staffingStatus || ""}
                  options={["Already Staffed", "Staffing Needed", "No Staffing Needed"]}
                  onChange={v => onUpdateDeal(selectedDeal.id, { staffingStatus: v })}
                />
                <SelectChip
                  label="Strategy BW"
                  value={selectedDeal.strategyBandwidthRequired || ""}
                  options={["Yes", "No", "Yes - Ad Hoc Strategy", "Not Applicable"]}
                  onChange={v => onUpdateDeal(selectedDeal.id, { strategyBandwidthRequired: v })}
                />
              </div>
            </div>

            {/* Role groups */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {GROUP_ORDER.map(group => {
                const isOpen = openGroups.has(group);
                const groupAssigns = assignmentsByGroup[group] || [];
                const isAddingHere = adding === group;
                return (
                  <div key={group} className="border border-border rounded-lg bg-background/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/30 transition-colors"
                    >
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="text-ui font-semibold text-foreground">{group}</span>
                      <span className="text-caption text-muted-foreground">
                        {groupAssigns.length === 0 ? "no roles assigned" : `${groupAssigns.length} ${groupAssigns.length === 1 ? "person" : "people"}`}
                      </span>
                      <span className="ml-auto text-caption text-muted-foreground font-mono tabular-nums">
                        {groupAssigns.reduce((s, a) => s + (a.allocationPct || 0), 0)}%
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2">
                        {groupAssigns.map(a => {
                          const role = ROLE_BY_KEY[a.roleKey];
                          return (
                            <div key={a.id} className="flex items-center gap-2 bg-card border border-border rounded-md px-2 py-1.5">
                              <div className="w-40 text-caption text-muted-foreground shrink-0 truncate" title={role?.label || a.roleKey}>
                                {role?.label || a.roleKey}
                              </div>
                              <PersonPicker
                                people={personOptions}
                                selectedPersonId={a.personId}
                                onSelect={pid => handleChangePerson(a.roleKey, pid, a.allocationPct)}
                                occupancy={occupancyByPerson}
                                vsdOptions={vsdOptions}
                                peopleByVsd={peopleByVsd}
                                roleKey={a.roleKey}
                              />
                              <div className="flex items-center gap-1 ml-auto shrink-0">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={a.allocationPct || 0}
                                  onChange={e => handleChangePct(a, Number(e.target.value))}
                                  className="w-14 h-7 text-ui text-right font-mono tabular-nums bg-background border border-border rounded px-1.5 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                                />
                                <span className="text-caption text-muted-foreground w-4">%</span>
                                <span className="text-caption text-muted-foreground font-mono tabular-nums w-10 text-right">
                                  {Math.round(((a.allocationPct || 0) / 100) * 160)}h
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemove(a)}
                                  className="ml-1 h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Remove assignment"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Add-role row */}
                        {isAddingHere ? (
                          <AddRoleRow
                            roles={availableRolesForGroup(group)}
                            people={personOptions}
                            onCancel={() => { setAdding(null); }}
                            onConfirm={(roleKey, personId) => handlePickPerson(roleKey, personId)}
                            occupancy={occupancyByPerson}
                            vsdOptions={vsdOptions}
                            peopleByVsd={peopleByVsd}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setAdding(group); }}
                            disabled={availableRolesForGroup(group).length === 0}
                            className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-md border border-dashed border-border text-caption text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {availableRolesForGroup(group).length === 0 ? "All roles in this group are filled" : `Add ${group} role`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {totalAlloc === 0 && (
                <div className="flex items-center gap-2 text-caption text-muted-foreground p-3 rounded-md bg-secondary/30 border border-dashed border-border">
                  <AlertCircle className="h-4 w-4" />
                  No one is staffed on this deal yet. Expand a section above and click <em>Add role</em> to begin.
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function Stat({ label, value, tone = "muted" }: { label: string; value: string; tone?: "muted" | "ok" | "warn" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn(
        "text-ui font-mono tabular-nums font-semibold",
        tone === "warn" ? "text-destructive" : tone === "ok" ? "text-positive" : "text-foreground"
      )}>{value}</div>
    </div>
  );
}

function SelectChip({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 h-8 px-2 rounded-md border border-border bg-background hover:border-primary/40 transition-colors">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent text-caption text-foreground outline-none focus:ring-0 border-0 cursor-pointer"
      >
        {!options.includes(value) && <option value={value}>{value || "—"}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function PersonPicker({
  people, selectedPersonId, onSelect, occupancy = {}, vsdOptions = ["All"], peopleByVsd = {},
}: {
  people: Person[];
  selectedPersonId: string;
  onSelect: (id: string) => void;
  occupancy?: Record<string, number>;
  vsdOptions?: string[];
  peopleByVsd?: Record<string, Set<string>>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [vsd, setVsd] = useState<string>("All");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const selected = people.find(p => p.id === selectedPersonId);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 280) });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const lq = q.toLowerCase().trim();
    let base = people;
    if (vsd !== "All") {
      const allowed = peopleByVsd[vsd];
      if (allowed && allowed.size > 0) {
        base = people.filter(p => allowed.has(p.id));
      } else {
        base = [];
      }
    }
    if (!lq) return base.slice(0, 80);
    return base.filter(p =>
      p.name.toLowerCase().includes(lq) ||
      (p.designation || "").toLowerCase().includes(lq) ||
      (p.department || "").toLowerCase().includes(lq)
    ).slice(0, 80);
  }, [people, q, vsd, peopleByVsd]);

  return (
    <div className="relative flex-1 min-w-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full text-left h-7 px-2 rounded-md border border-border bg-background hover:border-primary/40 transition-colors flex items-center gap-2",
          !selected && "text-muted-foreground"
        )}
      >
        <span className="truncate text-ui">{selected?.name || "Select person…"}</span>
        {selected && (
          <span className={cn(
            "ml-auto shrink-0 text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded",
            (occupancy[selected.id] || 0) > 100 ? "bg-[hsl(var(--danger-bg))] text-destructive"
              : (occupancy[selected.id] || 0) >= 80 ? "bg-[hsl(var(--warning-bg,var(--danger-bg)))] text-amber-600 dark:text-amber-400"
              : "bg-secondary text-muted-foreground"
          )} title="Current total allocation across all deals">
            {(occupancy[selected.id] || 0).toFixed(0)}%
          </span>
        )}
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[61] bg-card border border-border rounded-md shadow-lg max-h-80 overflow-hidden flex flex-col"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="p-2 border-b border-border space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search by name, designation…"
                  className="w-full h-7 pl-7 pr-2 text-caption bg-background border border-border rounded outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              {vsdOptions.length > 1 && (
                <select
                  value={vsd}
                  onChange={e => setVsd(e.target.value)}
                  className="w-full h-7 px-2 text-caption bg-background border border-border rounded outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {vsdOptions.map(v => (
                    <option key={v} value={v}>{v === "All" ? "All VSDs" : `VSD: ${v}`}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-caption text-muted-foreground text-center">No people match</div>
              ) : (
                filtered.map(p => {
                  const occ = occupancy[p.id] || 0;
                  const occTone = occ > 100 ? "bg-[hsl(var(--danger-bg))] text-destructive"
                    : occ >= 80 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : occ > 0 ? "bg-[hsl(var(--success-bg))] text-positive"
                    : "bg-secondary text-muted-foreground";
                  return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onSelect(p.id); setOpen(false); setQ(""); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-secondary/40 transition-colors",
                      p.id === selectedPersonId && "bg-primary/10"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-ui text-foreground truncate">{p.name}</div>
                      {(p.designation || p.department) && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {p.designation}{p.designation && p.department ? " · " : ""}{p.department}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn("shrink-0 text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded", occTone)}
                      title="Current total allocation across all deals"
                    >
                      {occ.toFixed(0)}%
                    </span>
                    {p.id === selectedPersonId && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                  );
                })
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function AddRoleRow({
  roles, people, onCancel, onConfirm, occupancy, vsdOptions, peopleByVsd,
}: {
  roles: { key: string; label: string }[];
  people: Person[];
  onCancel: () => void;
  onConfirm: (roleKey: string, personId: string) => void;
  occupancy?: Record<string, number>;
  vsdOptions?: string[];
  peopleByVsd?: Record<string, Set<string>>;
}) {
  const [roleKey, setRoleKey] = useState(roles[0]?.key || "");
  const [personId, setPersonId] = useState("");

  return (
    <div className="bg-primary/5 border border-primary/30 rounded-md p-2 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={roleKey}
          onChange={e => setRoleKey(e.target.value)}
          className="h-7 px-2 text-caption bg-background border border-border rounded outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-[160px]"
        >
          {roles.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <PersonPicker
          people={people}
          selectedPersonId={personId}
          onSelect={setPersonId}
          occupancy={occupancy}
          vsdOptions={vsdOptions}
          peopleByVsd={peopleByVsd}
        />
        <button
          type="button"
          onClick={() => { if (roleKey && personId) onConfirm(roleKey, personId); }}
          disabled={!roleKey || !personId}
          className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-caption font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >Add</button>
        <button
          type="button"
          onClick={onCancel}
          className="h-7 px-2 rounded-md border border-border text-caption text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >Cancel</button>
      </div>
    </div>
  );
}
