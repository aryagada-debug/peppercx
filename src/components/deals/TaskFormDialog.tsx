import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Trash2, Bold, Italic, List, CheckSquare, Link, Plus, Clock, ChevronDown, ChevronRight, X, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubTask } from "./TaskKanban";

const STAGES = ["To Do", "In Progress", "In Review", "Done", "Dropped"];
const URGENCIES = ["Low", "Medium", "High", "Critical"];

type Assignee = { id: string; name: string; staffed?: boolean; designation?: string };

/* ── Multi-select Assignee Combobox ── */
function MultiAssigneeCombobox({
  values,
  onChange,
  assignees,
  placeholder = "Select assignees",
}: {
  values: string[];
  onChange: (v: string[]) => void;
  assignees: Assignee[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const staffed = assignees.filter(a => a.staffed !== false);
  const others = assignees.filter(a => a.staffed === false);
  const toggle = (name: string) => {
    if (values.includes(name)) onChange(values.filter(v => v !== name));
    else onChange([...values, name]);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-sm text-left ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <div className="flex flex-wrap items-center gap-1">
            {values.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              values.map(v => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[11px]"
                >
                  {v}
                  <span
                    role="button"
                    onClick={e => { e.stopPropagation(); toggle(v); }}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              ))
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command>
          <CommandInput placeholder="Search by name or designation…" />
          <CommandList>
            <CommandEmpty>No people found.</CommandEmpty>
            {staffed.length > 0 && (
              <CommandGroup heading="Staffed on this deal">
                {staffed.map(a => {
                  const checked = values.includes(a.name);
                  return (
                    <CommandItem
                      key={a.id}
                      value={`${a.name} ${a.designation || ""}`}
                      onSelect={() => toggle(a.name)}
                    >
                      <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{a.name}</span>
                        {a.designation && (
                          <span className="text-[11px] text-muted-foreground truncate">{a.designation}</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {others.length > 0 && (
              <CommandGroup heading="Other people">
                {others.map(a => {
                  const checked = values.includes(a.name);
                  return (
                    <CommandItem
                      key={a.id}
                      value={`${a.name} ${a.designation || ""}`}
                      onSelect={() => toggle(a.name)}
                    >
                      <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{a.name}</span>
                        {a.designation && (
                          <span className="text-[11px] text-muted-foreground truncate">{a.designation}</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ── Searchable Assignee Combobox ── */
function AssigneeCombobox({
  value,
  onChange,
  assignees,
  placeholder = "Select assignee",
  triggerClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  assignees: Assignee[];
  placeholder?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const staffed = assignees.filter(a => a.staffed !== false);
  const others = assignees.filter(a => a.staffed === false);
  const selected = assignees.find(a => a.name === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-left ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            triggerClassName,
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? (
              <span>
                {selected.name}
                {selected.designation && (
                  <span className="text-muted-foreground"> · {selected.designation}</span>
                )}
              </span>
            ) : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command>
          <CommandInput placeholder="Search by name or designation…" />
          <CommandList>
            <CommandEmpty>No people found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="unassigned"
                onSelect={() => { onChange(""); setOpen(false); }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                Unassigned
              </CommandItem>
            </CommandGroup>
            {staffed.length > 0 && (
              <CommandGroup heading="Staffed on this deal">
                {staffed.map(a => (
                  <CommandItem
                    key={a.id}
                    value={`${a.name} ${a.designation || ""}`}
                    onSelect={() => { onChange(a.name); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === a.name ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{a.name}</span>
                      {a.designation && (
                        <span className="text-[11px] text-muted-foreground truncate">{a.designation}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {others.length > 0 && (
              <CommandGroup heading="Other people">
                {others.map(a => (
                  <CommandItem
                    key={a.id}
                    value={`${a.name} ${a.designation || ""}`}
                    onSelect={() => { onChange(a.name); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === a.name ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{a.name}</span>
                      {a.designation && (
                        <span className="text-[11px] text-muted-foreground truncate">{a.designation}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export interface TaskData {
  title: string;
  description: string;
  stage: string;
  assignee: string;
  assignees?: string[];
  startDate: string;
  endDate: string;
  urgency: string;
  estimatedHours?: number;
  subtasks?: SubTask[];
  autoRegen?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TaskData) => void;
  assignees: { id: string; name: string; staffed?: boolean; designation?: string }[];
  defaultStage?: string;
  initial?: TaskData & { loggedHours?: number };
  title?: string;
  onDelete?: () => void;
  /** Small read-only context strip shown above the form (e.g. "Client: X · Deal: Y"). */
  headerSubtitle?: string;
  /** ISO timestamp of task creation. Shown in a small audit footer when editing. */
  createdAt?: string | null;
  /** Display name of task creator. Shown in a small audit footer when editing. */
  createdByName?: string | null;
}

/* ── Rich Text Editor ── */
function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Set initial HTML once, and only re-sync if `value` changes from OUTSIDE
  // (e.g. parent reset). Avoids overwriting the DOM on every keystroke,
  // which was destroying the caret position.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== (value || "")) {
      el.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

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
      {/* Toolbar */}
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
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[100px] max-h-[200px] overflow-y-auto px-3 py-2 text-sm text-foreground bg-background focus:outline-none prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline"
        onInput={() => {
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        onClick={(e) => {
          // Make links inside contentEditable clickable (default behavior swallows the click)
          const target = e.target as HTMLElement;
          const anchor = target.closest("a") as HTMLAnchorElement | null;
          if (anchor && anchor.href) {
            e.preventDefault();
            window.open(anchor.href, anchor.target || "_blank", "noopener,noreferrer");
          }
        }}
      />
    </div>
  );
}

/* ── Subtask Row ── */
function SubtaskRow({
  subtask,
  assignees,
  onUpdate,
  onDelete,
}: {
  subtask: SubTask;
  assignees: { id: string; name: string; staffed?: boolean; designation?: string }[];
  onUpdate: (updates: Partial<SubTask>) => void;
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
        <div className="w-[160px]">
          <AssigneeCombobox
            value={subtask.assignee || ""}
            onChange={(v) => onUpdate({ assignee: v })}
            assignees={assignees}
            placeholder="Assign"
            triggerClassName="h-7 text-xs px-2"
          />
        </div>
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

export function TaskFormDialog({ open, onOpenChange, onSubmit, assignees, defaultStage, initial, title = "Create Task", onDelete, headerSubtitle, createdAt, createdByName }: Props) {
  const [form, setForm] = useState<TaskData>({
    title: initial?.title || "",
    description: initial?.description || "",
    stage: initial?.stage || defaultStage || "To Do",
    assignee: initial?.assignee || "",
    assignees: initial?.assignees && initial.assignees.length
      ? initial.assignees
      : (initial?.assignee ? [initial.assignee] : []),
    startDate: initial?.startDate || "",
    endDate: initial?.endDate || "",
    urgency: initial?.urgency || "Medium",
    estimatedHours: initial?.estimatedHours || 0,
    subtasks: initial?.subtasks || [],
    autoRegen: initial?.autoRegen || false,
  });
  const [logHoursInput, setLogHoursInput] = useState("");
  const [showLogHours, setShowLogHours] = useState(false);

  const set = (key: keyof TaskData, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    const list = form.assignees || [];
    onSubmit({ ...form, assignees: list, assignee: list[0] || "" });
    onOpenChange(false);
  };

  const addSubtask = () => {
    const newSub: SubTask = {
      id: crypto.randomUUID(),
      title: "",
      completed: false,
      assignee: "",
      description: "",
    };
    set("subtasks", [...(form.subtasks || []), newSub]);
  };

  const updateSubtask = (id: string, updates: Partial<SubTask>) => {
    set("subtasks", (form.subtasks || []).map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSubtask = (id: string) => {
    set("subtasks", (form.subtasks || []).filter(s => s.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          {/* Accessible title kept for screen readers; visually hidden so the
              editable task-name input below acts as the visible header. */}
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <Input
            value={form.title}
            onChange={e => set("title", e.target.value)}
            placeholder="Task title"
            autoFocus
            className="border-0 px-0 h-auto !text-lg font-medium shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {headerSubtitle && (
            <div className="text-[11px] text-muted-foreground">{headerSubtitle}</div>
          )}
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Rich Text Description */}
          <div className="space-y-1">
            <Label className="text-caption text-muted-foreground">Description</Label>
            <RichTextEditor value={form.description} onChange={v => set("description", v)} />
          </div>

          {/* Stage + Urgency */}
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

          {/* Assignee */}
          <div className="space-y-1">
            <Label className="text-caption text-muted-foreground">Assignees</Label>
            <MultiAssigneeCombobox
              values={form.assignees || []}
              onChange={(v) => set("assignees", v)}
              assignees={assignees}
            />
          </div>

          {/* Dates + Estimated Hours */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-caption text-muted-foreground">Start Date</Label>
              <Input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-caption text-muted-foreground">End Date</Label>
              <Input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-caption text-muted-foreground">Estimated Hours</Label>
              <Input
                type="number"
                min={0}
                value={form.estimatedHours || ""}
                onChange={e => set("estimatedHours", parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Logged hours (edit mode) */}
          {initial?.loggedHours !== undefined && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/30">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-caption text-muted-foreground">Hours logged:</span>
              <span className="text-ui font-mono font-bold text-primary">{initial.loggedHours}h</span>
              {form.estimatedHours != null && form.estimatedHours > 0 && (
                <span className="text-caption text-muted-foreground">/ {form.estimatedHours}h estimated</span>
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
                      onKeyDown={e => {
                        if (e.key === "Escape") setShowLogHours(false);
                      }}
                    />
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                      // Log hours will be handled by parent - we pass the increment through a special mechanism
                      const hrs = parseFloat(logHoursInput);
                      if (!isNaN(hrs) && hrs > 0 && initial) {
                        // We'll submit with updated loggedHours
                        onSubmit({ ...form });
                        // Parent needs to handle the loggedHours increment separately
                      }
                      setShowLogHours(false);
                      setLogHoursInput("");
                    }}>
                      + Log
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowLogHours(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Log Hours
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Auto-regenerate */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
            <Checkbox
              id="auto-regen"
              checked={form.autoRegen || false}
              onCheckedChange={(checked) => set("autoRegen", !!checked)}
            />
            <Label htmlFor="auto-regen" className="text-xs text-muted-foreground cursor-pointer">
              Auto-regenerate this task when marked Done
            </Label>
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-caption text-muted-foreground font-semibold">Subtasks</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addSubtask}>
                <Plus className="h-3 w-3 mr-1" /> Add Subtask
              </Button>
            </div>
            {(form.subtasks || []).map(sub => (
              <SubtaskRow
                key={sub.id}
                subtask={sub}
                assignees={assignees}
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
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!form.title.trim()}>
                {initial ? "Save Changes" : "Create Task"}
              </Button>
            </div>
          </div>

          {/* Created-by / created-at audit log (edit mode only) */}
          {initial && (createdAt || createdByName) && (
            <div className="text-[11px] text-muted-foreground pt-1 border-t border-border">
              <span className="pt-2 inline-block">
                {createdByName && <>Created by <span className="text-foreground">{createdByName}</span></>}
                {createdByName && createdAt && " · "}
                {createdAt && (() => {
                  try { return format(parseISO(createdAt), "d MMM yyyy, HH:mm"); }
                  catch { return createdAt; }
                })()}
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
