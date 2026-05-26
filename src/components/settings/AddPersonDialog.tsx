import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { uid, type Person, type RoleCategory, ROLE_SLOTS, ROLE_TYPE_TO_DEPT, DEPARTMENT_LABELS } from "@/data/staffingData";
import { useTaxonomyQuery } from "@/hooks/queries/useTaxonomyQuery";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  people: Person[];
  defaultDepartment?: string;
  defaultSubTeam?: string;
  onAdd: (p: Person) => Promise<void> | void;
}

export function AddPersonDialog({ open, onOpenChange, people, defaultDepartment, defaultSubTeam, onAdd }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState(defaultDepartment || "");
  const [subTeam, setSubTeam] = useState(defaultSubTeam || "");
  const [designation, setDesignation] = useState("");
  const [band, setBand] = useState("");
  const [reportsTo, setReportsTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [taxDeptId, setTaxDeptId] = useState<string>("");
  const [taxRoleTypeId, setTaxRoleTypeId] = useState<string>("");
  const { data: taxonomy } = useTaxonomyQuery();

  const departments = useMemo(
    () => Array.from(new Set(people.map(p => p.department || "").filter(Boolean))).sort(),
    [people],
  );
  const subTeams = useMemo(
    () => Array.from(new Set(people
      .filter(p => !department || p.department === department)
      .map(p => p.subTeam || "").filter(Boolean))).sort(),
    [people, department],
  );
  const managers = useMemo(
    () => Array.from(new Set(people.filter(p => !p.tbh).map(p => p.name))).sort(),
    [people],
  );

  const reset = () => {
    setName(""); setEmail(""); setDesignation(""); setBand(""); setReportsTo("");
    setDepartment(defaultDepartment || ""); setSubTeam(defaultSubTeam || "");
    setTaxDeptId(""); setTaxRoleTypeId("");
  };

  const submit = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { toast.error("Email looks invalid"); return; }
    setSaving(true);
    try {
      const rt = ROLE_SLOTS.find(s => s.roleKey === taxRoleTypeId);
      const newPerson: Person = {
        id: uid(),
        name: name.trim(),
        roleCategory: (rt?.category ?? "Other") as RoleCategory,
        roleTitle: designation.trim() || rt?.roleLabel || "",
        pod: "",
        region: "India",
        leaving: false,
        tbh: false,
        department: department.trim(),
        designation: designation.trim() || rt?.roleLabel || "",
        reportingManager: reportsTo.trim(),
        band: band.trim(),
        email: email.trim(),
        subTeam: subTeam.trim(),
        departmentId: taxDeptId || null,
        roleTypeId: taxRoleTypeId || null,
      };
      await onAdd(newPerson);
      toast.success(`${newPerson.name} added`);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  const taxDepartments = taxonomy?.departments ?? [];
  const taxRoleTypes = taxDeptId
    ? (taxonomy?.roleTypesByDept.get(taxDeptId) ?? [])
    : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Add a person</DialogTitle>
        </DialogHeader>
        <datalist id="add-person-departments">
          {departments.map(d => <option key={d} value={d} />)}
        </datalist>
        <datalist id="add-person-subteams">
          {subTeams.map(d => <option key={d} value={d} />)}
        </datalist>
        <datalist id="add-person-managers">
          {managers.map(d => <option key={d} value={d} />)}
        </datalist>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name *">
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8" autoFocus />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-8" placeholder="name@pepper.in" />
          </Field>
          <Field label="Department *">
            <select
              value={taxDeptId}
              onChange={(e) => { setTaxDeptId(e.target.value); setTaxRoleTypeId(""); }}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">— Select department —</option>
              {taxDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Role type *">
            <select
              value={taxRoleTypeId}
              onChange={(e) => setTaxRoleTypeId(e.target.value)}
              disabled={!taxDeptId}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
            >
              <option value="">— Select role type —</option>
              {taxRoleTypes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Legacy team">
            <Input list="add-person-departments" value={department} onChange={e => setDepartment(e.target.value)} className="h-8" placeholder="e.g. Capability — Creative Team" />
          </Field>
          <Field label="Sub-team">
            <Input list="add-person-subteams" value={subTeam} onChange={e => setSubTeam(e.target.value)} className="h-8" placeholder="e.g. Strategy" />
          </Field>
          <Field label="Designation">
            <Input value={designation} onChange={e => setDesignation(e.target.value)} className="h-8" />
          </Field>
          <Field label="Band">
            <Input value={band} onChange={e => setBand(e.target.value)} className="h-8" placeholder="L4" />
          </Field>
          <Field label="Reports to" wide>
            <Input list="add-person-managers" value={reportsTo} onChange={e => setReportsTo(e.target.value)} className="h-8" placeholder="Manager name" />
          </Field>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">
          A login account will be created automatically with password <span className="font-medium text-foreground">Pepper@2026</span> when an email is provided.
        </p>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)}
            className="h-8 px-3 rounded-md border border-border text-xs hover:bg-secondary/50">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving}
            className="h-8 px-3 rounded-md bg-foreground text-background text-xs font-medium disabled:opacity-50">
            {saving ? "Adding…" : "Add person"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "col-span-2 space-y-1" : "space-y-1"}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}