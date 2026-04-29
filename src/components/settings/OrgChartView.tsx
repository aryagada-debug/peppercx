import { useMemo, useState, useEffect } from "react";
import { Search, ChevronRight, ChevronDown, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Person } from "@/data/staffingData";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Props {
  people: Person[];
  onUpdate: (id: string, updates: Partial<Person>) => Promise<void> | void;
  onRequestDelete: (p: Person) => void;
}

function initials(name: string) {
  return name.split(/\s+/).map(s => s[0]).join("").slice(0, 2).toUpperCase();
}

/** Build subordinate counts (recursive) and direct-children map. */
function buildOrg(people: Person[]) {
  const byName = new Map<string, Person>();
  people.forEach(p => byName.set(p.name, p));
  const childrenOf = new Map<string, Person[]>(); // managerName → reports
  people.forEach(p => {
    const mgr = (p.reportingManager || "").trim();
    const key = mgr && byName.has(mgr) && mgr !== p.name ? mgr : "__root__";
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(p);
  });
  const total = new Map<string, number>();
  const compute = (name: string): number => {
    if (total.has(name)) return total.get(name)!;
    const direct = childrenOf.get(name) || [];
    let n = direct.length;
    for (const c of direct) n += compute(c.name);
    total.set(name, n);
    return n;
  };
  people.forEach(p => compute(p.name));
  const roots = (childrenOf.get("__root__") || []).sort((a, b) => (total.get(b.name) || 0) - (total.get(a.name) || 0));
  return { childrenOf, total, roots };
}

export function OrgChartView({ people, onUpdate, onRequestDelete }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { childrenOf, total, roots } = useMemo(() => buildOrg(people), [people]);

  // Auto-expand ancestors of search matches.
  useEffect(() => {
    if (!search.trim()) return;
    const q = search.toLowerCase();
    const matches = people.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.designation || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q),
    );
    const toExpand: Record<string, boolean> = {};
    const byName = new Map(people.map(p => [p.name, p]));
    matches.forEach(m => {
      let cur: Person | undefined = m;
      const seen = new Set<string>();
      while (cur) {
        if (seen.has(cur.name)) break;
        seen.add(cur.name);
        const mgrName = cur.reportingManager || "";
        if (!mgrName) break;
        toExpand[mgrName] = true;
        cur = byName.get(mgrName);
      }
    });
    setExpanded(prev => ({ ...prev, ...toExpand }));
  }, [search, people]);

  const isMatch = (p: Person) => {
    if (!search.trim()) return false;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.designation || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q)
    );
  };

  const renderNode = (p: Person, depth: number): React.ReactNode => {
    const reports = (childrenOf.get(p.name) || []).sort((a, b) => (total.get(b.name) || 0) - (total.get(a.name) || 0));
    const sub = total.get(p.name) || 0;
    const isOpen = expanded[p.name] ?? (depth < 1);
    const matched = isMatch(p);
    return (
      <div key={p.id} className="flex items-start gap-3" style={{ paddingLeft: depth ? 8 : 0 }}>
        {/* Connector */}
        {depth > 0 && <div className="w-3 mt-5 border-t border-border" />}
        <div className="flex flex-col">
          <div
            onClick={() => setSelectedId(p.id)}
            className={cn(
              "group inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 cursor-pointer hover:border-primary/50 transition-colors min-w-[260px]",
              matched ? "border-primary ring-2 ring-primary/30" : "border-border",
              p.leaving && "opacity-60",
            )}
          >
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-[11px] font-medium text-foreground shrink-0">
              {initials(p.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{p.designation || "—"}</div>
            </div>
            {sub > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded(s => ({ ...s, [p.name]: !isOpen })); }}
                className={cn(
                  "h-6 min-w-6 px-1.5 rounded inline-flex items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  isOpen ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-primary/20",
                )}
                title={isOpen ? "Collapse" : `${sub} reports`}
              >
                {sub}
                {isOpen
                  ? <ChevronDown className="h-3 w-3" />
                  : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
          </div>

          {isOpen && reports.length > 0 && (
            <div className="mt-2 ml-6 border-l border-border pl-2 space-y-2">
              {reports.map(r => renderNode(r, depth + 1))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const selected = selectedId ? people.find(p => p.id === selectedId) || null : null;

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search to highlight people…"
          className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
        <div className="space-y-4 min-w-max">
          {roots.length === 0 ? (
            <div className="text-sm text-muted-foreground">No people in the organisation yet.</div>
          ) : (
            roots.map(r => renderNode(r, 0))
          )}
        </div>
      </div>

      <PersonDrawer
        person={selected}
        people={people}
        onClose={() => setSelectedId(null)}
        onUpdate={onUpdate}
        onRequestDelete={(p) => { setSelectedId(null); onRequestDelete(p); }}
      />
    </div>
  );
}

/* ─── Drawer ─────────────────────────────────────────────────────────────── */

function PersonDrawer({
  person, people, onClose, onUpdate, onRequestDelete,
}: {
  person: Person | null;
  people: Person[];
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Person>) => Promise<void> | void;
  onRequestDelete: (p: Person) => void;
}) {
  const [draft, setDraft] = useState<Person | null>(person);

  useEffect(() => { setDraft(person); }, [person]);

  if (!person || !draft) {
    return (
      <Sheet open={false} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent />
      </Sheet>
    );
  }

  const set = <K extends keyof Person>(k: K, v: Person[K]) => setDraft(d => d ? { ...d, [k]: v } : d);

  const save = async () => {
    if (!draft) return;
    if (draft.name && draft.name === draft.reportingManager) {
      toast.error("A person can't report to themselves");
      return;
    }
    const updates: Partial<Person> = {
      name: draft.name,
      designation: draft.designation,
      band: draft.band,
      department: draft.department,
      subTeam: draft.subTeam,
      reportingManager: draft.reportingManager,
      email: draft.email,
      leaving: draft.leaving,
    };
    await onUpdate(draft.id, updates);
    toast.success("Saved");
    onClose();
  };

  const managers = Array.from(new Set(people.filter(p => !p.tbh && p.id !== draft.id).map(p => p.name))).sort();
  const departments = Array.from(new Set(people.map(p => p.department || "").filter(Boolean))).sort();
  const subTeams = Array.from(new Set(people
    .filter(p => !draft.department || p.department === draft.department)
    .map(p => p.subTeam || "").filter(Boolean))).sort();

  return (
    <Sheet open={!!person} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-[420px] sm:w-[440px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base flex items-center justify-between">
            <span>Edit person</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </SheetTitle>
        </SheetHeader>

        <datalist id="org-managers">{managers.map(m => <option key={m} value={m} />)}</datalist>
        <datalist id="org-depts">{departments.map(m => <option key={m} value={m} />)}</datalist>
        <datalist id="org-subteams">{subTeams.map(m => <option key={m} value={m} />)}</datalist>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          <Field label="Name"><Input value={draft.name} onChange={e => set("name", e.target.value)} className="h-8" /></Field>
          <Field label="Designation"><Input value={draft.designation || ""} onChange={e => set("designation", e.target.value)} className="h-8" /></Field>
          <Field label="Band"><Input value={draft.band || ""} onChange={e => set("band", e.target.value)} className="h-8" /></Field>
          <Field label="Team"><Input list="org-depts" value={draft.department || ""} onChange={e => set("department", e.target.value)} className="h-8" /></Field>
          <Field label="Sub-team"><Input list="org-subteams" value={draft.subTeam || ""} onChange={e => set("subTeam", e.target.value)} className="h-8" /></Field>
          <Field label="Reports to"><Input list="org-managers" value={draft.reportingManager || ""} onChange={e => set("reportingManager", e.target.value)} className="h-8" /></Field>
          <Field label="Email"><Input type="email" value={draft.email || ""} onChange={e => set("email", e.target.value)} className="h-8" /></Field>
          <Field label="Status">
            <button
              type="button"
              onClick={() => set("leaving", !draft.leaving)}
              className={cn(
                "h-8 px-3 rounded-md border text-xs font-medium",
                draft.leaving
                  ? "border-destructive/50 text-destructive"
                  : "border-border text-muted-foreground hover:bg-secondary/50",
              )}
            >
              {draft.leaving ? "Leaving — click to unmark" : "Active — mark as leaving"}
            </button>
          </Field>
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={() => onRequestDelete(person)}
            className="h-8 px-2.5 rounded-md border border-border text-xs text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"
          ><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-8 px-3 rounded-md border border-border text-xs hover:bg-secondary/50">Cancel</button>
            <button onClick={save} className="h-8 px-3 rounded-md bg-foreground text-background text-xs font-medium">Save</button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 block">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}