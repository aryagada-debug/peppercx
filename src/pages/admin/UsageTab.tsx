import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ROLE_LABELS, ROLE_ORDER, type AppRole } from "@/hooks/useUserRole";
import {
  classifyStatus,
  daysSince,
  STATUS_LABEL,
  STATUS_TONE,
  type UsageRow,
  type UsageStatus,
} from "@/lib/usageAnalytics";
import { cn } from "@/lib/utils";

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

interface Person {
  id: string;
  name: string;
  email: string;
  region: string | null;
  pod: string | null;
  department: string | null;
}

const THIRTY_DAYS = 30 * 86400000;

export function UsageTab() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UsageStatus | "all">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const since = new Date(Date.now() - THIRTY_DAYS).toISOString();
      const [
        authRes,
        { data: profiles },
        { data: roles },
        { data: people },
        { data: tasks },
        { data: rgyW },
        { data: rgyN },
        { data: todos1 },
        { data: todos2 },
        { data: slackMsgs },
        { data: approvals },
      ] = await Promise.all([
        supabase.functions.invoke("admin-user-mgmt", { body: { action: "list" } }),
        supabase.from("profiles").select("user_id, display_name, staffing_person_id"),
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("staffing_people")
          .select("id, name, email, region, pod, department")
          .eq("leaving", false)
          .eq("tbh", false),
        supabase.from("deal_tasks").select("created_by").gte("updated_at", since),
        supabase.from("deal_rgy_weekly").select("updated_by").gte("updated_at", since),
        supabase.from("deal_rgy_notes").select("updated_by").gte("created_at", since),
        supabase.from("personal_todos").select("user_id").gte("updated_at", since),
        supabase.from("personal_todos").select("assigned_by_user_id").gte("updated_at", since),
        supabase.from("slack_messages").select("sent_by_app_user").gte("created_at", since),
        supabase.from("approval_requests").select("requested_by").gte("created_at", since),
      ]);

      const authUsers: AuthUser[] = (authRes?.data?.users as AuthUser[]) || [];
      const authByEmail = new Map<string, AuthUser>();
      const authById = new Map<string, AuthUser>();
      authUsers.forEach((u) => {
        if (u.email) authByEmail.set(u.email.toLowerCase(), u);
        authById.set(u.id, u);
      });

      // highest role per user
      const rolesByUser = new Map<string, AppRole>();
      (roles || []).forEach((r: any) => {
        const existing = rolesByUser.get(r.user_id);
        const next = r.role as AppRole;
        const rank = (rr: AppRole) => ROLE_ORDER.indexOf(rr);
        if (!existing || rank(next) > rank(existing)) rolesByUser.set(r.user_id, next);
      });

      const profByUser = new Map<string, any>();
      (profiles || []).forEach((p: any) => profByUser.set(p.user_id, p));

      // Aggregate writes per user_id
      const writes = new Map<string, number>();
      const bump = (id: string | null | undefined) => {
        if (!id) return;
        writes.set(id, (writes.get(id) || 0) + 1);
      };
      (tasks || []).forEach((r: any) => bump(r.created_by));
      (rgyW || []).forEach((r: any) => bump(r.updated_by));
      (rgyN || []).forEach((r: any) => bump(r.updated_by));
      (todos1 || []).forEach((r: any) => bump(r.user_id));
      (todos2 || []).forEach((r: any) => bump(r.assigned_by_user_id));
      (slackMsgs || []).forEach((r: any) => bump(r.sent_by_app_user));
      (approvals || []).forEach((r: any) => bump(r.requested_by));

      const peopleList: Person[] = (people || []) as Person[];
      const peopleByEmail = new Map<string, Person>();
      peopleList.forEach((p) => {
        if (p.email) peopleByEmail.set(p.email.toLowerCase(), p);
      });

      const seenAuthIds = new Set<string>();
      const out: UsageRow[] = [];

      // 1. Each staffing person → row (provisioned or not)
      peopleList.forEach((p) => {
        const email = (p.email || "").trim().toLowerCase();
        const auth = email ? authByEmail.get(email) : undefined;
        if (auth) seenAuthIds.add(auth.id);
        const role = auth ? rolesByUser.get(auth.id) || "user" : "user";
        out.push({
          user_id: auth?.id ?? null,
          name: p.name,
          email: p.email || "",
          role,
          region: p.region || "",
          pod: p.pod || "",
          department: p.department || "",
          created_at: auth?.created_at ?? null,
          last_sign_in_at: auth?.last_sign_in_at ?? null,
          days_since_login: daysSince(auth?.last_sign_in_at ?? null),
          writes_30d: auth ? writes.get(auth.id) || 0 : 0,
          status: classifyStatus(!!auth, auth?.last_sign_in_at ?? null),
        });
      });

      // 2. Auth users not linked to any staffing_person (e.g. admins, ex-staff)
      authUsers.forEach((u) => {
        if (seenAuthIds.has(u.id)) return;
        const prof = profByUser.get(u.id);
        out.push({
          user_id: u.id,
          name: prof?.display_name || u.email || "—",
          email: u.email || "",
          role: rolesByUser.get(u.id) || "user",
          region: "",
          pod: "",
          department: "(unlinked)",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          days_since_login: daysSince(u.last_sign_in_at),
          writes_30d: writes.get(u.id) || 0,
          status: classifyStatus(true, u.last_sign_in_at),
        });
      });

      setRows(out);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load usage");
    } finally {
      setLoading(false);
    }
  }

  const kpis = useMemo(() => {
    const expected = rows.length;
    const provisioned = rows.filter((r) => r.status !== "not_provisioned").length;
    const signedInOnce = rows.filter(
      (r) => r.status === "active7" || r.status === "active30" || r.status === "dormant",
    ).length;
    const active7 = rows.filter((r) => r.status === "active7").length;
    const active30 = active7 + rows.filter((r) => r.status === "active30").length;
    const dormant = rows.filter((r) => r.status === "dormant").length;
    const never = rows.filter((r) => r.status === "never_signed_in").length;
    const notProv = rows.filter((r) => r.status === "not_provisioned").length;
    return { expected, provisioned, signedInOnce, active7, active30, dormant, never, notProv };
  }, [rows]);

  const regions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.region).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => roleFilter === "all" || r.role === roleFilter)
      .filter((r) => regionFilter === "all" || r.region === regionFilter)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        // Sort by status severity then by days since login desc
        const order: UsageStatus[] = ["not_provisioned", "never_signed_in", "dormant", "active30", "active7"];
        const d = order.indexOf(a.status) - order.indexOf(b.status);
        if (d !== 0) return d;
        return (b.days_since_login ?? -1) - (a.days_since_login ?? -1);
      });
  }, [rows, search, statusFilter, roleFilter, regionFilter]);

  const neverList = useMemo(
    () => rows.filter((r) => r.status === "never_signed_in" || r.status === "not_provisioned").slice(0, 50),
    [rows],
  );
  const dormantList = useMemo(
    () =>
      rows
        .filter((r) => r.status === "dormant")
        .sort((a, b) => (b.days_since_login ?? 0) - (a.days_since_login ?? 0))
        .slice(0, 20),
    [rows],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const copyEmails = async (list: UsageRow[]) => {
    const emails = list.map((r) => r.email).filter(Boolean).join(", ");
    if (!emails) return;
    await navigator.clipboard.writeText(emails);
    setCopied(emails);
    setTimeout(() => setCopied(null), 1500);
    toast.success(`Copied ${list.length} emails`);
  };

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiTile label="Expected users" value={kpis.expected} />
        <KpiTile label="Provisioned" value={kpis.provisioned} sub={`${pct(kpis.provisioned, kpis.expected)}%`} />
        <KpiTile label="Active · 7d" value={kpis.active7} tone="positive" sub={`${pct(kpis.active7, kpis.expected)}%`} />
        <KpiTile label="Active · 30d" value={kpis.active30} tone="positive" sub={`${pct(kpis.active30, kpis.expected)}%`} />
        <KpiTile label="Dormant 30d+" value={kpis.dormant} tone="warning" />
        <KpiTile label="Never signed in" value={kpis.never + kpis.notProv} tone="destructive" />
      </div>

      {/* Funnel */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Adoption funnel</h3>
          <span className="text-xs text-muted-foreground">Snapshot · {new Date().toLocaleDateString()}</span>
        </div>
        <Funnel
          steps={[
            { label: "Expected", value: kpis.expected },
            { label: "Provisioned", value: kpis.provisioned },
            { label: "Signed in once", value: kpis.signedInOnce },
            { label: "Active 30d", value: kpis.active30 },
            { label: "Active 7d", value: kpis.active7 },
          ]}
        />
      </div>

      {/* Action lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ActionList
          title="Never signed in"
          subtitle={`${neverList.length} people · invite or nudge`}
          rows={neverList}
          onCopy={() => copyEmails(neverList)}
          copied={copied}
        />
        <ActionList
          title="Dormant (30d+)"
          subtitle={`${dormantList.length} people · top by days since login`}
          rows={dormantList}
          onCopy={() => copyEmails(dormantList)}
          copied={copied}
          showDays
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, department…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_LABEL) as UsageStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLE_ORDER.map((r) => (
              <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Region" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} of {rows.length}</div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Region · Pod</th>
                <th className="px-3 py-2">First login</th>
                <th className="px-3 py-2">Last login</th>
                <th className="px-3 py-2 text-right">Days idle</th>
                <th className="px-3 py-2 text-right">Writes · 30d</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={`${r.user_id || r.email}-${i}`} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{r.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.email || "no email"}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{ROLE_LABELS[r.role as AppRole] || r.role}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[r.region, r.pod].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.last_sign_in_at)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {r.days_since_login === null ? "—" : r.days_since_login}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={r.writes_30d > 0 ? "text-foreground" : "text-muted-foreground"}>
                      {r.writes_30d}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[r.status])}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No users match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        "Writes · 30d" counts edits across tasks, RGY health, personal todos, Slack messages and approvals.
        Login history beyond the most recent timestamp is not retained — historical daily trends require enabling auth audit log ingestion.
      </p>
    </div>
  );
}

function KpiTile({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: "positive" | "warning" | "destructive" }) {
  const toneCls =
    tone === "positive" ? "text-positive" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-medium tabular-nums", toneCls)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const pctw = (s.value / max) * 100;
        const dropFromPrev = i > 0 ? steps[i - 1].value - s.value : 0;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-32 shrink-0 text-xs text-muted-foreground">{s.label}</div>
            <div className="relative h-7 flex-1 rounded-md bg-muted/40">
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-primary/80"
                style={{ width: `${pctw}%` }}
              />
              <div className="relative flex h-full items-center justify-between px-2 text-xs">
                <span className="font-medium text-foreground">{s.value}</span>
                {i > 0 && dropFromPrev > 0 && (
                  <span className="text-muted-foreground">−{dropFromPrev}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionList({
  title,
  subtitle,
  rows,
  onCopy,
  copied,
  showDays,
}: {
  title: string;
  subtitle: string;
  rows: UsageRow[];
  onCopy: () => void;
  copied: string | null;
  showDays?: boolean;
}) {
  const justCopied = !!copied && rows.length > 0 && copied.includes(rows[0].email);
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <button
          onClick={onCopy}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          {justCopied ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
          Copy emails
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Nothing to show — nice.</div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r, i) => (
              <li key={`${r.email}-${i}`} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{r.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.email || "no email"} · {r.department || "—"}</div>
                </div>
                <div className="ml-3 shrink-0 text-xs text-muted-foreground">
                  {showDays && r.days_since_login !== null ? `${r.days_since_login}d` : STATUS_LABEL[r.status]}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function fmtDate(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}