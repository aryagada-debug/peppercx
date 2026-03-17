import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

const onboardings = [
  {
    deal: "D-2024-050", client: "NewAge Digital", service: "SEO+Content", sla: 21,
    daysSinceCreation: 12, progress: 57,
    phases: [
      { name: "Kickoff", status: "done", tasks: 4, completed: 4 },
      { name: "Discovery", status: "done", tasks: 3, completed: 3 },
      { name: "Strategy", status: "in_progress", tasks: 5, completed: 2 },
      { name: "Launch", status: "pending", tasks: 4, completed: 0 },
    ],
  },
  {
    deal: "D-2024-051", client: "GreenTech Solutions", service: "Creative", sla: 14,
    daysSinceCreation: 8, progress: 35,
    phases: [
      { name: "Kickoff", status: "done", tasks: 3, completed: 3 },
      { name: "Brief Review", status: "in_progress", tasks: 4, completed: 1 },
      { name: "Production", status: "pending", tasks: 6, completed: 0 },
    ],
  },
];

const phaseStatusColor: Record<string, string> = {
  done: "bg-positive",
  in_progress: "bg-accent",
  pending: "bg-muted",
};

export default function Onboarding() {
  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">Active Onboardings</h1>
        <p className="text-ui text-muted-foreground mb-6">{onboardings.length} deals currently onboarding</p>

        <div className="space-y-4">
          {onboardings.map(o => (
            <div key={o.deal} className="data-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-accent font-medium text-ui">{o.deal}</span>
                    <span className="text-ui font-medium text-foreground">{o.client}</span>
                  </div>
                  <p className="text-caption text-muted-foreground mt-0.5">{o.service} • SLA: {o.sla} days • Day {o.daysSinceCreation}</p>
                </div>
                <div className="text-right">
                  <p className="text-subhead font-semibold font-mono tabular-nums text-foreground">{o.progress}%</p>
                  <p className={cn("text-caption font-medium", o.daysSinceCreation > o.sla ? "text-destructive" : "text-positive")}>
                    {o.sla - o.daysSinceCreation > 0 ? `${o.sla - o.daysSinceCreation} days remaining` : "SLA exceeded"}
                  </p>
                </div>
              </div>

              <div className="h-2 bg-muted rounded-sm overflow-hidden mb-4">
                <div className="h-full bg-accent rounded-sm transition-all" style={{ width: `${o.progress}%` }} />
              </div>

              <div className="flex gap-3">
                {o.phases.map(p => (
                  <div key={p.name} className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("h-2 w-2 rounded-full", phaseStatusColor[p.status])} />
                      <span className="text-caption font-medium text-foreground">{p.name}</span>
                    </div>
                    <p className="text-caption text-muted-foreground">{p.completed}/{p.tasks} tasks</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
