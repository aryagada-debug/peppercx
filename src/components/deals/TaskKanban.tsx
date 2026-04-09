import { useState, useCallback } from "react";
import { Plus, Clock, Calendar, User, Flag, GripVertical, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TaskFormDialog, type TaskData } from "@/components/deals/TaskFormDialog";

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
}

const STAGES = ["To Do", "In Progress", "In Review", "Done", "Dropped"] as const;

const STAGE_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  "To Do": { bg: "bg-secondary", border: "border-border", dot: "bg-muted-foreground" },
  "In Progress": { bg: "bg-[hsl(var(--info)/0.08)]", border: "border-[hsl(var(--info)/0.2)]", dot: "bg-[hsl(var(--info))]" },
  "In Review": { bg: "bg-[hsl(var(--warning)/0.08)]", border: "border-[hsl(var(--warning)/0.2)]", dot: "bg-warning" },
  "Done": { bg: "bg-[hsl(var(--success)/0.08)]", border: "border-[hsl(var(--success)/0.2)]", dot: "bg-positive" },
  "Dropped": { bg: "bg-[hsl(var(--destructive)/0.05)]", border: "border-[hsl(var(--destructive)/0.15)]", dot: "bg-destructive" },
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
}

export function TaskKanban({ tasks, dealId, assignees, onAdd, onUpdate, onDelete }: Props) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForStage, setCreateForStage] = useState<string>("To Do");
  const [editTask, setEditTask] = useState<DealTask | null>(null);
  const [logHoursTaskId, setLogHoursTaskId] = useState<string | null>(null);
  const [hoursInput, setHoursInput] = useState("");

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
    });
    setEditTask(null);
  }, [editTask, onUpdate]);

  const moveTask = (taskId: string, newStage: string) => {
    onUpdate(taskId, { stage: newStage });
  };

  const logHours = (taskId: string) => {
    const hrs = parseFloat(hoursInput);
    if (isNaN(hrs) || hrs <= 0) return;
    const task = tasks.find(t => t.id === taskId);
    if (task) onUpdate(taskId, { loggedHours: task.loggedHours + hrs });
    setLogHoursTaskId(null);
    setHoursInput("");
  };

  return (
    <div className="animate-fade-in">
      {/* Summary strip */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {STAGES.map(stage => {
          const count = tasks.filter(t => t.stage === stage).length;
          const colors = STAGE_COLORS[stage];
          return (
            <div key={stage} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-caption font-medium", colors.bg, colors.border)}>
              <span className={cn("w-2 h-2 rounded-full", colors.dot)} />
              {stage} <span className="font-mono">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
        {STAGES.map(stage => {
          const stageTasks = tasks.filter(t => t.stage === stage).sort((a, b) => a.sortOrder - b.sortOrder);
          const colors = STAGE_COLORS[stage];
          return (
            <div key={stage} className="flex-1 min-w-[240px] max-w-[300px]">
              {/* Column header */}
              <div className={cn("flex items-center justify-between px-3 py-2 rounded-t-lg border-b", colors.bg, colors.border)}>
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full", colors.dot)} />
                  <span className="text-ui font-bold text-foreground">{stage}</span>
                  <span className="text-caption text-muted-foreground font-mono">{stageTasks.length}</span>
                </div>
                <button
                  onClick={() => { setCreateForStage(stage); setCreateDialogOpen(true); }}
                  className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* Cards */}
              <div className={cn("space-y-2 p-2 rounded-b-lg border border-t-0 min-h-[300px]", colors.border, "bg-background")}>
                {stageTasks.map(task => (
                  <div
                    key={task.id}
                    className="data-card !p-3 cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => setEditTask(task)}
                  >
                    {/* Urgency + Title */}
                    <div className="flex items-start gap-2 mb-2">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0 mt-0.5", URGENCY_COLORS[task.urgency])}>
                        {task.urgency.charAt(0)}
                      </span>
                      <span className="text-ui font-medium text-foreground leading-tight">{task.title}</span>
                    </div>

                    {/* Description preview */}
                    {task.description && (
                      <p className="text-caption text-muted-foreground mb-2 line-clamp-2">{task.description}</p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-caption">
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
                        {task.loggedHours > 0 && (
                          <span className="flex items-center gap-0.5 text-primary font-mono font-medium">
                            <Clock className="h-3 w-3" />
                            {task.loggedHours}h
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick actions on hover */}
                    <div className="mt-2 pt-2 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {STAGES.filter(s => s !== task.stage).map(s => (
                        <button
                          key={s}
                          onClick={() => moveTask(task.id, s)}
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <ChevronRight className="h-2.5 w-2.5" />{s}
                        </button>
                      ))}
                    </div>

                    {/* Log hours inline */}
                    <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      {logHoursTaskId === task.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={hoursInput}
                            onChange={e => setHoursInput(e.target.value)}
                            className="h-6 w-16 rounded border border-border bg-background px-2 text-caption text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="hrs"
                            autoFocus
                            onKeyDown={e => { if (e.key === "Enter") logHours(task.id); if (e.key === "Escape") setLogHoursTaskId(null); }}
                          />
                          <button onClick={() => logHours(task.id)} className="text-primary text-caption font-medium">Log</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setLogHoursTaskId(task.id); setHoursInput(""); }}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Clock className="h-3 w-3" /> Log hours
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {stageTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-caption text-muted-foreground mb-2">No tasks</p>
                    <button
                      onClick={() => { setCreateForStage(stage); setCreateDialogOpen(true); }}
                      className="text-caption text-primary hover:underline"
                    >
                      + Add task
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
          initial={{ ...editTask, startDate: editTask.startDate || "", endDate: editTask.endDate || "" }}
          title="Edit Task"
          onDelete={() => { onDelete(editTask.id); setEditTask(null); }}
        />
        />
      )}
    </div>
  );
}
