import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { Loader2, Pencil, Check, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DEPARTMENTS } from "@/data/staffingData";

const tabs = ["People & Reporting", "Revenue Capacity", "Users & Roles", "Notifications"] as const;
type SettingsTab = typeof tabs[number];

const fmtCurrency = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

function InlineEdit({ value, onSave, type = "text", className: cls }: { value: string; onSave: (v: string) => void; type?: string; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input value={local} onChange={e => setLocal(e.target.value)} type={type} className="h-7 text-xs w-full min-w-[80px]" autoFocus
          onKeyDown={e => { if (e.key === "Enter") { onSave(local); setEditing(false); } if (e.key === "Escape") { setLocal(value); setEditing(false); } }} />
        <button onClick={() => { onSave(local); setEditing(false); }} className="text-primary"><Check className="h-3 w-3" /></button>
        <button onClick={() => { setLocal(value); setEditing(false); }} className="text-muted-foreground"><X className="h-3 w-3" /></button>
      </div>
    );
  }
  return (
    <div className={cn("group/edit flex items-center gap-1 cursor-pointer", cls)} onClick={() => { setLocal(value); setEditing(true); }}>
      <span className={cn("text-xs", value ? "text-foreground" : "text-muted-foreground")}>{value || "—"}</span>
      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover/edit:opacity-100 transition-opacity" />
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("People & Reporting");
  const { people, revenueTargets, loading, updatePerson, setRevenueTargets } = useStaffingData();
  const [search, setSearch] = useState("");

  // Group people by department
  const departments = useMemo(() => {
    const map = new Map<string, typeof people>();
    const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name));
    sorted.forEach(p => {
      const dept = p.department || "Unassigned";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(p);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [people]);

  const filteredPeople = useMemo(() => {
    if (!search) return people;
    const q = search.toLowerCase();
    return people.filter(p => p.name.toLowerCase().includes(q) || (p.department || "").toLowerCase().includes(q));
  }, [people, search]);

  const handleReportingChange = (personId: string, newManager: string) => {
    updatePerson(personId, { reportingManager: newManager });
    toast.success("Reporting manager updated");
  };

  const handleRevTargetChange = (dept: string, desg: string, newVal: number) => {
    const updated = revenueTargets.map(t =>
      t.department === dept && t.designation === desg ? { ...t, targetDealValuePerPerson: newVal } : t
    );
    setRevenueTargets(updated);
    toast.success("Target updated");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-6">Settings</h1>

        <div className="border-b border-border mb-6">
          <div className="flex gap-0 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2.5 text-ui font-medium transition-colors border-b-2",
                  activeTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ── People & Reporting Tab ── */}
        {activeTab === "People & Reporting" && (
          <div className="space-y-4">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search people..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-ui text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all" />
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-ui">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    {["Name", "Department", "Designation", "Band", "Pod", "Reporting Manager"].map(h => (
                      <th key={h} className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(search ? filteredPeople : people).map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className={cn("text-xs font-medium", p.tbh ? "text-muted-foreground italic" : p.leaving ? "text-destructive line-through" : "text-foreground")}>
                          {p.name} {p.tbh && "(TBH)"}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <Select value={p.department || "_none"} onValueChange={v => updatePerson(p.id, { department: v === "_none" ? "" : v })}>
                          <SelectTrigger className="h-7 text-xs border-none bg-transparent shadow-none px-0 focus:ring-0 w-[180px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none" className="text-xs text-muted-foreground">— None —</SelectItem>
                            {DEPARTMENTS.map(d => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-3">
                        <InlineEdit value={p.designation || ""} onSave={v => updatePerson(p.id, { designation: v })} />
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{p.band || "—"}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{p.pod || "—"}</td>
                      <td className="py-2 px-3">
                        <Select value={p.reportingManager || "_none"} onValueChange={v => handleReportingChange(p.id, v === "_none" ? "" : v)}>
                          <SelectTrigger className="h-7 text-xs border-none bg-transparent shadow-none px-0 focus:ring-0 w-[180px]">
                            <SelectValue placeholder="— None —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none" className="text-xs text-muted-foreground">— None —</SelectItem>
                            {people.filter(pp => pp.id !== p.id && !pp.tbh).map(pp => (
                              <SelectItem key={pp.id} value={pp.name} className="text-xs">{pp.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Revenue Capacity Tab ── */}
        {activeTab === "Revenue Capacity" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set target MRR/deal value capacity per person for each role. This drives utilization metrics in the Staffing view.
            </p>
            {(() => {
              const grouped = new Map<string, typeof revenueTargets>();
              revenueTargets.forEach(t => {
                if (!grouped.has(t.department)) grouped.set(t.department, []);
                grouped.get(t.department)!.push(t);
              });
              return Array.from(grouped.entries()).map(([dept, targets]) => (
                <div key={dept} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-secondary/30 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">{dept}</h3>
                  </div>
                  <table className="w-full text-ui">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Designation</th>
                        <th className="text-right py-2 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Target Deal Value / Person</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targets.map(t => (
                        <tr key={`${t.department}_${t.designation}`} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="py-2 px-4 text-xs text-foreground">{t.designation}</td>
                          <td className="py-2 px-4 text-right">
                            <InlineEdit
                              value={String(t.targetDealValuePerPerson)}
                              onSave={v => handleRevTargetChange(t.department, t.designation, Number(v) || 0)}
                              type="number"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ));
            })()}
          </div>
        )}

        {/* ── Users & Roles Tab (placeholder) ── */}
        {activeTab === "Users & Roles" && (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">User & role management coming soon.</p>
          </div>
        )}

        {/* ── Notifications Tab (placeholder) ── */}
        {activeTab === "Notifications" && (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">Notification settings coming soon.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
