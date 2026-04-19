import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VSDDrillDeal {
  id: string;
  deal_id: string;
  deal_name: string;
  account: string;
  worst: "R" | "Y" | "G" | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  vsd: string;
  deals: VSDDrillDeal[];
}

export function VSDDrillDialog({ open, onClose, vsd, deals }: Props) {
  const red = deals.filter((d) => d.worst === "R");
  const yellow = deals.filter((d) => d.worst === "Y");
  const green = deals.filter((d) => d.worst === "G");

  const renderList = (list: VSDDrillDeal[], color: string) => (
    <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
      {list.length === 0 && <p className="text-xs text-muted-foreground py-3 text-center">No deals.</p>}
      {list.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border hover:bg-secondary/30">
          <div className="min-w-0 flex-1">
            <Link
              to={`/deals/${d.id}`}
              className="text-xs font-medium text-foreground hover:text-primary hover:underline"
              onClick={onClose}
            >
              {d.deal_name}
            </Link>
            <p className="text-[11px] text-muted-foreground truncate">{d.account}</p>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{d.deal_id}</span>
          <span className={cn("inline-block w-2.5 h-2.5 rounded-full shrink-0", color)} />
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {vsd}'s portfolio —{" "}
            <span className="text-muted-foreground font-normal">{deals.length} deal{deals.length === 1 ? "" : "s"}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="red">
          <TabsList>
            <TabsTrigger value="red" className="gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Red <Badge variant="outline" className="ml-1 text-[10px]">{red.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="yellow" className="gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Yellow <Badge variant="outline" className="ml-1 text-[10px]">{yellow.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="green" className="gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Green <Badge variant="outline" className="ml-1 text-[10px]">{green.length}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="red" className="mt-3">{renderList(red, "bg-red-500")}</TabsContent>
          <TabsContent value="yellow" className="mt-3">{renderList(yellow, "bg-amber-500")}</TabsContent>
          <TabsContent value="green" className="mt-3">{renderList(green, "bg-emerald-500")}</TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
