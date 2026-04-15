import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMBRData, getWeekOptions, type MBREntry, type MBRDeal, type VSDSummary } from "@/hooks/useMBRData";
import { Loader2, CheckCircle2, Clock, BarChart3, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { MBRDetailDialog } from "@/components/mbr/MBRDetailDialog";
import { supabase } from "@/integrations/supabase/client";

// ── RGY dot helper ───────────────────────────────────────────────────────────
const RGY_DIMS = ["customer", "internal", "content", "seo", "supply", "copy", "design", "video"] as const;

function getWorstRGY(rgy: Record<string, string> | undefined): string {
  if (!rgy) return "bg-muted";
  const vals = RGY_DIMS.map(d => rgy[d] || "G");
  if (vals.includes("R")) return "bg-destructive";
  if (vals.includes("Y")) return "bg-warning";
  if (vals.includes("G")) return "bg-positive";
  return "bg-muted";
}

// ── VSD Summary Tab ──────────────────────────────────────────────────────────
function VSDSummaryTab({
  vsdSummary, totals, deals, entries, onSave, rgyMap
}: {
  vsdSummary: VSDSummary[]; totals: any; deals: MBRDeal[]; entries: MBREntry[];
  onSave: (params: any) => Promise<void>;
  rgyMap: Map<string, Record<string, string>>;
}) {
  const totalScheduled = vsdSummary.reduce((a, v) => a + v.scheduledCount, 0);
  const schedCompliance = totals.retainerAccounts > 0 ? Math.round((totalScheduled / totals.retainerAccounts) * 100) : 0;

  const [expandedVsd, setExpandedVsd] = useState<string | null>(null);
  const [viewDeal, setViewDeal] = useState<{ deal: MBRDeal; entry: MBREntry | null } | null>(null);

  const entryMap = new Map(entries.map(e => [e.dealId, e]));
  const toggleExpand = (vsd: string) => setExpandedVsd(prev => prev === vsd ? null : vsd);
  const vsdDeals = expandedVsd ? deals.filter(d => d.vsd === expandedVsd) : [];

  const sentimentDot = (s: string | null) => {
    if (!s) return <span className="text-muted-foreground text-xs">—</span>;
    const colors: Record<string, string> = { Green: "bg-positive", Yellow: "bg-warning", Red: "bg-destructive" };
    return <span className={cn("w-3 h-3 rounded-full inline-block", colors[s] || "bg-muted")} title={s} />;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        <MetricCard label="Retainer Accounts" value={String(totals.retainerAccounts)} />
        <MetricCard label="MBRs Done" value={String(totals.done)} />
        <MetricCard label="Not Done" value={String(totals.notDone)} />
        <MetricCard label="Pending to Update" value={String(totals.pending)} />
        <MetricCard label="Scheduling Compliance" value={`${schedCompliance}%`} />
      </div>

      <div className="data-card p-0 overflow-hidden">
        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="w-8" />
              {["VSD", "Accounts", "Done", "Not Done", "Pending", "🟢", "🟡", "🔴", "Scheduled"].map(h => (
                <th key={h} className="text-left py-3 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vsdSummary.map(v => (
              <>
                <tr
                  key={v.vsd}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(v.vsd)}
                >
                  <td className="py-3 px-2 text-center">
                    {expandedVsd === v.vsd
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </td>
                  <td className="py-3 px-3 font-semibold text-foreground">{v.vsd}</td>
                  <td className="py-3 px-3 font-mono tabular-nums text-foreground">{v.retainerAccounts}</td>
                  <td className="py-3 px-3 font-mono tabular-nums text-positive font-semibold">{v.done}</td>
                  <td className="py-3 px-3 font-mono tabular-nums text-destructive font-semibold">{v.notDone}</td>
                  <td className="py-3 px-3 font-mono tabular-nums text-warning font-semibold">{v.pending}</td>
                  <td className="py-3 px-3 font-mono tabular-nums text-positive">{v.greenCount}</td>
                  <td className="py-3 px-3 font-mono tabular-nums text-warning">{v.yellowCount}</td>
                  <td className="py-3 px-3 font-mono tabular-nums text-destructive">{v.redCount}</td>
                  <td className="py-3 px-3 font-mono tabular-nums text-foreground">{v.scheduledCount}/{v.retainerAccounts}</td>
                </tr>
                {expandedVsd === v.vsd && vsdDeals.map(d => {
                  const entry = entryMap.get(d.id);
                  const status = entry?.status || "Pending";
                  const rgyDotColor = getWorstRGY(rgyMap.get(d.id));
                  return (
                    <tr
                      key={`deal-${d.id}`}
                      className="border-b border-border/30 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer"
                      onClick={() => setViewDeal({ deal: d, entry: entry || null })}
                    >
                      <td />
                      <td className="py-2 px-3 pl-8 text-sm text-muted-foreground flex items-center gap-2">
                        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", rgyDotColor)} title="Overall RGY" />
                        {d.account}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground truncate max-w-[120px]">{d.dealName}</td>
                      <td className="py-2 px-3">
                        <span className={cn(
                          "text-xs font-semibold rounded px-1.5 py-0.5",
                          status === "Done" && "bg-positive/15 text-positive",
                          status === "Not Done" && "bg-destructive/15 text-destructive",
                          status === "Pending" && "bg-warning/15 text-warning",
                          status === "Not Required" && "bg-muted text-muted-foreground",
                        )}>{status}</span>
                      </td>
                      <td />
                      <td />
                      <td className="py-2 px-3">{sentimentDot(entry?.sentiment ?? null)}</td>
                      <td />
                      <td />
                      <td className="py-2 px-3 text-xs text-muted-foreground">{entry?.scheduledDate || "—"}</td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {viewDeal && (
        <MBRDetailDialog
          open={!!viewDeal}
          onClose={() => setViewDeal(null)}
          deal={viewDeal.deal}
          entry={viewDeal.entry}
          onSave={onSave}
        />
      )}
    </div>
  );
}

// ── Deal-Level Tracker Tab ───────────────────────────────────────────────────
function DealTrackerTab({
  deals, entries, onSave
}: {
  deals: MBRDeal[]; entries: MBREntry[];
  onSave: (params: any) => Promise<void>;
}) {
  const [filterVsd, setFilterVsd] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewDeal, setViewDeal] = useState<{ deal: MBRDeal; entry: MBREntry | null } | null>(null);

  const entryMap = new Map(entries.map((e) => [e.dealId, e]));
  const vsds = [...new Set(deals.map(d => d.vsd))].sort();

  const filtered = deals.filter(d => {
    if (filterVsd !== "all" && d.vsd !== filterVsd) return false;
    if (filterStatus !== "all") {
      const entry = entryMap.get(d.id);
      const st = entry?.status || "Pending";
      if (filterStatus !== st) return false;
    }
    return true;
  });

  const handleRowClick = (deal: MBRDeal) => {
    const entry = entryMap.get(deal.id);
    setViewDeal({ deal, entry: entry || null });
  };

  const formatCurrency = (v: number | null) => {
    if (!v) return "—";
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    return `₹${v.toLocaleString("en-IN")}`;
  };

  const sentimentDot = (s: string | null) => {
    if (!s) return null;
    const colors: Record<string, string> = { Green: "bg-positive", Yellow: "bg-warning", Red: "bg-destructive" };
    return <span className={cn("w-3.5 h-3.5 rounded-full inline-block", colors[s] || "bg-muted")} title={s} />;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Select value={filterVsd} onValueChange={setFilterVsd}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by VSD" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All VSDs</SelectItem>
            {vsds.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Done">Done</SelectItem>
            <SelectItem value="Not Done">Not Done</SelectItem>
            <SelectItem value="Not Required">Not Required</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-caption text-muted-foreground self-center ml-2">{filtered.length} deals</span>
      </div>

      <div className="data-card p-0 overflow-auto max-h-[65vh]">
        <table className="w-full text-ui">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-secondary/60 backdrop-blur">
              {["PC Code", "Account", "Deal Name", "VSD", "Sr. BOPM", "MRR", "Status", "Sentiment", "Scheduled", "Anirudh Added", "Anirudh Joining", ""].map(h => (
                <th key={h} className="text-left py-3 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const entry = entryMap.get(d.id);
              const status = entry?.status || "Pending";
              return (
                <tr
                  key={d.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer group"
                  onClick={() => handleRowClick(d)}
                >
                  <td className="py-2.5 px-3 font-mono text-accent text-caption">{d.pcCode}</td>
                  <td className="py-2.5 px-3 font-medium text-foreground max-w-[140px] truncate">{d.account}</td>
                  <td className="py-2.5 px-3 text-muted-foreground max-w-[160px] truncate text-caption">{d.dealName}</td>
                  <td className="py-2.5 px-3 text-foreground whitespace-nowrap">{d.vsd}</td>
                  <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{d.seniorBopm}</td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-foreground whitespace-nowrap">{formatCurrency(d.mrr)}</td>
                  <td className="py-2.5 px-3">
                    <span className={cn(
                      "text-caption font-semibold rounded px-2 py-1 inline-block",
                      status === "Done" && "bg-positive/15 text-positive",
                      status === "Not Done" && "bg-destructive/15 text-destructive",
                      status === "Not Required" && "bg-muted text-muted-foreground",
                      status === "Pending" && "bg-warning/15 text-warning",
                    )}>{status}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">{sentimentDot(entry?.sentiment ?? null)}</td>
                  <td className="py-2.5 px-3 text-caption text-muted-foreground whitespace-nowrap">{entry?.scheduledDate || "—"}</td>
                  <td className="py-2.5 px-3 text-center">{entry?.anirudhAdded ? <span className="text-positive font-bold">✓</span> : <span className="text-muted-foreground">✗</span>}</td>
                  <td className="py-2.5 px-3 text-center">{entry?.anirudhJoining ? <span className="text-positive font-bold">✓</span> : <span className="text-muted-foreground">✗</span>}</td>
                  <td className="py-2.5 px-3">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewDeal && (
        <MBRDetailDialog
          open={!!viewDeal}
          onClose={() => setViewDeal(null)}
          deal={viewDeal.deal}
          entry={viewDeal.entry}
          onSave={onSave}
        />
      )}
    </div>
  );
}

// ── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ deals, selectedWeek }: { deals: MBRDeal[]; selectedWeek: string }) {
  const weeks = getWeekOptions().slice(0, 8);
  const [historyData, setHistoryData] = useState<Record<string, any[]>>({});
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      const weekValues = weeks.map(w => w.value);
      supabase.from("mbr_entries").select("*").in("week_start", weekValues).then(({ data }) => {
        if (data) {
          const grouped: Record<string, any[]> = {};
          for (const e of data) {
            if (!grouped[e.week_start]) grouped[e.week_start] = [];
            grouped[e.week_start].push(e);
          }
          setHistoryData(grouped);
        }
        setLoaded(true);
      });
    });
  }

  const totalDeals = deals.length;

  return (
    <div className="space-y-6">
      <div className="data-card p-6">
        <h3 className="text-ui font-semibold text-foreground mb-4">Weekly Completion Trend</h3>
        <div className="space-y-3">
          {weeks.map(w => {
            const weekEntries = historyData[w.value] || [];
            const done = weekEntries.filter((e: any) => e.status === "Done").length;
            const rate = totalDeals > 0 ? Math.round((done / totalDeals) * 100) : 0;
            const isCurrent = w.value === selectedWeek;
            return (
              <div key={w.value} className={cn("flex items-center gap-4 p-3 rounded-lg", isCurrent && "bg-accent/10 border border-accent/20")}>
                <span className="w-48 text-caption text-muted-foreground">{w.label}</span>
                <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                  <div className="bg-positive h-full rounded-full transition-all" style={{ width: `${rate}%` }} />
                </div>
                <span className="font-mono text-ui font-semibold text-foreground w-16 text-right">{rate}%</span>
                <span className="text-caption text-muted-foreground w-20">{done}/{totalDeals}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function MBRTracker() {
  const { deals, entries, loading, selectedWeek, setSelectedWeek, upsertEntry, vsdSummary, totals, refresh } = useMBRData();
  const weekOptions = getWeekOptions();

  // Fetch latest RGY data for all deals
  const [rgyMap, setRgyMap] = useState<Map<string, Record<string, string>>>(new Map());

  useEffect(() => {
    if (deals.length === 0) return;
    const dealIds = deals.map(d => d.id);
    supabase
      .from("deal_rgy_weekly")
      .select("deal_id, customer, internal, content, seo, supply, copy, design, video, week_start")
      .in("deal_id", dealIds)
      .order("week_start", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<string, Record<string, string>>();
        for (const row of data) {
          if (!map.has(row.deal_id)) {
            map.set(row.deal_id, {
              customer: row.customer,
              internal: row.internal,
              content: row.content,
              seo: row.seo,
              supply: row.supply,
              copy: row.copy,
              design: row.design,
              video: row.video,
            });
          }
        }
        setRgyMap(map);
      });
  }, [deals]);

  const handleSave = async (params: any) => {
    await upsertEntry(params);
    await refresh();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">MBR Tracker</h1>
            <p className="text-ui text-muted-foreground">Weekly Business Review completion tracking</p>
          </div>
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select week" /></SelectTrigger>
            <SelectContent>
              {weekOptions.map(w => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> VSD Summary</TabsTrigger>
            <TabsTrigger value="deals" className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Deal Tracker</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> History</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <VSDSummaryTab vsdSummary={vsdSummary} totals={totals} deals={deals} entries={entries} onSave={handleSave} rgyMap={rgyMap} />
          </TabsContent>

          <TabsContent value="deals">
            <DealTrackerTab deals={deals} entries={entries} onSave={handleSave} />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab deals={deals} selectedWeek={selectedWeek} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
