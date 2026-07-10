import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ExternalLink, CheckCircle2, Circle, Save } from "lucide-react";
import type { MBRDeal, MBREntry, ActionItem } from "@/hooks/useMBRData";
import { getLinkLabel, getFileIcon } from "@/lib/fileLink";
import { formatINR } from "@/lib/csvTargets";
import { toast } from "sonner";

interface MBRDetailDialogProps {
  open: boolean;
  onClose: () => void;
  deal: MBRDeal;
  entry: MBREntry | null;
  selectedMonth?: string;
  onSave?: (params: {
    dealId: string;
    status: string;
    mode: string | null;
    notes: string | null;
    updatedBy: string;
    sentiment?: string | null;
    fathomLink?: string | null;
    scheduledDate?: string | null;
    anirudhAdded?: boolean;
    anirudhJoining?: boolean;
    mbrPptLink?: string | null;
    mbrDate?: string | null;
  }) => Promise<void>;
}

function defaultMbrDateFor(selectedMonth?: string): string {
  const today = new Date();
  const currentYm = today.toISOString().slice(0, 7);
  if (!selectedMonth || selectedMonth === currentYm) {
    return today.toISOString().slice(0, 10);
  }
  const [y, m] = selectedMonth.split("-").map(Number);
  // Last day of the selected month
  const last = new Date(y, m, 0);
  const mm = String(last.getMonth() + 1).padStart(2, "0");
  const dd = String(last.getDate()).padStart(2, "0");
  return `${last.getFullYear()}-${mm}-${dd}`;
}

export function MBRDetailDialog({ open, onClose, deal, entry, onSave, selectedMonth }: MBRDetailDialogProps) {
  const [status, setStatus] = useState(entry?.status || "Pending");
  const [sentiment, setSentiment] = useState(entry?.sentiment || "");
  const [mode, setMode] = useState(entry?.mode || "");
  const [notes, setNotes] = useState(entry?.notes || "");
  const [fathomLink, setFathomLink] = useState(entry?.fathomLink || "");
  const [mbrPptLink, setMbrPptLink] = useState(entry?.mbrPptLink || "");
  const [scheduledDate, setScheduledDate] = useState(entry?.scheduledDate || "");
  const [mbrDate, setMbrDate] = useState(entry?.weekStart || defaultMbrDateFor(selectedMonth));
  const [anirudhAdded, setAnirudhAdded] = useState(entry?.anirudhAdded || false);
  const [anirudhJoining, setAnirudhJoining] = useState(entry?.anirudhJoining || false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(entry?.status || "Pending");
    setSentiment(entry?.sentiment || "");
    setMode(entry?.mode || "");
    setNotes(entry?.notes || "");
    setFathomLink(entry?.fathomLink || "");
    setMbrPptLink(entry?.mbrPptLink || "");
    setScheduledDate(entry?.scheduledDate || "");
    setMbrDate(entry?.weekStart || defaultMbrDateFor(selectedMonth));
    setAnirudhAdded(entry?.anirudhAdded || false);
    setAnirudhJoining(entry?.anirudhJoining || false);
  }, [entry, selectedMonth]);

  const handleSave = async () => {
    if (!onSave) return;
    if (status === "Done" && !sentiment) {
      toast.error("Sentiment is required when marking an MBR as Done.");
      return;
    }
    setSaving(true);
    await onSave({
      dealId: deal.id,
      status,
      mode: mode || null,
      notes: notes || null,
      updatedBy: "",
      sentiment: sentiment || null,
      fathomLink: fathomLink || null,
      scheduledDate: scheduledDate || null,
      anirudhAdded,
      anirudhJoining,
      mbrPptLink: mbrPptLink || null,
      mbrDate: mbrDate || null,
    });
    setSaving(false);
    onClose();
  };

  const sentimentColors: Record<string, string> = {
    Green: "bg-positive text-positive-foreground",
    Yellow: "bg-warning text-warning-foreground",
    Red: "bg-destructive text-destructive-foreground",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">{deal.account}</DialogTitle>
          <p className="text-sm text-muted-foreground">{deal.dealName} · PC: {deal.pcCode}</p>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Editable Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Done">Done</SelectItem>
                  <SelectItem value="Not Done">Not Done</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Not Required">Not Required</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sentiment {status === "Done" && <span className="text-destructive">*</span>}
              </label>
              <Select value={sentiment} onValueChange={setSentiment}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Green">Green</SelectItem>
                  <SelectItem value="Yellow">Yellow</SelectItem>
                  <SelectItem value="Red">Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mode</label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="In-Person">In-Person</SelectItem>
                  <SelectItem value="Virtual">Virtual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Next MBR Scheduled Date</label>
              <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">MBR Date (When Conducted)</label>
              <Input type="date" value={mbrDate} onChange={e => setMbrDate(e.target.value)} className="mt-1" />
              <p className="mt-1 text-[11px] text-muted-foreground">Determines which month this MBR shows up in. Backdate as needed.</p>
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fathom Link</label>
              <Input value={fathomLink} onChange={e => setFathomLink(e.target.value)} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">MBR PPT Link</label>
              <Input value={mbrPptLink} onChange={e => setMbrPptLink(e.target.value)} placeholder="https://..." className="mt-1" />
              {mbrPptLink && (() => {
                const FileIco = getFileIcon(mbrPptLink);
                return (
                  <a
                    href={mbrPptLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={mbrPptLink}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-full"
                  >
                    <FileIco className="h-3 w-3 shrink-0" />
                    <span className="truncate">{getLinkLabel(mbrPptLink)}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                  </a>
                );
              })()}
            </div>
          </div>

          {/* Anirudh Flags */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={anirudhAdded} onCheckedChange={(v) => setAnirudhAdded(!!v)} />
              Anirudh Added
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={anirudhJoining} onCheckedChange={(v) => setAnirudhJoining(!!v)} />
              Anirudh Joining
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" rows={3} placeholder="Add notes..." />
          </div>

          {/* Deal Info (read-only) */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="VSD" value={deal.vsd} />
            <InfoRow label="Sr. BOPM" value={deal.seniorBopm} />
            <InfoRow label="BOPM" value={deal.bopm} />
            <InfoRow label="MRR" value={deal.mrr ? formatINR(deal.mrr) : "—"} />
          </div>

          {/* AI Summary (read-only) */}
          {entry?.aiSummary && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">AI Summary</h4>
              <div className="text-sm text-foreground bg-secondary/30 rounded-lg p-3 whitespace-pre-wrap">{entry.aiSummary}</div>
            </div>
          )}

          {/* Action Items (read-only) */}
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

          {/* Transcript */}
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

          {/* Save Button */}
          {onSave && (
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
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
