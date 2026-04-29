import { useState, useCallback, useMemo } from "react";
import { Plus, Clock, Calendar, User, ChevronDown, ChevronRight, Paperclip, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TaskFormDialog, type TaskData } from "@/components/deals/TaskFormDialog";
import { Progress } from "@/components/ui/progress";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  assignee?: string;
  description?: string;
}

export interface DealTask {
  id: string;
  dealId: string;
  title: string;
  description: string;
  stage: string;
  assignee: string;
  startDate?: string;
  endDate?: string;
  urgency: string;
  loggedHours: number;
  sortOrder: number;
  estimatedHours?: number;
  subtasks?: SubTask[];
  phase?: string;
  tags?: string[];
  autoRegen?: boolean;
}

const STAGES = ["To Do", "In Progress", "In Review", "Done", "Dropped"] as const;

const STAGE_COLORS: Record<string, { bg: string; border: string; dot: string; headerBg: string }> = {
  "To Do": { bg: "bg-secondary/30", border: "border-border", dot: "bg-muted-foreground", headerBg: "bg-secondary" },
  "In Progress": { bg: "bg-[hsl(var(--info)/0.05)]", border: "border-[hsl(var(--info)/0.2)]", dot: "bg-[hsl(var(--info))]", headerBg: "bg-[hsl(var(--info)/0.1)]" },
  "In Review": { bg: "bg-[hsl(var(--warning)/0.05)]", border: "border-[hsl(var(--warning)/0.2)]", dot: "bg-warning", headerBg: "bg-[hsl(var(--warning)/0.1)]" },
  "Done": { bg: "bg-[hsl(var(--success)/0.05)]", border: "border-[hsl(var(--success)/0.2)]", dot: "bg-positive", headerBg: "bg-[hsl(var(--success)/0.1)]" },
  "Dropped": { bg: "bg-[hsl(var(--destructive)/0.03)]", border: "border-[hsl(var(--destructive)/0.15)]", dot: "bg-destructive", headerBg: "bg-[hsl(var(--destructive)/0.08)]" },
};

const URGENCY_COLORS: Record<string, string> = {
  Critical: "bg-destructive text-white",
  High: "bg-[hsl(var(--warning))] text-white",
  Medium: "bg-accent text-accent-foreground",
  Low: "bg-secondary text-muted-foreground",
};

interface Props {
  tasks: DealTask[];
  dealId: string;
  assignees: { id: string; name: string }[];
  onAdd: (task: Omit<DealTask, "id">) => void;
  onUpdate: (id: string, updates: Partial<DealTask>) => void;
  onDelete: (id: string) => void;
  disableAdd?: boolean;
  /** When true, each column shows only ~3 tasks at a time and scrolls vertically. */
  compact?: boolean;
}

/* ── Droppable Column ── */
function DroppableColumn({ stage, children, compact }: { stage: string; children: React.ReactNode; compact?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const colors = STAGE_COLORS[stage];
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-2 p-2 rounded-b-lg border border-t-0 transition-colors",
        compact ? "min-h-[120px] max-h-[280px] overflow-y-auto" : "min-h-[300px]",
        colors.border,
        isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-background"
      )}
    >
      {children}
    </div>
  );
}

/* ── Draggable Task Card ── */
function DraggableTaskCard({ task, onClick }: { task: DealTask; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { stage: task.stage },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const hoursProgress = task.estimatedHours && task.estimatedHours > 0
    ? Math.min(100, (task.loggedHours / task.estimatedHours) * 100)
    : 0;

  // Strip HTML tags for preview
  const descPreview = task.description
    ? task.description.replace(/<[^>]*>/g, '').slice(0, 80)
    : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="data-card !p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
      onClick={(e) => {
        // Only open edit if not dragging
        if (!isDragging) onClick();
      }}
    >
      {/* Urgency + Title */}
      <div className="flex items-start gap-2 mb-1.5">
        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0 mt-0.5", URGENCY_COLORS[task.urgency])}>
          {task.urgency.charAt(0)}
        </span>
        <span className="text-ui font-medium text-foreground leading-tight">{task.title}</span>
      </div>

      {/* Description preview */}
      {descPreview && (
        <p className="text-caption text-muted-foreground mb-2 line-clamp-2 ml-6">{descPreview}</p>
      )}

      {/* Subtasks summary */}
      {subtasks.length > 0 && (
        <div className="flex items-center gap-1.5 text-caption text-muted-foreground mb-2 ml-6">
          <CheckSquare className="h-3 w-3" />
          <span>{completedSubtasks}/{subtasks.length}</span>
        </div>
      )}

      {/* Hours progress bar */}
      {task.estimatedHours != null && task.estimatedHours > 0 && (
        <div className="mb-2 ml-6">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>{task.loggedHours}h / {task.estimatedHours}h</span>
            <span>{Math.round(hoursProgress)}%</span>
          </div>
          <Progress value={hoursProgress} className="h-1.5" />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-caption ml-6">
        <div className="flex items-center gap-2">
          {task.assignee && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{task.assignee}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.endDate && (
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {task.endDate.slice(5)}
            </span>
          )}
          {task.loggedHours > 0 && (!task.estimatedHours || task.estimatedHours === 0) && (
            <span className="flex items-center gap-0.5 text-primary font-mono font-medium">
              <Clock className="h-3 w-3" />
              {task.loggedHours}h
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TaskKanban({ tasks, dealId, assignees, onAdd, onUpdate, onDelete, disableAdd, compact }: Props) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForStage, setCreateForStage] = useState<string>("To Do");
  const [editTask, setEditTask] = useState<DealTask | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleCreate = useCallback((data: TaskData) => {
    onAdd({
      dealId,
      title: data.title,
      description: data.description,
      stage: data.stage,
      assignee: data.assignee,
      startDate: data.startDate,
      endDate: data.endDate,
      urgency: data.urgency,
      loggedHours: 0,
      sortOrder: tasks.filter(t => t.stage === data.stage).length,
      estimatedHours: data.estimatedHours || 0,
      subtasks: data.subtasks || [],
    });
  }, [dealId, onAdd, tasks]);

  const handleEdit = useCallback((data: TaskData) => {
    if (!editTask) return;
    onUpdate(editTask.id, {
      title: data.title,
      description: data.description,
      stage: data.stage,
      assignee: data.assignee,
      startDate: data.startDate,
      endDate: data.endDate,
      urgency: data.urgency,
      estimatedHours: data.estimatedHours || 0,
      subtasks: data.subtasks || [],
    });
    setEditTask(null);
  }, [editTask, onUpdate]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStage = over.id as string;

    // Check if dropped on a column
    if (STAGES.includes(newStage as any)) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.stage !== newStage) {
        onUpdate(taskId, { stage: newStage });
      }
    }
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <div className="animate-fade-in">
      {/* Summary strip */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {STAGES.map(stage => {
          const count = tasks.filter(t => t.stage === stage).length;
          const colors = STAGE_COLORS[stage];
          return (
            <div key={stage} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-caption font-medium", colors.headerBg, colors.border)}>
              <span className={cn("w-2 h-2 rounded-full", colors.dot)} />
              {stage} <span className="font-mono">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Kanban columns with DnD */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: compact ? 200 : 400 }}>
          {STAGES.map(stage => {
            const stageTasks = tasks.filter(t => t.stage === stage).sort((a, b) => a.sortOrder - b.sortOrder);
            const colors = STAGE_COLORS[stage];
            return (
              <div key={stage} className="flex-1 min-w-[240px] max-w-[300px]">
                {/* Column header */}
                <div className={cn("flex items-center justify-between px-3 py-2 rounded-t-lg border-b", colors.headerBg, colors.border)}>
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", colors.dot)} />
                    <span className="text-ui font-bold text-foreground">{stage}</span>
                    <span className="text-caption text-muted-foreground font-mono">{stageTasks.length}</span>
                  </div>
                  {!disableAdd && (
                    <button
                      onClick={() => { setCreateForStage(stage); setCreateDialogOpen(true); }}
                      className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-accent transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Droppable zone */}
                <DroppableColumn stage={stage} compact={compact}>
                  {stageTasks.map(task => (
                    <DraggableTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => setEditTask(task)}
                    />
                  ))}

                  {stageTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="text-caption text-muted-foreground mb-2">No tasks</p>
                      {!disableAdd && (
                        <button
                          onClick={() => { setCreateForStage(stage); setCreateDialogOpen(true); }}
                          className="text-caption text-primary hover:underline"
                        >
                          + Add task
                        </button>
                      )}
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
            <div className="data-card !p-3 shadow-xl rotate-2 opacity-90 max-w-[280px]">
              <div className="flex items-start gap-2">
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase", URGENCY_COLORS[activeTask.urgency])}>
                  {activeTask.urgency.charAt(0)}
                </span>
                <span className="text-ui font-medium">{activeTask.title}</span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Create dialog */}
      <TaskFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreate}
        assignees={assignees}
        defaultStage={createForStage}
        title="Create Task"
      />

      {/* Edit dialog */}
      {editTask && (
        <TaskFormDialog
          open={!!editTask}
          onOpenChange={(open) => { if (!open) setEditTask(null); }}
          onSubmit={handleEdit}
          assignees={assignees}
          initial={{
            ...editTask,
            startDate: editTask.startDate || "",
            endDate: editTask.endDate || "",
            estimatedHours: editTask.estimatedHours || 0,
            subtasks: editTask.subtasks || [],
          }}
          title="Edit Task"
          onDelete={() => { onDelete(editTask.id); setEditTask(null); }}
        />
      )}
    </div>
  );
}
