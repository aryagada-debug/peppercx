import { useMemo, useState } from "react";
import { ArrowUpDown, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InviteRow, ResponseRow } from "./useAnalyticsData";
import { formatINR } from "@/lib/csvTargets";
import { SurveyResponseView } from "./SurveyResponseView";

type Row = {
  id: string;
  submitted_at: string;
  deal_id: string;
  deal_name: string;
  account: string;
  vsd: string;
  sp_bopm: string;
  bopm: string;
  total_value: number | null;
  respondent: string;
  campaign: string;
  business_unit: string;
  nps: number | null;
  csat: number | null;
  content_quality: number | null;
  seo_traffic: number | null;
  mood: string;
  renew: string;
  risk: string;
  payload: any;
  invite: InviteRow | null;
};

function joinList(...parts: (string | null | undefined)[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  parts.forEach((p) => {
    (p || "")
      .split(/[,/]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => {
        const k = s.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          out.push(s);
        }
      });
  });
  return out.join(", ");
}

function totalValueFor(inv: InviteRow | null): number | null {
  if (!inv) return null;
  const type = (inv.deal_type || "").toLowerCase();
  if (type.includes("retainer") && typeof inv.mrr === "number" && inv.mrr > 0) {
    return inv.mrr * 12;
  }
  if (typeof inv.deal_value === "number" && inv.deal_value > 0) return inv.deal_value;
  if (typeof inv.mrr === "number" && inv.mrr > 0) return inv.mrr * 12;
  return null;
}

export function AnalyticsResponsesTable({
  invites,
  responses,
}: {
  invites: InviteRow[];
  responses: ResponseRow[];
}) {
  const [sortKey, setSortKey] = useState<keyof Row>("submitted_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState("");
  const [drillRow, setDrillRow] = useState<Row | null>(null);

  const rows = useMemo<Row[]>(() => {
    const inviteById = new Map(invites.map((i) => [i.id, i]));
    return responses.map((r) => {
      const inv = inviteById.get(r.invite_id) || null;
      return {
        id: r.id,
        submitted_at: r.submitted_at,
        deal_id: r.deal_id || inv?.deal_id || "",
        deal_name: inv?.deal_name || inv?.account || "",
        account: inv?.account || "",
        vsd: inv?.vsd || "",
        sp_bopm: joinList(inv?.senior_bopm, inv?.principal_bopm),
        bopm: inv?.bopm || "",
        total_value: totalValueFor(inv),
        respondent: r.respondent_name || r.respondent_email || "",
        campaign: inv?.campaign_name || "",
        business_unit: inv?.business_unit || "",
        nps: r.nps ?? null,
        csat: r.csat_avg ?? null,
        content_quality: r.payload?.capability_deep_dive?.content?.quality ?? null,
        seo_traffic: r.payload?.capability_deep_dive?.seo?.traffic_growth ?? null,
        mood: r.mood || "",
        renew: r.renew || "",
        risk: r.churn_risk || "",
        payload: r.payload,
        invite: inv,
      };
    });
  }, [invites, responses]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    let xs = rows;
    if (f) {
      xs = xs.filter((r) =>
        [r.deal_id, r.deal_name, r.account, r.vsd, r.sp_bopm, r.bopm, r.respondent, r.campaign, r.business_unit]
          .some((v) => (v || "").toLowerCase().includes(f)),
      );
    }
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

  const toggleSort = (k: keyof Row) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const exportCsv = () => {
    const headers = [
      "Submitted","Deal ID","Deal name","Account","VSD","S/P BOPM","BOPM",
      "Total deal value","Respondent","Campaign","BU","NPS","CSAT","Content quality","SEO traffic","Mood","Renew","Risk",
    ];
    const out = filtered.map((r) => [
      new Date(r.submitted_at).toISOString(),
      r.deal_id, r.deal_name, r.account, r.vsd, r.sp_bopm, r.bopm,
      r.total_value ?? "",
      r.respondent,
      r.campaign, r.business_unit,
      r.nps ?? "", r.csat ?? "", r.content_quality ?? "", r.seo_traffic ?? "",
      r.mood, r.renew, r.risk,
    ]);
    const csv = [headers, ...out]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter deal, account, VSD, BOPM, respondent…"
          className="h-8 px-3 rounded-md border border-border bg-card text-xs w-80"
        />
        <div className="text-xs text-muted-foreground">{filtered.length} responses</div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1400px]">
            <thead className="bg-secondary">
              <tr className="text-left">
                <Th onClick={() => toggleSort("submitted_at")}>Submitted</Th>
                <Th onClick={() => toggleSort("deal_id")}>Deal ID</Th>
                <Th onClick={() => toggleSort("deal_name")}>Deal name</Th>
                <Th onClick={() => toggleSort("vsd")}>VSD</Th>
                <Th onClick={() => toggleSort("sp_bopm")}>S/P BOPM</Th>
                <Th onClick={() => toggleSort("bopm")}>BOPM</Th>
                <Th onClick={() => toggleSort("total_value")} className="text-right">Total value</Th>
                <Th onClick={() => toggleSort("respondent")}>Respondent</Th>
                <Th onClick={() => toggleSort("campaign")}>Campaign</Th>
                <Th onClick={() => toggleSort("business_unit")}>BU</Th>
                <Th onClick={() => toggleSort("nps")} className="text-right">NPS</Th>
                <Th onClick={() => toggleSort("csat")} className="text-right">CSAT</Th>
                <Th onClick={() => toggleSort("content_quality")} className="text-right">Content</Th>
                <Th onClick={() => toggleSort("seo_traffic")} className="text-right">SEO traffic</Th>
                <Th onClick={() => toggleSort("mood")}>Mood</Th>
                <Th onClick={() => toggleSort("renew")}>Renew</Th>
                <Th onClick={() => toggleSort("risk")}>Risk</Th>
                <Th>Q&amp;A</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/50">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {new Date(r.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">{r.deal_id || "—"}</td>
                  <td className="px-3 py-2 font-medium text-foreground max-w-[220px] truncate" title={r.deal_name}>
                    {r.deal_name || "—"}
                  </td>
                  <td className="px-3 py-2 max-w-[160px] truncate" title={r.vsd}>{r.vsd || "—"}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate" title={r.sp_bopm}>{r.sp_bopm || "—"}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate" title={r.bopm}>{r.bopm || "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {r.total_value == null ? "—" : formatINR(r.total_value)}
                  </td>
                  <td className="px-3 py-2 max-w-[180px] truncate" title={r.respondent}>{r.respondent || "—"}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate" title={r.campaign}>{r.campaign || "—"}</td>
                  <td className="px-3 py-2 max-w-[140px] truncate" title={r.business_unit}>{r.business_unit || "—"}</td>
                  <td className="px-3 py-2 text-right">{r.nps ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{r.csat ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{r.content_quality ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{r.seo_traffic ?? "—"}</td>
                  <td className="px-3 py-2">{r.mood || "—"}</td>
                  <td className="px-3 py-2">{r.renew || "—"}</td>
                  <td className="px-3 py-2">
                    {r.risk ? (
                      <span className={
                        r.risk.toLowerCase() === "high" ? "text-red-600" :
                        r.risk.toLowerCase() === "medium" ? "text-amber-600" : "text-muted-foreground"
                      }>{r.risk}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setDrillRow(r)}>
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={18} className="px-3 py-8 text-center text-muted-foreground">No responses for current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!drillRow} onOpenChange={(o) => !o && setDrillRow(null)}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <DialogTitle className="text-sm">
              {drillRow?.deal_name || drillRow?.deal_id || "Response"}
              {drillRow?.respondent && <span className="text-muted-foreground font-normal"> — {drillRow.respondent}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 overflow-y-auto bg-secondary/30">
            {drillRow && <SurveyResponseView payload={drillRow.payload} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({ children, onClick, className = "" }: { children: any; onClick?: () => void; className?: string }) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide select-none whitespace-nowrap ${onClick ? "cursor-pointer hover:text-foreground" : ""} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick && <ArrowUpDown className="h-3 w-3 opacity-50" />}
      </span>
    </th>
  );
}

function humanizeKey(k: string) {
  return k.replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function flatten(obj: any, prefix = "", out: Array<{ key: string; value: any }> = []) {
  if (obj == null) return out;
  if (Array.isArray(obj)) {
    out.push({ key: prefix || "(array)", value: obj });
    return out;
  }
  if (typeof obj === "object") {
    Object.entries(obj).forEach(([k, v]) => {
      const full = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        flatten(v, full, out);
      } else {
        out.push({ key: full, value: v });
      }
    });
    return out;
  }
  out.push({ key: prefix || "value", value: obj });
  return out;
}

function QnAView({ payload }: { payload: any }) {
  if (!payload || typeof payload !== "object") {
    return <div className="text-sm text-muted-foreground">No payload captured.</div>;
  }
  const entries = flatten(payload).filter((e) => {
    if (e.value == null || e.value === "") return false;
    if (Array.isArray(e.value) && e.value.length === 0) return false;
    return true;
  });
  if (entries.length === 0) {
    return <div className="text-sm text-muted-foreground">Empty submission.</div>;
  }
  return (
    <div className="rounded-lg border border-border divide-y divide-border">
      {entries.map((e) => (
        <div key={e.key} className="grid grid-cols-[minmax(160px,220px)_1fr] gap-3 px-3 py-2 text-xs">
          <div className="text-muted-foreground">{humanizeKey(e.key)}</div>
          <div className="text-foreground break-words">
            {Array.isArray(e.value) ? e.value.join(", ") : String(e.value)}
          </div>
        </div>
      ))}
    </div>
  );
}