import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  };
  existingEntry?: {
    sentiment?: string | null;
    fathomLink?: string | null;
    transcript?: string | null;
    aiSummary?: string | null;
    actionItems?: ActionItem[];
    scheduledDate?: string | null;
    anirudhAdded?: boolean;
    mode?: string | null;
    notes?: string | null;
    mbrPptLink?: string | null;
  } | null;
  selectedWeek: string;
  onSave: (data: {
    dealId: string;
    status: string;
    mode: string | null;
    notes: string | null;
    updatedBy: string;
    sentiment: string;
    fathomLink: string | null;
    transcript: string | null;
    aiSummary: string | null;
    actionItems: ActionItem[];
    scheduledDate: string | null;
    anirudhAdded: boolean;
    mbrPptLink: string | null;
    mbrDate?: string;
  }) => void;
}

export function MBRInputDrawer({ open, onClose, deal, existingEntry, selectedWeek, onSave }: MBRInputDrawerProps) {
  const [sentiment, setSentiment] = useState<string>(existingEntry?.sentiment || "");
  const [fathomLink, setFathomLink] = useState(existingEntry?.fathomLink || "");
  const [transcript, setTranscript] = useState(existingEntry?.transcript || "");
  const [aiSummary, setAiSummary] = useState(existingEntry?.aiSummary || "");
  const [actionItems, setActionItems] = useState<ActionItem[]>(existingEntry?.actionItems || []);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    existingEntry?.scheduledDate ? new Date(existingEntry.scheduledDate) : undefined
  );
  const [anirudhAdded, setAnirudhAdded] = useState(existingEntry?.anirudhAdded || false);
  const [mode, setMode] = useState(existingEntry?.mode || "");
  const [notes, setNotes] = useState(existingEntry?.notes || "");
  const [mbrPptLink, setMbrPptLink] = useState(existingEntry?.mbrPptLink || "");
  const [mbrDate, setMbrDate] = useState<Date | undefined>(
    selectedWeek ? new Date(selectedWeek) : new Date()
  );
  const [scheduledTime, setScheduledTime] = useState("11:00");
  const [durationMin, setDurationMin] = useState(30);
  const [attendeesStr, setAttendeesStr] = useState("");
  const { connected: calConnected, createEvent, updateEvent, deleteEvent } = useGoogleCalendar();
  const { user } = useAuth();
  const [summarizing, setSummarizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    if (!mbrDate) {
      toast({ title: "MBR Date required", description: "Please pick the MBR date.", variant: "destructive" });
      return;
    }
    if (!sentiment) {
      toast({ title: "Sentiment required", description: "Please select a sentiment color.", variant: "destructive" });
      return;
    }
    if (!transcript.trim()) {
      toast({ title: "Transcript required", description: "Paste the MBR call transcript.", variant: "destructive" });
      return;
    }
    if (!scheduledDate) {
      toast({ title: "Next MBR date required", description: "Please set the next MBR date.", variant: "destructive" });
      return;
    }
    if (!anirudhAdded) {
      toast({ title: "Anirudh attendance required", description: "Confirm Anirudh was added as an optional attendee.", variant: "destructive" });
      return;
    }
    if (!mode) {
      toast({ title: "Meeting Mode required", description: "Pick In-Person or Virtual.", variant: "destructive" });
      return;
    }
    if (!notes.trim()) {
      toast({ title: "Notes required", description: "Add additional MBR notes.", variant: "destructive" });
      return;
    }
    if (!mbrPptLink.trim()) {
      toast({ title: "MBR PPT Link required", description: "Paste the MBR deck link.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const scheduledDateStr = format(scheduledDate, "yyyy-MM-dd");
    onSave({
      dealId: deal.id,
      status: "Done",
      mode: mode || null,
      notes: notes || null,
      updatedBy: "",
      sentiment,
      fathomLink: fathomLink || null,
      transcript: transcript || null,
      aiSummary: aiSummary || null,
      actionItems,
      scheduledDate: scheduledDateStr,
      anirudhAdded,
      mbrPptLink: mbrPptLink || null,
      mbrDate: mbrDate ? format(mbrDate, "yyyy-MM-dd") : undefined,
    });
    // Best-effort: push to Google Calendar
    if (calConnected && user) {
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

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-lg font-semibold text-foreground">Record MBR — {deal.account}</SheetTitle>
            <CalendarConnectButton />
          </div>
          <div className="text-sm text-muted-foreground space-y-0.5">
            <p><span className="font-medium text-foreground">{deal.dealName}</span></p>
            <p>VSD: {deal.vsd} · PC: {deal.pcCode} · Week: {selectedWeek}</p>
          </div>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* MBR Date */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">MBR Date <span className="text-destructive">*</span></Label>
            <p className="text-xs text-muted-foreground mb-1.5">Select the date this MBR was conducted (defaults to current week, can be backdated)</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !mbrDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {mbrDate ? format(mbrDate, "PPP") : "Pick MBR date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={mbrDate} onSelect={setMbrDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Sentiment */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Sentiment Post MBR <span className="text-destructive">*</span></Label>
            <div className="flex gap-3">
              {sentimentOptions.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSentiment(s.value)}
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
          </div>

          {/* Fathom Link */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Fathom Note-Taker Link</Label>
            <p className="text-xs text-muted-foreground mb-1.5">Share the link with view access for anyone</p>
            <Input
              value={fathomLink}
              onChange={(e) => setFathomLink(e.target.value)}
              placeholder="https://fathom.video/..."
            />
          </div>

          {/* Transcript */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Call Transcript <span className="text-destructive">*</span></Label>
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
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Next MBR Scheduled Date <span className="text-destructive">*</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !scheduledDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} initialFocus />
              </PopoverContent>
            </Popover>
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

          {/* Anirudh Added */}
          <div className="flex items-center gap-3">
            <Checkbox checked={anirudhAdded} onCheckedChange={(v) => setAnirudhAdded(!!v)} id="anirudh-added" />
            <Label htmlFor="anirudh-added" className="text-sm cursor-pointer">Anirudh added as optional attendee? <span className="text-destructive">*</span></Label>
          </div>

          {/* Mode */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Meeting Mode <span className="text-destructive">*</span></Label>
            <RadioGroup value={mode} onValueChange={setMode} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="In-Person" id="in-person" />
                <Label htmlFor="in-person" className="text-sm cursor-pointer">In-Person</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="Virtual" id="virtual" />
                <Label htmlFor="virtual" className="text-sm cursor-pointer">Virtual</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Additional Notes <span className="text-destructive">*</span></Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." className="min-h-[80px]" />
          </div>

          {/* MBR PPT Link */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">MBR PPT Link <span className="text-destructive">*</span></Label>
            <Input
              value={mbrPptLink}
              onChange={(e) => setMbrPptLink(e.target.value)}
              placeholder="https://docs.google.com/presentation/..."
            />
          </div>

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit MBR Record
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
