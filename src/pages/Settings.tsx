import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { Loader2, Pencil, Check, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DEPARTMENTS } from "@/data/staffingData";

const tabs = ["People & Reporting", "Revenue Capacity", "Users & Roles", "Notifications"] as const;
type SettingsTab = typeof tabs[number];

function InlineEdit({
  value,
  onSave,
  type = "text",
  className: cls,
  listId,
  placeholder = "—",
}: {
  value: string;
  onSave: (v: string) => void;
  type?: string;
  className?: string;
  listId?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  const save = () => {
    onSave(local.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          type={type}
          list={listId}
          className="h-7 min-w-[120px] text-xs"
          placeholder={placeholder}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setLocal(value);
              setEditing(false);
            }
          }}
        />
        <button onClick={save} className="text-primary" type="button">
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={() => {
            setLocal(value);
            setEditing(false);
          }}
          className="text-muted-foreground"
          type="button"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn("group/edit flex items-center gap-1 text-left", cls)}
      onClick={() => {
        setLocal(value);
        setEditing(true);
      }}
    >
      <span className={cn("text-xs", value ? "text-foreground" : "text-muted-foreground")}>{value || placeholder}</span>
      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 transition-opacity group-hover/edit:opacity-100" />
    </button>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("People & Reporting");
  const { people, revenueTargets, loading, updatePerson, setRevenueTargets } = useStaffingData();
  const [search, setSearch] = useState("");

  const filteredPeople = useMemo(() => {
    if (!search) return people;
    const q = search.toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(q) || (p.department || "").toLowerCase().includes(q));
  }, [people, search]);

  const managerNames = useMemo(
    () => Array.from(new Set(people.filter((person) => !person.tbh).map((person) => person.name))).sort((a, b) => a.localeCompare(b)),
    [people],
  );

  const visiblePeople = search ? filteredPeople : people;

  const handleReportingChange = (personId: string, personName: string, newManager: string) => {
    if (newManager && newManager === personName) {
      toast.error("A person can't report to themselves");
      return;
    }
    updatePerson(personId, { reportingManager: newManager });
    toast.success("Reporting manager updated");
  };

  const handleRevTargetChange = (dept: string, desg: string, newVal: number) => {
    const updated = revenueTargets.map((t) =>
      t.department === dept && t.designation === desg ? { ...t, targetDealValuePerPerson: newVal } : t,
    );
    setRevenueTargets(updated);
    toast.success("Target updated");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <datalist id="settings-departments">
        {DEPARTMENTS.map((department) => (
          <option key={department} value={department} />
        ))}
      </datalist>

      <datalist id="settings-managers">
        {managerNames.map((managerName) => (
          <option key={managerName} value={managerName} />
        ))}
      </datalist>

      <div className="p-8">
        <h1 className="mb-6 text-subhead font-semibold tracking-tight text-foreground">Settings</h1>

        <div className="mb-6 border-b border-border">
          <div className="-mb-px flex gap-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "border-b-2 px-4 py-2.5 text-ui font-medium transition-colors",
                  activeTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "People & Reporting" && (
          <div className="space-y-4">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search people..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-ui text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-ui">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      {["Name", "Department", "Designation", "Band", "Pod", "Reporting Manager"].map((heading) => (
                        <th
                          key={heading}
                          className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePeople.map((person) => (
                      <tr key={person.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "text-xs font-medium",
                              person.tbh
                                ? "italic text-muted-foreground"
                                : person.leaving
                                  ? "text-destructive line-through"
                                  : "text-foreground",
                            )}
                          >
                            {person.name} {person.tbh && "(TBH)"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <InlineEdit
                            value={person.department || ""}
                            onSave={(value) => updatePerson(person.id, { department: value })}
                            listId="settings-departments"
                            placeholder="— None —"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <InlineEdit value={person.designation || ""} onSave={(value) => updatePerson(person.id, { designation: value })} />
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{person.band || "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{person.pod || "—"}</td>
                        <td className="px-3 py-2">
                          <InlineEdit
                            value={person.reportingManager || ""}
                            onSave={(value) => handleReportingChange(person.id, person.name, value)}
                            listId="settings-managers"
                            placeholder="— None —"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Revenue Capacity" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set target MRR/deal value capacity per person for each role. This drives utilization metrics in the Staffing view.
            </p>
            {(() => {
              const grouped = new Map<string, typeof revenueTargets>();
              revenueTargets.forEach((target) => {
                if (!grouped.has(target.department)) grouped.set(target.department, []);
                grouped.get(target.department)!.push(target);
              });

              return Array.from(grouped.entries()).map(([department, targets]) => (
                <div key={department} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="border-b border-border bg-secondary/30 px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">{department}</h3>
                  </div>
                  <table className="w-full text-ui">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Designation
                        </th>
                        <th className="px-4 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Target Deal Value / Person
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {targets.map((target) => (
                        <tr key={`${target.department}_${target.designation}`} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="px-4 py-2 text-xs text-foreground">{target.designation}</td>
                          <td className="px-4 py-2 text-right">
                            <InlineEdit
                              value={String(target.targetDealValuePerPerson)}
                              onSave={(value) => handleRevTargetChange(target.department, target.designation, Number(value) || 0)}
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

        {activeTab === "Users & Roles" && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">User & role management coming soon.</p>
          </div>
        )}

        {activeTab === "Notifications" && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Notification settings coming soon.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
