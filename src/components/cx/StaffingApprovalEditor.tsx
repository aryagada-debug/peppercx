import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaffingData } from "@/hooks/useStaffingData";
import { updateApprovalRequestDetails, type ApprovalRequestRow } from "@/lib/approvals";
import { toast } from "sonner";

interface Props {
  request: ApprovalRequestRow;
  onSaved: (patch: Partial<ApprovalRequestRow>) => void;
}

/**
 * Structured editor for staffing.add / staffing.update approval requests.
 * Lets Central CX edit the person, role, allocation %, and start/end dates
 * before approving — with full visibility into the proposed person's
 * current engagements and free capacity (same UX as the request dialog).
 */
export function StaffingApprovalEditor({ request, onSaved }: Props) {
  const { people, deals, assignments } = useStaffingData();
  const payload = (request.payload || {}) as any;

  const initialPersonId: string = payload.personId || "";
  const [personId, setPersonId] = useState<string>(initialPersonId);
  const [roleKey, setRoleKey] = useState<string>(payload.roleKey || "");
  const [allocationPct, setAllocationPct] = useState<number>(Number(payload.allocationPct || 0));
  const [startDate, setStartDate] = useState<string>(payload.startDate || "");
  const [endDate, setEndDate] = useState<string>(payload.endDate || "");
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPersonId(payload.personId || "");
    setRoleKey(payload.roleKey || "");
    setAllocationPct(Number(payload.allocationPct || 0));
    setStartDate(payload.startDate || "");
    setEndDate(payload.endDate || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id]);

  const selectedPerson = useMemo(() => people.find(p => p.id === personId) || null, [people, personId]);
  const deal = useMemo(() => deals.find(d => d.id === request.deal_id), [deals, request.deal_id]);

  const personUtil = useMemo(() => {
    const list = assignments.filter(a => a.personId === personId && a.id !== payload.id);
    const total = list.reduce((s, a) => s + (a.allocationPct || 0), 0);
    return { list, total };
  }, [assignments, personId, payload.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people.slice(0, 30);
    return people.filter(p =>
      `${p.name} ${p.roleTitle || ""} ${p.roleCategory || ""} ${p.pod || ""} ${p.email || ""}`
        .toLowerCase().includes(q)
    ).slice(0, 30);
  }, [people, search]);

  const dealName = (id: string) => {
    const d = deals.find(x => x.id === id);
    return d ? `${d.account} — ${d.dealName}` : id;
  };

  const freeCapacity = Math.max(0, 100 - personUtil.total);
  const newTotal = personUtil.total + allocationPct;
  const capColor = freeCapacity <= 0 ? "text-destructive" : freeCapacity <= 20 ? "text-warning" : "text-positive";

  const save = async () => {
    setBusy(true);
    const nextPayload = {
      ...payload,
      personId,
      roleKey,
      allocationPct,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    const ok = await updateApprovalRequestDetails(request.id, { payload: nextPayload });
    setBusy(false);
    if (ok) {
      toast.success("Approval details updated");
      onSaved({ payload: nextPayload });
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-border p-3 bg-card">
      <div className="text-xs font-medium text-foreground">Edit before approving</div>

      {/* Person */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1">Person</div>
        <button
          type="button"
          onClick={() => setShowPicker(v => !v)}
          className="w-full flex items-center justify-between gap-2 px-2.5 h-9 rounded-md border border-border bg-background text-xs text-left hover:bg-secondary/40"
        >
          <span className={cn("truncate", !selectedPerson && "text-muted-foreground")}>
            {selectedPerson ? `${selectedPerson.name} · ${selectedPerson.roleTitle || selectedPerson.roleCategory}` : "Pick a person…"}
          </span>
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {showPicker && (
          <div className="mt-2 rounded-md border border-border bg-background p-2 max-h-64 overflow-y-auto">
            <Input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, role, pod…"
              className="h-8 text-xs mb-2"
            />
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setPersonId(p.id); setRoleKey(roleKey || p.roleTitle || p.roleCategory); setShowPicker(false); setSearch(""); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] hover:bg-secondary",
                  p.id === personId && "bg-primary/5"
                )}
              >
                <span className="flex-1 min-w-0 truncate font-medium text-foreground">
                  {p.name}
                  {p.tbh && <span className="ml-1 text-[9px] text-muted-foreground font-normal">(TBH)</span>}
                </span>
                <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">{p.roleTitle || p.roleCategory}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">No matches</div>
            )}
          </div>
        )}
      </div>

      {/* Current engagements */}
      {selectedPerson && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="flex items-center justify-between p-2.5 bg-secondary/30">
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Current Engagements</span>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-mono font-medium text-foreground">{personUtil.total}% allocated</span>
              <span className="text-muted-foreground">·</span>
              <span className={cn("font-mono font-medium", capColor)}>{freeCapacity}% free</span>
            </div>
          </div>
          <div className="p-2.5">
            <Progress value={Math.min(personUtil.total, 100)} className="h-1.5 mb-2" />
            {personUtil.list.length > 0 ? (
              <div className="space-y-1.5">
                {personUtil.list.map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-[11px]">
                    <span className="flex-1 min-w-0 truncate text-foreground">{dealName(a.dealId)}</span>
                    <span className="text-[10px] text-muted-foreground">{a.roleKey}</span>
                    <span className="font-mono text-foreground w-10 text-right">{a.allocationPct}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center py-1">No other assignments — fully available</p>
            )}
          </div>
          {newTotal > 100 && (
            <div className="flex items-start gap-2 px-2.5 py-2 border-t border-warning/30 bg-warning/10">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
              <p className="text-[11px] text-warning">With this allocation, total becomes {newTotal}% — over capacity.</p>
            </div>
          )}
        </div>
      )}

      {/* Role + allocation */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Role on this deal</div>
          <Input value={roleKey} onChange={e => setRoleKey(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Allocation %</div>
          <Input
            type="number" min={0} max={100} step={1}
            value={allocationPct}
            onChange={e => setAllocationPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            className="h-8 text-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-1">= {(allocationPct / 100 * 40).toFixed(1)} hrs/wk</p>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Start date</div>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs" />
          {deal?.startDate && (
            <p className="text-[10px] text-muted-foreground mt-1">Deal starts: <span className="font-mono text-foreground">{deal.startDate}</span></p>
          )}
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">End date</div>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs" />
          {deal?.endDate && (
            <p className="text-[10px] text-muted-foreground mt-1">Deal ends: <span className="font-mono text-foreground">{deal.endDate}</span></p>
          )}
        </div>
      </div>

      {deal && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">Deal</Badge>
          <span className="truncate">{deal.account} — {deal.dealName}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={busy || !personId}>
          {busy ? "Saving…" : "Save edits"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Edits are included in the approval and visible to the requester, the deal's VSD/BOPMs, and the staffed person.
      </p>
    </div>
  );
}