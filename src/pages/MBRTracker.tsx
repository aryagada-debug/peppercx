import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMBRData, getWeekOptions } from "@/hooks/useMBRData";
import { Loader2, CheckCircle2, XCircle, Clock, BarChart3 } from "lucide-react";
import { useState } from "react";

// ── VSD Summary Tab ──────────────────────────────────────────────────────────
function VSDSummaryTab({ vsdSummary, totals }: { vsdSummary: any[]; totals: any }) {
  const maxAccounts = Math.max(...vsdSummary.map(v => v.retainerAccounts), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Retainer Accounts" value={String(totals.retainerAccounts)} />
        <MetricCard label="MBRs Done" value={String(totals.done)} />
        <MetricCard label="Not Done" value={String(totals.notDone)} />
        <MetricCard label="Pending to Update" value={String(totals.pending)} />
      </div>

      {/* VSD Summary Table */}
      <div className="data-card p-0 overflow-hidden">
        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              {["VSD", "Retainer Accounts", "MBRs Done", "Not Done", "Pending to Update"].map(h => (
                <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vsdSummary.map(v => (
              <tr key={v.vsd} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="py-3 px-4 font-semibold text-foreground">{v.vsd}</td>
                <td className="py-3 px-4 font-mono tabular-nums text-foreground">{v.retainerAccounts}</td>
                <td className="py-3 px-4 font-mono tabular-nums text-positive font-semibold">{v.done}</td>
                <td className="py-3 px-4 font-mono tabular-nums text-destructive font-semibold">{v.notDone}</td>
                <td className="py-3 px-4 font-mono tabular-nums text-warning font-semibold">{v.pending}</td>
              </tr>
            ))}
            <tr className="bg-secondary/50 font-bold">
              <td className="py-3 px-4 text-foreground">Total</td>
              <td className="py-3 px-4 font-mono tabular-nums text-foreground">{totals.retainerAccounts}</td>
              <td className="py-3 px-4 font-mono tabular-nums text-positive">{totals.done}</td>
              <td className="py-3 px-4 font-mono tabular-nums text-destructive">{totals.notDone}</td>
              <td className="py-3 px-4 font-mono tabular-nums text-warning">{totals.pending}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Stacked Bar Chart */}
      <div className="data-card p-6">
        <h3 className="text-ui font-semibold text-foreground mb-4">MBR Completion by VSD</h3>
        <div className="space-y-3">
          {vsdSummary.map(v => {
            const total = v.done + v.notDone;
            const doneW = total > 0 ? (v.done / maxAccounts) * 100 : 0;
            const notDoneW = total > 0 ? (v.notDone / maxAccounts) * 100 : 0;
            return (
              <div key={v.vsd} className="flex items-center gap-4">
                <span className="w-36 text-ui text-foreground font-medium truncate">{v.vsd}</span>
                <div className="flex-1 flex items-center gap-1 h-7">
                  {v.done > 0 && (
                    <div
                      className="bg-positive h-full rounded-l flex items-center justify-center text-positive-foreground text-caption font-bold min-w-[24px]"
                      style={{ width: `${doneW}%` }}
                    >
                      {v.done}
                    </div>
                  )}
                  {v.notDone > 0 && (
                    <div
                      className="bg-destructive h-full flex items-center justify-center text-destructive-foreground text-caption font-bold min-w-[24px]"
                      style={{ width: `${notDoneW}%`, borderRadius: v.done === 0 ? '0.25rem 0 0 0.25rem' : '0' }}
                    >
                      {v.notDone}
                    </div>
                  )}
                  <span className="text-ui font-bold text-foreground ml-1">{v.retainerAccounts}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 text-caption text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-positive inline-block" /> Done</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-destructive inline-block" /> Not Done</span>
        </div>
      </div>
    </div>
  );
}

// ── Deal-Level Tracker Tab ───────────────────────────────────────────────────
function DealTrackerTab({ deals, entries, upsertEntry }: { deals: any[]; entries: any[]; upsertEntry: any }) {
  const [filterVsd, setFilterVsd] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const entryMap = new Map(entries.map((e: any) => [e.dealId, e]));
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

  const handleStatusChange = (dealId: string, status: string) => {
    const existing = entryMap.get(dealId);
    upsertEntry(dealId, status, existing?.mode || null, existing?.notes || null, "");
  };

  const handleModeChange = (dealId: string, mode: string) => {
    const existing = entryMap.get(dealId);
    upsertEntry(dealId, existing?.status || "Done", mode, existing?.notes || null, "");
  };

  const formatCurrency = (v: number | null) => {
    if (!v) return "—";
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    return `₹${v.toLocaleString("en-IN")}`;
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
              {["PC Code", "Account", "Deal Name", "VSD", "Sr. BOPM", "MRR", "Status", "Mode"].map(h => (
                <th key={h} className="text-left py-3 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const entry = entryMap.get(d.id);
              const status = entry?.status || "Pending";
              return (
                <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-accent text-caption">{d.pcCode}</td>
                  <td className="py-2.5 px-3 font-medium text-foreground max-w-[160px] truncate">{d.account}</td>
                  <td className="py-2.5 px-3 text-muted-foreground max-w-[200px] truncate text-caption">{d.dealName}</td>
                  <td className="py-2.5 px-3 text-foreground whitespace-nowrap">{d.vsd}</td>
                  <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{d.seniorBopm}</td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-foreground whitespace-nowrap">{formatCurrency(d.mrr)}</td>
                  <td className="py-2.5 px-3">
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(d.id, e.target.value)}
                      className={cn(
                        "text-caption font-semibold rounded px-2 py-1 border-0 outline-none cursor-pointer",
                        status === "Done" && "bg-positive/15 text-positive",
                        status === "Not Done" && "bg-destructive/15 text-destructive",
                        status === "Not Required" && "bg-muted text-muted-foreground",
                        status === "Pending" && "bg-warning/15 text-warning",
                      )}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Done">Done</option>
                      <option value="Not Done">Not Done</option>
                      <option value="Not Required">Not Required</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3">
                    {(status === "Done") && (
                      <select
                        value={entry?.mode || ""}
                        onChange={(e) => handleModeChange(d.id, e.target.value)}
                        className="text-caption rounded px-2 py-1 bg-secondary text-foreground border-0 outline-none cursor-pointer"
                      >
                        <option value="">Select</option>
                        <option value="In-Person">In-Person</option>
                        <option value="Virtual">Virtual</option>
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ deals, selectedWeek }: { deals: any[]; selectedWeek: string }) {
  const weeks = getWeekOptions().slice(0, 8);
  const [historyData, setHistoryData] = useState<Record<string, any[]>>({});
  const [loaded, setLoaded] = useState(false);

  // Load history on mount
  if (!loaded) {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      const weekValues = weeks.map(w => w.value);
      supabase
        .from("mbr_entries")
        .select("*")
        .in("week_start", weekValues)
        .then(({ data }) => {
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
  const { deals, entries, loading, selectedWeek, setSelectedWeek, upsertEntry, vsdSummary, totals } = useMBRData();
  const weekOptions = getWeekOptions();

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
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select week" />
            </SelectTrigger>
            <SelectContent>
              {weekOptions.map(w => (
                <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
              ))}
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
            <VSDSummaryTab vsdSummary={vsdSummary} totals={totals} />
          </TabsContent>

          <TabsContent value="deals">
            <DealTrackerTab deals={deals} entries={entries} upsertEntry={upsertEntry} />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab deals={deals} selectedWeek={selectedWeek} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
