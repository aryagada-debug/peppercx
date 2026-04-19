import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Calendar } from "lucide-react";
import type { MBRDeal, MBREntry } from "@/hooks/useMBRData";

interface Props {
  open: boolean;
  onClose: () => void;
  deal: MBRDeal;
  entry: MBREntry | null;
  onSave: (params: {
    dealId: string;
    status: string;
    mode: string | null;
    notes: string | null;
    updatedBy: string;
    scheduledDate?: string | null;
    anirudhAdded?: boolean;
    anirudhJoining?: boolean;
  }) => Promise<void>;
}

export function ScheduleOnlyDialog({ open, onClose, deal, entry, onSave }: Props) {
  const [scheduledDate, setScheduledDate] = useState(entry?.scheduledDate || "");
  const [anirudhAdded, setAnirudhAdded] = useState(entry?.anirudhAdded || false);
  const [anirudhJoining, setAnirudhJoining] = useState(entry?.anirudhJoining || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!scheduledDate) return;
    setSaving(true);
    try {
      await onSave({
        dealId: deal.id,
        // Preserve existing status if any; otherwise mark as Pending (just scheduled)
        status: entry?.status || "Pending",
        mode: entry?.mode ?? null,
        notes: entry?.notes ?? null,
        updatedBy: "user",
        scheduledDate,
        anirudhAdded,
        anirudhJoining,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Schedule MBR — {deal.dealName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Scheduled Date</label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={anirudhAdded} onCheckedChange={(v) => setAnirudhAdded(!!v)} />
              <span className="text-xs text-foreground">Anirudh added</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={anirudhJoining} onCheckedChange={(v) => setAnirudhJoining(!!v)} />
              <span className="text-xs text-foreground">Anirudh joining</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !scheduledDate} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
