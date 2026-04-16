import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CxTaskFormDialog } from "@/components/cx/CxTaskFormDialog";
import type { CxTask, CxStatus } from "@/pages/CentralCx";

interface Props {
  tasks: CxTask[];
  statuses: CxStatus[];
  selectedSpaceId: string | null;
  onAddTask: (task: Partial<CxTask> & { space_id: string; title: string }) => void;
  onUpdateTask: (id: string, updates: Partial<CxTask>) => void;
  onDeleteTask: (id: string) => void;
}

const priorityColors: Record<string, string> = {
  Urgent: "bg-red-500/15 text-red-700 border-red-500/30",
  High: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  Normal: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  Low: "bg-muted text-muted-foreground border-border",
  None: "",
};

export function CxBoardView({ tasks, statuses, selectedSpaceId, onAddTask, onUpdateTask, onDeleteTask }: Props) {
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [editingTask, setEditingTask] = useState<CxTask | null>(null);

  const handleQuickAdd = (status: string) => {
    if (!quickTitle.trim() || !selectedSpaceId) return;
    onAddTask({ space_id: selectedSpaceId, title: quickTitle.trim(), status });
    setQuickTitle("");
    setQuickAddCol(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-2 min-h-[400px]">
      {statuses.map(col => {
        const colTasks = tasks.filter(t => t.status === col.label);
        return (
          <div key={col.id || col.label} className="flex-shrink-0 w-64 flex flex-col">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: col.color }}
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {col.label}
              </span>
              <span className="text-xs text-muted-foreground ml-1">{colTasks.length}</span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2">
              {colTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => setEditingTask(task)}
                  className="border border-border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium text-foreground leading-snug">{task.title}</span>
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteTask(task.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {task.assignee && (
                    <p className="text-xs text-muted-foreground mt-1">{task.assignee}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {task.priority && task.priority !== "None" && (
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", priorityColors[task.priority])}>
                        {task.priority}
                      </Badge>
                    )}
                    {(task.tags || []).map(tag => (
                      <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}

              {/* Quick add */}
              {selectedSpaceId && (
                quickAddCol === col.label ? (
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
                ) : (
                  <button
                    onClick={() => { setQuickAddCol(col.label); setQuickTitle(""); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-1 py-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Task
                  </button>
                )
              )}
            </div>
          </div>
        );
      })}

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
        />
      )}
    </div>
  );
}
