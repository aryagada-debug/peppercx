import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Trash2, User, Calendar, Clock, CheckSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CxTaskFormDialog } from "@/components/cx/CxTaskFormDialog";
import type { CxTask, CxStatus } from "@/pages/CentralCx";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  tasks: CxTask[];
  statuses: CxStatus[];
  selectedSpaceId: string | null;
  onAddTask: (task: Partial<CxTask> & { space_id: string; title: string }) => void;
  onUpdateTask: (id: string, updates: Partial<CxTask>) => void;
  onDeleteTask: (id: string) => void;
}

const URGENCY_COLORS: Record<string, string> = {
  Critical: "bg-destructive text-white",
  High: "bg-[hsl(var(--warning))] text-white",
  Medium: "bg-accent text-accent-foreground",
  Low: "bg-secondary text-muted-foreground",
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
function DraggableTaskCard({ task, onClick }: { task: CxTask; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const hoursProgress = task.estimated_hours > 0
    ? Math.min(100, (task.logged_hours / task.estimated_hours) * 100)
    : 0;
  const descPreview = task.description
    ? task.description.replace(/<[^>]*>/g, '').slice(0, 80)
    : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="border border-border rounded-lg p-3 bg-card cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow group"
      onClick={(e) => { if (!isDragging) onClick(); }}
    >
      {/* Urgency + Title */}
      <div className="flex items-start gap-2 mb-1.5">
        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0 mt-0.5", URGENCY_COLORS[task.urgency || "Medium"])}>
          {(task.urgency || "M").charAt(0)}
        </span>
        <span className="text-sm font-medium text-foreground leading-tight flex-1">{task.title}</span>
        <button
          onClick={e => { e.stopPropagation(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Description preview */}
      {descPreview && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2 ml-6">{descPreview}</p>
      )}

      {/* Subtasks summary */}
      {subtasks.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 ml-6">
          <CheckSquare className="h-3 w-3" />
          <span>{completedSubtasks}/{subtasks.length}</span>
        </div>
      )}

      {/* Hours progress bar */}
      {task.estimated_hours > 0 && (
        <div className="mb-2 ml-6">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>{task.logged_hours}h / {task.estimated_hours}h</span>
            <span>{Math.round(hoursProgress)}%</span>
          </div>
          <Progress value={hoursProgress} className="h-1.5" />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs ml-6">
        <div className="flex items-center gap-2">
          {task.assignee && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{task.assignee}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.end_date && (
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {task.end_date.slice(5)}
            </span>
          )}
          {task.logged_hours > 0 && task.estimated_hours === 0 && (
            <span className="flex items-center gap-0.5 text-primary font-mono font-medium">
              <Clock className="h-3 w-3" />
              {task.logged_hours}h
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CxBoardView({ tasks, statuses, selectedSpaceId, onAddTask, onUpdateTask, onDeleteTask }: Props) {
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [editingTask, setEditingTask] = useState<CxTask | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleQuickAdd = (status: string) => {
    if (!quickTitle.trim() || !selectedSpaceId) return;
    onAddTask({ space_id: selectedSpaceId, title: quickTitle.trim(), status });
    setQuickTitle("");
    setQuickAddCol(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as string;

    // Check if dropped on a column
    const statusLabels = statuses.map(s => s.label);
    if (statusLabels.includes(newStatus)) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== newStatus) {
        onUpdateTask(taskId, { status: newStatus });
      }
    }
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <div className="animate-fade-in pt-2">
      {/* Summary strip */}
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

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
          {statuses.map(col => {
            const colTasks = tasks.filter(t => t.status === col.label).sort((a, b) => a.sort_order - b.sort_order);
            return (
              <div key={col.id || col.label} className="flex-shrink-0 min-w-[240px] max-w-[300px] flex-1 flex flex-col">
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2 rounded-t-lg border-b" style={{ borderColor: `${col.color}33`, backgroundColor: `${col.color}15` }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">{col.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">{colTasks.length}</span>
                  </div>
                  {selectedSpaceId && (
                    <button
                      onClick={() => { setQuickAddCol(col.label); setQuickTitle(""); }}
                      className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-accent transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Droppable zone */}
                <DroppableColumn statusLabel={col.label} color={col.color}>
                  {colTasks.map(task => (
                    <DraggableTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => setEditingTask(task)}
                    />
                  ))}

                  {colTasks.length === 0 && !quickAddCol && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="text-xs text-muted-foreground mb-2">No tasks</p>
                      {selectedSpaceId && (
                        <button
                          onClick={() => { setQuickAddCol(col.label); setQuickTitle(""); }}
                          className="text-xs text-primary hover:underline"
                        >
                          + Add task
                        </button>
                      )}
                    </div>
                  )}

                  {/* Quick add */}
                  {selectedSpaceId && quickAddCol === col.label && (
                    <div className="border border-dashed border-primary/40 rounded-lg p-3 bg-primary/5">
                      <Input
                        autoFocus
                        placeholder="Task Name…"
                        value={quickTitle}
                        onChange={e => setQuickTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleQuickAdd(col.label);
                          if (e.key === "Escape") { setQuickAddCol(null); setQuickTitle(""); }
                        }}
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

        {/* Drag overlay */}
        <DragOverlay>
          {activeTask && (
            <div className="border border-border rounded-lg p-3 bg-card shadow-xl rotate-2 opacity-90 max-w-[280px]">
              <div className="flex items-start gap-2">
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase", URGENCY_COLORS[activeTask.urgency || "Medium"])}>
                  {(activeTask.urgency || "M").charAt(0)}
                </span>
                <span className="text-sm font-medium">{activeTask.title}</span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {editingTask && (
        <CxTaskFormDialog
          open
          task={editingTask}
          statuses={statuses}
          onClose={() => setEditingTask(null)}
          onSave={(updates) => {
            onUpdateTask(editingTask.id, updates);
            setEditingTask(null);
          }}
          onDelete={() => {
            onDeleteTask(editingTask.id);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}
