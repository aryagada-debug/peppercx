import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Loader2, KeyRound, Trash2, UserPlus, Sliders, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ALL_ROUTE_KEYS, ROLE_LABELS, ROLE_ORDER, type AppRole } from "@/hooks/useUserRole";
import { DemoLoginsCard } from "@/components/admin/DemoLoginsCard";

const ROUTE_LABELS: Record<string, string> = {
  "dashboard": "Dashboard",
  "clients": "Clients & Deals",
  "staffing": "Staffing & Capacity",
  "targets": "Targets",
  "rgy-health": "RGY Health",
  "mbr-tracker": "MBR Tracker",
  "onboarding": "Onboarding",
  "settings": "Settings",
};

interface UserRow {
  user_id: string;
  display_name: string;
  email: string;
  created_at: string;
  role: AppRole;
  staffing_person_id: string | null;
}

interface MissingPerson {
  id: string;
  name: string;
  email: string;
}

type OverrideOption = "inherit" | "hidden" | "read" | "edit";
type OverrideMap = Record<string, OverrideOption>;

const OVERRIDE_OPTIONS: OverrideOption[] = ["inherit", "hidden", "read", "edit"];
const OVERRIDE_LABELS: Record<OverrideOption, string> = {
  inherit: "Inherit",
  hidden: "Hidden",
  read: "Read-only",
  edit: "Editable",
};

export function UsersTab() {
  const { user: currentUser } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [overrideUser, setOverrideUser] = useState<UserRow | null>(null);
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [missingPeople, setMissingPeople] = useState<MissingPerson[]>([]);
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, created_at, staffing_person_id"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    // pick highest role per user
    const rolesByUser = new Map<string, AppRole>();
    (roles || []).forEach((r) => {
      const existing = rolesByUser.get(r.user_id);
      const next = r.role as AppRole;
      const rank = (rr: AppRole) => ROLE_ORDER.indexOf(rr);
      if (!existing || rank(next) > rank(existing)) rolesByUser.set(r.user_id, next);
    });

    const { data: emailData } = await supabase.functions.invoke("admin-user-mgmt", {
      body: { action: "list" },
    });
    const emailByUser = new Map<string, string>();
    if (emailData?.users) {
      emailData.users.forEach((u: any) => emailByUser.set(u.id, u.email));
    }

    const built: UserRow[] = (profiles || []).map((p) => ({
      user_id: p.user_id,
      display_name: p.display_name || "—",
      email: emailByUser.get(p.user_id) || "—",
      created_at: p.created_at,
      role: rolesByUser.get(p.user_id) || "user",
      staffing_person_id: (p as any).staffing_person_id || null,
    }));
    built.sort((a, b) => a.display_name.localeCompare(b.display_name));
    setRows(built);

    // Load staffing_people without emails (or whose email isn't in auth)
    const { data: people } = await supabase
      .from("staffing_people")
      .select("id, name, email")
      .order("name");
    const authEmails = new Set(
      (emailData?.users || []).map((u: any) => (u.email || "").toLowerCase()).filter(Boolean),
    );
    const missing = (people || [])
      .filter((p) => !p.email?.trim() || !authEmails.has(p.email.trim().toLowerCase()))
      .map((p) => ({ id: p.id, name: p.name, email: p.email || "" }));
    // Sort by importance: VSDs/BOPMs that appear on active deals first.
    const { data: dealRefs } = await supabase
      .from("staffing_deals")
      .select("vsd, bopm, senior_bopm, principal_bopm, deal_status")
      .in("deal_status", ["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);
    const usedNames = new Set<string>();
    (dealRefs || []).forEach((d: any) => {
      [d.vsd, d.bopm, d.senior_bopm, d.principal_bopm].forEach((n: string) => {
        if (n && n.trim()) usedNames.add(n.trim().toLowerCase());
      });
    });
    missing.sort((a, b) => {
      const aUsed = usedNames.has(a.name.trim().toLowerCase()) ? 0 : 1;
      const bUsed = usedNames.has(b.name.trim().toLowerCase()) ? 0 : 1;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return a.name.localeCompare(b.name);
    });
    setMissingPeople(missing);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (row: UserRow, newRole: AppRole) => {
    if (row.user_id === currentUser?.id && row.role === "admin" && newRole !== "admin") {
      toast.error("You cannot remove your own admin role");
      return;
    }
    setWorking(row.user_id);
    // Replace all roles with the chosen one (single role per user)
    await supabase.from("user_roles").delete().eq("user_id", row.user_id);
    const { error } = await supabase.from("user_roles").insert([{ user_id: row.user_id, role: newRole }]);
    if (error) toast.error(error.message);
    else toast.success(`${row.display_name} → ${ROLE_LABELS[newRole]}`);
    await load();
    setWorking(null);
  };

  const resetPassword = async (row: UserRow) => {
    if (row.email === "—") {
      toast.error("Email not available for this user");
      return;
    }
    setWorking(row.user_id);
    const { error } = await supabase.auth.resetPasswordForEmail(row.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success(`Password reset email sent to ${row.email}`);
    setWorking(null);
  };

  const deleteUser = async (row: UserRow) => {
    setWorking(row.user_id);
    const { data, error } = await supabase.functions.invoke("admin-user-mgmt", {
      body: { action: "delete", user_id: row.user_id },
    });
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Failed to delete user");
    } else {
      toast.success(`${row.display_name} deleted`);
      await load();
    }
    setWorking(null);
    setConfirmDelete(null);
  };

  const provisionFromPeople = async () => {
    // Block if any missing emails to nudge admin to fix first
    const blanks = missingPeople.filter((p) => !p.email.trim()).length;
    if (blanks > 0) {
      toast.error(`${blanks} people have no email. Add emails below first.`);
      setShowMissing(true);
      return;
    }
    setProvisioning(true);
    const { data, error } = await supabase.functions.invoke("admin-user-mgmt", {
      body: { action: "bulk_provision", send_invite: true },
    });
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Provisioning failed");
    } else {
      toast.success(`Created ${data?.created ?? 0} accounts. Skipped ${data?.skipped ?? 0}.`);
      if (data?.skipped_names?.length) {
        console.log("Skipped (no email):", data.skipped_names);
      }
      await load();
    }
    setProvisioning(false);
  };

  const saveEmail = async (personId: string, email: string) => {
    const trimmed = email.trim();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Invalid email format");
      return;
    }
    setSavingEmail(personId);
    const { error } = await supabase
      .from("staffing_people")
      .update({ email: trimmed })
      .eq("id", personId);
    if (error) toast.error(error.message);
    else {
      toast.success("Email saved");
      setMissingPeople((prev) =>
        prev.map((p) => (p.id === personId ? { ...p, email: trimmed } : p)),
      );
    }
    setSavingEmail(null);
  };

  // Bulk email helpers
  const [bulkSaving, setBulkSaving] = useState(false);
  const guessEmail = (name: string) =>
    `${name.toLowerCase().replace(/[^a-z\s]/g, "").trim().replace(/\s+/g, ".")}@peppercontent.io`;

  const fillAllGuessed = async () => {
    const blanks = missingPeople.filter((p) => !p.email.trim());
    if (blanks.length === 0) return;
    setBulkSaving(true);
    let saved = 0;
    for (const p of blanks) {
      const guess = guessEmail(p.name);
      const { error } = await supabase.from("staffing_people").update({ email: guess }).eq("id", p.id);
      if (!error) saved++;
    }
    toast.success(`Added ${saved} guessed emails. Review and edit before provisioning.`);
    setBulkSaving(false);
    await load();
  };

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const importPasted = async () => {
    const lines = pasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const byName = new Map(missingPeople.map((p) => [p.name.trim().toLowerCase(), p]));
    let saved = 0;
    for (const line of lines) {
      const parts = line.split(/[,\t]/).map((s) => s.trim());
      if (parts.length < 2) continue;
      const [name, email] = parts;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      const match = byName.get(name.toLowerCase());
      if (!match) continue;
      const { error } = await supabase.from("staffing_people").update({ email }).eq("id", match.id);
      if (!error) saved++;
    }
    toast.success(`Imported ${saved} emails`);
    setPasteOpen(false);
    setPasteText("");
    await load();
  };

  const openOverrides = async (row: UserRow) => {
    setOverrideUser(row);
    const { data } = await supabase
      .from("user_route_overrides")
      .select("route_key, visible, access_mode")
      .eq("user_id", row.user_id);
    const map: OverrideMap = {};
    ALL_ROUTE_KEYS.forEach((k) => (map[k] = "inherit"));
    (data || []).forEach((o: any) => {
      const m: OverrideOption =
        o.access_mode === "hidden" || o.access_mode === "read" || o.access_mode === "edit"
          ? o.access_mode
          : o.visible
          ? "edit"
          : "hidden";
      map[o.route_key] = m;
    });
    setOverrides(map);
  };

  const saveOverrides = async () => {
    if (!overrideUser) return;
    setSavingOverrides(true);
    // Delete existing
    await supabase.from("user_route_overrides").delete().eq("user_id", overrideUser.user_id);
    const toInsert = Object.entries(overrides)
      .filter(([, v]) => v !== "inherit")
      .map(([route_key, v]) => ({
        user_id: overrideUser.user_id,
        route_key,
        access_mode: v as "hidden" | "read" | "edit",
        visible: v !== "hidden",
      }));
    if (toInsert.length > 0) {
      const { error } = await supabase.from("user_route_overrides").insert(toInsert);
      if (error) {
        toast.error(error.message);
        setSavingOverrides(false);
        return;
      }
    }
    toast.success("Access updated");
    setSavingOverrides(false);
    setOverrideUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DemoLoginsCard />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Users & Roles</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage who can access the portal, their role, and per-user section access.</p>
        </div>
        <div className="flex items-center gap-2">
          {missingPeople.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setShowMissing((s) => !s)}
            >
              {missingPeople.filter((p) => !p.email.trim()).length} missing email
              {missingPeople.filter((p) => !p.email.trim()).length === 1 ? "" : "s"}
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={provisioning} onClick={provisionFromPeople}>
            {provisioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
            Provision from People
          </Button>
          <a href="/signup" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            <UserPlus className="h-3.5 w-3.5" /> Invite via signup link
          </a>
        </div>
      </div>

      {showMissing && missingPeople.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 bg-secondary/40 border-b border-border flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-foreground">People needing email</div>
              <div className="text-[11px] text-muted-foreground">
                Add work emails so they can be provisioned. People who appear on active deals are listed first.
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={bulkSaving} onClick={fillAllGuessed}>
                {bulkSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Auto-fill guesses"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setPasteOpen(true)}>
                Paste CSV
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setShowMissing(false)}>
                Hide
              </Button>
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs">
              <tbody>
                {missingPeople.map((p) => (
                  <EmailRow
                    key={p.id}
                    person={p}
                    saving={savingEmail === p.id}
                    onSave={(email) => saveEmail(p.id, email)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              {["Name", "Email", "Role", "Joined", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelf = row.user_id === currentUser?.id;
              const busy = working === row.user_id;
              return (
                <tr key={row.user_id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-2 text-xs font-medium text-foreground">
                    {row.display_name}
                    {isSelf && <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>}
                    {row.role !== "admin" && !row.staffing_person_id && (
                      <span
                        title="Not mapped to a staffing person — this user will see no deals on Clients, Staffing, MBR or RGY. Map them in the People directory."
                        className="ml-1.5 inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                      >
                        ⚠ Not mapped
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.email}</td>
                  <td className="px-3 py-2">
                    <Select value={row.role} onValueChange={(v) => changeRole(row, v as AppRole)} disabled={busy}>
                      <SelectTrigger className="h-7 w-[120px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_ORDER.slice().reverse().map((r) => (
                          <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={busy} onClick={() => openOverrides(row)}>
                        <Sliders className="h-3 w-3" /> Customize
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={busy} onClick={() => resetPassword(row)}>
                        <KeyRound className="h-3 w-3" /> Reset
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive" disabled={busy || isSelf} onClick={() => setConfirmDelete(row)}>
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                      {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete user?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes <strong>{confirmDelete?.display_name}</strong> and all their access. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteUser(confirmDelete)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Paste name,email pairs</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            One per line. Format: <code>Full Name, name@peppercontent.io</code> (comma or tab).
            Names must match exactly.
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={10}
            placeholder={"Neema Jayadas, neema@peppercontent.io\nAamir Khan, aamir@peppercontent.io"}
            className="w-full text-xs p-2 border border-border rounded-md bg-card font-mono"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasteOpen(false)}>Cancel</Button>
            <Button onClick={importPasted} disabled={!pasteText.trim()}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!overrideUser} onOpenChange={(o) => !o && setOverrideUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Customize access — {overrideUser?.display_name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Override the {overrideUser ? ROLE_LABELS[overrideUser.role] : ""} role defaults for this user. "Inherit" keeps the role default.
            Read-only keeps the section visible but disables edits for this user.
          </p>
          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary/60 backdrop-blur">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Section</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground w-[320px]">Access</th>
                </tr>
              </thead>
              <tbody>
                {ALL_ROUTE_KEYS.map((route) => (
                  <tr key={route} className="border-b border-border/50">
                    <td className="px-3 py-2 text-foreground">{ROUTE_LABELS[route] || route}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-1">
                        {OVERRIDE_OPTIONS.map((opt) => {
                          const active = overrides[route] === opt;
                          const colorClass = active
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
                              onClick={() =>
                                setOverrides((prev) => ({ ...prev, [route]: opt }))
                              }
                              className={"px-2 py-0.5 rounded border text-[11px] " + colorClass}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideUser(null)}>Cancel</Button>
            <Button onClick={saveOverrides} disabled={savingOverrides}>
              {savingOverrides && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmailRow({
  person,
  saving,
  onSave,
}: {
  person: { id: string; name: string; email: string };
  saving: boolean;
  onSave: (email: string) => void;
}) {
  const [value, setValue] = useState(person.email || "");
  const dirty = value.trim() !== (person.email || "").trim();
  return (
    <tr className="border-b border-border/50">
      <td className="px-3 py-2 text-foreground w-[200px]">{person.name}</td>
      <td className="px-3 py-2">
        <Input
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="name@company.com"
          className="h-7 text-xs"
        />
      </td>
      <td className="px-3 py-2 w-[100px] text-right">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          disabled={!dirty || saving}
          onClick={() => onSave(value)}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
        </Button>
      </td>
    </tr>
  );
}
