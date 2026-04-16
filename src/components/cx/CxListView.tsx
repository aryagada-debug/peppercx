import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CxTaskFormDialog } from "@/components/cx/CxTaskFormDialog";
import type { CxTask, CxStatus, CxSpace } from "@/pages/CentralCx";

interface Props {
  tasks: CxTask[];
  statuses: CxStatus[];
  spaces: CxSpace[];
  selectedSpaceId: string | null;
  onUpdateTask: (id: string, updates: Partial<CxTask>) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (task: Partial<CxTask> & { space_id: string; title: string }) => void;
}

const priorityColors: Record<string, string> = {
  Urgent: "bg-red-500/15 text-red-700",
  High: "bg-orange-500/15 text-orange-700",
  Normal: "bg-blue-500/15 text-blue-700",
  Low: "bg-muted text-muted-foreground",
  None: "bg-muted text-muted-foreground",
};

export function CxListView({ tasks, statuses, spaces, selectedSpaceId, onUpdateTask, onDeleteTask, onAddTask }: Props) {
  const [addingTitle, setAddingTitle] = useState("");
  const [editingTask, setEditingTask] = useState<CxTask | null>(null);

  const handleAdd = () => {
    if (!addingTitle.trim() || !selectedSpaceId) return;
    onAddTask({ space_id: selectedSpaceId, title: addingTitle.trim(), status: statuses[0]?.label || "Open" });
    setAddingTitle("");
  };

  return (
    <div className="pt-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
            <th className="text-left py-2 px-2 font-medium">Name</th>
            {!selectedSpaceId && <th className="text-left py-2 px-2 font-medium">Space</th>}
            <th className="text-left py-2 px-2 font-medium">Status</th>
            <th className="text-left py-2 px-2 font-medium">Priority</th>
            <th className="text-left py-2 px-2 font-medium">Assignee</th>
            <th className="text-left py-2 px-2 font-medium">Start</th>
            <th className="text-left py-2 px-2 font-medium">End</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => {
            const space = spaces.find(s => s.id === task.space_id);
            const statusObj = statuses.find(s => s.label === task.status);
            return (
              <tr
                key={task.id}
                className="border-b border-border/50 hover:bg-muted/30 cursor-pointer group"
                onClick={() => setEditingTask(task)}
              >
                <td className="py-2 px-2 font-medium text-foreground">{task.title}</td>
                {!selectedSpaceId && <td className="py-2 px-2 text-muted-foreground">{space?.name || "—"}</td>}
                <td className="py-2 px-2">
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: statusObj?.color, color: statusObj?.color }}>
                    {task.status}
                  </Badge>
                </td>
                <td className="py-2 px-2">
                  <Badge variant="outline" className={cn("text-[10px]", priorityColors[task.priority || "None"])}>
                    {task.priority || "None"}
                  </Badge>
                </td>
                <td className="py-2 px-2 text-muted-foreground">{task.assignee || "—"}</td>
                <td className="py-2 px-2 text-muted-foreground">{task.start_date || "—"}</td>
                <td className="py-2 px-2 text-muted-foreground">{task.end_date || "—"}</td>
                <td className="py-2 px-2">
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteTask(task.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selectedSpaceId && (
        <div className="flex items-center gap-2 px-2 py-3">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="New task…"
            value={addingTitle}
            onChange={e => setAddingTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            className="h-7 text-sm max-w-xs"
          />
        </div>
      )}

      {tasks.length === 0 && (
        <p className="text-center text-muted-foreground py-12 text-sm">No tasks yet.</p>
      )}

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
