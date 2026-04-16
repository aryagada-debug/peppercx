import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Trash2, User, Calendar, Clock, CheckSquare, Flag, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CxTaskFormDialog } from "@/components/cx/CxTaskFormDialog";
import { CxAssigneePopover } from "@/components/cx/CxAssigneePopover";
import { CxDatePickerPopover } from "@/components/cx/CxDatePickerPopover";
import { CxPriorityPopover, PriorityFlag } from "@/components/cx/CxPriorityPopover";
import { CxTagsPopover, tagColor } from "@/components/cx/CxTagsPopover";
import type { CxTask, CxStatus } from "@/pages/CentralCx";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  tasks: CxTask[];
  statuses: CxStatus[];
  selectedSpaceId: string | null;
  allTags: string[];
  onAddTask: (task: Partial<CxTask> & { space_id: string; title: string }) => void;
  onUpdateTask: (id: string, updates: Partial<CxTask>) => void;
  onDeleteTask: (id: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  Urgent: "text-red-500",
  High: "text-orange-500",
  Normal: "text-blue-500",
  Low: "text-gray-400",
};

/* ── Droppable Column ── */
function DroppableColumn({ statusLabel, color, children }: { statusLabel: string; color: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: statusLabel });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 space-y-2 p-2 rounded-b-lg border border-t-0 min-h-[300px] transition-colors",
        isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-background"
      )}
      style={{ borderColor: `${color}33` }}
    >
      {children}
    </div>
  );
}

/* ── Draggable Task Card ── */
function DraggableTaskCard({
  task, onClick, onUpdate, onDelete, spaceId, allTags,
}: {
  task: CxTask; onClick: () => void;
  onUpdate: (updates: Partial<CxTask>) => void;
  onDelete: () => void;
  spaceId: string | null; allTags: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id, data: { status: task.status },
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const hoursProgress = task.estimated_hours > 0 ? Math.min(100, (task.logged_hours / task.estimated_hours) * 100) : 0;
  const descPreview = task.description ? task.description.replace(/<[^>]*>/g, '').slice(0, 80) : '';

  return (
    <div
      ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="border border-border rounded-lg p-3 bg-card cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow group"
      onClick={e => { if (!isDragging) onClick(); }}
    >
      {/* Title row */}
      <div className="flex items-start gap-2 mb-1">
        {task.priority && task.priority !== "None" && (
          <PriorityFlag priority={task.priority} />
        )}
        <span className="text-sm font-medium text-foreground leading-tight flex-1">{task.title}</span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {descPreview && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{descPreview}</p>}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map(t => (
            <Badge key={t} variant="outline" className={`text-[9px] py-0 ${tagColor(t)}`}>{t}</Badge>
          ))}
          {task.tags.length > 3 && <span className="text-[9px] text-muted-foreground">+{task.tags.length - 3}</span>}
        </div>
      )}

      {subtasks.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <CheckSquare className="h-3 w-3" /> <span>{completedSubtasks}/{subtasks.length}</span>
        </div>
      )}

      {task.estimated_hours > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>{task.logged_hours}h / {task.estimated_hours}h</span>
            <span>{Math.round(hoursProgress)}%</span>
          </div>
          <Progress value={hoursProgress} className="h-1.5" />
        </div>
      )}

      {/* Footer: inline action icons */}
      <div className="flex items-center justify-between text-xs" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <CxAssigneePopover spaceId={spaceId} value={task.assignee} onChange={v => onUpdate({ assignee: v })}>
            <button className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-accent transition-colors" title="Assignee">
              {task.assignee ? (
                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                  {task.assignee.charAt(0).toUpperCase()}
                </div>
              ) : (
                <User className="h-3.5 w-3.5 text-muted-foreground/50" />
              )}
            </button>
          </CxAssigneePopover>
          <CxDatePickerPopover value={task.end_date} onChange={v => onUpdate({ end_date: v })}>
            <button className="h-6 px-1 rounded flex items-center gap-0.5 hover:bg-accent transition-colors text-muted-foreground" title="Due date">
              <Calendar className="h-3 w-3" />
              {task.end_date && <span className="text-[10px]">{task.end_date.slice(5)}</span>}
            </button>
          </CxDatePickerPopover>
          <CxPriorityPopover value={task.priority} onChange={v => onUpdate({ priority: v })}>
            <button className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent transition-colors" title="Priority">
              <Flag className={cn("h-3 w-3", PRIORITY_COLORS[task.priority] || "text-muted-foreground/40")} />
            </button>
          </CxPriorityPopover>
          <CxTagsPopover value={task.tags || []} allTags={allTags} onChange={v => onUpdate({ tags: v })}>
            <button className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent transition-colors" title="Tags">
              <Tag className="h-3 w-3 text-muted-foreground/50" />
            </button>
          </CxTagsPopover>
        </div>
        {task.logged_hours > 0 && task.estimated_hours === 0 && (
          <span className="flex items-center gap-0.5 text-primary font-mono font-medium">
            <Clock className="h-3 w-3" /> {task.logged_hours}h
          </span>
        )}
      </div>
    </div>
  );
}

export function CxBoardView({ tasks, statuses, selectedSpaceId, allTags, onAddTask, onUpdateTask, onDeleteTask }: Props) {
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [editingTask, setEditingTask] = useState<CxTask | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleQuickAdd = (status: string) => {
    if (!quickTitle.trim() || !selectedSpaceId) return;
    onAddTask({ space_id: selectedSpaceId, title: quickTitle.trim(), status });
    setQuickTitle(""); setQuickAddCol(null);
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const newStatus = over.id as string;
    if (statuses.map(s => s.label).includes(newStatus)) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== newStatus) onUpdateTask(taskId, { status: newStatus });
    }
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <div className="animate-fade-in pt-2">
      <div className="flex gap-3 mb-4 flex-wrap">
        {statuses.map(col => {
          const count = tasks.filter(t => t.status === col.label).length;
          return (
            <div key={col.id || col.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ borderColor: `${col.color}33`, backgroundColor: `${col.color}10` }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
              {col.label} <span className="font-mono">{count}</span>
            </div>
          );
        })}
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
          {statuses.map(col => {
            const colTasks = tasks.filter(t => t.status === col.label).sort((a, b) => a.sort_order - b.sort_order);
            return (
              <div key={col.id || col.label} className="flex-shrink-0 min-w-[240px] max-w-[300px] flex-1 flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 rounded-t-lg border-b" style={{ borderColor: `${col.color}33`, backgroundColor: `${col.color}15` }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">{col.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">{colTasks.length}</span>
                  </div>
                  {selectedSpaceId && (
                    <button onClick={() => { setQuickAddCol(col.label); setQuickTitle(""); }} className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-accent transition-colors">
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>

                <DroppableColumn statusLabel={col.label} color={col.color}>
                  {colTasks.map(task => (
                    <DraggableTaskCard
                      key={task.id} task={task}
                      onClick={() => setEditingTask(task)}
                      onUpdate={updates => onUpdateTask(task.id, updates)}
                      spaceId={selectedSpaceId} allTags={allTags}
                    />
                  ))}

                  {colTasks.length === 0 && !quickAddCol && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="text-xs text-muted-foreground mb-2">No tasks</p>
                      {selectedSpaceId && (
                        <button onClick={() => { setQuickAddCol(col.label); setQuickTitle(""); }} className="text-xs text-primary hover:underline">+ Add task</button>
                      )}
                    </div>
                  )}

                  {selectedSpaceId && quickAddCol === col.label && (
                    <div className="border border-dashed border-primary/40 rounded-lg p-3 bg-primary/5">
                      <Input autoFocus placeholder="Task Name…" value={quickTitle}
                        onChange={e => setQuickTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleQuickAdd(col.label); if (e.key === "Escape") { setQuickAddCol(null); setQuickTitle(""); } }}
                        className="h-7 text-sm mb-2"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-6 text-xs" onClick={() => handleQuickAdd(col.label)}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setQuickAddCol(null); setQuickTitle(""); }}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </DroppableColumn>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="border border-border rounded-lg p-3 bg-card shadow-xl rotate-2 opacity-90 max-w-[280px]">
              <div className="flex items-start gap-2">
                {activeTask.priority && activeTask.priority !== "None" && <PriorityFlag priority={activeTask.priority} />}
                <span className="text-sm font-medium">{activeTask.title}</span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {editingTask && (
        <CxTaskFormDialog
          open task={editingTask} statuses={statuses}
          spaceId={selectedSpaceId} allTags={allTags}
          onClose={() => setEditingTask(null)}
          onSave={updates => { onUpdateTask(editingTask.id, updates); setEditingTask(null); }}
          onDelete={() => { onDeleteTask(editingTask.id); setEditingTask(null); }}
        />
      )}
    </div>
  );
}
