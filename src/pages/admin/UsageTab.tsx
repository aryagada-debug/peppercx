import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ROLE_LABELS, ROLE_ORDER, type AppRole } from "@/hooks/useUserRole";
import { routeKeyLabel } from "@/lib/routeKey";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
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
  manager_person_id?: string | null;
  role_title?: string | null;
  designation?: string | null;
}

const DAY_MS = 86400000;
type RangeDays = 7 | 30 | 90;
type StatusChip = "all" | "active" | "low" | "dormant" | "never";

const STATUS_CHIPS: { key: StatusChip; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active (7d)" },
  { key: "low", label: "Low usage (30d)" },
  { key: "dormant", label: "Dormant" },
  { key: "never", label: "Never signed in" },
];

function matchesChip(s: UsageStatus, chip: StatusChip): boolean {
  switch (chip) {
    case "all": return true;
    case "active": return s === "active7";
    case "low": return s === "active30";
    case "dormant": return s === "dormant";
    case "never": return s === "never_signed_in" || s === "not_provisioned";
  }
}

function isVsdRole(roleText: string): boolean {
  const t = roleText.toLowerCase();
  return /\bvsd\b/.test(t) || /vertical service delivery/.test(t) || /service delivery (leader|director)/.test(t);
}

interface RowWithVsd extends UsageRow {
  vsd_name: string;
  avg_session_min: number | null;
}

interface PageRoleData {
  route_key: string;
  label: string;
  admin: number;
  member: number;
  user: number;
  total: number;
}

export function UsageTab() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RowWithVsd[]>([]);
  const [pageRoleData, setPageRoleData] = useState<PageRoleData[]>([]);
  const [vsdList, setVsdList] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusChip, setStatusChip] = useState<StatusChip>("all");
  const [vsdFilter, setVsdFilter] = useState<Set<string>>(new Set());
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<10 | 25 | 50>(25);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortK, setSortK] = useState<"name" | "role" | "last" | "idle" | "writes" | "status" | "session">("status");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  useEffect(() => { void load(rangeDays); }, [rangeDays]);

  async function load(days: RangeDays) {
    setLoading(true);
    try {
      const since = new Date(Date.now() - days * DAY_MS).toISOString();
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
          .select("id, name, email, region, pod, department, manager_person_id, role_title, designation")
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

      // Session heartbeats — used to compute average session length per user.
      // A "session" row's length is (last_seen_at - started_at).
      const { data: sessions } = await supabase
        .from("user_sessions")
        .select("user_id, started_at, last_seen_at")
        .gte("started_at", since);

      const sessionAgg = new Map<string, { total: number; count: number }>();
      (sessions || []).forEach((s: any) => {
        const dur = (new Date(s.last_seen_at).getTime() - new Date(s.started_at).getTime()) / 60000;
        // Ignore zero-length pings (single heartbeat) — only meaningful if > 0.
        if (!isFinite(dur) || dur <= 0) return;
        const a = sessionAgg.get(s.user_id) || { total: 0, count: 0 };
        a.total += dur;
        a.count += 1;
        sessionAgg.set(s.user_id, a);
      });
      const avgSessionFor = (uid: string | null | undefined): number | null => {
        if (!uid) return null;
        const a = sessionAgg.get(uid);
        if (!a || a.count === 0) return null;
        return a.total / a.count;
      };

      const authUsers: AuthUser[] = (authRes?.data?.users as AuthUser[]) || [];
      const authByEmail = new Map<string, AuthUser>();
      const authById = new Map<string, AuthUser>();
      authUsers.forEach((u) => {
        if (u.email) authByEmail.set(u.email.toLowerCase(), u);
        authById.set(u.id, u);
      });

      const rolesByUser = new Map<string, AppRole>();
      (roles || []).forEach((r: any) => {
        const existing = rolesByUser.get(r.user_id);
        const next = r.role as AppRole;
        const rank = (rr: AppRole) => ROLE_ORDER.indexOf(rr);
        if (!existing || rank(next) > rank(existing)) rolesByUser.set(r.user_id, next);
      });

      const profByUser = new Map<string, any>();
      (profiles || []).forEach((p: any) => profByUser.set(p.user_id, p));

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

      // Build VSD lookup: walk manager chain until we find a VSD
      const peopleById = new Map<string, Person>();
      peopleList.forEach((p) => peopleById.set(p.id, p));
      const vsdNameCache = new Map<string, string>();
      const resolveVsd = (pid: string | null | undefined): string => {
        if (!pid) return "";
        if (vsdNameCache.has(pid)) return vsdNameCache.get(pid)!;
        const seen = new Set<string>();
        let cur: string | null | undefined = pid;
        while (cur && !seen.has(cur)) {
          seen.add(cur);
          const p = peopleById.get(cur);
          if (!p) break;
          const roleText = `${p.role_title || ""} ${p.designation || ""}`;
          if (isVsdRole(roleText)) {
            vsdNameCache.set(pid, p.name);
            return p.name;
          }
          cur = p.manager_person_id || null;
        }
        vsdNameCache.set(pid, "");
        return "";
      };

      const seenAuthIds = new Set<string>();
      const out: RowWithVsd[] = [];

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
          vsd_name: resolveVsd(p.id),
          avg_session_min: avgSessionFor(auth?.id),
        });
      });

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
          vsd_name: "",
          avg_session_min: avgSessionFor(u.id),
        });
      });

      setRows(out);
      const vsds = Array.from(new Set(out.map((r) => r.vsd_name).filter(Boolean))).sort();
      setVsdList(vsds);

      // Page-views aggregation by route_key × role (admin/member/user).
      const { data: views } = await supabase
        .from("user_page_views")
        .select("user_id, route_key")
        .gte("visited_at", since)
        .limit(50000);

      const roleByUserId = new Map<string, AppRole>();
      rolesByUser.forEach((v, k) => roleByUserId.set(k, v));

      const agg = new Map<string, { admin: number; member: number; user: number }>();
      (views || []).forEach((v: any) => {
        const rk = v.route_key || "unknown";
        const role = roleByUserId.get(v.user_id) || "user";
        const bucket = agg.get(rk) || { admin: 0, member: 0, user: 0 };
        if (role === "admin") bucket.admin += 1;
        else if (role === "member") bucket.member += 1;
        else bucket.user += 1;
        agg.set(rk, bucket);
      });

      const pageRows: PageRoleData[] = Array.from(agg.entries())
        .map(([rk, b]) => ({
          route_key: rk,
          label: routeKeyLabel(rk),
          admin: b.admin,
          member: b.member,
          user: b.user,
          total: b.admin + b.member + b.user,
        }))
        .sort((a, b) => b.total - a.total);
      setPageRoleData(pageRows);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = rows
      .filter((r) => matchesChip(r.status, statusChip))
      .filter((r) => vsdFilter.size === 0 || vsdFilter.has(r.vsd_name))
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          (r.region || "").toLowerCase().includes(q) ||
          r.vsd_name.toLowerCase().includes(q),
      );
    const order: UsageStatus[] = ["not_provisioned", "never_signed_in", "dormant", "active30", "active7"];
    const cmp = (a: RowWithVsd, b: RowWithVsd): number => {
      switch (sortK) {
        case "name": return a.name.localeCompare(b.name);
        case "role": return (a.role || "").localeCompare(b.role || "");
        case "last": return (new Date(a.last_sign_in_at || 0).getTime()) - (new Date(b.last_sign_in_at || 0).getTime());
        case "idle": return (a.days_since_login ?? -1) - (b.days_since_login ?? -1);
        case "writes": return a.writes_30d - b.writes_30d;
        case "status": return order.indexOf(a.status) - order.indexOf(b.status);
        case "session": return (a.avg_session_min ?? -1) - (b.avg_session_min ?? -1);
      }
    };
    return [...base].sort((a, b) => cmp(a, b) * sortDir);
  }, [rows, search, statusChip, vsdFilter, sortK, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * perPage;
  const pageRows = filtered.slice(pageStart, pageStart + perPage);

  useEffect(() => { setPage(1); }, [search, statusChip, vsdFilter, perPage, rangeDays]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const toggleSort = (k: typeof sortK) => {
    if (sortK === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortK(k); setSortDir(k === "name" || k === "role" ? 1 : -1); }
  };

  const toggleVsd = (name: string) => {
    setVsdFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const exportCsv = () => {
    const head = ["Name", "Email", "Role", "VSD", "Region", "Pod", "Department", "First login", "Last login", "Days idle", `Writes ${rangeDays}d`, "Avg session (min)", "Status"];
    const lines = [head.join(",")];
    filtered.forEach((r) => {
      const cells = [
        r.name, r.email, ROLE_LABELS[r.role as AppRole] || r.role, r.vsd_name, r.region, r.pod, r.department,
        fmtDate(r.created_at), fmtDate(r.last_sign_in_at),
        r.days_since_login === null ? "" : String(r.days_since_login),
        String(r.writes_30d),
        r.avg_session_min === null ? "" : r.avg_session_min.toFixed(1),
        STATUS_LABEL[r.status],
      ].map((v) => {
        const s = (v ?? "").toString().replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      });
      lines.push(cells.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-adoption-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} rows`);
  };

  const pagerBtns: number[] = (() => {
    const out: number[] = [];
    const s = Math.max(1, safePage - 2);
    const e = Math.min(totalPages, s + 4);
    const start = Math.max(1, e - 4);
    for (let p = start; p <= e; p++) out.push(p);
    return out;
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium text-foreground">Usage & Adoption</h2>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Admin
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Who's signing in, who's contributing, and who needs a nudge.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-card p-0.5">
            {([7, 30, 90] as RangeDays[]).map((d) => (
              <button
                key={d}
                onClick={() => setRangeDays(d)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition",
                  rangeDays === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-8">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI strip — no "New activations" */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiTile label="Total users" value={kpis.expected} />
        <KpiTile label="Active · 7d" value={kpis.active7} tone="positive" sub={`${pct(kpis.active7, kpis.expected)}%`} />
        <KpiTile label="Active · 30d" value={kpis.active30} tone="positive" sub={`${pct(kpis.active30, kpis.expected)}%`} />
        <KpiTile label="Dormant" value={kpis.dormant} tone="warning" />
        <KpiTile label="Never signed in" value={kpis.never + kpis.notProv} tone="destructive" />
      </div>

      {/* Status chips + search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_CHIPS.map((c) => {
            const active = statusChip === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setStatusChip(c.key)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, region, VSD…"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {/* VSD pill filter */}
      {vsdList.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">VSD</span>
          <button
            onClick={() => setVsdFilter(new Set())}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition",
              vsdFilter.size === 0
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {vsdList.map((v) => {
            const active = vsdFilter.has(v);
            const count = rows.filter((r) => r.vsd_name === v).length;
            return (
              <button
                key={v}
                onClick={() => toggleVsd(v)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {v} <span className="ml-1 text-[10px] opacity-70 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table with expandable detail */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <Th label="Name" k="name" sortK={sortK} dir={sortDir} onClick={toggleSort} />
                <Th label="Role" k="role" sortK={sortK} dir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2 font-medium">VSD</th>
                <th className="px-3 py-2 font-medium">Region · Pod</th>
                <Th label="Last login" k="last" sortK={sortK} dir={sortDir} onClick={toggleSort} />
                <Th label="Idle" k="idle" sortK={sortK} dir={sortDir} onClick={toggleSort} align="right" />
                <Th label={`Writes · ${rangeDays}d`} k="writes" sortK={sortK} dir={sortDir} onClick={toggleSort} align="right" />
                <Th label="Avg session" k="session" sortK={sortK} dir={sortDir} onClick={toggleSort} align="right" />
                <Th label="Status" k="status" sortK={sortK} dir={sortDir} onClick={toggleSort} />
                <th className="w-8 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => {
                const key = `${r.user_id || r.email}-${pageStart + i}`;
                const open = expanded === key;
                return (
                  <FragmentRow
                    key={key}
                    rowKey={key}
                    r={r}
                    open={open}
                    onToggle={() => setExpanded(open ? null : key)}
                    rangeDays={rangeDays}
                  />
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No users match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pager */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <div>
            Showing {filtered.length ? pageStart + 1 : 0}–{Math.min(pageStart + perPage, filtered.length)} of {filtered.length}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5">
              <span>Per page</span>
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value) as 10 | 25 | 50)}
                className="h-7 rounded-md border border-border bg-background px-1.5 text-xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <div className="flex items-center gap-1">
              <PagerBtn disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</PagerBtn>
              {pagerBtns.map((p) => (
                <PagerBtn key={p} active={p === safePage} onClick={() => setPage(p)}>
                  {p}
                </PagerBtn>
              ))}
              <PagerBtn disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</PagerBtn>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        "Writes · {rangeDays}d" counts edits across tasks, RGY health, personal todos, Slack messages and approvals
        in the selected window. "Avg session" is the mean active session length (heartbeat-based) in the same window
        — it will be empty until users have signed in and accumulated session data.
      </p>
    </div>
  );
}

function FragmentRow({
  rowKey, r, open, onToggle, rangeDays,
}: {
  rowKey: string;
  r: RowWithVsd;
  open: boolean;
  onToggle: () => void;
  rangeDays: number;
}) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer border-t border-border hover:bg-muted/30">
        <td className="px-3 py-2">
          <div className="font-medium text-foreground">{r.name || "—"}</div>
          <div className="text-xs text-muted-foreground">{r.email || "no email"}</div>
        </td>
        <td className="px-3 py-2 text-muted-foreground">{ROLE_LABELS[r.role as AppRole] || r.role}</td>
        <td className="px-3 py-2 text-muted-foreground">{r.vsd_name || "—"}</td>
        <td className="px-3 py-2 text-muted-foreground">
          {[r.region, r.pod].filter(Boolean).join(" · ") || "—"}
        </td>
        <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.last_sign_in_at)}</td>
        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
          {r.days_since_login === null ? "—" : `${r.days_since_login}d`}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          <span className={r.writes_30d > 0 ? "text-foreground" : "text-muted-foreground"}>
            {r.writes_30d}
          </span>
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
          {fmtSession(r.avg_session_min)}
        </td>
        <td className="px-3 py-2">
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[r.status])}>
            {STATUS_LABEL[r.status]}
          </span>
        </td>
        <td className="px-2 py-2 text-muted-foreground">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={10} className="px-4 py-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs md:grid-cols-4">
              <Detail label="VSD" value={r.vsd_name || "—"} />
              <Detail label="Department" value={r.department || "—"} />
              <Detail label="First login" value={fmtDate(r.created_at)} />
              <Detail label="Last login" value={fmtDate(r.last_sign_in_at)} />
              <Detail
                label="Days since login"
                value={r.days_since_login === null ? "—" : `${r.days_since_login} days`}
              />
              <Detail label="Email" value={r.email || "—"} />
              <Detail label={`Writes (${rangeDays}d)`} value={String(r.writes_30d)} />
              <Detail label="Avg session" value={fmtSession(r.avg_session_min)} />
              <Detail label="Status" value={STATUS_LABEL[r.status]} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function KpiTile({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: "positive" | "warning" | "destructive" }) {
  const toneCls =
    tone === "positive" ? "text-positive" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-medium tabular-nums", toneCls)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Th({
  label, k, sortK, dir, onClick, align,
}: {
  label: string;
  k: "name" | "role" | "last" | "idle" | "writes" | "status" | "session";
  sortK: string;
  dir: 1 | -1;
  onClick: (k: any) => void;
  align?: "right";
}) {
  const active = sortK === k;
  return (
    <th
      onClick={() => onClick(k)}
      className={cn(
        "cursor-pointer select-none px-3 py-2 font-medium",
        align === "right" ? "text-right" : "",
        active ? "text-foreground" : "",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={cn("text-[9px]", active ? "opacity-100" : "opacity-40")}>
          {active ? (dir === 1 ? "▲" : "▼") : "▲▼"}
        </span>
      </span>
    </th>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}

function PagerBtn({
  children, onClick, active, disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 min-w-[28px] items-center justify-center rounded-md border px-2 text-xs font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
        disabled && "opacity-40 pointer-events-none",
      )}
    >
      {children}
    </button>
  );
}

function fmtDate(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtSession(min: number | null): string {
  if (min === null || !isFinite(min) || min <= 0) return "—";
  if (min < 1) return "<1m";
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}