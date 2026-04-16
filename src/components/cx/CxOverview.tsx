import React from "react";
import { Clock } from "lucide-react";
import type { CxTask, CxStatus, CxSpace } from "@/pages/CentralCx";

interface Props {
  tasks: CxTask[];
  spaces: CxSpace[];
  statuses: CxStatus[];
  selectedSpaceId: string | null;
}

export function CxOverview({ tasks, spaces, statuses, selectedSpaceId }: Props) {
  const recentTasks = [...tasks].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 8);

  const spaceGroups = selectedSpaceId
    ? [{ space: spaces.find(s => s.id === selectedSpaceId)!, tasks }]
    : spaces.map(s => ({ space: s, tasks: tasks.filter(t => t.space_id === s.id) }));

  const totalEstimated = tasks.reduce((s, t) => s + (t.estimated_hours || 0), 0);
  const totalLogged = tasks.reduce((s, t) => s + (t.logged_hours || 0), 0);

  return (
    <div className="pt-4 space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground">Total Tasks</p>
          <p className="text-2xl font-semibold text-foreground">{tasks.length}</p>
        </div>
        {statuses.slice(0, 3).map(s => {
          const count = tasks.filter(t => t.status === s.label).length;
          return (
            <div key={s.label} className="border border-border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold" style={{ color: s.color }}>{count}</p>
            </div>
          );
        })}
        {(totalEstimated > 0 || totalLogged > 0) && (
          <div className="border border-border rounded-lg p-4 bg-card">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Hours</p>
            <p className="text-2xl font-semibold text-primary">{totalLogged}<span className="text-sm text-muted-foreground font-normal">/{totalEstimated}h</span></p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent */}
        <div className="border border-border rounded-lg p-4 bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent</h3>
          <div className="space-y-2">
            {recentTasks.length === 0 && <p className="text-xs text-muted-foreground">No tasks yet</p>}
            {recentTasks.map(t => {
              const space = spaces.find(s => s.id === t.space_id);
              return (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="text-foreground font-medium">{t.title}</span>
                  {space && <span className="text-xs text-muted-foreground">• in {space.name}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Spaces summary */}
        <div className="border border-border rounded-lg p-4 bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Spaces</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="text-left py-1">Name</th>
                <th className="text-left py-1">Tasks</th>
                <th className="text-left py-1">Done</th>
                <th className="text-left py-1">Hours</th>
              </tr>
            </thead>
            <tbody>
              {spaceGroups.map(g => {
                const doneCount = g.tasks.filter(t => t.status === "Done").length;
                const logged = g.tasks.reduce((s, t) => s + (t.logged_hours || 0), 0);
                const est = g.tasks.reduce((s, t) => s + (t.estimated_hours || 0), 0);
                return (
                  <tr key={g.space?.id} className="border-t border-border/50">
                    <td className="py-2 text-foreground">{g.space?.name || "—"}</td>
                    <td className="py-2 text-muted-foreground">{g.tasks.length}</td>
                    <td className="py-2 text-muted-foreground">{doneCount}/{g.tasks.length}</td>
                    <td className="py-2 text-muted-foreground font-mono text-xs">{logged}/{est}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
