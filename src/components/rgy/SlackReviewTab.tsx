import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Search, Hash, AlertCircle, Sparkles, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { BopmFilter, dealMatchesBopm, useStaffedDealIdsByName } from "@/components/access/BopmFilter";
import { DealTypeFilter, dealMatchesType, type DealTypeFilterValue } from "@/components/filters/DealTypeFilter";
import { useAllPersonNames } from "@/hooks/queries/legacy";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { loadSlackChannels, type SlackChannel } from "@/lib/slackChannels";
import { useUserRole } from "@/hooks/useUserRole";
import { Link2, X } from "lucide-react";
import { useEffect } from "react";

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
  deal_type: string | null;
}

interface Combined extends HealthRow {
  account: string;
  deal_name: string;
  vsd: string;
  senior_bopm: string;
  principal_bopm: string;
  mrr: number;
  deal_type: string;
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
          .select("id, account, deal_name, vsd, senior_bopm, principal_bopm, bopm, mrr, deal_type, deal_status")
          .in("deal_status", ["Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal in Renewal Process"]),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const map = new Map<string, HealthRow>(
        (health || []).map((h): [string, HealthRow] => [h.deal_id, { ...h, rgy: (h.rgy as Rgy) } as HealthRow]),
      );
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
          account: (d.account || "").trim(),
          deal_name: (d.deal_name || "").trim(),
          vsd: (d.vsd || "").trim(),
          senior_bopm: (d.senior_bopm || "").trim(),
          principal_bopm: (d.principal_bopm || "").trim(),
          bopm: (d.bopm || "").trim(),
          mrr: Number(d.mrr) || 0,
          deal_type: (d.deal_type || "").trim(),
          principalBopm: (d.principal_bopm || "").trim(),
          seniorBopm: (d.senior_bopm || "").trim(),
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
  const { isAdmin } = useUserRole();
  const [view, setView] = useState<"list" | "dashboard">("list");
  const [rgyFilter, setRgyFilter] = useState<string>("");
  const [vsdFilter, setVsdFilter] = useState<string>("");
  const [connFilter, setConnFilter] = useState<string>("");
  const [bopmFilter, setBopmFilter] = useState<string>("All");
  const [dealTypeFilter, setDealTypeFilter] = useState<DealTypeFilterValue>("All");
  const [q, setQ] = useState("");
  const [rebuilding, setRebuilding] = useState(false);
  type SortKey = "account" | "deal_name" | "vsd" | "senior_bopm" | "is_connected" | "channel_name" | "last_msg_at" | "msg_count_90d" | "rgy";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const toggleSort = (k: SortKey) => {
    if (sortKey !== k) { setSortKey(k); setSortDir("asc"); return; }
    if (sortDir === "asc") { setSortDir("desc"); return; }
    setSortKey(null);
  };

  const rows = data || [];
  const registeredNames = useAllPersonNames();
  const bopmStaffedDealIds = useStaffedDealIdsByName(bopmFilter);

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
      if (!dealMatchesType(r.deal_type, dealTypeFilter)) return false;
      if (bopmFilter !== "All" && !dealMatchesBopm(r as any, bopmFilter, registeredNames, bopmStaffedDealIds)) return false;
      if (ql) {
        const hay = `${r.account} ${r.deal_name} ${r.channel_name || ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rows, rgyFilter, vsdFilter, connFilter, q, dealTypeFilter, bopmFilter, registeredNames, bopmStaffedDealIds]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const rgyOrder: Record<Rgy, number> = { R: 0, Y: 1, G: 2 };
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: any; let bv: any;
      switch (sortKey) {
        case "is_connected": av = a.is_connected ? 1 : 0; bv = b.is_connected ? 1 : 0; break;
        case "last_msg_at":
          av = a.last_msg_at ? new Date(a.last_msg_at).getTime() : 0;
          bv = b.last_msg_at ? new Date(b.last_msg_at).getTime() : 0; break;
        case "msg_count_90d": av = a.msg_count_90d; bv = b.msg_count_90d; break;
        case "rgy": av = rgyOrder[a.rgy]; bv = rgyOrder[b.rgy]; break;
        case "channel_name": av = (a.channel_name || "").toLowerCase(); bv = (b.channel_name || "").toLowerCase(); break;
        default: av = ((a as any)[sortKey] || "").toString().toLowerCase(); bv = ((b as any)[sortKey] || "").toString().toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const kpi = useMemo(() => {
    const total = filtered.length;
    const red = filtered.filter((r) => r.rgy === "R").length;
    const yellow = filtered.filter((r) => r.rgy === "Y").length;
    const green = filtered.filter((r) => r.rgy === "G").length;
    const tracked = filtered.filter((r) => r.is_connected).length;
    const noChannel = total - tracked;
    return { total, red, yellow, green, tracked, noChannel };
  }, [filtered]);

  const byVsd = useMemo(() => {
    const m = new Map<string, { customers: number; r: number; y: number; g: number; connected: number; noChan: number; mrr: number }>();
    for (const r of filtered) {
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
  }, [filtered]);

  const bySrBopm = useMemo(() => {
    const m = new Map<string, { customers: number; r: number; y: number; g: number; connected: number; noChan: number; mrr: number }>();
    for (const r of filtered) {
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
  }, [filtered]);

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
        <DealTypeFilter value={dealTypeFilter} onChange={setDealTypeFilter} />
        <BopmFilter value={bopmFilter} onChange={setBopmFilter} scopedVsd={vsdFilter || null} />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search account, deal, channel..." className="h-8 pl-7 text-xs" />
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">{filtered.length} of {rows.length}</span>
      </div>

      {view === "list" ? (
        <ConnectionTable rows={sorted} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} canLink={isAdmin} />
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

type SortKeyT = "account" | "deal_name" | "vsd" | "senior_bopm" | "is_connected" | "channel_name" | "last_msg_at" | "msg_count_90d" | "rgy";
function ConnectionTable({ rows, sortKey, sortDir, onSort, canLink }: {
  rows: Combined[];
  sortKey: SortKeyT | null;
  sortDir: "asc" | "desc";
  onSort: (k: SortKeyT) => void;
  canLink: boolean;
}) {
  if (rows.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-12">No deals match these filters.</div>;
  }
  const SortableTh = ({ k, label, align = "left" }: { k: SortKeyT; label: string; align?: "left" | "right" }) => {
    const active = sortKey === k;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className={cn("px-3 py-2 font-medium", align === "right" ? "text-right" : "text-left")}>
        <button
          type="button"
          onClick={() => onSort(k)}
          className={cn("inline-flex items-center gap-1 hover:text-foreground transition-colors", active && "text-foreground")}
        >
          {label}
          <Icon className="h-3 w-3 opacity-60" />
        </button>
      </th>
    );
  };
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <SortableTh k="account" label="Account" />
              <SortableTh k="deal_name" label="Deal" />
              <SortableTh k="vsd" label="VSD" />
              <SortableTh k="senior_bopm" label="Sr / Principal BOPM" />
              <SortableTh k="is_connected" label="Slack" />
              <SortableTh k="channel_name" label="Channel" />
              <SortableTh k="last_msg_at" label="Last message" align="right" />
              <SortableTh k="msg_count_90d" label="90d msgs" align="right" />
              <SortableTh k="rgy" label="Health" />
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
                    <ChannelLinkCell row={r} canLink={canLink} />
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {r.last_msg_at ? formatDistanceToNow(new Date(r.last_msg_at), { addSuffix: true }) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{r.msg_count_90d}</td>
                  <td className="px-3 py-2">
                    <span
                      title={r.reason || undefined}
                      className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase", s.chip)}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                      {s.label}
                    </span>
                    {r.reason ? (
                      <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[220px] leading-tight">
                        {r.reason}
                      </div>
                    ) : null}
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

function ChannelLinkCell({ row, canLink }: { row: Combined; canLink: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const link = slackLink(row.channel_id);

  useEffect(() => {
    if (!open || channels.length) return;
    setLoading(true);
    loadSlackChannels()
      .then(setChannels)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load channels"))
      .finally(() => setLoading(false));
  }, [open, channels.length]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return channels;
    return channels.filter((c) => c.name.toLowerCase().includes(ql));
  }, [channels, q]);

  const patchCache = (channelId: string, channelName: string, isConnected: boolean) => {
    qc.setQueryData<Combined[]>(["slack-health"], (prev) =>
      prev?.map((x) =>
        x.deal_id === row.deal_id
          ? { ...x, channel_id: channelId || null, channel_name: channelName || null, is_connected: isConnected }
          : x,
      ),
    );
  };

  const linkTo = async (ch: SlackChannel) => {
    setSaving(true);
    const { error } = await supabase.from("staffing_deals").update({ slack_channel_id: ch.id }).eq("id", row.deal_id);
    setSaving(false);
    if (error) { toast.error("Failed to link channel"); return; }
    toast.success(`Linked #${ch.name}`);
    patchCache(ch.id, ch.name, true);
    setOpen(false);
    supabase.functions.invoke("slack-health-rebuild", { body: { dealId: row.deal_id } }).then(() => {
      qc.invalidateQueries({ queryKey: ["slack-health"] });
    }).catch(() => {});
  };

  const unlink = async () => {
    setSaving(true);
    const { error } = await supabase.from("staffing_deals").update({ slack_channel_id: "" }).eq("id", row.deal_id);
    setSaving(false);
    if (error) { toast.error("Failed to unlink"); return; }
    toast.success("Channel unlinked");
    patchCache("", "", false);
    setOpen(false);
  };

  const trigger = row.channel_id ? (
    <button type="button" className="text-[10px] text-muted-foreground hover:text-primary underline underline-offset-2">
      Change
    </button>
  ) : (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
    >
      <Link2 className="h-3 w-3" /> Link channel
    </button>
  );

  return (
    <div className="inline-flex items-center gap-2">
      {row.channel_id ? (
        link ? (
          <a href={link} className="text-primary hover:underline inline-flex items-center gap-1">
            <Hash className="h-3 w-3" /> {row.channel_name || row.channel_id}
          </a>
        ) : (
          <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" /> {row.channel_name || row.channel_id}</span>
        )
      ) : (
        !canLink && <span className="text-muted-foreground">-</span>
      )}
      {canLink && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search channels..."
              className="h-8 text-xs mb-2"
            />
            {row.channel_id && (
              <button
                type="button"
                onClick={unlink}
                disabled={saving}
                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent inline-flex items-center gap-1.5 text-destructive"
              >
                <X className="h-3 w-3" /> Remove current link
              </button>
            )}
            <div className="max-h-64 overflow-y-auto mt-1">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Loading channels...
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-6">No channels found</div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={saving || c.id === row.channel_id}
                    onClick={() => linkTo(c)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent inline-flex items-center gap-1.5",
                      c.id === row.channel_id && "opacity-50 cursor-default",
                    )}
                  >
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{c.name}</span>
                    {c.is_private && <span className="ml-auto text-[10px] text-muted-foreground">private</span>}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
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
      <AuditPanel row={row} />
    </details>
  );
}

interface AuditRecord {
  deal_id: string;
  rating: "R" | "Y" | "G";
  health_sentiment: string;
  scope_of_work: string;
  customer_cares: string;
  engagement: string;
  performance_results: string;
  churn_signals: string[];
  what_is_working: string[];
  recommended_action: string;
  channels: Array<{ role: string; channel: string; msgs_12wk: number; activity: string; audit_status: string }>;
  computed_at: string;
  model: string;
}

interface SlackDiagnostic {
  ok: boolean;
  channelId: string;
  channelName: string | null;
  canSeeMetadata: boolean;
  botIsMember: boolean;
  canReadHistory: boolean;
  infoError: string | null;
  historyError: string | null;
  latestMessageAt: string | null;
  latestMessagePreview: string | null;
  summary: string;
  error?: string;
}

function AuditPanel({ row }: { row: Combined }) {
  const qc = useQueryClient();
  const { data: audit, isLoading } = useQuery({
    queryKey: ["slack-audit", row.deal_id],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<AuditRecord | null> => {
      const { data, error } = await supabase
        .from("slack_channel_audits")
        .select("*")
        .eq("deal_id", row.deal_id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AuditRecord) || null;
    },
  });
  const [busy, setBusy] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);
  const [diag, setDiag] = useState<SlackDiagnostic | null>(null);

  const generate = async (force: boolean) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-channel-audit", {
        body: { deal_id: row.deal_id, force },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Audit failed");
      await qc.invalidateQueries({ queryKey: ["slack-audit", row.deal_id] });
      toast.success(data?.cached ? "Loaded cached audit" : "Audit generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setBusy(false);
    }
  };

  const diagnose = async () => {
    if (!row.channel_id) return;
    setDiagBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-channel-diagnostics", {
        body: { channelId: row.channel_id },
      });
      if (error) throw error;
      setDiag(data as SlackDiagnostic);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Slack diagnostic failed");
    } finally {
      setDiagBusy(false);
    }
  };

  const s = rgyStyles[audit?.rating || row.rgy];
  const tone = audit?.rating === "R" ? "text-red-600" : audit?.rating === "Y" ? "text-amber-600" : "text-emerald-600";
  const auditIsStale = Boolean(audit?.computed_at && row.last_msg_at && new Date(audit.computed_at).getTime() < new Date(row.last_msg_at).getTime());

  if (isLoading) {
    return (
      <div className="px-3.5 py-4 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading audit...
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="px-3.5 py-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            No audit generated yet for this account. Auto-audit uses the last 12 weeks of Slack messages.
          </div>
          <div className="flex items-center gap-2">
            {row.channel_id ? (
              <Button size="sm" variant="outline" onClick={diagnose} disabled={diagBusy} className="h-7 gap-1.5">
                {diagBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertCircle className="h-3.5 w-3.5" />}
                Check access
              </Button>
            ) : null}
            <Button size="sm" onClick={() => generate(false)} disabled={busy} className="h-7 gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Generate audit
            </Button>
          </div>
        </div>
        {diag ? <SlackDiagnosticPanel diag={diag} /> : null}
      </div>
    );
  }

  return (
    <div className="px-4 py-4 border-t border-border space-y-4">
      <div className="flex items-center justify-end gap-2">
        <span className="text-[10px] text-muted-foreground">
          Audited {formatDistanceToNow(new Date(audit.computed_at), { addSuffix: true })} · {audit.model || "model"}
        </span>
        {row.channel_id ? (
          <Button size="sm" variant="outline" onClick={diagnose} disabled={diagBusy} className="h-7 gap-1.5">
            {diagBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertCircle className="h-3 w-3" />}
            Check access
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => generate(true)} disabled={busy} className="h-7 gap-1.5">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Re-run
        </Button>
      </div>

      {auditIsStale ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This audit is older than the latest ingested Slack message. Re-run it to refresh the insight.
        </div>
      ) : null}

      {diag ? <SlackDiagnosticPanel diag={diag} /> : null}

      <AuditSection tone={tone} title="Health & Sentiment">{audit.health_sentiment || "Not stated."}</AuditSection>
      <AuditSection tone={tone} title="Scope of Work">{audit.scope_of_work || "Not stated."}</AuditSection>
      <AuditSection tone={tone} title="What the Customer Cares About">{audit.customer_cares || "Not stated."}</AuditSection>
      <AuditSection tone={tone} title="Engagement">{audit.engagement || "Not stated."}</AuditSection>
      <AuditSection tone={tone} title="Performance & Results">{audit.performance_results || "None stated."}</AuditSection>

      <div>
        <div className={cn("text-[11px] font-bold uppercase tracking-wide mb-1", tone)}>Churn Signals</div>
        {audit.churn_signals.length ? (
          <ul className="list-disc pl-5 text-sm space-y-0.5">
            {audit.churn_signals.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        ) : <p className="text-sm text-muted-foreground">None detected.</p>}
      </div>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide mb-1 text-emerald-600">What is Working</div>
        {audit.what_is_working.length ? (
          <ul className="list-disc pl-5 text-sm space-y-0.5">
            {audit.what_is_working.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        ) : <p className="text-sm text-muted-foreground">None.</p>}
      </div>

      {audit.recommended_action && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
          <span className="font-semibold">Recommended action:</span>{" "}
          <span className="text-amber-900">{audit.recommended_action}</span>
        </div>
      )}

      <div>
        <div className={cn("text-[11px] font-bold uppercase tracking-wide mb-1", tone)}>Slack Channels</div>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium">Role</th>
                <th className="text-left px-3 py-1.5 font-medium">Channel</th>
                <th className="text-left px-3 py-1.5 font-medium">12wk msgs</th>
                <th className="text-left px-3 py-1.5 font-medium">Activity</th>
                <th className="text-left px-3 py-1.5 font-medium">Audit status</th>
              </tr>
            </thead>
            <tbody>
              {(audit.channels || []).length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-2 text-muted-foreground italic">No channel linked</td></tr>
              ) : audit.channels.map((c, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-1.5 font-medium">{c.role}</td>
                  <td className="px-3 py-1.5">{c.channel}</td>
                  <td className="px-3 py-1.5">{c.msgs_12wk}</td>
                  <td className="px-3 py-1.5">
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      c.activity === "Dormant" && "bg-red-50 border-red-200 text-red-700",
                      c.activity === "Stale" && "bg-red-50 border-red-200 text-red-700",
                      c.activity === "Slow" && "bg-amber-50 border-amber-200 text-amber-700",
                      c.activity === "Low" && "bg-amber-50 border-amber-200 text-amber-700",
                      c.activity === "Moderate" && "bg-amber-50 border-amber-200 text-amber-700",
                      c.activity === "Active" && "bg-emerald-50 border-emerald-200 text-emerald-700",
                    )}>{c.activity}</Badge>
                  </td>
                  <td className="px-3 py-1.5 text-primary">{c.audit_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3 text-xs pt-2 border-t border-border">
        <Stat label="Msgs 90d" value={row.msg_count_90d} />
        <Stat label="Msgs 30d" value={row.msg_count_30d} />
        <Stat label="Msgs 7d" value={row.msg_count_7d} />
        <Stat label="Last message" value={row.last_msg_at ? formatDistanceToNow(new Date(row.last_msg_at), { addSuffix: true }) : "-"} />
      </div>
    </div>
  );
}

function AuditSection({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={cn("text-[11px] font-bold uppercase tracking-wide mb-1", tone)}>{title}</div>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
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

function SlackDiagnosticPanel({ diag }: { diag: SlackDiagnostic }) {
  return (
    <div className={cn(
      "rounded-md border px-3 py-2 text-xs space-y-1",
      diag.canReadHistory ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900",
    )}>
      <div className="font-medium">{diag.summary || diag.error || "Slack access diagnostic complete."}</div>
      <div className="grid sm:grid-cols-4 gap-2 text-[11px]">
        <DiagStat label="Metadata" ok={diag.canSeeMetadata} detail={diag.infoError || undefined} />
        <DiagStat label="Bot member" ok={diag.botIsMember} />
        <DiagStat label="History" ok={diag.canReadHistory} detail={diag.historyError || undefined} />
        <div>
          <div className="uppercase text-muted-foreground">Latest live msg</div>
          <div className="font-medium">{diag.latestMessageAt ? formatDistanceToNow(new Date(diag.latestMessageAt), { addSuffix: true }) : "-"}</div>
        </div>
      </div>
    </div>
  );
}

function DiagStat({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div>
      <div className="uppercase text-muted-foreground">{label}</div>
      <div className={cn("font-medium", ok ? "text-emerald-700" : "text-red-700")}>{ok ? "OK" : detail || "No"}</div>
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