import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldOff, KeyRound, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface UserRow {
  user_id: string;
  display_name: string;
  email: string;
  created_at: string;
  roles: ("admin" | "vsd")[];
}

export function UsersTab() {
  const { user: currentUser } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch profiles + roles. Email not directly accessible — we use display_name and user_id; email pulled via edge function.
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const rolesByUser = new Map<string, ("admin" | "vsd")[]>();
    (roles || []).forEach((r) => {
      const existing = rolesByUser.get(r.user_id) || [];
      existing.push(r.role as "admin" | "vsd");
      rolesByUser.set(r.user_id, existing);
    });

    // Get emails via edge function
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
      roles: rolesByUser.get(p.user_id) || [],
    }));

    built.sort((a, b) => a.display_name.localeCompare(b.display_name));
    setRows(built);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const promote = async (row: UserRow) => {
    setWorking(row.user_id);
    const { error } = await supabase.from("user_roles").insert({ user_id: row.user_id, role: "admin" });
    if (error) toast.error(error.message);
    else toast.success(`${row.display_name} promoted to Admin`);
    await load();
    setWorking(null);
  };

  const demote = async (row: UserRow) => {
    if (row.user_id === currentUser?.id) {
      toast.error("You cannot remove your own admin role");
      return;
    }
    setWorking(row.user_id);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", row.user_id).eq("role", "admin");
    if (error) toast.error(error.message);
    else toast.success(`${row.display_name} demoted to VSD`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Users & Roles</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage who can access the portal and their roles.</p>
        </div>
        <a
          href="/signup"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <UserPlus className="h-3.5 w-3.5" /> Invite via signup link
        </a>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              {["Name", "Email", "Role", "Joined", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isAdmin = row.roles.includes("admin");
              const isSelf = row.user_id === currentUser?.id;
              const busy = working === row.user_id;
              return (
                <tr key={row.user_id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-2 text-xs font-medium text-foreground">
                    {row.display_name}
                    {isSelf && <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.email}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        isAdmin
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {isAdmin ? "Admin" : "VSD"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {isAdmin ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1"
                          disabled={busy || isSelf}
                          onClick={() => demote(row)}
                        >
                          <ShieldOff className="h-3 w-3" /> Demote
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1"
                          disabled={busy}
                          onClick={() => promote(row)}
                        >
                          <ShieldCheck className="h-3 w-3" /> Make Admin
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] gap-1"
                        disabled={busy}
                        onClick={() => resetPassword(row)}
                      >
                        <KeyRound className="h-3 w-3" /> Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive"
                        disabled={busy || isSelf}
                        onClick={() => setConfirmDelete(row)}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                      {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes <strong>{confirmDelete?.display_name}</strong> and all their access. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteUser(confirmDelete)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
