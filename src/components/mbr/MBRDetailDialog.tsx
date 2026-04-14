import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExternalLink, CheckCircle2, Circle } from "lucide-react";
import type { MBRDeal, MBREntry, ActionItem } from "@/hooks/useMBRData";

interface MBRDetailDialogProps {
  open: boolean;
  onClose: () => void;
  deal: MBRDeal;
  entry: MBREntry | null;
}

export function MBRDetailDialog({ open, onClose, deal, entry }: MBRDetailDialogProps) {
  const sentimentColors: Record<string, string> = {
    Green: "bg-positive text-positive-foreground",
    Yellow: "bg-warning text-warning-foreground",
    Red: "bg-destructive text-destructive-foreground",
  };

  const statusColors: Record<string, string> = {
    Done: "bg-positive/15 text-positive",
    "Not Done": "bg-destructive/15 text-destructive",
    Pending: "bg-warning/15 text-warning",
    "Not Required": "bg-muted text-muted-foreground",
  };

  const status = entry?.status || "Pending";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-foreground">{deal.account}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Status & Sentiment Row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={cn("text-xs", statusColors[status])}>{status}</Badge>
            {entry?.sentiment && (
              <Badge className={cn("text-xs", sentimentColors[entry.sentiment])}>
                {entry.sentiment} Sentiment
              </Badge>
            )}
            {entry?.mode && (
              <Badge variant="outline" className="text-xs">{entry.mode}</Badge>
            )}
          </div>

          {/* Deal Info Grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="VSD" value={deal.vsd} />
            <InfoRow label="Sr. BOPM" value={deal.seniorBopm} />
            <InfoRow label="BOPM" value={deal.bopm} />
            <InfoRow label="MRR" value={deal.mrr ? `₹${deal.mrr.toLocaleString("en-IN")}` : "—"} />
            <InfoRow label="Next MBR Date" value={entry?.scheduledDate || "Not scheduled"} />
            <InfoRow label="Anirudh Added" value={entry?.anirudhAdded ? "Yes ✓" : "No"} />
            <InfoRow label="Anirudh Joining" value={entry?.anirudhJoining ? "Yes ✓" : "No"} />
            {entry?.inputRecordedAt && (
              <InfoRow label="Recorded At" value={new Date(entry.inputRecordedAt).toLocaleString("en-IN")} />
            )}
          </div>

          {/* Fathom Link */}
          {entry?.fathomLink && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Fathom Link</h4>
              <a href={entry.fathomLink} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline inline-flex items-center gap-1">
                {entry.fathomLink.slice(0, 60)}{entry.fathomLink.length > 60 ? "…" : ""}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* MBR PPT Link */}
          {entry?.mbrPptLink && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">MBR PPT Link</h4>
              <a href={entry.mbrPptLink} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline inline-flex items-center gap-1">
                {entry.mbrPptLink.slice(0, 60)}{entry.mbrPptLink.length > 60 ? "…" : ""}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* AI Summary */}
          {entry?.aiSummary && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">AI Summary</h4>
              <div className="text-sm text-foreground bg-secondary/30 rounded-lg p-3 whitespace-pre-wrap">{entry.aiSummary}</div>
            </div>
          )}

          {/* Action Items */}
          {entry?.actionItems && entry.actionItems.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Action Items ({entry.actionItems.length})</h4>
              <div className="space-y-2">
                {entry.actionItems.map((item: ActionItem, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-md bg-secondary/20 border border-border/50">
                    {item.done
                      ? <CheckCircle2 className="h-4 w-4 text-positive mt-0.5 shrink-0" />
                      : <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                    <div className="flex-1">
                      <p className={cn("text-foreground", item.done && "line-through text-muted-foreground")}>{item.task}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.owner && `Owner: ${item.owner}`}
                        {item.owner && item.deadline && " · "}
                        {item.deadline && `Due: ${item.deadline}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {entry?.notes && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Notes</h4>
              <p className="text-sm text-foreground">{entry.notes}</p>
            </div>
          )}

          {/* Transcript (collapsed) */}
          {entry?.transcript && (
            <details className="group">
              <summary className="text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors">
                View Transcript
              </summary>
              <div className="text-sm text-muted-foreground bg-secondary/20 rounded-lg p-3 mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {entry.transcript}
              </div>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/30">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
