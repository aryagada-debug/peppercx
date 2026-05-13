import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Inbox, Search } from "lucide-react";
import type { ApprovalRequestRow } from "@/lib/approvals";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  under_review: "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] border-[hsl(var(--info))]/30",
  approved: "bg-positive/15 text-positive border-positive/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const TYPE_LABEL: Record<string, string> = {
  "staffing.add": "Staffing — Add",
  "staffing.update": "Staffing — Update",
  "staffing.remove": "Staffing — Remove",
  "client.create": "Client — Create",
  "deal.create": "Deal — Create",
  "deal.update": "Deal — Update",
};

function statusLabel(s: string) {
  return s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DealRequestsTab({ dealId }: { dealId: string }) {
  const [rows, setRows] = useState<ApprovalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState<ApprovalRequestRow | null>(null);

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("approval_requests")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setRows((data as ApprovalRequestRow[]) || []);
        setLoading(false);
      }
    };
    load();
    const ch = supabase
      .channel(`deal_requests_${dealId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "approval_requests", filter: `deal_id=eq.${dealId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [dealId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.batch_title || "").toLowerCase().includes(q) ||
        (r.requester_note || "").toLowerCase().includes(q) ||
        (r.requested_by_name || "").toLowerCase().includes(q) ||
        (r.request_type || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, pending: 0, under_review: 0, approved: 0, rejected: 0, cancelled: 0 };
    rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h3 className="text-base font-semibold">Requests sent to Central CX</h3>
        <p className="text-xs text-muted-foreground">
          All approval / change requests raised for this deal.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {["all", "pending", "under_review", "approved", "rejected", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-2.5 h-7 text-xs rounded-md border transition-colors",
                statusFilter === s
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All" : statusLabel(s)}
              <span className="ml-1 text-[10px] font-mono opacity-70">{counts[s] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 flex flex-col items-center gap-2 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No requests sent to Central CX for this deal yet.</p>
          <p className="text-xs text-muted-foreground">
            Staffing or deal change requests raised here will appear in this tab.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr>
                {["Created", "Type", "Title", "Status", "Requester", "Reviewer", "Note"].map((h) => (
                  <th
                    key={h}
                    className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setOpen(r)}
                  className="border-t border-border/60 hover:bg-secondary/30 cursor-pointer"
                >
                  <td className="py-2 px-3 text-xs whitespace-nowrap text-muted-foreground">
                    {format(new Date(r.created_at), "dd MMM yyyy")}
                  </td>
                  <td className="py-2 px-3 text-xs whitespace-nowrap">
                    {TYPE_LABEL[r.request_type] || r.request_type}
                  </td>
                  <td className="py-2 px-3 text-xs">
                    {r.batch_title || (r.is_batch ? "Batch request" : r.target_kind || "—")}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5", STATUS_TONE[r.status])}>
                      {statusLabel(r.status)}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-xs whitespace-nowrap">{r.requested_by_name || "—"}</td>
                  <td className="py-2 px-3 text-xs whitespace-nowrap text-muted-foreground">
                    {r.reviewer_name || "—"}
                  </td>
                  <td className="py-2 px-3 text-xs text-muted-foreground max-w-[280px] truncate">
                    {r.requester_note || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {open ? TYPE_LABEL[open.request_type] || open.request_type : "Request"}
              {open && (
                <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5", STATUS_TONE[open.status])}>
                  {statusLabel(open.status)}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {open && (
                <>Sent {format(new Date(open.created_at), "dd MMM yyyy, HH:mm")} by {open.requested_by_name || "—"}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {open && (
            <div className="space-y-4 text-sm">
              {open.batch_title && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Title</p>
                  <p className="font-medium">{open.batch_title}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Reviewer</p>
                  <p>{open.reviewer_name || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Decided</p>
                  <p>{open.decided_at ? format(new Date(open.decided_at), "dd MMM yyyy, HH:mm") : "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Requester note</p>
                <p className="whitespace-pre-wrap rounded-md border border-border bg-secondary/30 p-2 text-xs">
                  {open.requester_note || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Reviewer note</p>
                <p className="whitespace-pre-wrap rounded-md border border-border bg-secondary/30 p-2 text-xs">
                  {open.reviewer_note || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Payload</p>
                <pre className="text-[11px] bg-secondary/30 border border-border rounded-md p-2 overflow-auto max-h-60">
                  {JSON.stringify(open.payload, null, 2)}
                </pre>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setOpen(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}