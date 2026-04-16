import React, { useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trash2, Bold, Italic, List, CheckSquare, Link, Plus, Clock,
  ChevronDown, ChevronRight, X, User, Calendar, Flag, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CxAssigneePopover } from "@/components/cx/CxAssigneePopover";
import { CxDatePickerPopover } from "@/components/cx/CxDatePickerPopover";
import { CxPriorityPopover, PriorityFlag } from "@/components/cx/CxPriorityPopover";
import { CxTagsPopover, tagColor } from "@/components/cx/CxTagsPopover";
import type { CxTask, CxStatus, CxSubTask } from "@/pages/CentralCx";

interface Props {
  open: boolean;
  task: CxTask;
  statuses: CxStatus[];
  spaceId: string | null;
  allTags: string[];
  onClose: () => void;
  onSave: (updates: Partial<CxTask>) => void;
  onDelete?: () => void;
}

/* ── Rich Text Editor ── */
function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Set initial HTML only once on mount
  React.useEffect(() => {
    if (editorRef.current && !initializedRef.current) {
      editorRef.current.innerHTML = value || "";
      initializedRef.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };
  const handleLink = () => { const url = prompt("Enter URL:"); if (url) exec("createLink", url); };

  return (
    <div className="border border-input rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-input bg-muted/30">
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("bold"); }} className="p-1.5 rounded hover:bg-accent"><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("italic"); }} className="p-1.5 rounded hover:bg-accent"><Italic className="h-3.5 w-3.5" /></button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("insertUnorderedList"); }} className="p-1.5 rounded hover:bg-accent"><List className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("insertOrderedList"); }} className="p-1.5 rounded hover:bg-accent"><CheckSquare className="h-3.5 w-3.5" /></button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={e => { e.preventDefault(); handleLink(); }} className="p-1.5 rounded hover:bg-accent"><Link className="h-3.5 w-3.5" /></button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[120px] max-h-[250px] overflow-y-auto px-3 py-2 text-sm text-foreground bg-background focus:outline-none prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline"
        onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
      />
    </div>
  );
}

/* ── Subtask Row ── */
function SubtaskRow({ subtask, onUpdate, onDelete }: { subtask: CxSubTask; onUpdate: (u: Partial<CxSubTask>) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border rounded-md p-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <Checkbox checked={subtask.completed} onCheckedChange={c => onUpdate({ completed: !!c })} />
        <Input value={subtask.title} onChange={e => onUpdate({ title: e.target.value })} placeholder="Subtask title" className="h-7 text-sm flex-1" />
        <Input value={subtask.assignee || ""} onChange={e => onUpdate({ assignee: e.target.value })} placeholder="Assignee" className="h-7 w-[120px] text-xs" />
        <button type="button" onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-accent rounded">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <button type="button" onClick={onDelete} className="p-1 hover:bg-destructive/10 rounded text-destructive"><X className="h-3 w-3" /></button>
      </div>
      {expanded && (
        <div className="mt-2 ml-6">
          <Label className="text-[10px] text-muted-foreground">Description</Label>
          <RichTextEditor value={subtask.description || ""} onChange={v => onUpdate({ description: v })} />
        </div>
      )}
    </div>
  );
}

/* ── Priority label mapping ── */
const PRIORITY_LABELS: Record<string, { color: string; label: string }> = {
  Urgent: { color: "text-red-500", label: "Urgent" },
  High: { color: "text-orange-500", label: "High" },
  Normal: { color: "text-blue-500", label: "Normal" },
  Low: { color: "text-gray-400", label: "Low" },
};

export function CxTaskFormDialog({ open, task, statuses, spaceId, allTags, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState(task.status);
  const [assignee, setAssignee] = useState(task.assignee);
  const [priority, setPriority] = useState(task.priority || "None");
  const [urgency, setUrgency] = useState(task.urgency || "Medium");
  const [startDate, setStartDate] = useState(task.start_date || "");
  const [endDate, setEndDate] = useState(task.end_date || "");
  const [tags, setTags] = useState<string[]>(task.tags || []);
  const [estimatedHours, setEstimatedHours] = useState(task.estimated_hours || 0);
  const [loggedHours] = useState(task.logged_hours || 0);
  const [subtasks, setSubtasks] = useState<CxSubTask[]>(task.subtasks || []);
  const [autoRegen, setAutoRegen] = useState(task.auto_regen || false);
  const [showLogHours, setShowLogHours] = useState(false);
  const [logHoursInput, setLogHoursInput] = useState("");

  const hoursProgress = estimatedHours > 0 ? Math.min(100, (loggedHours / estimatedHours) * 100) : 0;

  const handleSave = () => {
    const addedHours = parseFloat(logHoursInput) || 0;
    onSave({
      title, description, status, assignee, priority, urgency,
      start_date: startDate || null, end_date: endDate || null,
      tags,
      estimated_hours: estimatedHours,
      logged_hours: loggedHours + (addedHours > 0 ? addedHours : 0),
      subtasks, auto_regen: autoRegen,
    });
  };

  const addSubtask = () => setSubtasks(prev => [...prev, { id: crypto.randomUUID(), title: "", completed: false, assignee: "", description: "" }]);
  const updateSubtask = (id: string, updates: Partial<CxSubTask>) => setSubtasks(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  const deleteSubtask = (id: string) => setSubtasks(prev => prev.filter(s => s.id !== id));

  const statusObj = statuses.find(s => s.label === status);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <span>Central Cx</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium truncate max-w-[200px]">{task.title}</span>
          </div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-xl font-semibold text-foreground bg-transparent w-full border-none outline-none placeholder:text-muted-foreground"
            placeholder="Task name"
          />
        </div>

        {/* Metadata Grid */}
        <div className="px-6 py-4 grid grid-cols-2 gap-y-3 gap-x-8 border-b border-border">
          {/* Status */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20">Status</span>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-7 text-xs w-40">
                <div className="flex items-center gap-1.5">
                  {statusObj && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusObj.color }} />}
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {statuses.map(s => (
                  <SelectItem key={s.label} value={s.label}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20">Assignee</span>
            <CxAssigneePopover spaceId={spaceId} value={assignee} onChange={setAssignee}>
              <button className="h-7 px-2 rounded border border-input flex items-center gap-1.5 text-xs hover:bg-accent transition-colors min-w-[140px]">
                {assignee ? (
                  <>
                    <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                      {assignee.charAt(0).toUpperCase()}
                    </div>
                    <span>{assignee}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Add assignee</span>
                )}
              </button>
            </CxAssigneePopover>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20">Priority</span>
            <CxPriorityPopover value={priority} onChange={setPriority}>
              <button className="h-7 px-2 rounded border border-input flex items-center gap-1.5 text-xs hover:bg-accent transition-colors min-w-[140px]">
                {priority && priority !== "None" ? (
                  <>
                    <PriorityFlag priority={priority} />
                    <span>{priority}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1"><Flag className="h-3 w-3" /> Set priority</span>
                )}
              </button>
            </CxPriorityPopover>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20">Dates</span>
            <div className="flex items-center gap-2">
              <CxDatePickerPopover value={startDate || null} onChange={v => setStartDate(v || "")}>
                <button className="h-7 px-2 rounded border border-input flex items-center gap-1 text-xs hover:bg-accent transition-colors">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  {startDate || "Start"}
                </button>
              </CxDatePickerPopover>
              <span className="text-xs text-muted-foreground">→</span>
              <CxDatePickerPopover value={endDate || null} onChange={v => setEndDate(v || "")}>
                <button className="h-7 px-2 rounded border border-input flex items-center gap-1 text-xs hover:bg-accent transition-colors">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  {endDate || "End"}
                </button>
              </CxDatePickerPopover>
            </div>
          </div>

          {/* Time Estimate */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20">Estimate</span>
            <Input type="number" min={0} value={estimatedHours || ""} onChange={e => setEstimatedHours(parseFloat(e.target.value) || 0)} placeholder="0h" className="h-7 w-20 text-xs" />
          </div>

          {/* Track Time */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20">Tracked</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-primary">{loggedHours}h</span>
              {estimatedHours > 0 && (
                <>
                  <Progress value={hoursProgress} className="h-1.5 w-16" />
                  <span className="text-[10px] text-muted-foreground">{Math.round(hoursProgress)}%</span>
                </>
              )}
              {showLogHours ? (
                <div className="flex items-center gap-1">
                  <Input type="number" value={logHoursInput} onChange={e => setLogHoursInput(e.target.value)} className="h-6 w-16 text-xs" placeholder="hrs" autoFocus />
                  <button onClick={() => setShowLogHours(false)} className="text-[10px] text-primary">OK</button>
                </div>
              ) : (
                <button onClick={() => setShowLogHours(true)} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                  <Plus className="h-2.5 w-2.5" /> Log
                </button>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-3 col-span-2">
            <span className="text-xs text-muted-foreground w-20">Tags</span>
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              {tags.map(t => (
                <Badge key={t} variant="outline" className={`text-[9px] cursor-pointer ${tagColor(t)}`} onClick={() => setTags(tags.filter(x => x !== t))}>
                  {t} <X className="h-2.5 w-2.5 ml-0.5" />
                </Badge>
              ))}
              <CxTagsPopover value={tags} allTags={allTags} onChange={setTags}>
                <button className="h-6 px-1.5 rounded border border-dashed border-border flex items-center gap-1 text-[10px] text-muted-foreground hover:bg-accent transition-colors">
                  <Tag className="h-3 w-3" /> Add
                </button>
              </CxTagsPopover>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="px-6 py-4 border-b border-border">
          <Label className="text-xs text-muted-foreground font-medium mb-2 block">Description</Label>
          <RichTextEditor value={description} onChange={setDescription} />
        </div>

        {/* Subtasks */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground font-semibold">Subtasks</Label>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addSubtask}>
              <Plus className="h-3 w-3 mr-1" /> Add Subtask
            </Button>
          </div>
          <div className="space-y-2">
            {subtasks.map(sub => (
              <SubtaskRow key={sub.id} subtask={sub} onUpdate={u => updateSubtask(sub.id, u)} onDelete={() => deleteSubtask(sub.id)} />
            ))}
            {subtasks.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No subtasks yet</p>}
          </div>
        </div>

        {/* Auto-regen + Actions */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-muted/30 border border-border">
            <Checkbox id="cx-auto-regen" checked={autoRegen} onCheckedChange={c => setAutoRegen(!!c)} />
            <Label htmlFor="cx-auto-regen" className="text-xs text-muted-foreground cursor-pointer">
              Auto-regenerate this task when marked Done
            </Label>
          </div>

          <div className="flex items-center justify-between">
            {onDelete ? (
              <Button variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={!title.trim()}>Save Changes</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
