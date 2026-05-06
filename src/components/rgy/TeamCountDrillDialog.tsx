import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface DrillDeal {
  id: string;
  deal_id: string;
  deal_name: string;
  account: string;
  rgy_value: "R" | "Y" | "G";
  issue_details?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  team: string;
  severity: "R" | "Y" | "G";
  deals: DrillDeal[];
}

export function TeamCountDrillDialog({ open, onClose, team, severity, deals }: Props) {
  const color = severity === "R" ? "text-red-600" : severity === "Y" ? "text-amber-600" : "text-emerald-600";
  const bg = severity === "R"
    ? "bg-red-500/10 border-red-500/30"
    : severity === "Y"
    ? "bg-amber-500/10 border-amber-500/30"
    : "bg-emerald-500/10 border-emerald-500/30";
  const label = severity === "R" ? "Red" : severity === "Y" ? "Yellow" : "Green";
  const dotBg = severity === "R" ? "bg-red-500" : severity === "Y" ? "bg-amber-500" : "bg-emerald-500";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn("inline-block w-3 h-3 rounded-full", dotBg)} />
            <span className={color}>{label}</span> accounts in {team} —{" "}
            <span className="text-muted-foreground font-normal">{deals.length} deal{deals.length === 1 ? "" : "s"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {deals.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">No deals to show.</p>
          )}
          {deals.map((d) => (
            <div key={d.id} className={cn("border rounded-lg p-3", bg)}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/deals/${d.id}`}
                      className="text-sm font-semibold text-foreground hover:underline"
                      onClick={onClose}
                    >
                      {d.deal_name}
                    </Link>
                    <span className="text-[11px] text-muted-foreground font-mono">{d.deal_id}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.account}</p>
                </div>
                <Badge variant="outline" className={cn("text-[10px] shrink-0", color, "border-current")}>
                  {label}
                </Badge>
              </div>
              {d.issue_details && (
                <p className="text-xs text-foreground/80 leading-relaxed mt-1.5">{d.issue_details}</p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
