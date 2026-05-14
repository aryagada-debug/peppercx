import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AttendeeMultiSelect } from "@/components/calendar/AttendeeMultiSelect";
import { ConferencingSelect, type ConferencingType } from "@/components/calendar/ConferencingSelect";

export interface EventFormValue {
  id?: string;
  summary: string;
  description?: string;
  start: string; // ISO
  end: string;   // ISO
  attendees?: string[];
  location?: string;
  htmlLink?: string;
  conferencing?: ConferencingType;
  conferenceLink?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<EventFormValue> | null;
  onSave: (v: EventFormValue) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}

function isoToLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(s: string): string {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

export function EventFormDialog({ open, onOpenChange, initial, onSave, onDelete }: Props) {
  const isEdit = !!initial?.id;
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [conferencing, setConferencing] = useState<ConferencingType>("meet");
  const [conferenceLink, setConferenceLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSummary(initial?.summary || "");
    setDescription(initial?.description || "");
    const defaultStart = initial?.start ? new Date(initial.start) : (() => {
      const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d;
    })();
    const defaultEnd = initial?.end ? new Date(initial.end) : new Date(defaultStart.getTime() + 30 * 60_000);
    setStart(isoToLocalInput(defaultStart.toISOString()));
    setEnd(isoToLocalInput(defaultEnd.toISOString()));
    setAttendees(initial?.attendees || []);
    setLocation(initial?.location || "");
    // Infer conferencing from existing event if editing
    const loc = initial?.location || "";
    const desc = initial?.description || "";
    if (/meet\.google\.com/i.test(loc) || /meet\.google\.com/i.test(desc)) {
      setConferencing("meet"); setConferenceLink("");
    } else if (/teams\.microsoft\.com/i.test(loc)) {
      setConferencing("teams"); setConferenceLink(loc);
    } else if (/zoom\.us/i.test(loc)) {
      setConferencing("zoom"); setConferenceLink(loc);
    } else if (isEdit) {
      setConferencing("none"); setConferenceLink("");
    } else {
      setConferencing("meet"); setConferenceLink("");
    }
  }, [open, initial]);

  const submit = async () => {
    if (!summary.trim() || !start || !end) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        summary: summary.trim(),
        description: description.trim() || undefined,
        start: localInputToIso(start),
        end: localInputToIso(end),
        attendees,
        location: location.trim() || undefined,
        conferencing,
        conferenceLink: conferenceLink.trim() || undefined,
      });
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try { await onDelete(); onOpenChange(false); } finally { setDeleting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={summary} onChange={e => setSummary(e.target.value)} placeholder="Meeting title" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Starts</Label>
              <Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Ends</Label>
              <Input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Attendees</Label>
            <AttendeeMultiSelect value={attendees} onChange={setAttendees} />
          </div>
          <ConferencingSelect value={conferencing} onChange={setConferencing} link={conferenceLink} onLinkChange={setConferenceLink} />
          <div>
            <Label className="text-xs">Location</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {isEdit && onDelete && (
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleting || saving}>
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving || deleting}>Cancel</Button>
            <Button type="button" size="sm" onClick={submit} disabled={saving || deleting || !summary.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isEdit ? "Save" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}