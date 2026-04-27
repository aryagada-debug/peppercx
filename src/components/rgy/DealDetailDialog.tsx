import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatINR } from "@/lib/csvTargets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import type { RGYStatus } from "@/types/dashboard";
import { cn } from "@/lib/utils";

interface DealInfo {
  id: string;
  deal_name: string;
  account: string;
  bopm: string;
  deal_status: string;
  pod: string;
  mrr: number | null;
  total_deal_value: number | null;
  vsd: string;
  principal_bopm: string;
  senior_bopm: string;
  start_date: string | null;
  end_date: string | null;
  payment_terms: string;
  account_health?: string;
  delivery?: string;
  finance_billing?: string;
  capability_seo?: string;
  capability_creative?: string;
}

interface DealDetailDialogProps {
  deal: DealInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const rgyColors: Record<string, string> = {
  R: "bg-red-500/15 text-red-600 border-red-500/30",
  Y: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  G: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  NA: "bg-muted text-muted-foreground border-border",
};

function RGYBadge({ label, status }: { label: string; status: string }) {
  const s = (status || "NA") as RGYStatus;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border", rgyColors[s] || rgyColors.NA)}>
        {s === "NA" ? "N/A" : s === "R" ? "Red" : s === "Y" ? "Yellow" : "Green"}
      </span>
    </div>
  );
}

function fmt(val: number | null) {
  return formatINR(Number(val) || 0);
}

export function DealDetailDialog({ deal, open, onOpenChange }: DealDetailDialogProps) {
  const navigate = useNavigate();

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{deal.deal_name}</DialogTitle>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline">{deal.deal_status}</Badge>
            {deal.pod && <Badge variant="secondary">{deal.pod}</Badge>}
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Account</p>
              <p className="text-sm font-medium">{deal.account || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">MRR</p>
              <p className="text-sm font-medium">{fmt(deal.mrr)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Deal Value</p>
              <p className="text-sm font-medium">{fmt(deal.total_deal_value)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment Terms</p>
              <p className="text-sm font-medium">{deal.payment_terms || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="text-sm font-medium">{deal.start_date || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">End Date</p>
              <p className="text-sm font-medium">{deal.end_date || "—"}</p>
            </div>
          </div>

          {/* Team */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Team</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">VSD:</span> {deal.vsd || "—"}</div>
              <div><span className="text-muted-foreground">Principal BOPM:</span> {deal.principal_bopm || "—"}</div>
              <div><span className="text-muted-foreground">Senior BOPM:</span> {deal.senior_bopm || "—"}</div>
              <div><span className="text-muted-foreground">BOPM:</span> {deal.bopm || "—"}</div>
            </div>
          </div>

          {/* RGY Status */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Current RGY Status</p>
            <div className="space-y-0.5">
              <RGYBadge label="Account Health" status={deal.account_health || "NA"} />
              <RGYBadge label="Delivery" status={deal.delivery || "NA"} />
              <RGYBadge label="Finance/Billing" status={deal.finance_billing || "NA"} />
              <RGYBadge label="Capability-SEO" status={deal.capability_seo || "NA"} />
              <RGYBadge label="Capability-Creative" status={deal.capability_creative || "NA"} />
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => { onOpenChange(false); navigate(`/deals/${deal.id}`); }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Full Deal Detail
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
