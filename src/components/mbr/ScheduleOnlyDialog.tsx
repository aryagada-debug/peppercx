import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Calendar, ExternalLink, Users, Plus } from "lucide-react";
import type { MBRDeal, MBREntry } from "@/hooks/useMBRData";
import { useGoogleCalendar, type GCalEvent } from "@/hooks/useGoogleCalendar";
import { CalendarConnectButton } from "@/components/calendar/CalendarConnectButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { syncMbrToCalendar } from "@/lib/mbrCalendarSync";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WeekGrid, getWeekStart } from "@/components/calendar/WeekGrid";
import { addDays, addMinutes } from "date-fns";
import { AttendeeMultiSelect } from "@/components/calendar/AttendeeMultiSelect";
import { ConferencingSelect, type ConferencingType } from "@/components/calendar/ConferencingSelect";
import { useStakeholders } from "@/components/deals/orgmap/useStakeholders";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

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
  const [scheduledTime, setScheduledTime] = useState("11:00");
  const [durationMin, setDurationMin] = useState(30);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [conferencing, setConferencing] = useState<ConferencingType>("meet");
  const [conferenceLink, setConferenceLink] = useState("");
  const [saving, setSaving] = useState(false);
  const { connected: calConnected, createEvent, updateEvent, deleteEvent, listEvents } = useGoogleCalendar();
  const { user } = useAuth();
  const { data: stakeholders, add: addStakeholder, update: updateStakeholder, reload: reloadStakeholders } = useStakeholders(deal.id, deal.account || "");
  const [newSh, setNewSh] = useState({ name: "", role: "", email: "" });
  const [shOpen, setShOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const baseDate = useMemo(() => scheduledDate ? new Date(scheduledDate + "T00:00:00") : new Date(), [scheduledDate]);
  const weekStart = useMemo(() => getWeekStart(baseDate), [baseDate]);
  const [events, setEvents] = useState<GCalEvent[]>([]);

  useEffect(() => {
    if (!open || !calConnected) { setEvents([]); return; }
    const tMin = weekStart.toISOString();
    const tMax = addDays(weekStart, 7).toISOString();
    listEvents({ timeMin: tMin, timeMax: tMax, maxResults: 250 }).then(setEvents);
  }, [open, calConnected, weekStart, listEvents]);

  const selection = useMemo(() => {
    if (!scheduledDate) return null;
    const [hh, mm] = scheduledTime.split(":").map(Number);
    const start = new Date(scheduledDate + "T00:00:00");
    start.setHours(hh || 11, mm || 0, 0, 0);
    const end = addMinutes(start, durationMin || 30);
    return { start, end };
  }, [scheduledDate, scheduledTime, durationMin]);

  const handleSave = async () => {
    if (!scheduledDate) return;
    setSaving(true);
    try {
      await onSave({
        dealId: deal.id,
        status: entry?.status || "Pending",
        mode: entry?.mode ?? null,
        notes: entry?.notes ?? null,
        updatedBy: "user",
        scheduledDate,
        anirudhAdded: entry?.anirudhAdded ?? false,
        anirudhJoining: entry?.anirudhJoining ?? false,
      });
      if (calConnected && user) {
        const { data: refetched } = await supabase
          .from("mbr_entries")
          .select("id")
          .eq("deal_id", deal.id)
          .eq("scheduled_date", scheduledDate)
          .maybeSingle();
        const mbrId = refetched?.id || entry?.id;
        if (mbrId) {
          const result = await syncMbrToCalendar({
            userId: user.id,
            mbrEntryId: mbrId,
            scheduledDate,
            startTime: scheduledTime,
            durationMin,
            dealName: deal.dealName,
            account: deal.account,
            dealId: deal.id,
            attendees: attendees.length ? attendees : undefined,
            conferencing,
            conferenceLink: conferenceLink.trim() || undefined,
            cal: { createEvent, updateEvent, deleteEvent, connected: calConnected },
          });
          if (result) toast.success("MBR added to your Google Calendar");
        }
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const stakeholdersWithEmail = useMemo(() => stakeholders.filter(s => s.email && s.email.includes("@")), [stakeholders]);

  const addStakeholderToAttendees = (email: string) => {
    const e = email.trim().toLowerCase();
    if (!e || attendees.some(a => a.toLowerCase() === e)) return;
    setAttendees(prev => [...prev, e]);
  };

  const handleCreateStakeholder = async () => {
    const email = newSh.email.trim().toLowerCase();
    if (!email || !email.includes("@")) { toast.error("Enter a valid email"); return; }
    const inserted = await addStakeholder();
    if (inserted) {
      await updateStakeholder(inserted.id, { name: newSh.name || email, role: newSh.role, email });
      addStakeholderToAttendees(email);
      setNewSh({ name: "", role: "", email: "" });
      setNewOpen(false);
      toast.success("Stakeholder added to Org Map");
      reloadStakeholders();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Schedule MBR — {deal.dealName}
            </DialogTitle>
            <CalendarConnectButton />
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 py-2">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
                <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="h-9" />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Time</label>
                <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="h-9" disabled={!calConnected} title={!calConnected ? "Connect calendar to set time" : ""} />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Duration (min)</label>
                <Input type="number" min={15} step={15} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value) || 30)} className="h-9" disabled={!calConnected} />
              </div>
            </div>

            {calConnected && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-muted-foreground">Attendees</label>
                    <div className="flex items-center gap-1">
                      <Popover open={shOpen} onOpenChange={setShOpen}>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] gap-1">
                            <Users className="h-3 w-3" /> Org Map
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-2" align="end">
                          <p className="text-[11px] font-medium text-muted-foreground mb-1.5 px-1">Add from {deal.account}'s Org Map</p>
                          {stakeholdersWithEmail.length === 0 ? (
                            <p className="text-xs text-muted-foreground px-1 py-2">No stakeholders with emails yet.</p>
                          ) : (
                            <div className="max-h-56 overflow-y-auto">
                              {stakeholdersWithEmail.map(s => {
                                const already = attendees.some(a => a.toLowerCase() === s.email.toLowerCase());
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    disabled={already}
                                    onClick={() => { addStakeholderToAttendees(s.email); }}
                                    className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded hover:bg-accent text-xs disabled:opacity-50"
                                  >
                                    <div>
                                      <div className="font-medium">{s.name}</div>
                                      <div className="text-muted-foreground text-[11px]">{s.role || s.email}</div>
                                    </div>
                                    {already && <span className="text-[10px] text-muted-foreground">added</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      <Popover open={newOpen} onOpenChange={setNewOpen}>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] gap-1">
                            <Plus className="h-3 w-3" /> New
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3 space-y-2" align="end">
                          <p className="text-[11px] font-medium text-muted-foreground">Add new stakeholder to Org Map</p>
                          <div className="space-y-1.5">
                            <Input placeholder="Name" value={newSh.name} onChange={e => setNewSh(p => ({ ...p, name: e.target.value }))} className="h-8 text-xs" />
                            <Input placeholder="Role" value={newSh.role} onChange={e => setNewSh(p => ({ ...p, role: e.target.value }))} className="h-8 text-xs" />
                            <Input placeholder="Email" type="email" value={newSh.email} onChange={e => setNewSh(p => ({ ...p, email: e.target.value }))} className="h-8 text-xs" />
                          </div>
                          <Button size="sm" className="w-full h-7" onClick={handleCreateStakeholder}>Add & invite</Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <AttendeeMultiSelect
                    value={attendees}
                    onChange={setAttendees}
                    extraOptions={stakeholdersWithEmail.map(s => ({ name: s.name || s.email, email: s.email }))}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Saving creates a Google Calendar invite for everyone listed.</p>
                </div>
                <ConferencingSelect value={conferencing} onChange={setConferencing} link={conferenceLink} onLinkChange={setConferenceLink} />
              </>
            )}

            <p className="text-[11px] text-muted-foreground">
              Tip: click any slot in the week view to set the date and time.
            </p>
          </div>

          <div className="min-h-[440px]">
            {calConnected ? (
              <WeekGrid
                weekStart={weekStart}
                events={events}
                selection={selection}
                onSlotClick={(sel) => {
                  const y = sel.start.getFullYear();
                  const m = String(sel.start.getMonth() + 1).padStart(2, "0");
                  const d = String(sel.start.getDate()).padStart(2, "0");
                  const hh = String(sel.start.getHours()).padStart(2, "0");
                  const mm = String(sel.start.getMinutes()).padStart(2, "0");
                  setScheduledDate(`${y}-${m}-${d}`);
                  setScheduledTime(`${hh}:${mm}`);
                }}
                className="h-full"
              />
            ) : (
              <div className="h-full min-h-[440px] flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 text-center px-6">
                <Calendar className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">Connect Google Calendar to pick a slot from your week.</p>
                <CalendarConnectButton />
              </div>
            )}
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
