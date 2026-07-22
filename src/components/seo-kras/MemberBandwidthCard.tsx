import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";
import { useMemberBandwidth } from "@/hooks/queries/useMemberBandwidth";

function fmtMoney(n: number) {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (Math.abs(n) >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function allocTone(pct: number) {
  if (pct >= 100) return "bg-[hsl(var(--kra-score-bad)/0.15)] text-[hsl(var(--kra-score-bad))]";
  if (pct >= 85) return "bg-[hsl(var(--kra-score-warn)/0.18)] text-[hsl(var(--kra-score-warn))]";
  if (pct >= 60) return "bg-[hsl(var(--kra-score-good)/0.18)] text-[hsl(var(--kra-score-good))]";
  return "bg-muted text-muted-foreground";
}

export function MemberBandwidthCard({ personId, memberName }: { personId: string; memberName: string }) {
  const { data, isLoading } = useMemberBandwidth(personId);
  const summary = data || { rows: [], totalAllocation: 0, totalMrr: 0, attributedMrr: 0, activeDeals: 0 };

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            Current bandwidth · {memberName}
          </span>
          <span className="inline-flex items-center gap-2 text-xs font-normal text-muted-foreground">
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${allocTone(summary.totalAllocation)}`}>
              {summary.totalAllocation.toFixed(0)}% allocated
            </span>
            <span>·</span>
            <span>{summary.activeDeals} active deal{summary.activeDeals === 1 ? "" : "s"}</span>
            <span>·</span>
            <span>MRR {fmtMoney(summary.totalMrr)}</span>
            <span>·</span>
            <span>Attributed {fmtMoney(summary.attributedMrr)}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : summary.rows.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No active deal allocations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Deal</th>
                  <th className="text-left p-2">Role</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-right p-2">Allocation</th>
                  <th className="text-right p-2">Deal MRR</th>
                  <th className="text-right p-2">Attributed MRR</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map(r => (
                  <tr key={`${r.deal_id}:${r.role_key}`} className="border-t border-border">
                    <td className="p-2">
                      <div className="font-medium">{r.account || r.deal_name}</div>
                      {r.account && r.deal_name && r.account !== r.deal_name && (
                        <div className="text-xs text-muted-foreground">{r.deal_name}</div>
                      )}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{r.role_key || "—"}</td>
                    <td className="p-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">{r.deal_status || "—"}</Badge>
                    </td>
                    <td className="p-2 text-right">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${allocTone(r.allocation_pct)}`}>
                        {r.allocation_pct.toFixed(0)}%
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{fmtMoney(r.mrr || 0)}</td>
                    <td className="p-2 text-right tabular-nums font-medium">{fmtMoney(r.attributed_mrr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}