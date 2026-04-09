import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { RGYRow, RGYStatus } from "@/types/dashboard";
import { mbrHistory, slackActivity } from "@/data/dashboardMocks";

interface DealDrawerProps {
  deal: RGYRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColor: Record<RGYStatus, string> = {
  G: "bg-positive text-primary-foreground",
  Y: "bg-warning text-primary-foreground",
  R: "bg-destructive text-destructive-foreground",
  NA: "bg-muted text-muted-foreground",
};

const sentimentColor: Record<string, string> = {
  Positive: "text-positive",
  Neutral: "text-muted-foreground",
  Negative: "text-destructive",
};

export function DealDrawer({ deal, open, onOpenChange }: DealDrawerProps) {
  if (!deal) return null;

  const mbrs = mbrHistory[deal.id] ?? [];
  const slacks = slackActivity[deal.id] ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{deal.deal}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {/* Deal Info */}
          <div className="space-y-2 text-ui">
            <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span className="font-medium text-foreground">{deal.client}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">BOPM</span><span className="font-medium text-foreground">{deal.bopm}</span></div>
          </div>

          {/* RGY Badges */}
          <div>
            <p className="metric-label mb-2">RGY Status</p>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(deal.dimensions).map(([dim, status]) => (
                <Badge key={dim} className={cn("text-xs", statusColor[status])}>
                  {dim}: {status}
                </Badge>
              ))}
            </div>
          </div>

          {/* MBR History */}
          <div>
            <p className="metric-label mb-2">MBR History</p>
            {mbrs.length === 0 ? (
              <p className="text-ui text-muted-foreground">No MBR records</p>
            ) : (
              <div className="space-y-2">
                {mbrs.map((mbr) => (
                  <div key={mbr.id} className="p-2 rounded-md bg-secondary/50 text-ui">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-muted-foreground text-caption">{mbr.date}</span>
                      <span className={cn("text-caption font-medium", sentimentColor[mbr.sentiment])}>{mbr.sentiment}</span>
                    </div>
                    <p className="text-foreground">{mbr.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Slack Activity */}
          <div>
            <p className="metric-label mb-2">Slack Activity</p>
            {slacks.length === 0 ? (
              <p className="text-ui text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {slacks.map((s) => (
                  <div key={s.id} className="p-2 rounded-md bg-secondary/50 text-ui">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-foreground">{s.channel}</span>
                      <span className="text-caption text-muted-foreground">{s.timestamp}</span>
                    </div>
                    <p className="text-muted-foreground">{s.lastMessage}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link to full deal */}
          <Link
            to={`/deals`}
            className="inline-flex items-center text-ui text-primary hover:underline"
          >
            Open Full Deal →
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
