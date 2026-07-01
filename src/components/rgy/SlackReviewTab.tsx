import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Search, Hash, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type Rgy = "R" | "Y" | "G";

interface HealthRow {
  deal_id: string;
  channel_id: string | null;
  channel_name: string | null;
  is_connected: boolean;
  msg_count_90d: number;
  msg_count_30d: number;
  msg_count_7d: number;
  external_count_90d: number;
  internal_count_90d: number;
  last_msg_at: string | null;
  avg_gap_hours: number | null;
  rgy: Rgy;
  reason: string | null;
  computed_at: string;
}

interface DealMeta {
  id: string;
  account: string | null;
  deal_name: string | null;
  vsd: string | null;
  senior_bopm: string | null;
  principal_bopm: string | null;
  bopm: string | null;
  mrr: number | null;
}

interface Combined extends HealthRow {
  account: string;
  deal_name: string;
  vsd: string;
  senior_bopm: string;
  principal_bopm: string;
  mrr: number;
}

function useSlackHealth() {
  return useQuery({
    queryKey: ["slack-health"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Combined[]> => {
      const [{ data: health, error: e1 }, { data: deals, error: e2 }] = await Promise.all([
        supabase.from("slack_channel_health").select("*"),
        supabase
          .from("staffing_deals")
          .select("id, account, deal_name, vsd, senior_bopm, principal_bopm, bopm, mrr, deal_status")
          .in("deal_status", ["Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal in Renewal Process"]),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const map = new Map<string, HealthRow>((health || []).map((h: HealthRow) => [h.deal_id, h]));
      return (deals as DealMeta[] || []).map((d) => {
        const h = map.get(d.id) || {
          deal_id: d.id, channel_id: null, channel_name: null, is_connected: false,
          msg_count_90d: 0, msg_count_30d: 0, msg_count_7d: 0,
          external_count_90d: 0, internal_count_90d: 0,
          last_msg_at: null, avg_gap_hours: null, rgy: "R" as Rgy,
          reason: "No Slack channel linked", computed_at: new Date().toISOString(),
        };
        return {
          ...h,
          account: d.account || "",
          deal_name: d.deal_name || "",
          vsd: d.vsd || "",
          senior_bopm: d.senior_bopm || "",
          principal_bopm: d.principal_bopm || "",
          mrr: Number(d.mrr) || 0,
        };
      });
    },
  });
}

const rgyStyles: Record<Rgy, { chip: string; border: string; dot: string; label: string }> = {
  R: { chip: "bg-red-100 text-red-700", border: "border-l-red-500", dot: "bg-red-500", label: "Red" },
  Y: { chip: "bg-amber-100 text-amber-700", border: "border-l-amber-500", dot: "bg-amber-500", label: "Yellow" },
  G: { chip: "bg-emerald-100 text-emerald-700", border: "border-l-emerald-500", dot: "bg-emerald-500", label: "Green" },
};

function fmtInr(n: number) {
  if (!n) return "-";
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

function slackLink(channelId: string | null) {
  if (!channelId) return null;
  return `slack://channel?id=${channelId}`;
}

export function SlackReviewTab() {
  const { data, isLoading, refetch, isFetching } = useSlackHealth();
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "dashboard">("list");
  const [rgyFilter, setRgyFilter] = useState<string>("");
  const [vsdFilter, setVsdFilter] = useState<string>("");
  const [connFilter, setConnFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [rebuilding, setRebuilding] = useState(false);

  const rows = data || [];

  const vsdList = useMemo(
    () => Array.from(new Set(rows.map((r) => r.vsd).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (rgyFilter && r.rgy !== rgyFilter) return false;
      if (vsdFilter && r.vsd !== vsdFilter) return false;
      if (connFilter === "connected" && !r.is_connected) return false;
      if (connFilter === "not_connected" && r.is_connected) return false;
      if (ql) {
        const hay = `${r.account} ${r.deal_name} ${r.channel_name || ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rows, rgyFilter, vsdFilter, connFilter, q]);

  const kpi = useMemo(() => {
    const total = rows.length;
    const red = rows.filter((r) => r.rgy === "R").length;
    const yellow = rows.filter((r) => r.rgy === "Y").length;
    const green = rows.filter((r) => r.rgy === "G").length;
    const tracked = rows.filter((r) => r.is_connected).length;
    const noChannel = total - tracked;
    return { total, red, yellow, green, tracked, noChannel };
  }, [rows]);

  const byVsd = useMemo(() => {
    const m = new Map<string, { customers: number; r: number; y: number; g: number; connected: number; noChan: number; mrr: number }>();
    for (const r of rows) {
      const key = r.vsd || "(Unassigned)";
      const cur = m.get(key) || { customers: 0, r: 0, y: 0, g: 0, connected: 0, noChan: 0, mrr: 0 };
      cur.customers += 1;
      if (r.rgy === "R") cur.r += 1;
      if (r.rgy === "Y") cur.y += 1;
      if (r.rgy === "G") cur.g += 1;
      if (r.is_connected) cur.connected += 1; else cur.noChan += 1;
      cur.mrr += r.mrr;
      m.set(key, cur);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].customers - a[1].customers);
  }, [rows]);

  const bySrBopm = useMemo(() => {
    const m = new Map<string, { customers: number; r: number; y: number; g: number; connected: number; noChan: number; mrr: number }>();
    for (const r of rows) {
      const key = r.senior_bopm || r.principal_bopm || "(Unassigned)";
      const cur = m.get(key) || { customers: 0, r: 0, y: 0, g: 0, connected: 0, noChan: 0, mrr: 0 };
      cur.customers += 1;
      if (r.rgy === "R") cur.r += 1;
      if (r.rgy === "Y") cur.y += 1;
      if (r.rgy === "G") cur.g += 1;
      if (r.is_connected) cur.connected += 1; else cur.noChan += 1;
      cur.mrr += r.mrr;
      m.set(key, cur);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].customers - a[1].customers);
  }, [rows]);

  const rebuild = async () => {
    setRebuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-health-rebuild", { body: {} });
      if (error) throw error;
      toast.success(`Refreshed ${data?.rows ?? 0} rows${data?.hydrated ? `, hydrated ${data.hydrated} channel names` : ""}`);
      await qc.invalidateQueries({ queryKey: ["slack-health"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rebuild failed");
    } finally {
      setRebuilding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading Slack health...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border bg-card p-0.5">
          <button
            className={cn("px-3 py-1.5 text-xs font-medium rounded", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setView("list")}
          >
            Channel List
          </button>
          <button
            className={cn("px-3 py-1.5 text-xs font-medium rounded", view === "dashboard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setView("dashboard")}
          >
            Health Dashboard
          </button>
        </div>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground">
          Cached rollup - updates daily at 04:00 UTC
        </span>
        <Button size="sm" variant="outline" onClick={rebuild} disabled={rebuilding} className="h-8 gap-1.5">
          {rebuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Rebuild now
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <KpiCard label="Active deals" value={kpi.total} />
        <KpiCard label="Red - churn risk" value={kpi.red} tone="R" />
        <KpiCard label="Yellow - on watch" value={kpi.yellow} tone="Y" />
        <KpiCard label="Green - healthy" value={kpi.green} tone="G" />
        <KpiCard label="Tracked channels" value={kpi.tracked} tone="B" />
        <KpiCard label="No Slack channel" value={kpi.noChannel} tone="R" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={rgyFilter || "all"} onValueChange={(v) => setRgyFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="All RGY" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All RGY</SelectItem>
            <SelectItem value="R">Red only</SelectItem>
            <SelectItem value="Y">Yellow only</SelectItem>
            <SelectItem value="G">Green only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vsdFilter || "all"} onValueChange={(v) => setVsdFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="All VSDs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All VSDs</SelectItem>
            {vsdList.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={connFilter || "all"} onValueChange={(v) => setConnFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="All coverage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All coverage</SelectItem>
            <SelectItem value="connected">Connected</SelectItem>
            <SelectItem value="not_connected">Not connected</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search account, deal, channel..." className="h-8 pl-7 text-xs" />
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">{filtered.length} of {rows.length}</span>
      </div>

      {view === "list" ? (
        <ConnectionTable rows={filtered} />
      ) : (
        <Dashboard rows={filtered} byVsd={byVsd} bySrBopm={bySrBopm} kpi={kpi} />
      )}
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: "R" | "Y" | "G" | "B" }) {
  const color =
    tone === "R" ? "text-red-600" :
    tone === "Y" ? "text-amber-600" :
    tone === "G" ? "text-emerald-600" :
    tone === "B" ? "text-blue-600" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className={cn("text-2xl font-semibold tracking-tight", color)}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

function ConnectionTable({ rows }: { rows: Combined[] }) {
  if (rows.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-12">No deals match these filters.</div>;
  }
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Account</th>
              <th className="text-left px-3 py-2 font-medium">Deal</th>
              <th className="text-left px-3 py-2 font-medium">VSD</th>
              <th className="text-left px-3 py-2 font-medium">Sr / Principal BOPM</th>
              <th className="text-left px-3 py-2 font-medium">Slack</th>
              <th className="text-left px-3 py-2 font-medium">Channel</th>
              <th className="text-right px-3 py-2 font-medium">Last message</th>
              <th className="text-right px-3 py-2 font-medium">90d msgs</th>
              <th className="text-left px-3 py-2 font-medium">Health</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = rgyStyles[r.rgy];
              const link = slackLink(r.channel_id);
              return (
                <tr key={r.deal_id} className={cn("border-t border-border hover:bg-accent/20", `border-l-4 ${s.border}`)}>
                  <td className="px-3 py-2 font-medium">{r.account || "-"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.deal_name}</td>
                  <td className="px-3 py-2">{r.vsd || "-"}</td>
                  <td className="px-3 py-2">{r.senior_bopm || r.principal_bopm || "-"}</td>
                  <td className="px-3 py-2">
                    {r.is_connected ? (
                      <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px]">Connected</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 border-red-200 text-red-700 text-[10px]">Not connected</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.channel_id ? (
                      link ? (
                        <a href={link} className="text-primary hover:underline inline-flex items-center gap-1">
                          <Hash className="h-3 w-3" /> {r.channel_name || r.channel_id}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" /> {r.channel_name || r.channel_id}</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {r.last_msg_at ? formatDistanceToNow(new Date(r.last_msg_at), { addSuffix: true }) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{r.msg_count_90d}</td>
                  <td className="px-3 py-2">
                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase", s.chip)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                      {s.label}
                    </span>
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

function Dashboard({
  rows, byVsd, bySrBopm, kpi,
}: {
  rows: Combined[];
  byVsd: Array<[string, { customers: number; r: number; y: number; g: number; connected: number; noChan: number; mrr: number }]>;
  bySrBopm: Array<[string, { customers: number; r: number; y: number; g: number; connected: number; noChan: number; mrr: number }]>;
  kpi: { total: number; red: number; yellow: number; green: number; tracked: number; noChannel: number };
}) {
  const donut = useMemo(() => {
    const total = Math.max(1, kpi.red + kpi.yellow + kpi.green);
    const r = (kpi.red / total) * 360;
    const y = (kpi.yellow / total) * 360;
    return `conic-gradient(#dc2626 0deg ${r}deg, #d97706 ${r}deg ${r + y}deg, #059669 ${r + y}deg 360deg)`;
  }, [kpi]);

  return (
    <div className="space-y-4">
      {/* Donut + summary */}
      <div className="grid md:grid-cols-[240px_1fr] gap-3">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="relative w-36 h-36 mx-auto rounded-full" style={{ background: donut }}>
            <div className="absolute inset-6 bg-card rounded-full flex flex-col items-center justify-center">
              <div className="text-2xl font-semibold">{kpi.total}</div>
              <div className="text-[10px] text-muted-foreground">Active deals</div>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-xs text-left">
            <LegendRow color="#dc2626" label="Red - churn risk" value={kpi.red} />
            <LegendRow color="#d97706" label="Yellow - on watch" value={kpi.yellow} />
            <LegendRow color="#059669" label="Green - healthy" value={kpi.green} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-2">
          <p>
            <b>Headline:</b> {kpi.red} Red, {kpi.yellow} Yellow, {kpi.green} Green across {kpi.total} active retainers.{" "}
            {kpi.noChannel > 0 && (
              <>
                <span className="text-red-600 font-medium">{kpi.noChannel}</span> deals have <b>no Slack channel linked</b> - we have zero live visibility into them.
              </>
            )}
          </p>
          <p className="text-muted-foreground text-xs">
            RGY is computed from Slack cadence in the trailing 90 days. Red = no channel or no messages in 30 days.
            Yellow = active but low volume or slow cadence. Green = at least 3 messages in the last week and 20+ in 90 days.
          </p>
        </div>
      </div>

      {/* Customer cards */}
      <div className="space-y-1.5">
        {rows.slice(0, 200).map((r) => (
          <CustomerCard key={r.deal_id} row={r} />
        ))}
        {rows.length > 200 && (
          <div className="text-center text-xs text-muted-foreground py-2">
            Showing first 200 of {rows.length}. Apply filters to narrow.
          </div>
        )}
      </div>

      {/* Pivots */}
      <PivotTable title="Health by VSD" data={byVsd} keyLabel="VSD" />
      <PivotTable title="Health by Senior / Principal BOPM" data={bySrBopm} keyLabel="Sr / Principal BOPM" />
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      <span>{label}</span>
      <span className="ml-auto font-semibold">{value}</span>
    </div>
  );
}

function CustomerCard({ row }: { row: Combined }) {
  const s = rgyStyles[row.rgy];
  const link = slackLink(row.channel_id);
  return (
    <details className={cn("rounded-lg border border-border bg-card border-l-4 group", s.border)}>
      <summary className="cursor-pointer list-none px-3.5 py-2.5 flex flex-wrap items-center gap-2.5">
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide", s.chip)}>{s.label}</span>
        <span className="font-semibold text-sm min-w-[180px]">{row.account || row.deal_name}</span>
        <span className="text-[11px] text-muted-foreground">{row.deal_name}</span>
        <span className="text-[11px] text-muted-foreground">VSD: {row.vsd || "-"}</span>
        <span className="text-[11px] text-muted-foreground">Sr BOPM: {row.senior_bopm || row.principal_bopm || "-"}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {row.is_connected ? (
            link ? <a href={link} className="text-primary hover:underline inline-flex items-center gap-1"><Hash className="h-3 w-3" />{row.channel_name || row.channel_id}</a>
                 : <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />{row.channel_name || row.channel_id}</span>
          ) : (
            <span className="text-red-600 inline-flex items-center gap-1"><AlertCircle className="h-3 w-3" /> No channel</span>
          )}
        </span>
      </summary>
      <div className="px-3.5 pb-3 pt-1 border-t border-border grid md:grid-cols-4 gap-3 text-xs">
        <Stat label="Msgs 90d" value={row.msg_count_90d} />
        <Stat label="Msgs 30d" value={row.msg_count_30d} />
        <Stat label="Msgs 7d" value={row.msg_count_7d} />
        <Stat label="Last message" value={row.last_msg_at ? formatDistanceToNow(new Date(row.last_msg_at), { addSuffix: true }) : "-"} />
        <Stat label="Avg gap" value={row.avg_gap_hours ? `${row.avg_gap_hours.toFixed(1)} h` : "-"} />
        <Stat label="Inbound (Slack)" value={row.external_count_90d} />
        <Stat label="Sent from app" value={row.internal_count_90d} />
        <Stat label="MRR" value={fmtInr(row.mrr)} />
        {row.reason && (
          <div className="md:col-span-4 text-muted-foreground italic">{row.reason}</div>
        )}
      </div>
    </details>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function PivotTable({
  title, data, keyLabel,
}: {
  title: string;
  keyLabel: string;
  data: Array<[string, { customers: number; r: number; y: number; g: number; connected: number; noChan: number; mrr: number }]>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <span className="w-1 h-4 bg-primary rounded" /> {title}
      </h3>
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <table className="w-full text-xs">
          <thead className="bg-foreground text-background">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium">{keyLabel}</th>
              <th className="px-3 py-1.5 font-medium text-center">Customers</th>
              <th className="px-3 py-1.5 font-medium text-center">Red</th>
              <th className="px-3 py-1.5 font-medium text-center">Yellow</th>
              <th className="px-3 py-1.5 font-medium text-center">Green</th>
              <th className="px-3 py-1.5 font-medium text-center">Connected</th>
              <th className="px-3 py-1.5 font-medium text-center">No channel</th>
              <th className="px-3 py-1.5 font-medium text-right">Total MRR</th>
            </tr>
          </thead>
          <tbody>
            {data.map(([k, v]) => (
              <tr key={k} className="border-t border-border">
                <td className="px-3 py-1.5 font-medium">{k}</td>
                <td className="px-3 py-1.5 text-center">{v.customers}</td>
                <td className="px-3 py-1.5 text-center text-red-600 font-semibold">{v.r}</td>
                <td className="px-3 py-1.5 text-center text-amber-600 font-semibold">{v.y}</td>
                <td className="px-3 py-1.5 text-center text-emerald-600 font-semibold">{v.g}</td>
                <td className="px-3 py-1.5 text-center">{v.connected}</td>
                <td className="px-3 py-1.5 text-center">{v.noChan}</td>
                <td className="px-3 py-1.5 text-right">{fmtInr(v.mrr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}