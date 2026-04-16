import React, { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CxSpaceSidebar } from "@/components/cx/CxSpaceSidebar";
import { CxBoardView } from "@/components/cx/CxBoardView";
import { CxListView } from "@/components/cx/CxListView";
import { CxOverview } from "@/components/cx/CxOverview";
import { CxSpaceMembersDialog } from "@/components/cx/CxSpaceMembersDialog";
import { CxStatusManagerDialog } from "@/components/cx/CxStatusManagerDialog";
import { supabase } from "@/integrations/supabase/client";
import { CxCalendarPanel } from "@/components/cx/CxCalendarPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Columns3, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Json } from "@/integrations/supabase/types";

export interface CxSpace {
  id: string;
  name: string;
}

export interface CxStatus {
  id: string;
  space_id: string;
  label: string;
  color: string;
  sort_order: number;
}

export interface CxSubTask {
  id: string;
  title: string;
  completed: boolean;
  assignee?: string;
  description?: string;
}

export interface CxTask {
  id: string;
  space_id: string;
  title: string;
  description: string;
  status: string;
  assignee: string;
  priority: string;
  tags: string[];
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
  created_at?: string;
  estimated_hours: number;
  logged_hours: number;
  subtasks: CxSubTask[];
  urgency: string;
  auto_regen: boolean;
}

const DEFAULT_STATUSES = [
  { label: "Open", color: "#6b7280", sort_order: 0 },
  { label: "Not Started", color: "#ef4444", sort_order: 1 },
  { label: "Ready", color: "#eab308", sort_order: 2 },
  { label: "In Progress", color: "#3b82f6", sort_order: 3 },
  { label: "Writing", color: "#ec4899", sort_order: 4 },
  { label: "Done", color: "#22c55e", sort_order: 5 },
];

export default function CentralCx() {
  const [spaces, setSpaces] = useState<CxSpace[]>([]);
  const [statuses, setStatuses] = useState<CxStatus[]>([]);
  const [tasks, setTasks] = useState<CxTask[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersOpen, setMembersOpen] = useState(false);
  const [statusMgrOpen, setStatusMgrOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Collect all unique tags across tasks
  const allTags = Array.from(new Set(tasks.flatMap(t => t.tags || [])));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [spaceRes, statusRes, taskRes] = await Promise.all([
      supabase.from("cx_spaces").select("id, name").order("created_at"),
      supabase.from("cx_statuses").select("*").order("sort_order"),
      supabase.from("cx_tasks").select("*").order("sort_order"),
    ]);
    setSpaces((spaceRes.data as CxSpace[]) || []);
    setStatuses((statusRes.data as CxStatus[]) || []);
    // Map subtasks from Json to CxSubTask[]
    const rawTasks = (taskRes.data || []) as any[];
    setTasks(rawTasks.map(t => ({
      ...t,
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
      estimated_hours: t.estimated_hours ?? 0,
      logged_hours: t.logged_hours ?? 0,
      urgency: t.urgency ?? "Medium",
      auto_regen: t.auto_regen ?? false,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addSpace = async (name: string) => {
    const { data } = await supabase.from("cx_spaces").insert({ name }).select("id, name").single();
    if (data) {
      const space = data as CxSpace;
      const statusInserts = DEFAULT_STATUSES.map(s => ({ space_id: space.id, ...s }));
      const { data: newStatuses } = await supabase.from("cx_statuses").insert(statusInserts).select("*");
      setSpaces(prev => [...prev, space]);
      if (newStatuses) setStatuses(prev => [...prev, ...(newStatuses as CxStatus[])]);
      setSelectedSpaceId(space.id);
    }
  };

  const renameSpace = async (id: string, name: string) => {
    await supabase.from("cx_spaces").update({ name } as any).eq("id", id);
    setSpaces(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };

  const deleteSpace = async (id: string) => {
    await supabase.from("cx_spaces").delete().eq("id", id);
    setSpaces(prev => prev.filter(s => s.id !== id));
    setStatuses(prev => prev.filter(s => s.space_id !== id));
    setTasks(prev => prev.filter(t => t.space_id !== id));
    if (selectedSpaceId === id) setSelectedSpaceId(null);
  };

  const addTask = async (task: Partial<CxTask> & { space_id: string; title: string }) => {
    const insert: any = {
      space_id: task.space_id,
      title: task.title,
      status: task.status || "Open",
      description: task.description || "",
      assignee: task.assignee || "",
      priority: task.priority || "None",
      urgency: task.urgency || "Medium",
      estimated_hours: task.estimated_hours || 0,
      logged_hours: task.logged_hours || 0,
      subtasks: (task.subtasks || []) as unknown as Json,
      auto_regen: task.auto_regen || false,
      tags: task.tags || [],
      start_date: task.start_date || null,
      end_date: task.end_date || null,
    };
    const { data } = await supabase.from("cx_tasks").insert(insert).select("*").single();
    if (data) {
      const t = data as any;
      setTasks(prev => [...prev, {
        ...t,
        subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
      }]);
    }
  };

  const updateTask = async (id: string, updates: Partial<CxTask>) => {
    const dbUpdates: any = { ...updates };
    if (updates.subtasks) {
      dbUpdates.subtasks = updates.subtasks as unknown as Json;
    }
    await supabase.from("cx_tasks").update(dbUpdates).eq("id", id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTask = async (id: string) => {
    await supabase.from("cx_tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const currentSpace = spaces.find(s => s.id === selectedSpaceId);
  const filteredTasks = selectedSpaceId ? tasks.filter(t => t.space_id === selectedSpaceId) : tasks;
  const currentStatuses = selectedSpaceId
    ? statuses.filter(s => s.space_id === selectedSpaceId).sort((a, b) => a.sort_order - b.sort_order)
    : Array.from(new Map(statuses.sort((a, b) => a.sort_order - b.sort_order).map(s => [s.label, s])).values());

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-3.5rem)]">
        <CxSpaceSidebar
          spaces={spaces}
          selectedSpaceId={selectedSpaceId}
          onSelect={setSelectedSpaceId}
          onAdd={addSpace}
          onRename={renameSpace}
          onDelete={deleteSpace}
        />

        <div className="flex-1 overflow-auto">
          <div className="px-6 pt-4 pb-2 flex items-center justify-between border-b border-border">
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {selectedSpaceId ? currentSpace?.name || "Space" : "All Tasks"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {selectedSpaceId ? "Space view" : "Admin — all tasks across spaces"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCalendarOpen(!calendarOpen)}>
                <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Calendar
              </Button>
              {selectedSpaceId && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setMembersOpen(true)}>
                    <Users className="h-3.5 w-3.5 mr-1.5" /> Members
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setStatusMgrOpen(true)}>
                    <Columns3 className="h-3.5 w-3.5 mr-1.5" /> Columns
                  </Button>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <Tabs defaultValue="board" className="px-6 pt-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="list">List</TabsTrigger>
                <TabsTrigger value="board">Board</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <CxOverview
                  tasks={filteredTasks}
                  spaces={spaces}
                  statuses={currentStatuses}
                  selectedSpaceId={selectedSpaceId}
                />
              </TabsContent>

              <TabsContent value="list">
                <CxListView
                  tasks={filteredTasks}
                  statuses={currentStatuses}
                  spaces={spaces}
                  selectedSpaceId={selectedSpaceId}
                  allTags={allTags}
                  onUpdateTask={updateTask}
                  onDeleteTask={deleteTask}
                  onAddTask={addTask}
                />
              </TabsContent>

              <TabsContent value="board">
                <CxBoardView
                  tasks={filteredTasks}
                  statuses={currentStatuses}
                  selectedSpaceId={selectedSpaceId}
                  allTags={allTags}
                  onAddTask={addTask}
                  onUpdateTask={updateTask}
                  onDeleteTask={deleteTask}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {selectedSpaceId && (
        <>
          <CxSpaceMembersDialog
            open={membersOpen}
            onClose={() => setMembersOpen(false)}
            spaceId={selectedSpaceId}
            spaceName={currentSpace?.name || ""}
          />
          <CxStatusManagerDialog
            open={statusMgrOpen}
            onClose={() => setStatusMgrOpen(false)}
            spaceId={selectedSpaceId}
            statuses={currentStatuses}
            onStatusesChange={fetchAll}
          />
        </>
      )}
    </AppLayout>
  );
}
