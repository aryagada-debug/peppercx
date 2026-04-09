import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

const STAGES = ["To Do", "In Progress", "In Review", "Done", "Dropped"];
const URGENCIES = ["Low", "Medium", "High", "Critical"];

export interface TaskData {
  title: string;
  description: string;
  stage: string;
  assignee: string;
  startDate: string;
  endDate: string;
  urgency: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TaskData) => void;
  assignees: { id: string; name: string }[];
  defaultStage?: string;
  initial?: TaskData & { loggedHours?: number };
  title?: string;
  onDelete?: () => void;
}

export function TaskFormDialog({ open, onOpenChange, onSubmit, assignees, defaultStage, initial, title = "Create Task", onDelete }: Props) {
  const [form, setForm] = useState<TaskData>({
    title: initial?.title || "",
    description: initial?.description || "",
    stage: initial?.stage || defaultStage || "To Do",
    assignee: initial?.assignee || "",
    startDate: initial?.startDate || "",
    endDate: initial?.endDate || "",
    urgency: initial?.urgency || "Medium",
  });

  const set = (key: keyof TaskData, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onSubmit(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label className="text-caption text-muted-foreground">Title *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Task title" autoFocus />
          </div>

          <div className="space-y-1">
            <Label className="text-caption text-muted-foreground">Description</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="Add details, checklists, notes..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-caption text-muted-foreground">Stage</Label>
              <Select value={form.stage} onValueChange={v => set("stage", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-caption text-muted-foreground">Urgency</Label>
              <Select value={form.urgency} onValueChange={v => set("urgency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{URGENCIES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-caption text-muted-foreground">Assignee</Label>
            <Select value={form.assignee} onValueChange={v => set("assignee", v)}>
              <SelectTrigger><SelectValue placeholder="Select assignee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {assignees.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-caption text-muted-foreground">Start Date</Label>
              <Input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-caption text-muted-foreground">End Date</Label>
              <Input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} />
            </div>
          </div>

          {initial?.loggedHours !== undefined && initial.loggedHours > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/30">
              <span className="text-caption text-muted-foreground">Hours logged:</span>
              <span className="text-ui font-mono font-bold text-primary">{initial.loggedHours}h</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {onDelete ? (
              <Button variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!form.title.trim()}>
                {initial ? "Save Changes" : "Create Task"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
