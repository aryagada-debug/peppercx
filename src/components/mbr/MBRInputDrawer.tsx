import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { CalendarConnectButton } from "@/components/calendar/CalendarConnectButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { syncMbrToCalendar } from "@/lib/mbrCalendarSync";

interface ActionItem {
  task: string;
  owner: string;
  deadline: string;
  done: boolean;
}

interface MBRInputDrawerProps {
  open: boolean;
  onClose: () => void;
  deal: {
    id: string;
    account: string;
    dealName: string;
    vsd: string;
    pcCode: string;
    startDate?: string | null;
  };
  existingEntry?: {
    status?: string | null;
    weekStart?: string | null;
    sentiment?: string | null;
    fathomLink?: string | null;
    transcript?: string | null;
    aiSummary?: string | null;
    actionItems?: ActionItem[];
    scheduledDate?: string | null;
    anirudhAdded?: boolean;
    anirudhJoining?: boolean;
    mode?: string | null;
    notes?: string | null;
    mbrPptLink?: string | null;
  } | null;
  selectedWeek?: string;
  onSave: (data: {
    dealId: string;
    status: string;
    mode: string | null;
    notes: string | null;
    updatedBy: string;
    sentiment: string | null;
    fathomLink: string | null;
    transcript: string | null;
    aiSummary: string | null;
    actionItems: ActionItem[];
    scheduledDate: string | null;
    anirudhAdded: boolean;
    anirudhJoining: boolean;
    mbrPptLink: string | null;
    mbrDate?: string;
  }) => void;
}

type FieldKey =
  | "mbrDate"
  | "sentiment"
  | "scheduledDate"
  | "mode"
  | "notes"
  | "mbrPptLink";

export function MBRInputDrawer({ open, onClose, deal, existingEntry, selectedWeek, onSave }: MBRInputDrawerProps) {
  const [status, setStatus] = useState<string>(existingEntry?.status || "Done");
  const [sentiment, setSentiment] = useState<string>(existingEntry?.sentiment || "");
  const [fathomLink, setFathomLink] = useState(existingEntry?.fathomLink || "");
  const [transcript, setTranscript] = useState(existingEntry?.transcript || "");
  const [aiSummary, setAiSummary] = useState(existingEntry?.aiSummary || "");
  const [actionItems, setActionItems] = useState<ActionItem[]>(existingEntry?.actionItems || []);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    existingEntry?.scheduledDate ? new Date(existingEntry.scheduledDate) : undefined
  );
  const [anirudhAdded, setAnirudhAdded] = useState(existingEntry?.anirudhAdded || false);
  const [anirudhJoining, setAnirudhJoining] = useState(existingEntry?.anirudhJoining || false);
  const [mode, setMode] = useState(existingEntry?.mode || "");
  const [notes, setNotes] = useState(existingEntry?.notes || "");
  const [mbrPptLink, setMbrPptLink] = useState(existingEntry?.mbrPptLink || "");
  const [mbrDate, setMbrDate] = useState<Date | undefined>(
    existingEntry?.weekStart
      ? new Date(existingEntry.weekStart)
      : selectedWeek
      ? new Date(selectedWeek)
      : new Date()
  );
  const [scheduledTime, setScheduledTime] = useState("11:00");
  const [durationMin, setDurationMin] = useState(30);
  const [attendeesStr, setAttendeesStr] = useState("");
  const { connected: calConnected, createEvent, updateEvent, deleteEvent } = useGoogleCalendar();
  const { user } = useAuth();
  const [summarizing, setSummarizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const fieldRefs: Record<FieldKey, React.MutableRefObject<HTMLDivElement | null>> = {
    mbrDate: useRef(null),
    sentiment: useRef(null),
    scheduledDate: useRef(null),
    mode: useRef(null),
    notes: useRef(null),
    mbrPptLink: useRef(null),
  };

  const clearError = (k: FieldKey) => setErrors(prev => {
    if (!prev[k]) return prev;
    const next = { ...prev }; delete next[k]; return next;
  });

  const handleGenerateSummary = async () => {
    if (!transcript.trim() || transcript.trim().length < 10) {
      toast({ title: "Transcript too short", description: "Paste at least a few sentences of transcript.", variant: "destructive" });
      return;
    }
    setSummarizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("mbr-summarize", {
        body: { transcript },
      });
      if (error) throw error;
      if (data?.summary) setAiSummary(data.summary);
      if (data?.actionItems?.length) setActionItems(data.actionItems);
      toast({ title: "AI Summary generated", description: `${data?.actionItems?.length || 0} action items extracted.` });
    } catch (e: any) {
      toast({ title: "AI Summary failed", description: e.message || "Try again later.", variant: "destructive" });
    } finally {
      setSummarizing(false);
    }
  };

  const addActionItem = () => setActionItems([...actionItems, { task: "", owner: "", deadline: "", done: false }]);
  const removeActionItem = (i: number) => setActionItems(actionItems.filter((_, idx) => idx !== i));
  const updateActionItem = (i: number, field: keyof ActionItem, value: string | boolean) => {
    const updated = [...actionItems];
    (updated[i] as any)[field] = value;
    setActionItems(updated);
  };

  const handleSubmit = async () => {
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    if (status === "Done") {
      if (!mbrDate) nextErrors.mbrDate = "Pick the date the MBR was conducted.";
      if (!sentiment) nextErrors.sentiment = "Select a sentiment.";
      if (!scheduledDate) nextErrors.scheduledDate = "Set the next MBR date.";
      if (!mode) nextErrors.mode = "Pick In-Person or Virtual.";
      if (!notes.trim()) nextErrors.notes = "Notes are required.";
      if (!mbrPptLink.trim()) nextErrors.mbrPptLink = "MBR PPT link is required.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const firstKey = Object.keys(nextErrors)[0] as FieldKey;
      fieldRefs[firstKey]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast({ title: "Please complete the required fields", description: "Highlighted fields need to be filled before saving.", variant: "destructive" });
      return;
    }
    setErrors({});
    setSubmitting(true);
    const scheduledDateStr = scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : null;
    onSave({
      dealId: deal.id,
      status,
      mode: mode || null,
      notes: notes || null,
      updatedBy: "",
      sentiment: sentiment || null,
      fathomLink: fathomLink || null,
      transcript: transcript || null,
      aiSummary: aiSummary || null,
      actionItems,
      scheduledDate: scheduledDateStr,
      anirudhAdded,
      anirudhJoining,
      mbrPptLink: mbrPptLink || null,
      mbrDate: mbrDate ? format(mbrDate, "yyyy-MM-dd") : undefined,
    });
    // Best-effort: push to Google Calendar
    if (calConnected && user && scheduledDateStr) {
      try {
        const { data: refetched } = await supabase
          .from("mbr_entries")
          .select("id")
          .eq("deal_id", deal.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (refetched?.id) {
          const attendees = attendeesStr.split(",").map(s => s.trim()).filter(Boolean);
          await syncMbrToCalendar({
            userId: user.id,
            mbrEntryId: refetched.id,
            scheduledDate: scheduledDateStr,
            startTime: scheduledTime,
            durationMin,
            dealName: deal.dealName,
            account: deal.account,
            dealId: deal.id,
            notes: notes || undefined,
            attendees: attendees.length ? attendees : undefined,
            cal: { createEvent, updateEvent, deleteEvent, connected: calConnected },
          });
        }
      } catch (e) { console.warn("GCal sync failed", e); }
    }
    setSubmitting(false);
    onClose();
  };

  const sentimentOptions = [
    { value: "Green", color: "bg-positive", ring: "ring-positive" },
    { value: "Yellow", color: "bg-warning", ring: "ring-warning" },
    { value: "Red", color: "bg-destructive", ring: "ring-destructive" },
  ];

  const isDone = status === "Done";
  // Always mark the fields that are compulsory when status = Done so users
  // can see the requirement even before flipping to Done. Enforcement stays
  // conditional on isDone inside handleSubmit.
  const req = (label: string) => (
    <>
      {label} <span className="text-destructive" title="Required when status is Done">*</span>
    </>
  );

  const isValidUrl = (v: string) => {
    try { const u = new URL(v.trim()); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-lg font-semibold text-foreground">MBR — {deal.account}</SheetTitle>
            <CalendarConnectButton />
          </div>
          <div className="text-sm text-muted-foreground space-y-0.5">
            <p><span className="font-medium text-foreground">{deal.dealName}</span></p>
            <p>VSD: {deal.vsd} · PC: {deal.pcCode}{selectedWeek ? ` · Week: ${selectedWeek}` : ""}</p>
          </div>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Status <span className="text-destructive">*</span></Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Done">Done</SelectItem>
                <SelectItem value="Not Done">Not Done</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Not Required">Not Required</SelectItem>
              </SelectContent>
            </Select>
            {isDone && (
              <p className="text-[11px] text-muted-foreground mt-1">Fields marked * are required when status is Done.</p>
            )}
          </div>

          {/* MBR Date */}
          <div ref={fieldRefs.mbrDate}>
            <Label className="text-sm font-medium mb-1.5 block">{req("MBR Date")}</Label>
            <p className="text-xs text-muted-foreground mb-1.5">Select the date this MBR was conducted (defaults to current week, can be backdated)</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !mbrDate && "text-muted-foreground", errors.mbrDate && "border-destructive")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {mbrDate ? format(mbrDate, "PPP") : "Pick MBR date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={mbrDate}
                  onSelect={(d) => { setMbrDate(d); clearError("mbrDate"); }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {errors.mbrDate && <p className="text-xs text-destructive mt-1">{errors.mbrDate}</p>}
            {deal.startDate && (
              <p className="mt-1 text-[11px] text-muted-foreground">Account start date: {format(new Date(deal.startDate), "PPP")}.</p>
            )}
          </div>

          {/* Sentiment */}
          <div ref={fieldRefs.sentiment}>
            <Label className="text-sm font-medium mb-2 block">{req("Sentiment Post MBR")}</Label>
            <div className="flex gap-3">
              {sentimentOptions.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => { setSentiment(s.value); clearError("sentiment"); }}
                  className={cn(
                    "w-12 h-12 rounded-full transition-all",
                    s.color,
                    sentiment === s.value ? `ring-4 ${s.ring} ring-offset-2 ring-offset-background scale-110` : "opacity-60 hover:opacity-100"
                  )}
                  title={s.value}
                />
              ))}
            </div>
            {sentiment && <p className="text-sm text-muted-foreground mt-1">Selected: {sentiment}</p>}
            {errors.sentiment && <p className="text-xs text-destructive mt-1">{errors.sentiment}</p>}
          </div>

          {/* Fathom Link */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Fathom Note-Taker Link <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <p className="text-xs text-muted-foreground mb-1.5">Share the link with view access for anyone</p>
            <Input
              value={fathomLink}
              onChange={(e) => setFathomLink(e.target.value)}
              placeholder="https://fathom.video/..."
            />
          </div>

          {/* Transcript */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Call Transcript <span className="text-xs text-muted-foreground font-normal">(optional — paste to auto-summarize)</span></Label>
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste the full MBR call transcript here..."
              className="min-h-[120px]"
            />
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 gap-1.5"
              onClick={handleGenerateSummary}
              disabled={summarizing || transcript.trim().length < 10}
            >
              {summarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Generate AI Summary
            </Button>
          </div>

          {/* AI Summary */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">AI Summary <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={aiSummary}
                onChange={(e) => setAiSummary(e.target.value)}
                placeholder="AI-generated summary will appear here..."
                className="min-h-[100px]"
              />
          </div>

          {/* Action Items */}
          {(actionItems.length > 0 || aiSummary) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Action Items</Label>
                <Button variant="ghost" size="sm" onClick={addActionItem} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {actionItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start p-2 rounded-md bg-secondary/30 border border-border/50">
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={(v) => updateActionItem(i, "done", !!v)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <Input
                        value={item.task}
                        onChange={(e) => updateActionItem(i, "task", e.target.value)}
                        placeholder="Task description"
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={item.owner}
                          onChange={(e) => updateActionItem(i, "owner", e.target.value)}
                          placeholder="Owner"
                          className="h-7 text-xs flex-1"
                        />
                        <Input
                          value={item.deadline}
                          onChange={(e) => updateActionItem(i, "deadline", e.target.value)}
                          placeholder="Deadline"
                          className="h-7 text-xs flex-1"
                        />
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeActionItem(i)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scheduled Date */}
          <div ref={fieldRefs.scheduledDate}>
            <Label className="text-sm font-medium mb-1.5 block">{req("Next MBR Scheduled Date")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !scheduledDate && "text-muted-foreground", errors.scheduledDate && "border-destructive")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={scheduledDate} onSelect={(d) => { setScheduledDate(d); clearError("scheduledDate"); }} initialFocus />
              </PopoverContent>
            </Popover>
            {errors.scheduledDate && <p className="text-xs text-destructive mt-1">{errors.scheduledDate}</p>}
            {calConnected && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Time</Label>
                  <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Duration (min)</Label>
                  <Input type="number" min={15} step={15} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value) || 30)} className="h-9" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1 block">Attendees (optional, comma-separated emails)</Label>
                  <Input placeholder="alice@example.com, bob@example.com" value={attendeesStr} onChange={(e) => setAttendeesStr(e.target.value)} className="h-9" />
                </div>
                <p className="col-span-2 text-[11px] text-muted-foreground">Saving will create / update the matching event in your Google Calendar.</p>
              </div>
            )}
          </div>

          {/* Anirudh Flags */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={anirudhAdded} onCheckedChange={(v) => setAnirudhAdded(!!v)} />
              Anirudh Added
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={anirudhJoining} onCheckedChange={(v) => setAnirudhJoining(!!v)} />
              Anirudh Joining
            </label>
          </div>

          {/* Mode */}
          <div ref={fieldRefs.mode}>
            <Label className="text-sm font-medium mb-2 block">{req("Meeting Mode")}</Label>
            <RadioGroup value={mode} onValueChange={(v) => { setMode(v); clearError("mode"); }} className={cn("flex gap-4 p-2 rounded-md", errors.mode && "border border-destructive")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="In-Person" id="in-person" />
                <Label htmlFor="in-person" className="text-sm cursor-pointer">In-Person</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="Virtual" id="virtual" />
                <Label htmlFor="virtual" className="text-sm cursor-pointer">Virtual</Label>
              </div>
            </RadioGroup>
            {errors.mode && <p className="text-xs text-destructive mt-1">{errors.mode}</p>}
          </div>

          {/* Notes */}
          <div ref={fieldRefs.notes}>
            <Label className="text-sm font-medium mb-1.5 block">{req("Notes")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); if (e.target.value.trim()) clearError("notes"); }}
              placeholder="Add MBR notes..."
              className={cn("min-h-[80px]", errors.notes && "border-destructive")}
            />
            {errors.notes && <p className="text-xs text-destructive mt-1">{errors.notes}</p>}
          </div>

          {/* MBR PPT Link */}
          <div ref={fieldRefs.mbrPptLink}>
            <Label className="text-sm font-medium mb-1.5 block">{req("MBR PPT Link")}</Label>
            <Input
              value={mbrPptLink}
              onChange={(e) => { setMbrPptLink(e.target.value); if (e.target.value.trim()) clearError("mbrPptLink"); }}
              placeholder="https://docs.google.com/presentation/..."
              className={cn(errors.mbrPptLink && "border-destructive")}
            />
            {errors.mbrPptLink && <p className="text-xs text-destructive mt-1">{errors.mbrPptLink}</p>}
          </div>

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
