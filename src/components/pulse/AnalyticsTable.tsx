import { useMemo, useState } from "react";
import { ArrowUpDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ResponseRow, InviteRow, CapabilityRow, capabilityLabel, splitNames, normName } from "./useAnalyticsData";

type GroupBy = "vsd" | "bopm" | "deal" | "capability";

type AggRow = {
  key: string;
  label: string;
  sent: number;
  completed: number;
  responseRate: number;
  nps: number | null;
  csat: number | null;
  ces: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  highRisk: number;
  lastResponseAt: string | null;
  responses: ResponseRow[];
  invites: InviteRow[];
};

function computeNps(scores: number[]) {
  if (!scores.length) return null;
  const p = scores.filter(n => n >= 9).length;
  const d = scores.filter(n => n <= 6).length;
  return Math.round(((p - d) / scores.length) * 100);
}
function avg(nums: (number | null | undefined)[]) {
  const xs = nums.filter((n): n is number => typeof n === "number");
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function AnalyticsTable({
  groupBy, bopmTier, invites, responses, capabilities,
}: {
  groupBy: GroupBy;
  bopmTier: "any" | "principal" | "senior" | "bopm";
  invites: InviteRow[];
  responses: ResponseRow[];
  capabilities: CapabilityRow[];
}) {
  const [sortKey, setSortKey] = useState<keyof AggRow>("sent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState("");
  const [drillKey, setDrillKey] = useState<string | null>(null);

  const rows = useMemo<AggRow[]>(() => {
    // index responses by invite_id for invite-attribute lookup
    const invitesById = new Map(invites.map(i => [i.id, i]));
    const responsesByDeal = new Map<string, ResponseRow[]>();
    responses.forEach(r => {
      const arr = responsesByDeal.get(r.deal_id) || [];
      arr.push(r);
      responsesByDeal.set(r.deal_id, arr);
    });

    type Bucket = { invites: Set<InviteRow>; responses: Set<ResponseRow>; label: string };
    const buckets = new Map<string, Bucket>();
    const push = (key: string, label: string, inv?: InviteRow, resp?: ResponseRow) => {
      const k = key || "—";
      let b = buckets.get(k);
      if (!b) {
        b = { invites: new Set(), responses: new Set(), label: label || "—" };
        buckets.set(k, b);
      }
      if (inv) b.invites.add(inv);
      if (resp) b.responses.add(resp);
    };

    if (groupBy === "vsd") {
      invites.forEach(i => {
        const names = splitNames(i.vsd);
        if (!names.length) push("__unassigned__", "Unassigned", i);
        else names.forEach(n => push(normName(n), n, i));
      });
      responses.forEach(r => {
        const inv = invitesById.get(r.invite_id);
        const src = inv?.vsd ?? null;
        const names = splitNames(src);
        if (!names.length) push("__unassigned__", "Unassigned", undefined, r);
        else names.forEach(n => push(normName(n), n, undefined, r));
      });
    } else if (groupBy === "bopm") {
      const pick = (inv: InviteRow): string[] => {
        if (bopmTier === "principal") return splitNames(inv.principal_bopm);
        if (bopmTier === "senior") return splitNames(inv.senior_bopm);
        if (bopmTier === "bopm") return splitNames(inv.bopm);
        return [
          ...splitNames(inv.principal_bopm),
          ...splitNames(inv.senior_bopm),
          ...splitNames(inv.bopm),
        ];
      };
      invites.forEach(i => {
        const names = pick(i);
        if (!names.length) push("__unassigned__", "Unassigned", i);
        else names.forEach(n => push(normName(n), n, i));
      });
      responses.forEach(r => {
        const inv = invitesById.get(r.invite_id);
        const names = inv ? pick(inv) : [];
        if (!names.length) push("__unassigned__", "Unassigned", undefined, r);
        else names.forEach(n => push(normName(n), n, undefined, r));
      });
    } else if (groupBy === "deal") {
      invites.forEach(i => {
        const label = [i.account, i.deal_name].filter(Boolean).join(" — ") || i.deal_id;
        push(i.deal_id, label, i);
      });
      responses.forEach(r => {
        const inv = invitesById.get(r.invite_id);
        const label = inv ? ([inv.account, inv.deal_name].filter(Boolean).join(" — ") || r.deal_id) : r.deal_id;
        push(r.deal_id, label, undefined, r);
      });
    } else if (groupBy === "capability") {
      const capsByDeal = new Map<string, Set<string>>();
      capabilities.forEach(c => {
        const s = capsByDeal.get(c.deal_id) || new Set();
        s.add(c.role_key);
        capsByDeal.set(c.deal_id, s);
      });
      invites.forEach(i => {
        const caps = capsByDeal.get(i.deal_id);
        if (!caps || caps.size === 0) push("__none__", "No capabilities", i);
        else caps.forEach(k => push(k, capabilityLabel(k), i));
      });
      responses.forEach(r => {
        const caps = capsByDeal.get(r.deal_id);
        if (!caps || caps.size === 0) push("__none__", "No capabilities", undefined, r);
        else caps.forEach(k => push(k, capabilityLabel(k), undefined, r));
      });
    }

    const out: AggRow[] = [];
    buckets.forEach((b, key) => {
      const inv = Array.from(b.invites);
      const resp = Array.from(b.responses);
      const scores = resp.map(r => r.nps).filter((n): n is number => typeof n === "number");
      const completedCount = inv.filter(i => i.completed_at).length;
      const lastResp = resp.length
        ? resp.map(r => r.submitted_at).sort().slice(-1)[0]
        : null;
      out.push({
        key,
        label: b.label,
        sent: inv.length,
        completed: completedCount,
        responseRate: inv.length > 0 ? Math.round((completedCount / inv.length) * 100) : 0,
        nps: computeNps(scores),
        csat: avg(resp.map(r => r.csat_avg)),
        ces: avg(resp.map(r => r.ces)),
        promoters: scores.filter(n => n >= 9).length,
        passives: scores.filter(n => n >= 7 && n <= 8).length,
        detractors: scores.filter(n => n <= 6).length,
        highRisk: resp.filter(r => (r.churn_risk || "").toLowerCase() === "high").length,
        lastResponseAt: lastResp,
        responses: resp,
        invites: inv,
      });
    });
    return out;
  }, [groupBy, bopmTier, invites, responses, capabilities]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    let xs = rows;
    if (f) xs = xs.filter(r => r.label.toLowerCase().includes(f));
    xs = [...xs].sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return xs;
  }, [rows, filter, sortKey, sortDir]);

  const toggleSort = (k: keyof AggRow) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const chartData = useMemo(() =>
    filtered.filter(r => r.nps != null).slice(0, 15).map(r => ({ name: r.label.slice(0, 24), nps: r.nps })),
    [filtered]);

  const drillRow = drillKey ? filtered.find(r => r.key === drillKey) : null;

  const exportCsv = () => {
    const headers = ["Group","Sent","Completed","Response %","NPS","Avg CSAT","Avg CES","Promoters","Passives","Detractors","High churn risk","Last response"];
    const rowsCsv = filtered.map(r => [
      r.label, r.sent, r.completed, `${r.responseRate}%`,
      r.nps ?? "", r.csat?.toFixed(2) ?? "", r.ces?.toFixed(2) ?? "",
      r.promoters, r.passives, r.detractors, r.highRisk,
      r.lastResponseAt ? new Date(r.lastResponseAt).toISOString().slice(0, 10) : "",
    ]);
    const csv = [headers, ...rowsCsv].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-analytics-${groupBy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {chartData.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground mb-2">NPS by {labelFor(groupBy)} (top 15)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10 }} domain={[-100, 100]} />
              <Tooltip />
              <Bar dataKey="nps" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder={`Filter ${labelFor(groupBy).toLowerCase()}…`}
          className="h-8 px-3 rounded-md border border-border bg-card text-xs w-64"
        />
        <div className="text-xs text-muted-foreground">{filtered.length} groups</div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary">
            <tr className="text-left">
              <Th onClick={() => toggleSort("label")}>{labelFor(groupBy)}</Th>
              <Th onClick={() => toggleSort("sent")} className="text-right">Sent</Th>
              <Th onClick={() => toggleSort("completed")} className="text-right">Completed</Th>
              <Th onClick={() => toggleSort("responseRate")} className="text-right">Resp %</Th>
              <Th onClick={() => toggleSort("nps")} className="text-right">NPS</Th>
              <Th onClick={() => toggleSort("csat")} className="text-right">CSAT</Th>
              <Th onClick={() => toggleSort("ces")} className="text-right">CES</Th>
              <Th onClick={() => toggleSort("promoters")} className="text-right">P / Pa / D</Th>
              <Th onClick={() => toggleSort("highRisk")} className="text-right">High risk</Th>
              <Th onClick={() => toggleSort("lastResponseAt")} className="text-right">Last</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr
                key={r.key}
                className="border-t border-border hover:bg-secondary/50 cursor-pointer"
                onClick={() => setDrillKey(r.key)}
              >
                <td className="px-3 py-2 font-medium text-foreground">{r.label}</td>
                <td className="px-3 py-2 text-right">{r.sent}</td>
                <td className="px-3 py-2 text-right">{r.completed}</td>
                <td className="px-3 py-2 text-right">{r.responseRate}%</td>
                <td className="px-3 py-2 text-right">{r.nps ?? "—"}</td>
                <td className="px-3 py-2 text-right">{r.csat?.toFixed(2) ?? "—"}</td>
                <td className="px-3 py-2 text-right">{r.ces?.toFixed(2) ?? "—"}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{r.promoters}/{r.passives}/{r.detractors}</td>
                <td className="px-3 py-2 text-right">{r.highRisk}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {r.lastResponseAt ? new Date(r.lastResponseAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No data for current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer open={!!drillRow} onOpenChange={(o) => !o && setDrillKey(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{drillRow?.label} — {drillRow?.responses.length || 0} response(s)</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary">
                <tr className="text-left">
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Respondent</th>
                  <th className="px-3 py-2">Deal</th>
                  <th className="px-3 py-2 text-right">NPS</th>
                  <th className="px-3 py-2 text-right">CSAT</th>
                  <th className="px-3 py-2 text-right">CES</th>
                  <th className="px-3 py-2">Mood</th>
                  <th className="px-3 py-2">Renew</th>
                  <th className="px-3 py-2">Risk</th>
                  <th className="px-3 py-2">Comments</th>
                </tr>
              </thead>
              <tbody>
                {(drillRow?.responses || []).map(r => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {new Date(r.submitted_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{r.respondent_name || r.respondent_email || "—"}</td>
                    <td className="px-3 py-2">{r.deal_id}</td>
                    <td className="px-3 py-2 text-right">{r.nps ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r.csat_avg ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r.ces ?? "—"}</td>
                    <td className="px-3 py-2">{r.mood || "—"}</td>
                    <td className="px-3 py-2">{r.renew || "—"}</td>
                    <td className="px-3 py-2">{r.churn_risk || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[260px] truncate">
                      {extractComment(r.payload)}
                    </td>
                  </tr>
                ))}
                {(!drillRow?.responses || drillRow.responses.length === 0) && (
                  <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">No responses yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Th({ children, onClick, className = "" }: { children: any; onClick?: () => void; className?: string }) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide select-none ${onClick ? "cursor-pointer hover:text-foreground" : ""} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick && <ArrowUpDown className="h-3 w-3 opacity-50" />}
      </span>
    </th>
  );
}

function labelFor(g: GroupBy) {
  return g === "vsd" ? "VSD" : g === "bopm" ? "BOPM" : g === "deal" ? "Deal" : "Capability";
}

function extractComment(payload: any): string {
  if (!payload || typeof payload !== "object") return "";
  const keys = ["comments", "comment", "feedback", "notes", "free_text"];
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}