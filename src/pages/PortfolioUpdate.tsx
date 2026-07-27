import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Download, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";

type TabKey = "vsd" | "us_bopm" | "seo" | "creative";

interface DealRow {
  deal_id: string;
  deal_name: string;
  account: string;
  vsd: string;
  principal_bopm: string;
  senior_bopm: string;
  bopm: string;
  business_unit: string;
  capability_line: string;
}

interface Computed {
  rgy_status: string;
  nps: number | null;
  csat: number | null;
  mbr_pct: number | null;
  rgy_seo: string;
  rgy_creative: string;
}

interface SavedRow {
  deal_id: string;
  submitted_by: string;
  metrics: Record<string, unknown>;
  narrative: Record<string, string>;
}

const ACTIVE = ["Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal in Renewal Process"];
const SEO_DEPT = "dept_seo_capability";
const CREATIVE_DEPTS = new Set([
  "dept_capability_creative_strategy_team",
  "dept_creative_capability_copy",
  "dept_creative_capability_video",
  "dept_creative_capability_design",
  "dept_creative_capability_influencer",
]);

const TAB_META: Record<TabKey, {
  label: string;
  submitterLabel: string;
  metricCols: { key: string; label: string }[];
}> = {
  vsd: {
    label: "VSD",
    submitterLabel: "Submitted By (VSD)",
    metricCols: [
      { key: "nps", label: "NPS (latest)" },
      { key: "csat", label: "CSAT (latest)" },
      { key: "rev_vs_plan", label: "Revenue vs. Plan (%)" },
      { key: "at_risk_arr", label: "At-Risk ARR ($)" },
    ],
  },
  us_bopm: {
    label: "US BOPM",
    submitterLabel: "Submitted By (BOPM)",
    metricCols: [
      { key: "mbr_pct", label: "MBR Completion (%)" },
      { key: "active_esc", label: "Active Escalations (#)" },
      { key: "upsell", label: "Upsell Pipeline ($)" },
      { key: "sla_pct", label: "Client Response SLA Met (%)" },
    ],
  },
  seo: {
    label: "SEO",
    submitterLabel: "Submitted By (SEO Head)",
    metricCols: [
      { key: "traffic_delta", label: "Organic Traffic Δ (%)" },
      { key: "kw_top10", label: "Keywords in Top 10 (#)" },
      { key: "kw_up", label: "Keywords Moved Up (#)" },
      { key: "deliv_pct", label: "Deliverable Adherence (%)" },
      { key: "client_wins", label: "Client-Reported Wins" },
    ],
  },
  creative: {
    label: "Creative",
    submitterLabel: "Submitted By",
    metricCols: [
      { key: "utilization", label: "Team Utilization (%)" },
      { key: "on_time", label: "On-Time Delivery (%)" },
      { key: "revisions", label: "Avg. Revision Rounds (#)" },
      { key: "csat_creative", label: "CSAT on Creative (out of 5)" },
    ],
  },
};

const NARRATIVE_COLS: { key: string; label: string }[] = [
  { key: "summary", label: "Executive Summary" },
  { key: "achievements", label: "Key Achievements" },
  { key: "risks", label: "Risks / Blockers" },
  { key: "support", label: "Support Required" },
  { key: "priorities", label: "Priorities for Next Month" },
];

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function monthLabel(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
function firstNonEmpty(...xs: (string | null | undefined)[]) {
  for (const x of xs) if (x && x.trim()) return x.trim();
  return "";
}
function worstOf(vals: (string | null | undefined)[]): string {
  const order: Record<string, number> = { R: 3, Y: 2, G: 1 };
  let best = ""; let bestN = 0;
  for (const v of vals) {
    const k = (v || "").trim().toUpperCase();
    const n = order[k] || 0;
    if (n > bestN) { bestN = n; best = k; }
  }
  return { R: "Red", Y: "Yellow", G: "Green" }[best as "R" | "Y" | "G"] || "";
}
function dimLabel(v: string | null | undefined) {
  return { R: "Red", Y: "Yellow", G: "Green" }[((v || "").trim().toUpperCase()) as "R" | "Y" | "G"] || "";
}

function rgyBadge(v: string) {
  const cls =
    v === "Red" ? "bg-red-500/15 text-red-700 border-red-500/30"
    : v === "Yellow" ? "bg-yellow-500/15 text-yellow-700 border-yellow-500/30"
    : v === "Green" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
    : "bg-muted text-muted-foreground border-border";
  return <Badge variant="outline" className={cls}>{v || "—"}</Badge>;
}

export default function PortfolioUpdate() {
  const { toast } = useToast();
  const { isAdmin, isActuallyAdmin } = useUserRole();
  const admin = isAdmin || isActuallyAdmin;

  const [month, setMonth] = useState<string>(monthKey());
  const [tab, setTab] = useState<TabKey>("vsd");
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [computed, setComputed] = useState<Record<string, Computed>>({});
  const [appl, setAppl] = useState<Record<string, Set<string>>>({});
  const [saved, setSaved] = useState<Record<string, SavedRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>("");

  // Load deals + computed metrics (respects RLS)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: dealsData } = await supabase
        .from("staffing_deals")
        .select("id, deal_name, account, vsd, principal_bopm, senior_bopm, bopm, business_unit, capability_line, deal_status")
        .in("deal_status", ACTIVE);
      const ds: DealRow[] = ((dealsData as any[]) || [])
        .map((d) => ({
          deal_id: d.id, deal_name: d.deal_name || "", account: d.account || "",
          vsd: d.vsd || "", principal_bopm: d.principal_bopm || "", senior_bopm: d.senior_bopm || "",
          bopm: d.bopm || "", business_unit: d.business_unit || "", capability_line: d.capability_line || "",
        }))
        .sort((a, b) => (a.account || a.deal_name).localeCompare(b.account || b.deal_name));
      const ids = ds.map((d) => d.deal_id);

      const [rgyRes, npsRes, mbrRes, applRes] = await Promise.all([
        supabase.from("deal_rgy_weekly")
          .select("deal_id, week_start, account_health, delivery, finance_billing, capability_seo, capability_creative, content, seo, copy, design, video, invoicing, receivables, margins")
          .in("deal_id", ids).order("week_start", { ascending: false }),
        supabase.from("survey_responses")
          .select("deal_id, nps, csat_avg, created_at")
          .in("deal_id", ids).order("created_at", { ascending: false }),
        supabase.from("mbr_entries")
          .select("deal_id, status, week_start")
          .in("deal_id", ids),
        supabase.from("deal_applicability")
          .select("deal_id, department_id, is_applicable")
          .in("deal_id", ids).eq("is_applicable", true),
      ]);

      // Latest RGY per deal
      const rgyLatest: Record<string, any> = {};
      ((rgyRes.data as any[]) || []).forEach((r) => { if (!rgyLatest[r.deal_id]) rgyLatest[r.deal_id] = r; });

      // Latest NPS/CSAT per deal
      const npsLatest: Record<string, { nps: number | null; csat: number | null }> = {};
      ((npsRes.data as any[]) || []).forEach((r) => {
        if (!npsLatest[r.deal_id]) npsLatest[r.deal_id] = { nps: r.nps, csat: r.csat_avg == null ? null : Number(r.csat_avg) };
      });

      // MBR completion (last 3 months)
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3); cutoff.setDate(1);
      const mbrAgg: Record<string, { due: number; done: number }> = {};
      ((mbrRes.data as any[]) || []).forEach((m) => {
        const ws = new Date(m.week_start);
        if (ws < cutoff) return;
        const a = (mbrAgg[m.deal_id] ||= { due: 0, done: 0 });
        a.due += 1;
        if (m.status === "Done") a.done += 1;
      });

      const applMap: Record<string, Set<string>> = {};
      ((applRes.data as any[]) || []).forEach((r) => {
        (applMap[r.deal_id] ||= new Set()).add(r.department_id);
      });

      const comp: Record<string, Computed> = {};
      ds.forEach((d) => {
        const r = rgyLatest[d.deal_id];
        const overall = r ? worstOf([
          r.account_health, r.delivery, r.finance_billing, r.capability_seo, r.capability_creative,
          r.content, r.seo, r.copy, r.design, r.video, r.invoicing, r.receivables, r.margins,
        ]) : "";
        const n = npsLatest[d.deal_id];
        const m = mbrAgg[d.deal_id];
        comp[d.deal_id] = {
          rgy_status: overall,
          nps: n?.nps ?? null,
          csat: n?.csat ?? null,
          mbr_pct: m && m.due ? Math.round((100 * m.done) / m.due) : null,
          rgy_seo: r ? dimLabel(r.capability_seo) : "",
          rgy_creative: r ? dimLabel(r.capability_creative) : "",
        };
      });

      if (cancelled) return;
      setDeals(ds);
      setComputed(comp);
      setAppl(applMap);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Load saved rows for month+tab
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("portfolio_updates")
        .select("deal_id, submitted_by, metrics, narrative")
        .eq("month", month).eq("tab", tab);
      const map: Record<string, SavedRow> = {};
      ((data as any[]) || []).forEach((r) => {
        map[r.deal_id] = {
          deal_id: r.deal_id,
          submitted_by: r.submitted_by || "",
          metrics: r.metrics || {},
          narrative: r.narrative || {},
        };
      });
      setSaved(map);
    })();
  }, [month, tab]);

  const relevantDeals = useMemo(() => {
    return deals.filter((d) => {
      if (tab === "vsd" || tab === "us_bopm") return true;
      const set = appl[d.deal_id] || new Set<string>();
      if (tab === "seo") {
        return set.has(SEO_DEPT)
          || (d.capability_line || "").toUpperCase().includes("SEO")
          || (d.business_unit || "").toUpperCase().includes("SEO");
      }
      // creative
      const anyCreative = [...set].some((x) => CREATIVE_DEPTS.has(x));
      return anyCreative
        || (d.business_unit || "").toUpperCase().includes("CREATIVE")
        || (d.business_unit || "").toUpperCase().includes("CONTENT");
    });
  }, [deals, appl, tab]);

  function submitterFor(d: DealRow): string {
    if (tab === "vsd") return d.vsd;
    if (tab === "us_bopm") return firstNonEmpty(d.principal_bopm, d.senior_bopm, d.bopm);
    if (tab === "seo") return "Mayur";
    return "";
  }
  function rgyFor(d: DealRow): string {
    const c = computed[d.deal_id];
    if (!c) return "";
    if (tab === "seo") return c.rgy_seo || c.rgy_status;
    if (tab === "creative") return c.rgy_creative || c.rgy_status;
    return c.rgy_status;
  }
  function metricDefault(d: DealRow, key: string): string {
    const c = computed[d.deal_id];
    if (!c) return "";
    if (key === "nps" && c.nps != null) return String(c.nps);
    if (key === "csat" && c.csat != null) return String(c.csat);
    if (key === "mbr_pct" && c.mbr_pct != null) return String(c.mbr_pct);
    return "";
  }

  async function saveRow(d: DealRow, patch: Partial<SavedRow>) {
    setSavingId(d.deal_id);
    const existing = saved[d.deal_id] || { deal_id: d.deal_id, submitted_by: submitterFor(d), metrics: {}, narrative: {} };
    const next: SavedRow = {
      deal_id: d.deal_id,
      submitted_by: patch.submitted_by ?? existing.submitted_by,
      metrics: { ...(existing.metrics || {}), ...(patch.metrics || {}) },
      narrative: { ...(existing.narrative || {}), ...(patch.narrative || {}) },
    };
    const { error } = await supabase
      .from("portfolio_updates")
      .upsert({
        month, tab, deal_id: d.deal_id,
        submitted_by: next.submitted_by,
        rgy_status: rgyFor(d),
        metrics: next.metrics as any,
        narrative: next.narrative as any,
      }, { onConflict: "month,tab,deal_id" });
    setSavingId("");
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setSaved((s) => ({ ...s, [d.deal_id]: next }));
  }

  function exportCsv() {
    const meta = TAB_META[tab];
    const headers = [
      "Month", "Deal / Client", meta.submitterLabel, "RGY Status",
      ...meta.metricCols.map((c) => c.label),
      ...NARRATIVE_COLS.map((c) => c.label),
    ];
    const rows = relevantDeals.map((d) => {
      const s = saved[d.deal_id];
      const submitter = s?.submitted_by || submitterFor(d);
      const metrics = meta.metricCols.map((c) => {
        const v = (s?.metrics as any)?.[c.key];
        if (v != null && v !== "") return String(v);
        return metricDefault(d, c.key);
      });
      const narr = NARRATIVE_COLS.map((c) => (s?.narrative as any)?.[c.key] || "");
      const label = `${d.deal_name}${d.account ? " / " + d.account : ""}`;
      return [monthLabel(month), label, submitter, rgyFor(d), ...metrics, ...narr];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Portfolio_Update_${meta.label}_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const meta = TAB_META[tab];

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Portfolio Update</h1>
            <p className="text-sm text-muted-foreground">
              Monthly one-row-per-deal update. RGY, NPS/CSAT and MBR % are auto-computed; fill the narrative and function-specific KPIs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={month.slice(0, 7)}
              onChange={(e) => setMonth(`${e.target.value}-01`)}
              className="w-40"
            />
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="vsd">VSD</TabsTrigger>
            <TabsTrigger value="us_bopm">US BOPM</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="creative">Creative</TabsTrigger>
          </TabsList>

          {(["vsd", "us_bopm", "seo", "creative"] as TabKey[]).map((tk) => (
            <TabsContent key={tk} value={tk} className="mt-4">
              {tk === tab && (
                <div className="border border-border rounded-lg overflow-auto bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium">Month</th>
                        <th className="px-3 py-2 font-medium min-w-[200px]">Deal / Client</th>
                        <th className="px-3 py-2 font-medium min-w-[140px]">{meta.submitterLabel}</th>
                        <th className="px-3 py-2 font-medium">RGY</th>
                        {meta.metricCols.map((c) => (
                          <th key={c.key} className="px-3 py-2 font-medium min-w-[110px]">{c.label}</th>
                        ))}
                        {NARRATIVE_COLS.map((c) => (
                          <th key={c.key} className="px-3 py-2 font-medium min-w-[220px]">{c.label}</th>
                        ))}
                        <th className="px-3 py-2 font-medium w-24">Save</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr><td colSpan={4 + meta.metricCols.length + NARRATIVE_COLS.length + 1} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
                      )}
                      {!loading && relevantDeals.length === 0 && (
                        <tr><td colSpan={4 + meta.metricCols.length + NARRATIVE_COLS.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                          No deals for this tab.
                        </td></tr>
                      )}
                      {!loading && relevantDeals.map((d) => {
                        const s = saved[d.deal_id];
                        const submitter = s?.submitted_by ?? submitterFor(d);
                        return (
                          <tr key={d.deal_id} className="border-t border-border align-top">
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{monthLabel(month)}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{d.deal_name}</div>
                              <div className="text-xs text-muted-foreground">{d.account}</div>
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                defaultValue={submitter}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v !== (s?.submitted_by ?? submitterFor(d))) saveRow(d, { submitted_by: v });
                                }}
                                className="h-8"
                              />
                            </td>
                            <td className="px-3 py-2">{rgyBadge(rgyFor(d))}</td>
                            {meta.metricCols.map((c) => {
                              const savedV = (s?.metrics as any)?.[c.key];
                              const value = savedV ?? metricDefault(d, c.key);
                              return (
                                <td key={c.key} className="px-3 py-2">
                                  <Input
                                    defaultValue={value}
                                    onBlur={(e) => {
                                      const v = e.target.value.trim();
                                      if (v !== String(value ?? "")) saveRow(d, { metrics: { [c.key]: v } });
                                    }}
                                    className="h-8"
                                  />
                                </td>
                              );
                            })}
                            {NARRATIVE_COLS.map((c) => (
                              <td key={c.key} className="px-3 py-2">
                                <Textarea
                                  defaultValue={(s?.narrative as any)?.[c.key] || ""}
                                  rows={2}
                                  onBlur={(e) => {
                                    const v = e.target.value;
                                    if (v !== ((s?.narrative as any)?.[c.key] || "")) saveRow(d, { narrative: { [c.key]: v } });
                                  }}
                                  className="min-h-[52px] text-xs"
                                />
                              </td>
                            ))}
                            <td className="px-3 py-2 text-center">
                              {savingId === d.deal_id ? <Loader2 className="h-4 w-4 animate-spin inline" /> : <Save className="h-4 w-4 text-muted-foreground inline" />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {!admin && (
          <p className="text-xs text-muted-foreground">You see only deals you have access to.</p>
        )}
      </div>
    </AppLayout>
  );
}