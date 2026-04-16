import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Trash2, Bold, Italic, List, CheckSquare, Link, Plus, Clock, ChevronDown, ChevronRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CxTask, CxStatus, CxSubTask } from "@/pages/CentralCx";

const URGENCIES = ["Low", "Medium", "High", "Critical"];

interface Props {
  open: boolean;
  task: CxTask;
  statuses: CxStatus[];
  onClose: () => void;
  onSave: (updates: Partial<CxTask>) => void;
  onDelete?: () => void;
}

/* ── Rich Text Editor ── */
function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const handleLink = () => {
    const url = prompt("Enter URL:");
    if (url) exec("createLink", url);
  };

  return (
    <div className="border border-input rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-input bg-muted/30">
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("bold"); }}
          className="p-1.5 rounded hover:bg-accent transition-colors" title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("italic"); }}
          className="p-1.5 rounded hover:bg-accent transition-colors" title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("insertUnorderedList"); }}
          className="p-1.5 rounded hover:bg-accent transition-colors" title="Bullet List">
          <List className="h-3.5 w-3.5" />
        </button>
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("insertOrderedList"); }}
          className="p-1.5 rounded hover:bg-accent transition-colors" title="Checklist">
          <CheckSquare className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={e => { e.preventDefault(); handleLink(); }}
          className="p-1.5 rounded hover:bg-accent transition-colors" title="Add Link">
          <Link className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[100px] max-h-[200px] overflow-y-auto px-3 py-2 text-sm text-foreground bg-background focus:outline-none prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: value }}
        onInput={() => {
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
      />
    </div>
  );
}

/* ── Subtask Row ── */
function SubtaskRow({
  subtask,
  onUpdate,
  onDelete,
}: {
  subtask: CxSubTask;
  onUpdate: (updates: Partial<CxSubTask>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-md p-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={subtask.completed}
          onCheckedChange={(checked) => onUpdate({ completed: !!checked })}
        />
        <Input
          value={subtask.title}
          onChange={e => onUpdate({ title: e.target.value })}
          placeholder="Subtask title"
          className="h-7 text-sm flex-1"
        />
        <Input
          value={subtask.assignee || ""}
          onChange={e => onUpdate({ assignee: e.target.value })}
          placeholder="Assignee"
          className="h-7 w-[120px] text-xs"
        />
        <button type="button" onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-accent rounded">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <button type="button" onClick={onDelete} className="p-1 hover:bg-destructive/10 rounded text-destructive">
          <X className="h-3 w-3" />
        </button>
      </div>
      {expanded && (
        <div className="mt-2 ml-6">
          <Label className="text-[10px] text-muted-foreground">Description</Label>
          <RichTextEditor
            value={subtask.description || ""}
            onChange={v => onUpdate({ description: v })}
          />
        </div>
      )}
    </div>
  );
}

export function CxTaskFormDialog({ open, task, statuses, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState(task.status);
  const [assignee, setAssignee] = useState(task.assignee);
  const [urgency, setUrgency] = useState(task.urgency || "Medium");
  const [startDate, setStartDate] = useState(task.start_date || "");
  const [endDate, setEndDate] = useState(task.end_date || "");
  const [tagsStr, setTagsStr] = useState((task.tags || []).join(", "));
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
      title,
      description,
      status,
      assignee,
      urgency,
      start_date: startDate || null,
      end_date: endDate || null,
      tags: tagsStr.split(",").map(t => t.trim()).filter(Boolean),
      estimated_hours: estimatedHours,
      logged_hours: loggedHours + (addedHours > 0 ? addedHours : 0),
      subtasks,
      auto_regen: autoRegen,
    });
  };

  const addSubtask = () => {
    setSubtasks(prev => [...prev, {
      id: crypto.randomUUID(),
      title: "",
      completed: false,
      assignee: "",
      description: "",
    }]);
  };

  const updateSubtask = (id: string, updates: Partial<CxSubTask>) => {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSubtask = (id: string) => {
    setSubtasks(prev => prev.filter(s => s.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>

          {/* Rich Text Description */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <RichTextEditor value={description} onChange={setDescription} />
          </div>

          {/* Status + Urgency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map(s => (
                    <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Urgency</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {URGENCIES.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Assignee</Label>
            <Input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Name" />
          </div>

          {/* Dates + Estimated Hours */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Estimated Hours</Label>
              <Input
                type="number"
                min={0}
                value={estimatedHours || ""}
                onChange={e => setEstimatedHours(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Logged hours */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/30">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Hours logged:</span>
            <span className="text-sm font-mono font-bold text-primary">{loggedHours}h</span>
            {estimatedHours > 0 && (
              <>
                <span className="text-xs text-muted-foreground">/ {estimatedHours}h estimated</span>
                <Progress value={hoursProgress} className="h-1.5 w-20" />
                <span className="text-xs text-muted-foreground">{Math.round(hoursProgress)}%</span>
              </>
            )}
            <div className="ml-auto">
              {showLogHours ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={logHoursInput}
                    onChange={e => setLogHoursInput(e.target.value)}
                    className="h-7 w-20"
                    placeholder="hrs"
                    autoFocus
                    onKeyDown={e => { if (e.key === "Escape") setShowLogHours(false); }}
                  />
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowLogHours(false)}>
                    OK
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowLogHours(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Log Hours
                </Button>
              )}
            </div>
          </div>

          {/* Auto-regenerate */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
            <Checkbox
              id="cx-auto-regen"
              checked={autoRegen}
              onCheckedChange={(checked) => setAutoRegen(!!checked)}
            />
            <Label htmlFor="cx-auto-regen" className="text-xs text-muted-foreground cursor-pointer">
              Auto-regenerate this task when marked Done
            </Label>
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tags (comma-separated)</Label>
            <Input value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="tag1, tag2" />
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground font-semibold">Subtasks</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addSubtask}>
                <Plus className="h-3 w-3 mr-1" /> Add Subtask
              </Button>
            </div>
            {subtasks.map(sub => (
              <SubtaskRow
                key={sub.id}
                subtask={sub}
                onUpdate={updates => updateSubtask(sub.id, updates)}
                onDelete={() => deleteSubtask(sub.id)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
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
