import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";

const NA = "Not Applicable";

// Matrix role columns: maps a column to a staffing_assignments.role_key
const ROLE_COLS: { key: string; label: string; group: string }[] = [
  { key: "vsd", label: "VSD", group: "VSD & BOPM" },
  { key: "principal_bopm", label: "Principal BOPM", group: "VSD & BOPM" },
  { key: "senior_bopm", label: "Senior BOPM", group: "VSD & BOPM" },
  { key: "bopm", label: "BOPM", group: "VSD & BOPM" },
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

const DEAL_FIELD_GROUPS: { group: string; fields: { key: keyof Deal; label: string; type: "text" | "number" | "currency" }[] }[] = [
  {
    group: "Deal Identity",
    fields: [
      { key: "pepperBusinessUnit", label: "Pepper BU", type: "text" },
      { key: "capabilityLine", label: "Capability Line", type: "text" },
      { key: "pcCode", label: "PC Code", type: "text" },
      { key: "newDealIdFormulated", label: "Deal ID (Formulated)", type: "text" },
      { key: "newDealIdTemp", label: "Deal ID / Temp", type: "text" },
      { key: "dealType", label: "Deal Type", type: "text" },
      { key: "dealStatus", label: "Master Status", type: "text" },
      { key: "staffingStatus", label: "Staffing Status", type: "text" },
      { key: "validationCentralCx", label: "Validation by Central CX", type: "text" },
    ],
  },
  {
    group: "Financials",
    fields: [
      { key: "monthClosedWon", label: "Month of Closed Won", type: "text" },
      { key: "mrr", label: "MRR", type: "currency" },
      { key: "duration", label: "Duration", type: "text" },
      { key: "retainerDealValue", label: "Retainer Value", type: "currency" },
      { key: "nonRetainerDealValue", label: "Non-Retainer Value", type: "currency" },
      { key: "totalDealValue", label: "Total Deal Value", type: "currency" },
      { key: "dealValueLost", label: "Deal Value Lost", type: "currency" },
      { key: "netDealValue", label: "Net Deal Value", type: "currency" },
      { key: "totalMisRecognition", label: "Total MIS Recognition", type: "currency" },
      { key: "totalPendingRecognition", label: "Total Pending Recognition", type: "currency" },
      { key: "consumptionValue", label: "Consumption", type: "currency" },
      { key: "misVsConsumption", label: "MIS vs Consumption", type: "currency" },
      { key: "invoicedDealValue", label: "Invoiced Deal Value", type: "currency" },
      { key: "undeliveredFunnel", label: "Undelivered Funnel", type: "currency" },
      { key: "tcvUsd", label: "TCV (USD)", type: "number" },
      { key: "startDate", label: "Start Month", type: "text" },
      { key: "endDate", label: "End Month", type: "text" },
      { key: "dealTargetStatus", label: "Deal Target Status", type: "text" },
    ],
  },
];

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
  onUpdateDeal: (dealId: string, updates: Partial<Deal>) => void;
  onUpsertAssignment: (dealId: string, roleKey: string, personId: string, pct: number) => void;
}

export function MatrixTab({ deals, people, assignments, onUpdateDeal, onUpsertAssignment }: Props) {
  const [search, setSearch] = useState("");
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ dealId: string; field: string } | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const personOptions = useMemo(() => {
    return [{ id: "", name: NA }, ...people.filter(p => !p.tbh && !p.leaving).map(p => ({ id: p.id, name: p.name }))];
  }, [people]);

  const personMap = useMemo(() => {
    const m: Record<string, Person> = {};
    people.forEach(p => { m[p.id] = p; });
    return m;
  }, [people]);

  const assignmentBy = useMemo(() => {
    const m: Record<string, StaffingAssignment> = {};
    assignments.forEach(a => { m[`${a.dealId}::${a.roleKey}`] = a; });
    return m;
  }, [assignments]);

  const filtered = useMemo(() => {
    if (!search) return deals;
    const q = search.toLowerCase();
    return deals.filter(d =>
      d.dealName.toLowerCase().includes(q) ||
      d.account.toLowerCase().includes(q) ||
      (d.vsd || "").toLowerCase().includes(q) ||
      (d.pcCode || "").toLowerCase().includes(q)
    );
  }, [deals, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [filtered, currentPage]
  );

  const allGroups = useMemo(() => {
    const set = new Set<string>();
    DEAL_FIELD_GROUPS.forEach(g => set.add(g.group));
    ROLE_COLS.forEach(r => set.add(r.group));
    return Array.from(set);
  }, []);

  const fmtNum = (n?: number) => (n === undefined || n === null || Number.isNaN(n)) ? "" : n.toLocaleString();

  const startEdit = (dealId: string, field: string, current: string) => {
    setEditing({ dealId, field });
    setDraft(current);
  };

  const saveDealField = (deal: Deal, field: keyof Deal, type: "text" | "number" | "currency") => {
    let value: any = draft;
    if (type === "number" || type === "currency") {
      const n = Number(draft.replace(/,/g, ""));
      value = Number.isNaN(n) ? 0 : n;
    }
    onUpdateDeal(deal.id, { [field]: value } as Partial<Deal>);
    setEditing(null);
    toast.success("Saved");
  };

  const toggleGroup = (g: string) => setHiddenGroups(prev => {
    const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n;
  });

  return (
    <div className="animate-fade-in space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search deals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-ui text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-caption text-muted-foreground mr-1">Groups:</span>
          {allGroups.map(g => {
            const hidden = hiddenGroups.has(g);
            return (
              <button
                key={g}
                onClick={() => toggleGroup(g)}
                className={cn(
                  "h-7 px-2 rounded-md text-[11px] border transition-colors",
                  hidden ? "bg-secondary text-muted-foreground border-border" : "bg-card text-foreground border-border hover:bg-secondary/50"
                )}
              >
                {hidden ? "+ " : "− "}{g}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-caption text-muted-foreground">
            {filtered.length === 0 ? 0 : currentPage * PAGE_SIZE + 1}–
            {Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="h-7 px-2 rounded-md text-[11px] border border-border bg-card hover:bg-secondary/50 disabled:opacity-40"
          >Prev</button>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="h-7 px-2 rounded-md text-[11px] border border-border bg-card hover:bg-secondary/50 disabled:opacity-40"
          >Next</button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
        <table className="text-[11px] border-collapse">
          {/* Group header row */}
          <thead className="sticky top-0 z-30 bg-card">
            <tr>
              <th colSpan={3} className="sticky left-0 z-40 bg-secondary/40 border border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deal</th>
              {DEAL_FIELD_GROUPS.filter(g => !hiddenGroups.has(g.group)).map(g => (
                <th key={g.group} colSpan={g.fields.length} className="bg-secondary/40 border border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</th>
              ))}
              {Array.from(new Set(ROLE_COLS.map(r => r.group))).filter(g => !hiddenGroups.has(g)).map(g => {
                const cols = ROLE_COLS.filter(r => r.group === g);
                return <th key={g} colSpan={cols.length * 2} className="bg-secondary/40 border border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</th>;
              })}
              <th colSpan={2} className="bg-secondary/40 border border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Other</th>
            </tr>
            <tr>
              <th className="sticky left-0 z-30 bg-card border border-border px-2 py-1.5 text-left font-medium text-muted-foreground min-w-[60px]">PC Code</th>
              <th className="sticky left-[60px] z-30 bg-card border border-border px-2 py-1.5 text-left font-medium text-muted-foreground min-w-[140px]">Account</th>
              <th className="sticky left-[200px] z-30 bg-card border border-border px-2 py-1.5 text-left font-medium text-muted-foreground min-w-[200px]">Deal Name</th>
              {DEAL_FIELD_GROUPS.filter(g => !hiddenGroups.has(g.group)).flatMap(g => g.fields).map(f => (
                <th key={String(f.key)} className="bg-card border border-border px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">{f.label}</th>
              ))}
              {ROLE_COLS.filter(r => !hiddenGroups.has(r.group)).map(r => (
                <React.Fragment key={r.key}>
                  <th className="bg-card border border-border px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">{r.label}</th>
                  <th className="bg-card border border-border px-2 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap">% Mapping</th>
                </React.Fragment>
              ))}
              <th className="bg-card border border-border px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Strategy BW Required</th>
              <th className="bg-card border border-border px-2 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap">TCV (USD)</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(d => (
              <tr key={d.id} className="hover:bg-secondary/20">
                <td className="sticky left-0 z-10 bg-card border border-border px-2 py-1 font-mono text-foreground">{d.pcCode || "—"}</td>
                <td className="sticky left-[60px] z-10 bg-card border border-border px-2 py-1 text-foreground whitespace-nowrap">{d.account}</td>
                <td className="sticky left-[200px] z-10 bg-card border border-border px-2 py-1 text-foreground whitespace-nowrap">{d.dealName}</td>

                {DEAL_FIELD_GROUPS.filter(g => !hiddenGroups.has(g.group)).flatMap(g => g.fields).map(f => {
                  const isEditing = editing?.dealId === d.id && editing.field === String(f.key);
                  const raw = d[f.key];
                  const display = f.type === "currency" || f.type === "number"
                    ? fmtNum(raw as number | undefined)
                    : (raw as string | undefined) || "";
                  return (
                    <td key={String(f.key)} className="border border-border px-1 py-0.5 text-foreground whitespace-nowrap min-w-[80px]">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          onBlur={() => saveDealField(d, f.key, f.type)}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveDealField(d, f.key, f.type);
                            if (e.key === "Escape") setEditing(null);
                          }}
                          type={f.type === "text" ? "text" : "number"}
                          className="w-full h-6 px-1 text-[11px] bg-background border border-primary rounded outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(d.id, String(f.key), f.type === "text" ? (display as string) : String(raw ?? ""))}
                          className="w-full text-left hover:bg-accent/20 px-1 rounded"
                        >
                          {display || <span className="text-muted-foreground/50">—</span>}
                        </button>
                      )}
                    </td>
                  );
                })}

                {ROLE_COLS.filter(r => !hiddenGroups.has(r.group)).map(r => {
                  const a = assignmentBy[`${d.id}::${r.key}`];
                  return (
                    <React.Fragment key={r.key}>
                      <td className="border border-border px-1 py-0.5 min-w-[140px]">
                        <select
                          value={a?.personId || ""}
                          onChange={e => onUpsertAssignment(d.id, r.key, e.target.value, a?.allocationPct || 0)}
                          className="w-full h-6 text-[11px] bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded"
                        >
                          {personOptions.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-border px-1 py-0.5 text-right min-w-[60px]">
                        <input
                          type="number"
                          value={a?.allocationPct ?? ""}
                          onChange={e => {
                            const v = Number(e.target.value);
                            if (a?.personId) {
                              onUpsertAssignment(d.id, r.key, a.personId, Number.isNaN(v) ? 0 : v);
                            }
                          }}
                          disabled={!a?.personId}
                          className="w-full h-6 px-1 text-[11px] text-right bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded font-mono tabular-nums disabled:opacity-30"
                          placeholder="0"
                        />
                      </td>
                    </React.Fragment>
                  );
                })}

                {/* Other resources */}
                <td className="border border-border px-1 py-0.5 min-w-[140px]">
                  {editing?.dealId === d.id && editing.field === "strategyBandwidthRequired" ? (
                    <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => saveDealField(d, "strategyBandwidthRequired", "text")}
                      onKeyDown={e => { if (e.key === "Enter") saveDealField(d, "strategyBandwidthRequired", "text"); if (e.key === "Escape") setEditing(null); }}
                      className="w-full h-6 px-1 text-[11px] bg-background border border-primary rounded outline-none" />
                  ) : (
                    <button type="button" onClick={() => startEdit(d.id, "strategyBandwidthRequired", d.strategyBandwidthRequired || "")} className="w-full text-left hover:bg-accent/20 px-1 rounded">
                      {d.strategyBandwidthRequired || <span className="text-muted-foreground/50">—</span>}
                    </button>
                  )}
                </td>
                <td className="border border-border px-1 py-0.5 text-right min-w-[80px]">
                  {editing?.dealId === d.id && editing.field === "tcvUsd" ? (
                    <input autoFocus type="number" value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => saveDealField(d, "tcvUsd", "number")}
                      onKeyDown={e => { if (e.key === "Enter") saveDealField(d, "tcvUsd", "number"); if (e.key === "Escape") setEditing(null); }}
                      className="w-full h-6 px-1 text-[11px] text-right bg-background border border-primary rounded outline-none font-mono" />
                  ) : (
                    <button type="button" onClick={() => startEdit(d.id, "tcvUsd", String(d.tcvUsd ?? ""))} className="w-full text-right hover:bg-accent/20 px-1 rounded font-mono tabular-nums">
                      {fmtNum(d.tcvUsd) || <span className="text-muted-foreground/50">—</span>}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}