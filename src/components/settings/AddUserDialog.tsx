import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTaxonomyQuery } from "@/hooks/queries/useTaxonomyQuery";
import { ROLE_LABELS, ROLE_ORDER, ALL_ROUTE_KEYS, type AppRole } from "@/hooks/useUserRole";

const ROUTE_LABELS: Record<string, string> = {
  home: "Home",
  dashboard: "Dashboard",
  clients: "Clients & Deals",
  staffing: "Staffing & Capacity",
  "people-ops": "People Ops",
  targets: "Targets",
  "rgy-health": "RGY Health",
  "mbr-tracker": "MBR Tracker",
  onboarding: "Onboarding",
  settings: "Settings",
};

const OVERRIDE_OPTIONS = ["inherit", "hidden", "read", "edit"] as const;
const OVERRIDE_LABELS: Record<typeof OVERRIDE_OPTIONS[number], string> = {
  inherit: "Inherit",
  hidden: "Hidden",
  read: "Read-only",
  edit: "Editable",
};
type OverrideOpt = typeof OVERRIDE_OPTIONS[number];

interface PersonOption {
  id: string;
  name: string;
  email: string;
  designation: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}

const DEFAULT_PASSWORD = "Pepper@2026";

export function AddUserDialog({ open, onOpenChange, onCreated }: Props) {
  const { data: taxonomy } = useTaxonomyQuery();

  // Account
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [role, setRole] = useState<AppRole>("user");

  // Link mode
  const [linkMode, setLinkMode] = useState<"existing" | "new">("new");

  // Existing person
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [personSearch, setPersonSearch] = useState("");
  const [personId, setPersonId] = useState<string>("");

  // New person fields
  const [department, setDepartment] = useState("");
  const [subTeam, setSubTeam] = useState("");
  const [designation, setDesignation] = useState("");
  const [band, setBand] = useState("");
  const [reportsTo, setReportsTo] = useState("");
  const [region, setRegion] = useState("India");
  const [taxDeptId, setTaxDeptId] = useState("");
  const [taxRoleTypeId, setTaxRoleTypeId] = useState("");

  // Overrides
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, OverrideOpt>>(() => {
    const m: Record<string, OverrideOpt> = {};
    ALL_ROUTE_KEYS.forEach((k) => (m[k] = "inherit"));
    return m;
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("staffing_people")
        .select("id, name, email, designation, leaving, tbh")
        .eq("leaving", false)
        .eq("tbh", false)
        .order("name");
      setPeople(
        (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          email: p.email || "",
          designation: p.designation || "",
        })),
      );
    })();
  }, [open]);

  const reset = () => {
    setFullName("");
    setEmail("");
    setPassword(DEFAULT_PASSWORD);
    setRole("user");
    setLinkMode("new");
    setPersonId("");
    setPersonSearch("");
    setDepartment("");
    setSubTeam("");
    setDesignation("");
    setBand("");
    setReportsTo("");
    setRegion("India");
    setTaxDeptId("");
    setTaxRoleTypeId("");
    setOverridesOpen(false);
    const m: Record<string, OverrideOpt> = {};
    ALL_ROUTE_KEYS.forEach((k) => (m[k] = "inherit"));
    setOverrides(m);
  };

  const filteredPeople = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    if (!q) return people.slice(0, 200);
    return people
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.designation.toLowerCase().includes(q),
      )
      .slice(0, 200);
  }, [people, personSearch]);

  const departments = useMemo(
    () => Array.from(new Set(people.map((p) => p as any).map((p: any) => p.department || "").filter(Boolean))).sort(),
    [people],
  );

  const managers = useMemo(
    () => Array.from(new Set(people.map((p) => p.name))).sort(),
    [people],
  );

  const taxDepartments = taxonomy?.departments ?? [];
  const taxRoleTypes = taxDeptId ? taxonomy?.roleTypesByDept.get(taxDeptId) ?? [] : [];
  const selectedPerson = people.find((p) => p.id === personId) || null;

  const canSubmit = useMemo(() => {
    if (!fullName.trim() || !email.trim() || !password) return false;
    if (linkMode === "existing" && !personId) return false;
    return true;
  }, [fullName, email, password, linkMode, personId]);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Invalid email format");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        action: "create_user",
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role,
        link_mode: linkMode,
      };
      if (linkMode === "existing") {
        payload.person_id = personId;
      } else {
        payload.new_person = {
          name: fullName.trim(),
          department,
          sub_team: subTeam,
          designation,
          band,
          reporting_manager: reportsTo,
          region,
          department_id: taxDeptId || null,
          role_type_id: taxRoleTypeId || null,
          role_category: "Other",
        };
      }
      const overrideList = Object.entries(overrides)
        .filter(([, v]) => v !== "inherit")
        .map(([route_key, v]) => ({ route_key, access_mode: v as "hidden" | "read" | "edit" }));
      if (overrideList.length) payload.overrides = overrideList;

      const { data, error } = await supabase.functions.invoke("admin-user-mgmt", { body: payload });
      if (error || (data as any)?.error) {
        toast.error(error?.message || (data as any)?.error || "Failed to create user");
        return;
      }
      toast.success(`${fullName} added. Password: ${password}`);
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Add user</DialogTitle>
        </DialogHeader>

        <datalist id="add-user-departments">
          {departments.map((d) => <option key={d} value={d} />)}
        </datalist>
        <datalist id="add-user-managers">
          {managers.map((d) => <option key={d} value={d} />)}
        </datalist>

        {/* Section 1: Account */}
        <Section title="Account">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name *">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-8" autoFocus />
            </Field>
            <Field label="Work email *">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8" placeholder="name@peppercontent.io" />
            </Field>
            <Field label="Password *">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} className="h-8" />
            </Field>
            <Field label="App role *">
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_ORDER.slice().reverse().map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Email is auto-confirmed. Share the password with the user — they can change it after first login.
          </p>
        </Section>

        {/* Section 2: Link to person */}
        <Section title="Link to person directory">
          <div className="flex items-center gap-3 mb-2">
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input type="radio" checked={linkMode === "new"} onChange={() => setLinkMode("new")} />
              Create new person
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input type="radio" checked={linkMode === "existing"} onChange={() => setLinkMode("existing")} />
              Link to existing person
            </label>
          </div>

          {linkMode === "existing" ? (
            <div className="space-y-2">
              <Input
                placeholder="Search by name, email or designation…"
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                className="h-8"
              />
              <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                {filteredPeople.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">No matches</div>
                )}
                {filteredPeople.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPersonId(p.id)}
                    className={
                      "w-full text-left px-3 py-1.5 text-xs border-b border-border/40 last:border-0 hover:bg-secondary/40 " +
                      (personId === p.id ? "bg-primary/10 text-primary" : "text-foreground")
                    }
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.designation || "—"} · {p.email || "no email"}
                    </div>
                  </button>
                ))}
              </div>
              {selectedPerson && (
                <p className="text-[11px] text-muted-foreground">
                  Selected: <span className="text-foreground font-medium">{selectedPerson.name}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Department">
                <select
                  value={taxDeptId}
                  onChange={(e) => { setTaxDeptId(e.target.value); setTaxRoleTypeId(""); }}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">— Select department —</option>
                  {taxDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Role type">
                <select
                  value={taxRoleTypeId}
                  onChange={(e) => setTaxRoleTypeId(e.target.value)}
                  disabled={!taxDeptId}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
                >
                  <option value="">— Select role type —</option>
                  {taxRoleTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Legacy team">
                <Input list="add-user-departments" value={department} onChange={(e) => setDepartment(e.target.value)} className="h-8" placeholder="e.g. Capability — Creative" />
              </Field>
              <Field label="Sub-team">
                <Input value={subTeam} onChange={(e) => setSubTeam(e.target.value)} className="h-8" placeholder="e.g. Strategy" />
              </Field>
              <Field label="Designation">
                <Input value={designation} onChange={(e) => setDesignation(e.target.value)} className="h-8" />
              </Field>
              <Field label="Band">
                <Input value={band} onChange={(e) => setBand(e.target.value)} className="h-8" placeholder="L4" />
              </Field>
              <Field label="Reports to">
                <Input list="add-user-managers" value={reportsTo} onChange={(e) => setReportsTo(e.target.value)} className="h-8" placeholder="Manager name" />
              </Field>
              <Field label="Region">
                <Input value={region} onChange={(e) => setRegion(e.target.value)} className="h-8" placeholder="India" />
              </Field>
            </div>
          )}
        </Section>

        {/* Section 3: Initial access */}
        <Section
          title="Initial access (optional)"
          collapsible
          open={overridesOpen}
          onToggle={() => setOverridesOpen((s) => !s)}
        >
          {overridesOpen && (
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40">
                  <tr className="border-b border-border">
                    <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Section</th>
                    <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL_ROUTE_KEYS.map((route) => (
                    <tr key={route} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-1.5 text-foreground">{ROUTE_LABELS[route] || route}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex justify-center gap-1">
                          {OVERRIDE_OPTIONS.map((opt) => {
                            const active = overrides[route] === opt;
                            const cls = active
                              ? opt === "edit"
                                ? "border-primary bg-primary/10 text-primary"
                                : opt === "read"
                                ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : opt === "hidden"
                                ? "border-destructive bg-destructive/10 text-destructive"
                                : "border-foreground/40 bg-foreground/5 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:text-foreground";
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setOverrides((p) => ({ ...p, [route]: opt }))}
                                className={"px-2 py-0.5 rounded border text-[11px] " + cls}
                              >
                                {OVERRIDE_LABELS[opt]}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || saving}>
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
            Create user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function Section({
  title,
  children,
  collapsible,
  open,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="border-t border-border pt-3 first-of-type:border-t-0 first-of-type:pt-0">
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-xs font-medium text-foreground mb-2"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {title}
        </button>
      ) : (
        <div className="text-xs font-medium text-foreground mb-2">{title}</div>
      )}
      {children}
    </div>
  );
}