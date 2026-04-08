import { useState, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Plus, X, ChevronDown, ChevronRight, Pencil, Trash2, UserPlus } from "lucide-react";
import {
  ROLE_CATEGORIES, DEPARTMENTS, BANDS,
  type Deal, type Person, type StaffingAssignment, type RoleCategory, uid
} from "@/data/staffingData";

interface Props {
  people: Person[];
  allPeople: Person[];
  assignments: StaffingAssignment[];
  deals: Deal[];
  editMode: boolean;
  onAddPerson: (person: Person) => void;
  onUpdatePerson: (id: string, updates: Partial<Person>) => void;
  onDeletePerson: (id: string) => void;
  onBulkUpdate: (ids: string[], field: keyof Person, value: string) => void;
}

const fmtPct = (n: number) => n === 0 ? "—" : `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;

export function PeopleTab({ people, allPeople, assignments, deals, editMode, onAddPerson, onUpdatePerson, onDeletePerson, onBulkUpdate }: Props) {
  const [categoryTab, setCategoryTab] = useState<RoleCategory>(ROLE_CATEGORIES[0]);
  const [addModal, setAddModal] = useState(false);
  const [editPersonId, setEditPersonId] = useState<string | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ personId: string; field: string } | null>(null);
  const [newPerson, setNewPerson] = useState<Omit<Person, "id" | "leaving" | "tbh">>({
    name: "", roleCategory: "Content", roleTitle: "", pod: "", region: "India",
    department: "", designation: "", reportingManager: "", band: "",
  });

  const allDesignations = useMemo(() => [...new Set(allPeople.map(p => p.designation).filter(Boolean))].sort(), [allPeople]);
  const allManagers = useMemo(() => [...new Set(allPeople.map(p => p.name))].sort(), [allPeople]);

  const filteredPeople = useMemo(() => people.filter(p => p.roleCategory === categoryTab), [people, categoryTab]);

  // Person utilization
  const personUtil = useMemo(() => {
    const map: Record<string, { totalPct: number; dealCount: number }> = {};
    people.forEach(p => { map[p.id] = { totalPct: 0, dealCount: 0 }; });
    assignments.forEach(a => {
      if (map[a.personId]) {
        map[a.personId].totalPct += a.allocationPct;
        map[a.personId].dealCount = new Set(assignments.filter(x => x.personId === a.personId).map(x => x.dealId)).size;
      }
    });
    return map;
  }, [assignments, people]);

  // TBH and Leaving counts
  const tbhPeople = filteredPeople.filter(p => p.tbh);
  const leavingPeople = filteredPeople.filter(p => p.leaving);
  const activePeople = filteredPeople.filter(p => !p.tbh && !p.leaving);

  // Build tree
  const { roots, childrenMap } = useMemo(() => {
    const cMap = new Map<string, Person[]>();
    const hasParent = new Set<string>();
    filteredPeople.forEach(p => {
      if (p.reportingManager) {
        const mgr = filteredPeople.find(m => m.name === p.reportingManager && m.id !== p.id);
        if (mgr) {
          hasParent.add(p.id);
          if (!cMap.has(mgr.id)) cMap.set(mgr.id, []);
          cMap.get(mgr.id)!.push(p);
        }
      }
    });
    return { roots: filteredPeople.filter(p => !hasParent.has(p.id)), childrenMap: cMap };
  }, [filteredPeople]);

  const addNewPerson = () => {
    const id = `p_new_${uid()}`;
    onAddPerson({ id, ...newPerson, leaving: false, tbh: false });
    setNewPerson({ name: "", roleCategory: categoryTab, roleTitle: "", pod: "", region: "India", department: "", designation: "", reportingManager: "", band: "" });
    setAddModal(false);
  };

  const saveEditPerson = () => {
    if (!editPersonId) return;
    onUpdatePerson(editPersonId, newPerson);
    setEditPersonId(null);
    setAddModal(false);
  };

  const startEditPerson = (p: Person) => {
    setEditPersonId(p.id);
    setNewPerson({
      name: p.name, roleCategory: p.roleCategory, roleTitle: p.roleTitle, pod: p.pod, region: p.region,
      department: p.department || "", designation: p.designation || "", reportingManager: p.reportingManager || "", band: p.band || "",
    });
    setAddModal(true);
  };

  const renderPersonRow = (p: Person, depth: number): React.ReactNode[] => {
    const util = personUtil[p.id] || { totalPct: 0, dealCount: 0 };
    const isEditing = (field: string) => editingCell?.personId === p.id && editingCell?.field === field;
    const isSelected = selectedPeople.has(p.id);
    const children = childrenMap.get(p.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(p.id);
    const rows: React.ReactNode[] = [];

    rows.push(
      <tr key={p.id} className={cn("border-b border-border/50 hover:bg-secondary/20 transition-colors", isSelected && "bg-accent/5")}>
        {editMode && (
          <td className="py-2 px-3">
            <input type="checkbox" className="rounded border-border" checked={isSelected}
              onChange={() => {
                const next = new Set(selectedPeople);
                if (isSelected) next.delete(p.id); else next.add(p.id);
                setSelectedPeople(next);
              }} />
          </td>
        )}
        <td className="py-2 px-3" style={{ paddingLeft: `${12 + depth * 20}px` }}>
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button onClick={() => {
                setExpandedNodes(prev => {
                  const next = new Set(prev);
                  if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                  return next;
                });
              }} className="p-0.5 rounded hover:bg-secondary">
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            ) : <span className="w-5" />}
            <span className={cn("font-medium", p.leaving && "line-through text-muted-foreground", p.tbh && "text-warning italic")}>{p.name}</span>
            {hasChildren && <span className="text-[10px] text-muted-foreground ml-1">({children.length})</span>}
          </div>
        </td>
        <td className="py-2 px-3">
          {editMode && isEditing("department") ? (
            <select autoFocus value={p.department || ""} onChange={e => { onUpdatePerson(p.id, { department: e.target.value }); setEditingCell(null); }} onBlur={() => setEditingCell(null)}
              className="h-7 w-full px-2 rounded border border-accent bg-card text-caption text-foreground">
              <option value="">—</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          ) : (
            <span onClick={() => editMode && setEditingCell({ personId: p.id, field: "department" })} className={cn("text-caption text-muted-foreground truncate block max-w-[160px]", editMode && "cursor-pointer hover:text-foreground")}>{p.department || "—"}</span>
          )}
        </td>
        <td className="py-2 px-3 text-caption text-muted-foreground">{p.designation || "—"}</td>
        <td className="py-2 px-3 text-caption text-muted-foreground">{p.reportingManager || "—"}</td>
        <td className="py-2 px-3">
          <span className={cn("font-mono text-caption font-medium px-1.5 py-0.5 rounded", p.band ? "bg-accent/10 text-accent" : "text-muted-foreground")}>{p.band || "—"}</span>
        </td>
        <td className="py-2 px-3 text-caption text-muted-foreground">{p.region}</td>
        <td className="py-2 px-3 text-center font-mono tabular-nums text-foreground">{util.dealCount}</td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-sm overflow-hidden max-w-[100px]">
              <div className={cn("h-full rounded-sm", util.totalPct > 100 ? "bg-destructive" : util.totalPct > 80 ? "bg-warning" : "bg-positive")} style={{ width: `${Math.min(util.totalPct, 100)}%` }} />
            </div>
          </div>
        </td>
        <td className="py-2 px-3 text-right">
          <span className={cn("font-mono tabular-nums text-caption font-medium", util.totalPct > 100 ? "text-destructive" : util.totalPct > 80 ? "text-warning" : "text-positive")}>{fmtPct(util.totalPct)}</span>
        </td>
        <td className="py-2 px-3">
          {p.tbh ? <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/10 text-warning">TBH</span>
            : p.leaving ? <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive">Leaving</span>
            : <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-positive/10 text-positive">Active</span>}
        </td>
        {editMode && (
          <td className="py-2 px-3">
            <div className="flex items-center gap-1">
              <button onClick={() => startEditPerson(p)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={() => onDeletePerson(p.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </td>
        )}
      </tr>
    );

    if (isExpanded && hasChildren) {
      children.forEach(child => { rows.push(...renderPersonRow(child, depth + 1)); });
    }

    return rows;
  };

  return (
    <div className="space-y-4">
      {/* TBH Banner */}
      {tbhPeople.length > 0 && (
        <div className="data-card border-warning/30 bg-warning/5 py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-caption font-medium bg-warning/10 text-warning">{tbhPeople.length} TBH</span>
              <span className="text-caption text-muted-foreground">placeholders in {categoryTab}</span>
            </div>
            {leavingPeople.length > 0 && (
              <span className="text-caption text-destructive font-medium">{leavingPeople.length} leaving</span>
            )}
          </div>
        </div>
      )}

      {/* Category tabs + controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {ROLE_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategoryTab(cat)} className={cn(
              "px-3 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
              categoryTab === cat ? "bg-foreground text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            )}>{cat}</button>
          ))}
        </div>
        {editMode && (
          <div className="flex items-center gap-2">
            {selectedPeople.size > 0 && (
              <div className="flex items-center gap-2 bg-accent/10 rounded-md px-3 py-1.5">
                <span className="text-caption font-medium text-accent">{selectedPeople.size} selected</span>
                <select onChange={e => { if (e.target.value) { onBulkUpdate(Array.from(selectedPeople), "department", e.target.value); e.target.value = ""; } }}
                  className="h-7 px-2 rounded border border-border bg-card text-caption text-foreground">
                  <option value="">Bulk Dept...</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button onClick={() => setSelectedPeople(new Set())} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <button onClick={() => { setEditPersonId(null); setNewPerson({ name: "", roleCategory: categoryTab, roleTitle: "", pod: "", region: "India", department: "", designation: "", reportingManager: "", band: "" }); setAddModal(true); }}
              className="h-8 px-3 rounded-md bg-foreground text-primary-foreground text-caption font-medium hover:opacity-90 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="data-card p-0 overflow-x-auto">
        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              {editMode && <th className="py-2.5 px-3 w-8"><input type="checkbox" className="rounded border-border" checked={selectedPeople.size === filteredPeople.length && filteredPeople.length > 0} onChange={e => { if (e.target.checked) setSelectedPeople(new Set(filteredPeople.map(p => p.id))); else setSelectedPeople(new Set()); }} /></th>}
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[200px]">Name</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Department</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Designation</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Manager</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-16">Band</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-16">Region</th>
              <th className="text-center py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-16">Deals</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[120px]">BW Used</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-16">Total %</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-16">Status</th>
              {editMode && <th className="py-2.5 px-3 w-16"></th>}
            </tr>
          </thead>
          <tbody>
            {roots.flatMap(p => renderPersonRow(p, 0))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Person Modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20" onClick={() => { setAddModal(false); setEditPersonId(null); }}>
          <div className="bg-card border border-border rounded-lg p-6 w-[480px] max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-ui font-semibold text-foreground">{editPersonId ? "Edit Person" : "Add New Person"}</h3>
              <button onClick={() => { setAddModal(false); setEditPersonId(null); }}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-caption text-muted-foreground font-medium">Name</label>
                <input type="text" value={newPerson.name} onChange={e => setNewPerson(p => ({ ...p, name: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none" placeholder="Full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Role Category</label>
                  <select value={newPerson.roleCategory} onChange={e => setNewPerson(p => ({ ...p, roleCategory: e.target.value as RoleCategory }))}
                    className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                    {ROLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Designation</label>
                  <input type="text" value={newPerson.designation} onChange={e => setNewPerson(p => ({ ...p, designation: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-caption text-muted-foreground font-medium">Department</label>
                <select value={newPerson.department} onChange={e => setNewPerson(p => ({ ...p, department: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                  <option value="">Select...</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Reporting Manager</label>
                  <select value={newPerson.reportingManager} onChange={e => setNewPerson(p => ({ ...p, reportingManager: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                    <option value="">Select...</option>
                    {allManagers.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Band</label>
                  <select value={newPerson.band} onChange={e => setNewPerson(p => ({ ...p, band: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                    <option value="">Select...</option>
                    {BANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Pod</label>
                  <input type="text" value={newPerson.pod} onChange={e => setNewPerson(p => ({ ...p, pod: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none" />
                </div>
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Region</label>
                  <select value={newPerson.region} onChange={e => setNewPerson(p => ({ ...p, region: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                    <option value="India">India</option>
                    <option value="US">US</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Role Title</label>
                  <input type="text" value={newPerson.roleTitle} onChange={e => setNewPerson(p => ({ ...p, roleTitle: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none" />
                </div>
              </div>
              <button onClick={editPersonId ? saveEditPerson : addNewPerson} disabled={!newPerson.name}
                className="w-full h-9 rounded-md bg-foreground text-primary-foreground text-ui font-medium hover:opacity-90 disabled:opacity-50 mt-2">
                {editPersonId ? "Save Changes" : "Add Person"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}