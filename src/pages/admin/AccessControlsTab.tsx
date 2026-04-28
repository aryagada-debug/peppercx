import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  ShieldCheck,
  Briefcase,
  Users,
  Eye,
  Pencil,
  ChevronDown,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { ALL_ROUTE_KEYS, type AppRole, type AccessMode } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "home": "Home",
  "dashboard": "Dashboard",
  "clients": "Clients & Deals",
  "staffing": "Staffing & Capacity",
  "revenue": "Revenue",
  "targets": "Targets",
  "central-cx": "Central Cx",
  "rgy-health": "RGY Health",
  "mbr-tracker": "MBR Tracker",
  "slack-health": "Slack Health",
  "onboarding": "Onboarding",
  "deal-desk": "Deal Desk",
  "seo-staffing": "SEO Staffing",
  "gm2-calculator": "GM2 Calculator",
  "settings": "Settings",
};

type RouteVis = { role: AppRole; route_key: string; visible: boolean; access_mode: AccessMode | null };
type SummaryRow = { role: AppRole; route_key: string; view_summary: string; edit_summary: string };

type PersonaCol = {
  role: AppRole;
  label: string;
  sublabel: string;
  icon: typeof ShieldCheck;
};

const PERSONA_COLUMNS: PersonaCol[] = [
  { role: "admin",     label: "Admin",     sublabel: "Full access — every section, edit everything", icon: ShieldCheck },
  { role: "member",    label: "VSD",       sublabel: "Sees their pod's deals end-to-end",            icon: Briefcase },
  { role: "user",      label: "BOPM",      sublabel: "Sees only deals they're staffed on",           icon: Users },
  { role: "view_only", label: "Viewer",    sublabel: "Read-only — no edits anywhere",                icon: Eye },
];

const VIEW_OPTIONS: Record<string, string[]> = {
  "home":           ["My tasks", "Pinned deals", "Quick links"],
  "dashboard":      ["All KPIs", "Own pod KPIs", "Own deals only", "Drill-down dialogs"],
  "clients":        ["All clients", "Own pod clients", "Own deals only", "Financial summary", "SoW & contracts", "Contact details"],
  "staffing":       ["All allocations", "Own pod allocations", "Own allocations only", "Own deals staffing", "People & Matrix only (no Deal view)", "Capacity heatmap", "Hiring gaps"],
  "revenue":        ["Org revenue", "Pod revenue", "Deal-level revenue", "FX & GM%"],
  "targets":        ["Org targets", "Pod targets", "Deal targets"],
  "central-cx":     ["All Cx tasks", "Own space tasks", "Calendar view"],
  "rgy-health":     ["Full RGY board", "Own pod RGY", "Own deals RGY", "Table view only (no insights)", "Issue history", "AI summary"],
  "mbr-tracker":    ["All MBRs", "Own pod MBRs", "Own deals MBRs", "Table view only (no MoM / Trend)", "Notes & transcripts"],
  "slack-health":   ["All channels", "Own pod channels", "Inactivity nudges"],
  "onboarding":     ["All onboarding plans", "Own deals onboarding"],
  "deal-desk":      ["All requests", "Own requests"],
  "seo-staffing":   ["All SEO allocations", "Own SEO allocations"],
  "gm2-calculator": ["Calculator inputs", "Saved scenarios"],
  "settings":       ["Personal settings", "Users & roles", "Access controls", "Integrations"],
};

const EDIT_OPTIONS: Record<string, string[]> = {
  "home":           ["Reorder pinned items", "Mark tasks done"],
  "dashboard":      ["No edit access"],
  "clients":        ["Create clients", "Edit own deals", "Edit any deal", "Delete deals", "Edit financials", "Edit SoW", "Edit RGY", "Edit staffing"],
  "staffing":       ["Assign people (own deals)", "Assign people (any deal)", "Edit allocations", "Mark hiring needs"],
  "revenue":        ["No edit access", "Edit FX rate", "Edit deal financials"],
  "targets":        ["Edit org targets", "Edit pod targets", "Edit deal targets", "Upload targets CSV"],
  "central-cx":     ["Create tasks", "Edit own tasks", "Edit any task", "Manage statuses & members"],
  "rgy-health":     ["Mark RGY (own deals)", "Mark RGY (any deal)", "Log issues & action plans", "Resolve issues"],
  "mbr-tracker":    ["Schedule MBRs", "Upload notes", "Mark done", "Edit any MBR"],
  "slack-health":   ["Send messages", "Configure nudges"],
  "onboarding":     ["Edit own deal steps", "Edit any deal steps", "Mark complete"],
  "deal-desk":      ["Submit requests", "Approve / reject"],
  "seo-staffing":   ["Edit SEO allocations"],
  "gm2-calculator": ["Save scenarios"],
  "settings":       ["Edit personal settings", "Manage users & roles", "Edit access controls", "Manage integrations"],
};

const splitTokens = (raw: string): string[] =>
  raw.split(",").map((s) => s.trim()).filter(Boolean);
const joinTokens = (arr: string[]): string => Array.from(new Set(arr)).join(", ");

const DEFAULT_SUMMARY: Record<AppRole, Partial<Record<string, { view: string[]; edit: string[] }>>> = {
  admin: {},
  member: {
    "clients":     { view: ["Own pod clients", "Financial summary"], edit: ["Edit any deal", "Edit financials", "Edit RGY", "Edit staffing"] },
    "rgy-health":  { view: ["Own pod RGY", "Issue history"],         edit: ["Mark RGY (any deal)", "Log issues & action plans"] },
    "mbr-tracker": { view: ["Own pod MBRs"],                         edit: ["Schedule MBRs", "Upload notes", "Mark done"] },
    "staffing":    { view: ["Own pod allocations"],                  edit: ["Assign people (any deal)", "Edit allocations"] },
    "revenue":     { view: ["Pod revenue"],                          edit: ["No edit access"] },
  },
  user: {
    "clients":     { view: ["Own deals only", "Financial summary"],  edit: ["Edit own deals"] },
    "rgy-health":  { view: ["Own deals RGY", "Issue history"],       edit: ["Mark RGY (own deals)", "Log issues & action plans"] },
    "mbr-tracker": { view: ["Own deals MBRs", "Notes & transcripts"], edit: ["Schedule MBRs", "Upload notes", "Mark done"] },
    "staffing":    { view: ["Own deals staffing"],                   edit: ["Assign people (own deals)"] },
  },
  view_only: {},
};

const MODE_LABELS: Record<AccessMode, string> = {
  hidden: "Hidden",
  read: "View only",
  edit: "Editable",
};
const MODE_ICONS: Record<AccessMode, typeof EyeOff> = {
  hidden: EyeOff,
  read: Eye,
  edit: Pencil,
};

function ModeChip({ mode, active, onClick, disabled }: { mode: AccessMode; active: boolean; onClick: () => void; disabled?: boolean }) {
  const Icon = MODE_ICONS[mode];
  const tone =
    mode === "hidden" ? "border-destructive/40 text-destructive bg-destructive/5"
    : mode === "read"  ? "border-warning/40 text-warning-foreground bg-warning/10"
    : "border-positive/40 text-positive bg-positive/10";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-all",
        active ? `${tone} ring-1 ring-inset` : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <Icon className="h-3 w-3" />
      {MODE_LABELS[mode]}
    </button>
  );
}

export function AccessControlsTab() {
  const [rows, setRows] = useState<RouteVis[]>([]);
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<AppRole>("member");
  const [scope, setScope] = useState<{ name: string; role: string; person_id: string | null; deals: number; status: "ok" | "warn" }[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: visRows }, { data: sumRows }] = await Promise.all([
      supabase.from("route_visibility").select("role, route_key, visible, access_mode"),
      supabase.from("route_access_summaries").select("role, route_key, view_summary, edit_summary"),
    ]);
    setRows((visRows || []) as RouteVis[]);
    setSummaries((sumRows || []) as SummaryRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh access controls when anyone changes them
  useEffect(() => {
    const ch = supabase
      .channel(`access-controls-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "route_visibility" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "route_access_summaries" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const getMode = (role: AppRole, route: string): AccessMode => {
    const r = rows.find((x) => x.role === role && x.route_key === route);
    if (r?.access_mode === "hidden" || r?.access_mode === "read" || r?.access_mode === "edit") return r.access_mode;
    if (!r) return role === "view_only" ? "read" : "edit";
    return r.visible ? (role === "view_only" ? "read" : "edit") : "hidden";
  };

  const setMode = async (role: AppRole, route: string, next: AccessMode) => {
    const key = `${role}:${route}`;
    setSaving(key);
    const visible = next !== "hidden";
    const existing = rows.find((r) => r.role === role && r.route_key === route);
    if (existing) {
      const { error } = await supabase
        .from("route_visibility")
        .update({ visible, access_mode: next })
        .eq("role", role)
        .eq("route_key", route);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("route_visibility")
        .insert([{ role, route_key: route, visible, access_mode: next }]);
      if (error) toast.error(error.message);
    }
    setRows((prev) => {
      const copy = prev.filter((r) => !(r.role === role && r.route_key === route));
      copy.push({ role, route_key: route, visible, access_mode: next });
      return copy;
    });
    setSaving(null);
    toast.success(`${ROUTE_LABELS[route] || route} → ${MODE_LABELS[next]}`);
  };

  const getSelected = (role: AppRole, route: string): { view: string[]; edit: string[] } => {
    const row = summaries.find((s) => s.role === role && s.route_key === route);
    if (row) return { view: splitTokens(row.view_summary), edit: splitTokens(row.edit_summary) };
    const def = DEFAULT_SUMMARY[role]?.[route];
    return { view: def?.view ?? [], edit: def?.edit ?? [] };
  };

  const persistSummary = async (role: AppRole, route: string, field: "view" | "edit", value: string) => {
    const existing = summaries.find((s) => s.role === role && s.route_key === route);
    const payload = {
      role,
      route_key: route,
      view_summary: field === "view" ? value : (existing?.view_summary ?? ""),
      edit_summary: field === "edit" ? value : (existing?.edit_summary ?? ""),
    };
    if (existing) {
      const { error } = await supabase
        .from("route_access_summaries").update(payload)
        .eq("role", role).eq("route_key", route);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("route_access_summaries").insert([payload]);
      if (error) { toast.error(error.message); return; }
    }
    setSummaries((prev) => {
      const copy = prev.filter((s) => !(s.role === role && s.route_key === route));
      copy.push(payload as SummaryRow);
      return copy;
    });
  };

  const toggleOption = async (role: AppRole, route: string, field: "view" | "edit", option: string) => {
    const current = getSelected(role, route)[field];
    const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
    await persistSummary(role, route, field, joinTokens(next));
  };

  const refreshScope = useCallback(async () => {
    setScopeLoading(true);
    // For each demo persona, count visible deals using the same logic as useDealAccess
    const PERSONAS: { name: string; person_id: string; role: "VSD" | "BOPM" }[] = [
      { name: "Aditya Shaw",       person_id: "P437", role: "VSD" },
      { name: "Neema Jayadas",     person_id: "P378", role: "VSD" },
      { name: "Aamir Khan",        person_id: "P112", role: "VSD" },
      { name: "Sumit Shekhawat",   person_id: "P308", role: "VSD" },
      { name: "Sneha Iyer",        person_id: "P064", role: "VSD" },
      { name: "Ritu Priya",        person_id: "P579", role: "BOPM" },
      { name: "Tiffany Fernandes", person_id: "P148", role: "BOPM" },
      { name: "Shreshtha Pathak",  person_id: "P543", role: "BOPM" },
    ];

    const [{ data: deals }, { data: profiles }] = await Promise.all([
      supabase.from("staffing_deals").select("id, vsd, principal_bopm, senior_bopm, bopm"),
      supabase.from("profiles").select("user_id, display_name, staffing_person_id"),
    ]);
    const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();
    const out: typeof scope = [];
    for (const p of PERSONAS) {
      const me = norm(p.name);
      let count = 0;
      if (p.role === "VSD") {
        // pod-wide via deal.vsd OR deal's BOPM reports to this VSD
        const pod = new Set<string>();
        (deals || []).forEach((d: any) => {
          if (norm(d.vsd) === me) {
            if (d.principal_bopm) pod.add(norm(d.principal_bopm));
            if (d.senior_bopm) pod.add(norm(d.senior_bopm));
          }
        });
        (deals || []).forEach((d: any) => {
          if (norm(d.vsd) === me) { count++; return; }
          const pk = norm(d.principal_bopm), sk = norm(d.senior_bopm);
          if ((pk && pod.has(pk)) || (sk && pod.has(sk))) count++;
        });
      } else {
        (deals || []).forEach((d: any) => {
          if (norm(d.principal_bopm) === me || norm(d.senior_bopm) === me || norm(d.bopm) === me) count++;
        });
      }
      const linkedProfiles = (profiles || []).filter((pr: any) => pr.staffing_person_id === p.person_id);
      const orphan = (profiles || []).some((pr: any) => norm(pr.display_name) === me && !pr.staffing_person_id);
      out.push({
        name: p.name,
        role: p.role,
        person_id: linkedProfiles.length ? p.person_id : null,
        deals: count,
        status: count > 0 && linkedProfiles.length > 0 && !orphan ? "ok" : "warn",
      });
    }
    setScope(out);
    setScopeLoading(false);
  }, []);

  useEffect(() => { refreshScope(); }, [refreshScope]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const visibleCount = (role: AppRole) =>
    ALL_ROUTE_KEYS.filter((rk) => getMode(role, rk) !== "hidden").length;
  const editCount = (role: AppRole) =>
    ALL_ROUTE_KEYS.filter((rk) => getMode(role, rk) === "edit").length;

  const CapabilityCell = ({ route, field, disabled }: { route: string; field: "view" | "edit"; disabled?: boolean }) => {
    const selected = getSelected(activePersona, route)[field];
    const options = (field === "view" ? VIEW_OPTIONS : EDIT_OPTIONS)[route] || [];
    const label =
      selected.length === 0
        ? <span className="italic text-muted-foreground">No specifics</span>
        : selected.length <= 2 ? selected.join(", ") : `${selected.slice(0, 2).join(", ")} +${selected.length - 2} more`;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 w-full text-left rounded border border-border/60 bg-background px-2 py-1.5 text-xs hover:bg-muted/40 transition-colors",
              disabled && "opacity-40 cursor-not-allowed",
            )}
          >
            <span className="flex-1 truncate">{label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            {field === "view" ? "Can view" : "Can edit"} · {ROUTE_LABELS[route] || route}
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5 pt-1">
            {options.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <label key={opt} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={() => toggleOption(activePersona, route, field, opt)} />
                  <span className="text-xs">{opt}</span>
                </label>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-border mt-1 pt-1 px-2 flex justify-end">
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => persistSummary(activePersona, route, field, "")}>
                Clear all
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Access Controls</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          For every section, choose whether each persona sees it as <strong>Hidden</strong>, <strong>View only</strong>, or <strong>Editable</strong>.
          Changes apply across the app immediately. The Viewer persona is meant for read-only consumers.
        </p>
      </div>

      {/* Persona pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {PERSONA_COLUMNS.map((p) => {
          const Icon = p.icon;
          const isActive = activePersona === p.role;
          return (
            <button
              key={p.role}
              type="button"
              onClick={() => setActivePersona(p.role)}
              aria-pressed={isActive}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                isActive ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/40",
              )}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md",
                isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{p.label}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {visibleCount(p.role)} visible · {editCount(p.role)} editable
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
        Need to grant a single person stricter or looser access than their persona? Open <strong>Users &amp; Roles</strong> → <strong>Customize</strong> next to that user.
      </div>

      {/* Per-persona section list */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            {(() => {
              const p = PERSONA_COLUMNS.find((x) => x.role === activePersona)!;
              const Icon = p.icon;
              return (
                <>
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground">{p.label} access</div>
                    <div className="text-[11px] text-muted-foreground">{p.sublabel}</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium w-44">Section</th>
              <th className="text-left px-3 py-2 font-medium w-[260px]">Access</th>
              <th className="text-left px-3 py-2 font-medium"><Eye className="h-3 w-3 inline mr-1" /> Can view</th>
              <th className="text-left px-3 py-2 font-medium"><Pencil className="h-3 w-3 inline mr-1" /> Can edit</th>
            </tr>
          </thead>
          <tbody>
            {ALL_ROUTE_KEYS.map((route) => {
              const key = `${activePersona}:${route}`;
              const mode = getMode(activePersona, route);
              const isHidden = mode === "hidden";
              return (
                <tr key={route} className="border-b border-border/50 align-top">
                  <td className="px-3 py-2 text-xs font-medium text-foreground">{ROUTE_LABELS[route] || route}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {(["hidden","read","edit"] as AccessMode[]).map((m) => (
                        <ModeChip
                          key={m}
                          mode={m}
                          active={mode === m}
                          onClick={() => setMode(activePersona, route, m)}
                          disabled={saving === key}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2"><CapabilityCell route={route} field="view" disabled={isHidden} /></td>
                  <td className="px-3 py-2"><CapabilityCell route={route} field="edit" disabled={mode !== "edit"} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cross-persona access matrix */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-foreground uppercase tracking-wider">All personas, side-by-side</h3>
          <span className="text-[11px] text-muted-foreground">Click a chip to change</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Section</th>
                {PERSONA_COLUMNS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <th key={p.role} className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider w-44 text-muted-foreground cursor-pointer" onClick={() => setActivePersona(p.role)}>
                      <div className="flex items-center justify-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" /> {p.label}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ALL_ROUTE_KEYS.map((route) => (
                <tr key={route} className="border-b border-border/50">
                  <td className="px-3 py-2 text-xs font-medium text-foreground">{ROUTE_LABELS[route] || route}</td>
                  {PERSONA_COLUMNS.map((p) => {
                    const m = getMode(p.role, route);
                    const key = `${p.role}:${route}`;
                    return (
                      <td key={p.role} className="px-3 py-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          {(["hidden","read","edit"] as AccessMode[]).map((opt) => (
                            <ModeChip
                              key={opt}
                              mode={opt}
                              active={m === opt}
                              onClick={() => setMode(p.role, route, opt)}
                              disabled={saving === key}
                            />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Persona scope diagnostics */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-secondary/40">
          <div>
            <div className="text-xs font-semibold text-foreground">Persona scope preview</div>
            <div className="text-[11px] text-muted-foreground">How many deals each demo persona can currently see, and whether their login is wired up correctly.</div>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={refreshScope} disabled={scopeLoading}>
            {scopeLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Refresh
          </Button>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-secondary/20 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Person</th>
              <th className="px-3 py-2 text-left font-medium">Role</th>
              <th className="px-3 py-2 text-left font-medium">Linked staffing ID</th>
              <th className="px-3 py-2 text-right font-medium">Visible deals</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {scope.map((r) => (
              <tr key={r.name} className="border-t border-border/50">
                <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.role}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.person_id || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{r.deals}</td>
                <td className="px-3 py-2">
                  {r.status === "ok" ? (
                    <span className="inline-flex items-center gap-1 text-positive text-[11px]"><CheckCircle2 className="h-3 w-3" /> OK</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-warning-foreground text-[11px]"><AlertTriangle className="h-3 w-3" /> Check linking / scope</span>
                  )}
                </td>
              </tr>
            ))}
            {scope.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Click Refresh to compute persona scopes.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
