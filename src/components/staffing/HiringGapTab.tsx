import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Plus, X, AlertTriangle, Users } from "lucide-react";
import { ROLE_CATEGORIES, ROLE_SLOTS, type HiringNeed, type RoleCategory, type Person, type Deal, type StaffingAssignment, uid } from "@/data/staffingData";

interface Props {
  hiringNeeds: HiringNeed[];
  onUpdateNeeds: (needs: HiringNeed[]) => void;
  people: Person[];
  deals: Deal[];
  assignments: StaffingAssignment[];
  editMode: boolean;
}

const priorityColors = {
  Critical: "bg-destructive/10 text-destructive",
  High: "bg-warning/10 text-warning",
  Medium: "bg-accent/10 text-accent",
};

const statusColors = {
  Open: "bg-muted text-muted-foreground",
  "In Progress": "bg-warning/10 text-warning",
  Filled: "bg-positive/10 text-positive",
};

export function HiringGapTab({ hiringNeeds, onUpdateNeeds, people, deals, assignments, editMode }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [newNeed, setNewNeed] = useState<Partial<HiringNeed>>({
    role: "", roleCategory: "Operations", pod: "", priority: "High", targetDate: "", rationale: "", status: "Open"
  });

  const addNeed = () => {
    if (!newNeed.role || !newNeed.rationale) return;
    onUpdateNeeds([...hiringNeeds, { id: `h_${uid()}`, ...newNeed as HiringNeed }]);
    setNewNeed({ role: "", roleCategory: "Operations", pod: "", priority: "High", targetDate: "", rationale: "", status: "Open" });
    setShowAdd(false);
  };

  const removeNeed = (id: string) => onUpdateNeeds(hiringNeeds.filter(h => h.id !== id));
  const updateStatus = (id: string, status: HiringNeed["status"]) => {
    onUpdateNeeds(hiringNeeds.map(h => h.id === id ? { ...h, status } : h));
  };

  const sorted = [...hiringNeeds].sort((a, b) => {
    const p = { Critical: 0, High: 1, Medium: 2 };
    return (p[a.priority] || 2) - (p[b.priority] || 2);
  });

  // Compute gap analysis
  const leavingPeople = people.filter(p => p.leaving && !p.tbh);
  const tbhPeople = people.filter(p => p.tbh);

  // Unstaffed active deals
  const unstaffedDeals = useMemo(() => {
    return deals.filter(d => {
      if (d.staffingStatus === "No Staffing Needed") return false;
      const hasStaff = assignments.some(a => a.dealId === d.id && a.allocationPct > 0);
      return !hasStaff;
    });
  }, [deals, assignments]);

  // FTE gap by role category
  const fteGaps = useMemo(() => {
    const gaps: { category: string; leaving: number; tbh: number; net: number }[] = [];
    ROLE_CATEGORIES.forEach(cat => {
      const leaving = leavingPeople.filter(p => p.roleCategory === cat).length;
      const tbh = tbhPeople.filter(p => p.roleCategory === cat).length;
      if (leaving > 0 || tbh > 0) {
        gaps.push({ category: cat, leaving, tbh, net: tbh - leaving });
      }
    });
    return gaps;
  }, [leavingPeople, tbhPeople]);

  return (
    <div className="space-y-6">
      {/* Gap Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Leaving People */}
        <div className="data-card border-destructive/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h4 className="text-ui font-semibold text-foreground">Leaving ({leavingPeople.length})</h4>
          </div>
          <div className="space-y-1">
            {leavingPeople.slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center justify-between text-caption">
                <span className="text-foreground line-through">{p.name}</span>
                <span className="text-muted-foreground">{p.roleTitle}</span>
              </div>
            ))}
            {leavingPeople.length > 6 && <p className="text-caption text-muted-foreground">+{leavingPeople.length - 6} more</p>}
            {leavingPeople.length === 0 && <p className="text-caption text-muted-foreground">No attrition</p>}
          </div>
        </div>

        {/* TBH Placeholders */}
        <div className="data-card border-warning/20">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-warning" />
            <h4 className="text-ui font-semibold text-foreground">TBH Placeholders ({tbhPeople.length})</h4>
          </div>
          <div className="space-y-1">
            {tbhPeople.slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center justify-between text-caption">
                <span className="text-warning italic">{p.name}</span>
                <span className="text-muted-foreground">{p.roleCategory}</span>
              </div>
            ))}
            {tbhPeople.length > 6 && <p className="text-caption text-muted-foreground">+{tbhPeople.length - 6} more</p>}
            {tbhPeople.length === 0 && <p className="text-caption text-muted-foreground">No TBH roles</p>}
          </div>
        </div>

        {/* Unstaffed Deals */}
        <div className="data-card border-accent/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-accent" />
            <h4 className="text-ui font-semibold text-foreground">Unstaffed Deals ({unstaffedDeals.length})</h4>
          </div>
          <div className="space-y-1">
            {unstaffedDeals.slice(0, 6).map(d => (
              <div key={d.id} className="flex items-center justify-between text-caption">
                <span className="text-foreground truncate max-w-[140px]">{d.account}</span>
                <span className="text-muted-foreground">{d.vsd}</span>
              </div>
            ))}
            {unstaffedDeals.length > 6 && <p className="text-caption text-muted-foreground">+{unstaffedDeals.length - 6} more</p>}
            {unstaffedDeals.length === 0 && <p className="text-caption text-positive">All deals staffed</p>}
          </div>
        </div>
      </div>

      {/* FTE Gap Analysis */}
      {fteGaps.length > 0 && (
        <div className="data-card">
          <h4 className="text-ui font-semibold text-foreground mb-3">FTE Gap Analysis by Role</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {fteGaps.map(g => (
              <div key={g.category} className="border border-border rounded-lg p-3">
                <p className="text-caption font-medium text-foreground mb-1">{g.category}</p>
                <div className="flex items-center gap-3 text-caption">
                  <span className="text-destructive">-{g.leaving} leaving</span>
                  <span className="text-warning">+{g.tbh} TBH</span>
                  <span className={cn("font-medium font-mono", g.net > 0 ? "text-positive" : g.net < 0 ? "text-destructive" : "text-muted-foreground")}>
                    Net: {g.net > 0 ? "+" : ""}{g.net}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hiring Pipeline Table */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-ui font-semibold text-foreground">Hiring Pipeline</h3>
          <p className="text-caption text-muted-foreground">{hiringNeeds.filter(h => h.status === "Open").length} open • {hiringNeeds.filter(h => h.status === "In Progress").length} in progress • {hiringNeeds.filter(h => h.status === "Filled").length} filled</p>
        </div>
        {editMode && (
          <button onClick={() => setShowAdd(true)} className="h-8 px-3 rounded-md bg-foreground text-primary-foreground text-caption font-medium hover:opacity-90 flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Add Need
          </button>
        )}
      </div>

      <div className="data-card p-0 overflow-x-auto">
        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              {["Priority", "Role", "Category", "Pod", "Target Date", "Rationale", "Status", ""].map(h => (
                <th key={h} className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(need => (
              <tr key={need.id} className="border-b border-border/50 hover:bg-secondary/20">
                <td className="py-2 px-3">
                  <span className={cn("px-1.5 py-0.5 rounded text-caption font-medium", priorityColors[need.priority])}>{need.priority}</span>
                </td>
                <td className="py-2 px-3 font-medium text-foreground">{need.role}</td>
                <td className="py-2 px-3 text-muted-foreground text-caption">{need.roleCategory}</td>
                <td className="py-2 px-3 text-muted-foreground text-caption">{need.pod}</td>
                <td className="py-2 px-3 font-mono text-caption text-muted-foreground">{need.targetDate}</td>
                <td className="py-2 px-3 text-caption text-muted-foreground max-w-[250px] truncate" title={need.rationale}>{need.rationale}</td>
                <td className="py-2 px-3">
                  {editMode ? (
                    <select value={need.status} onChange={e => updateStatus(need.id, e.target.value as HiringNeed["status"])}
                      className={cn("h-7 px-2 rounded text-caption font-medium border-0 cursor-pointer", statusColors[need.status])}>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Filled">Filled</option>
                    </select>
                  ) : (
                    <span className={cn("px-1.5 py-0.5 rounded text-caption font-medium", statusColors[need.status])}>{need.status}</span>
                  )}
                </td>
                <td className="py-2 px-3">
                  {editMode && (
                    <button onClick={() => removeNeed(need.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20" onClick={() => setShowAdd(false)}>
          <div className="bg-card border border-border rounded-lg p-6 w-[450px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-ui font-semibold text-foreground">Add Hiring Need</h3>
              <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-caption text-muted-foreground font-medium">Role</label>
                <input type="text" value={newNeed.role} onChange={e => setNewNeed(p => ({ ...p, role: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:ring-1 focus:ring-accent focus:outline-none" placeholder="e.g. Senior BOPM" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Category</label>
                  <select value={newNeed.roleCategory} onChange={e => setNewNeed(p => ({ ...p, roleCategory: e.target.value as RoleCategory }))}
                    className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                    {ROLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Priority</label>
                  <select value={newNeed.priority} onChange={e => setNewNeed(p => ({ ...p, priority: e.target.value as any }))}
                    className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Pod</label>
                  <input type="text" value={newNeed.pod} onChange={e => setNewNeed(p => ({ ...p, pod: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:ring-1 focus:ring-accent focus:outline-none" />
                </div>
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Target Date</label>
                  <input type="date" value={newNeed.targetDate} onChange={e => setNewNeed(p => ({ ...p, targetDate: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:ring-1 focus:ring-accent focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-caption text-muted-foreground font-medium">Rationale</label>
                <input type="text" value={newNeed.rationale} onChange={e => setNewNeed(p => ({ ...p, rationale: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:ring-1 focus:ring-accent focus:outline-none" placeholder="Why is this needed?" />
              </div>
              <button onClick={addNeed} disabled={!newNeed.role || !newNeed.rationale}
                className="w-full h-9 rounded-md bg-foreground text-primary-foreground text-ui font-medium hover:opacity-90 disabled:opacity-50 mt-2">
                Add Hiring Need
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}