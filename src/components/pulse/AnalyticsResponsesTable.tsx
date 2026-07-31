import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Download, Eye, Send, Loader2, AlertCircle, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InviteRow, ResponseRow } from "./useAnalyticsData";
import { SurveyResponseView } from "./SurveyResponseView";
import { GoogleFormResponseView } from "./GoogleFormResponseView";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { useUserRole } from "@/hooks/useUserRole";

type StatusKey = "completed" | "opened" | "sent" | "failed" | "pending";

type Row = {
  id: string;
  deal_id: string;
  deal_name: string;
  account: string;
  recipient_name: string;
  recipient_email: string;
  status: StatusKey;
  status_label: string;
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  error: string | null;
  respondent: string;
  campaign: string;
  nps: number | null;
  csat: number | null;
  payload: any | null;
  has_response: boolean;
  duplicates: number;
  source: string | null;
  sync_note: string | null;
  awaiting_sync: boolean;
  stuck: boolean;
};

const STUCK_MS = 48 * 3600 * 1000;

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function deriveStatus(inv: InviteRow): { key: StatusKey; label: string } {
  if (inv.completed_at) return { key: "completed", label: "Completed" };
  const es = (inv.email_status || "").toLowerCase();
  if (es === "failed" || es === "bounced" || es === "error") {
    // Gmail throttle/quota errors are transient — the message is typically
    // still delivered. If we have a sent_at timestamp, treat as sent.
    const err = (inv.error || "").toLowerCase();
    const isThrottle =
      err.includes("too many concurrent") ||
      err.includes("quota exceeded") ||
      err.includes("ratelimit") ||
      err.includes("rate limit") ||
      err.includes("userratelimitexceeded");
    if (isThrottle && inv.sent_at) return { key: "sent", label: "Sent" };
    return { key: "failed", label: "Failed" };
  }
  if (inv.source === "google_form" && inv.sent_at) return { key: "sent", label: "Awaiting form submit" };
  if (inv.opened_at) return { key: "opened", label: "Opened" };
  if (inv.sent_at) return { key: "sent", label: "Sent" };
  return { key: "pending", label: "Pending" };
}

const STATUS_STYLES: Record<StatusKey, string> = {
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  opened: "bg-amber-100 text-amber-700 border-amber-200",
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  pending: "bg-secondary text-muted-foreground border-border",
};

const STATUS_RANK: Record<StatusKey, number> = {
  completed: 4, opened: 3, sent: 2, failed: 1, pending: 0,
};

type DealSortKey = "deal_name" | "invites" | "received" | "rate" | "nps" | "csat" | "last_sent";

type DealGroup = {
  key: string;
  deal_id: string;
  deal_name: string;
  account: string;
  rows: Row[];
  invites: number;
  received: number;
  rate: number;
  nps: number | null;
  csat: number | null;
  last_sent: number | null;
  last_completed: number | null;
};

export function AnalyticsResponsesTable({
  invites,
  responses,
}: {
  invites: InviteRow[];
  responses: ResponseRow[];
}) {
  const [sortKey, setSortKey] = useState<keyof Row>("sent_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState("");
  const [drillRow, setDrillRow] = useState<Row | null>(null);
  const [uniqueContacts, setUniqueContacts] = useState(false);
  const [layout, setLayout] = useState<"deal" | "flat">("deal");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dealSortKey, setDealSortKey] = useState<DealSortKey>("received");
  const [dealSortDir, setDealSortDir] = useState<"asc" | "desc">("desc");
  const [resending, setResending] = useState<Set<string>>(new Set());
  const [bulkResending, setBulkResending] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isActuallyAdmin } = useUserRole();
  const responseRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [unmatchedCount, setUnmatchedCount] = useState(0);

  useEffect(() => {
    if (!isActuallyAdmin) return;
    supabase
      .from("pulse_unmatched_submissions" as any)
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null)
      .then(({ count }) => setUnmatchedCount(count || 0));
  }, [isActuallyAdmin, invites.length, responses.length]);

  const downloadPng = async () => {
    if (!responseRef.current || !drillRow) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(responseRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const safe = (s: string) => (s || "response").replace(/[^\w-]+/g, "_").slice(0, 60);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `pulse-${safe(drillRow.deal_name || drillRow.deal_id)}-${safe(drillRow.respondent)}.png`;
      a.click();
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const rows = useMemo<Row[]>(() => {
    // Keep the latest response per invite (responses arrive sorted desc).
    const respByInvite = new Map<string, ResponseRow>();
    responses.forEach((r) => {
      if (!respByInvite.has(r.invite_id)) respByInvite.set(r.invite_id, r);
    });
    return invites.map((inv) => {
      const r = respByInvite.get(inv.id) || null;
      const status = deriveStatus(inv);
      const awaiting_sync =
        inv.source === "google_form" && !!inv.sent_at && !inv.completed_at && !r;
      const ageMs = inv.sent_at ? Date.now() - new Date(inv.sent_at).getTime() : 0;
      const stuck = awaiting_sync && ageMs > STUCK_MS;
      const days = Math.floor(ageMs / 86400000);
      const baseSync = awaiting_sync
        ? "Email sent. Waiting for the Google Form submission to sync back by email."
        : null;
      const sync_note = baseSync
        ? stuck
          ? `${baseSync} · Sent ${days} day${days === 1 ? "" : "s"} ago — try resending.`
          : baseSync
        : null;
      return {
        id: inv.id,
        deal_id: inv.deal_id || "",
        deal_name: inv.deal_name || inv.account || "",
        account: inv.account || "",
        recipient_name: inv.recipient_name || "",
        recipient_email: inv.recipient_email || "",
        status: status.key,
        status_label: status.label,
        sent_at: inv.sent_at,
        opened_at: inv.opened_at,
        completed_at: inv.completed_at,
        error: inv.error ?? null,
        respondent: r?.respondent_name || r?.respondent_email || "",
        campaign: inv.campaign_name || "",
        nps: r?.nps ?? null,
        csat: r?.csat_avg ?? null,
        payload: r?.payload ?? null,
        has_response: !!r,
        duplicates: 0,
        source: r?.source ?? inv.source ?? null,
        sync_note,
        awaiting_sync,
        stuck,
      };
    });
  }, [invites, responses]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    let xs = rows;
    if (f) {
      xs = xs.filter((r) =>
        [r.deal_id, r.deal_name, r.account, r.recipient_name, r.recipient_email, r.respondent, r.campaign, r.status_label, r.sync_note]
          .some((v) => (v || "").toLowerCase().includes(f)),
      );
    }
    if (uniqueContacts) {
      const rankOrder = (r: Row) => STATUS_RANK[r.status] * 1e13 + (r.sent_at ? new Date(r.sent_at).getTime() : 0);
      const groups = new Map<string, Row[]>();
      xs.forEach((r) => {
        const key = (r.recipient_email || `__${r.id}`).toLowerCase();
        const arr = groups.get(key) || [];
        arr.push(r);
        groups.set(key, arr);
      });
      xs = Array.from(groups.values()).map((arr) => {
        const best = [...arr].sort((a, b) => rankOrder(b) - rankOrder(a))[0];
        return { ...best, duplicates: arr.length - 1 };
      });
    }
    xs = [...xs].sort((a, b) => {
      let av: any = (a as any)[sortKey];
      let bv: any = (b as any)[sortKey];
      if (sortKey === "status") {
        av = STATUS_RANK[a.status];
        bv = STATUS_RANK[b.status];
      }
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
  }, [rows, filter, sortKey, sortDir, uniqueContacts]);

  const failedVisibleIds = useMemo(
    () => filtered.filter((r) => r.status === "failed").map((r) => r.id),
    [filtered],
  );

  const dealGroups = useMemo<DealGroup[]>(() => {
    const map = new Map<string, Row[]>();
    filtered.forEach((r) => {
      const key = r.deal_id || r.deal_name || "—";
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    });
    const groups = Array.from(map.entries()).map(([key, rows]) => {
      const received = rows.filter((r) => r.has_response).length;
      const npsVals = rows.map((r) => r.nps).filter((v): v is number => typeof v === "number");
      const csatVals = rows.map((r) => r.csat).filter((v): v is number => typeof v === "number");
      const ts = (v: string | null) => (v ? new Date(v).getTime() : null);
      const maxOf = (xs: (number | null)[]) => {
        const ok = xs.filter((x): x is number => typeof x === "number");
        return ok.length ? Math.max(...ok) : null;
      };
      return {
        key,
        deal_id: rows[0].deal_id,
        deal_name: rows[0].deal_name || rows[0].account || "—",
        account: rows[0].account,
        rows,
        invites: rows.length,
        received,
        rate: rows.length ? received / rows.length : 0,
        nps: npsVals.length ? npsVals.reduce((a, b) => a + b, 0) / npsVals.length : null,
        csat: csatVals.length ? csatVals.reduce((a, b) => a + b, 0) / csatVals.length : null,
        last_sent: maxOf(rows.map((r) => ts(r.sent_at))),
        last_completed: maxOf(rows.map((r) => ts(r.completed_at))),
      };
    });
    return groups.sort((a, b) => {
      const av = (a as any)[dealSortKey];
      const bv = (b as any)[dealSortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return dealSortDir === "asc" ? av - bv : bv - av;
      return dealSortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, dealSortKey, dealSortDir]);

  const toggleDealSort = (k: DealSortKey) => {
    if (dealSortKey === k) setDealSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setDealSortKey(k); setDealSortDir("desc"); }
  };

  const allExpanded = dealGroups.length > 0 && dealGroups.every((g) => expanded.has(g.key));

  const stuckVisibleIds = useMemo(
    () => filtered.filter((r) => r.stuck).map((r) => r.id),
    [filtered],
  );

  const runResend = async (ids: string[], scope: "row" | "bulk") => {
    if (ids.length === 0) return;
    if (scope === "bulk") setBulkResending(true);
    if (scope === "row") setResending((s) => new Set([...s, ...ids]));
    try {
      const { data, error } = await supabase.functions.invoke("pulse-resend-invite", {
        body: { inviteIds: ids },
      });
      if (error) throw error;
      const sent = (data as any)?.sent ?? 0;
      const failed = (data as any)?.failed ?? 0;
      if ((data as any)?.error === "resend_not_connected") {
        toast({
          title: "Resend not connected",
          description: "Ask an admin to link the Resend connector to this project.",
          variant: "destructive",
        });
      } else if (failed > 0 && sent === 0) {
        const first = (data as any)?.results?.find((r: any) => !r.ok)?.error || "Send failed";
        toast({ title: "Resend failed", description: String(first).slice(0, 240), variant: "destructive" });
      } else {
        toast({
          title: sent > 0 ? `Resent ${sent} invite${sent === 1 ? "" : "s"}` : "No invites resent",
          description: failed > 0 ? `${failed} still failing — hover the status chip for details.` : undefined,
        });
      }
      await qc.invalidateQueries({ queryKey: ["pulse-analytics-invites"] });
    } catch (e: any) {
      toast({ title: "Resend failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      if (scope === "bulk") setBulkResending(false);
      if (scope === "row") setResending((s) => { const n = new Set(s); ids.forEach((i) => n.delete(i)); return n; });
    }
  };

  const toggleSort = (k: keyof Row) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const exportCsv = () => {
    if (layout === "deal") {
      const headers = ["Deal ID","Deal name","Account","Invites","Responses received","Response rate %","Avg NPS","Avg CSAT","Last sent","Last completed"];
      const out = dealGroups.map((g) => [
        g.deal_id, g.deal_name, g.account, g.invites, g.received,
        Math.round(g.rate * 100),
        g.nps != null ? g.nps.toFixed(1) : "",
        g.csat != null ? g.csat.toFixed(1) : "",
        g.last_sent ? new Date(g.last_sent).toISOString() : "",
        g.last_completed ? new Date(g.last_completed).toISOString() : "",
      ]);
      const csv = [headers, ...out]
        .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pulse-deal-responses.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const headers = [
      "Deal ID","Deal name","Account","Recipient name","Recipient email",
      "Status","Sent","Opened","Completed","Respondent","Campaign","NPS","CSAT",
    ];
    const out = filtered.map((r) => [
      r.deal_id, r.deal_name, r.account,
      r.recipient_name, r.recipient_email,
      r.status_label,
      r.sent_at ? new Date(r.sent_at).toISOString() : "",
      r.opened_at ? new Date(r.opened_at).toISOString() : "",
      r.completed_at ? new Date(r.completed_at).toISOString() : "",
      r.respondent, r.campaign,
      r.nps ?? "", r.csat ?? "",
    ]);
    const csv = [headers, ...out]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-invites.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
          {([{ k: "deal", l: "Deal-wise" }, { k: "flat", l: "Flat" }] as { k: "deal" | "flat"; l: string }[]).map((m) => (
            <button
              key={m.k}
              onClick={() => setLayout(m.k)}
              className={cn("px-2.5 py-1 rounded-md text-[11px] font-medium",
                layout === m.k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {m.l}
            </button>
          ))}
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter deal, account, recipient, respondent…"
          className="h-8 px-3 rounded-md border border-border bg-card text-xs w-80"
        />
        <div className="text-xs text-muted-foreground">
          {layout === "deal" ? `${dealGroups.length} deals · ${filtered.length} invites` : `${filtered.length} invites`}
        </div>
        {layout === "deal" && dealGroups.length > 0 && (
          <button
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(dealGroups.map((g) => g.key)))}
            className="text-[11px] text-muted-foreground underline hover:text-foreground"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        )}
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none ml-2">
          <Checkbox checked={uniqueContacts} onCheckedChange={(v) => setUniqueContacts(!!v)} />
          Unique contacts
        </label>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="mr-2"
            disabled={bulkResending || failedVisibleIds.length === 0}
            onClick={() => runResend(failedVisibleIds, "bulk")}
          >
            {bulkResending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            Resend failed ({failedVisibleIds.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="mr-2"
            disabled={bulkResending || stuckVisibleIds.length === 0}
            onClick={() => runResend(stuckVisibleIds, "bulk")}
            title="Resend Google Form invites that have been awaiting sync for more than 48 hours"
          >
            {bulkResending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            Resend stuck syncs ({stuckVisibleIds.length})
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {unmatchedCount > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {unmatchedCount} Google Form submission{unmatchedCount === 1 ? "" : "s"} reached the app but could not be matched to an open invite. Check the email question title and pending invite email.
        </div>
      )}

      {layout === "deal" && (
      <div className="rounded-lg border border-border overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead className="bg-secondary">
              <tr className="text-left">
                <Th onClick={() => toggleDealSort("deal_name")}>Deal</Th>
                <Th onClick={() => toggleDealSort("invites")} className="text-right">POCs</Th>
                <Th onClick={() => toggleDealSort("received")} className="text-center">Responses</Th>
                <Th onClick={() => toggleDealSort("rate")} className="text-right">Rate</Th>
                <Th onClick={() => toggleDealSort("nps")} className="text-right">Avg NPS</Th>
                <Th onClick={() => toggleDealSort("csat")} className="text-right">Avg CSAT</Th>
                <Th onClick={() => toggleDealSort("last_sent")}>Last sent</Th>
                <Th>Last completed</Th>
              </tr>
            </thead>
            <tbody>
              {dealGroups.map((g) => {
                const open = expanded.has(g.key);
                const tone = g.received === 0
                  ? "bg-secondary text-muted-foreground border-border"
                  : g.received >= g.invites
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-amber-100 text-amber-700 border-amber-200";
                return (
                  <>
                    <tr
                      key={g.key}
                      className="border-t border-border hover:bg-secondary/50 cursor-pointer"
                      onClick={() => setExpanded((s) => {
                        const n = new Set(s);
                        n.has(g.key) ? n.delete(g.key) : n.add(g.key);
                        return n;
                      })}
                    >
                      <td className="px-3 py-2 max-w-[320px]">
                        <div className="flex items-start gap-1.5">
                          {open ? <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />}
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate" title={g.deal_name}>{g.deal_name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {g.account}{g.deal_id ? ` · ${g.deal_id}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{g.invites}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-medium", tone)}>
                          {g.received}/{g.invites} {g.received === 0 ? "· none" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{Math.round(g.rate * 100)}%</td>
                      <td className="px-3 py-2 text-right">{g.nps != null ? g.nps.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 text-right">{g.csat != null ? g.csat.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{g.last_sent ? fmtDate(new Date(g.last_sent).toISOString()) : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{g.last_completed ? fmtDate(new Date(g.last_completed).toISOString()) : "—"}</td>
                    </tr>
                    {open && (
                      <tr key={`${g.key}-exp`} className="bg-secondary/20">
                        <td colSpan={8} className="px-3 py-2">
                          <div className="overflow-x-auto rounded-md border border-border bg-card">
                            <table className="w-full text-xs min-w-[1000px]">
                              <thead className="bg-secondary/60">
                                <tr className="text-left">
                                  <Th>Recipient</Th>
                                  <Th>Status</Th>
                                  <Th>Sent</Th>
                                  <Th>Opened</Th>
                                  <Th>Completed</Th>
                                  <Th>Respondent</Th>
                                  <Th>Campaign</Th>
                                  <Th>Source</Th>
                                  <Th className="text-right">NPS</Th>
                                  <Th className="text-right">CSAT</Th>
                                  <Th>Response</Th>
                                  <Th>Resend</Th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.rows.map((r) => (
                                  <tr key={r.id} className="border-t border-border hover:bg-secondary/50">
                                    <PocCells r={r} resending={resending} runResend={runResend} onView={setDrillRow} />
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {dealGroups.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No invites for current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {layout === "flat" && (
      <div className="rounded-lg border border-border overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1200px]">
            <thead className="bg-secondary">
              <tr className="text-left">
                <Th onClick={() => toggleSort("deal_name")}>Deal</Th>
                <Th onClick={() => toggleSort("recipient_name")}>Recipient</Th>
                <Th onClick={() => toggleSort("status")}>Status</Th>
                <Th onClick={() => toggleSort("sent_at")}>Sent</Th>
                <Th onClick={() => toggleSort("opened_at")}>Opened</Th>
                <Th onClick={() => toggleSort("completed_at")}>Completed</Th>
                <Th onClick={() => toggleSort("respondent")}>Respondent</Th>
                <Th onClick={() => toggleSort("campaign")}>Campaign</Th>
                <Th>Source</Th>
                <Th onClick={() => toggleSort("nps")} className="text-right">NPS</Th>
                <Th onClick={() => toggleSort("csat")} className="text-right">CSAT</Th>
                <Th>Response</Th>
                <Th>Resend</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/50">
                  <td className="px-3 py-2 max-w-[260px]">
                    <div className="font-medium text-foreground truncate" title={r.deal_name}>
                      {r.deal_name || "—"}
                    </div>
                    {r.deal_id && (
                      <div className="font-mono text-[10px] text-muted-foreground truncate" title={r.deal_id}>
                        {r.deal_id}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[220px]">
                    <div className="text-foreground truncate" title={r.recipient_name}>
                      {r.recipient_name || "—"}
                      {r.duplicates > 0 && (
                        <span className="ml-1 text-[10px] text-muted-foreground">+{r.duplicates}</span>
                      )}
                    </div>
                    {r.recipient_email && (
                      <div className="text-[10px] text-muted-foreground truncate" title={r.recipient_email}>
                        {r.recipient_email}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.status === "failed" && r.error ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-medium cursor-help",
                            STATUS_STYLES[r.status],
                          )}>
                            {r.status_label}
                            <AlertCircle className="h-2.5 w-2.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-[11px]">
                          {r.error}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <div className="space-y-1">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-medium",
                          STATUS_STYLES[r.status],
                        )}>
                          {r.status_label}
                        </span>
                        {r.sync_note && <div className="max-w-[180px] text-[10px] leading-tight text-muted-foreground">{r.sync_note}</div>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(r.sent_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(r.opened_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(r.completed_at)}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate" title={r.respondent}>{r.respondent || "—"}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate" title={r.campaign}>{r.campaign || "—"}</td>
                  <td className="px-3 py-2">
                    {r.source ? (
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-medium",
                        r.source === "google_form"
                          ? "bg-violet-100 text-violet-700 border-violet-200"
                          : "bg-secondary text-muted-foreground border-border",
                      )}>
                        {r.source === "google_form" ? "Google Form" : "App"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{r.nps ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{r.csat ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      disabled={!r.has_response}
                      onClick={() => r.has_response && setDrillRow(r)}
                    >
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      disabled={r.status === "completed" || resending.has(r.id) || !r.recipient_email}
                      onClick={() => runResend([r.id], "row")}
                      title={
                        r.status === "completed"
                          ? "Already completed"
                          : r.awaiting_sync
                            ? "Resend Google Form invite / retry sync"
                            : "Re-send via Resend"
                      }
                    >
                      {resending.has(r.id)
                        ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        : <Send className="h-3 w-3 mr-1" />}
                      {r.stuck ? "Retry sync" : "Resend"}
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">No invites for current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!drillRow} onOpenChange={(o) => !o && setDrillRow(null)}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-sm">
                {drillRow?.deal_name || drillRow?.deal_id || "Response"}
                {drillRow?.respondent && <span className="text-muted-foreground font-normal"> — {drillRow.respondent}</span>}
              </DialogTitle>
              <Button variant="outline" size="sm" onClick={downloadPng} disabled={downloading} className="mr-6">
                {downloading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                Download PNG
              </Button>
            </div>
          </DialogHeader>
          <div className="px-6 py-5 overflow-y-auto bg-secondary/30">
            <div ref={responseRef} className="bg-white p-4 rounded-md">
              {drillRow && (
                drillRow.source === "google_form"
                  ? <GoogleFormResponseView payload={drillRow.payload} nps={drillRow.nps ?? null} csat={drillRow.csat ?? null} />
                  : <SurveyResponseView payload={drillRow.payload} />
              )}
            </div>
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