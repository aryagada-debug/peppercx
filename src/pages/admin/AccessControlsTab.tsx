import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react";
import { toast } from "sonner";
import { ALL_ROUTE_KEYS, type AppRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
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

type RouteVis = { role: AppRole; route_key: string; visible: boolean };
type SummaryRow = { role: AppRole; route_key: string; view_summary: string; edit_summary: string };

type PersonaCol = {
  role: AppRole;
  label: string;
  sublabel: string;
  icon: typeof ShieldCheck;
};

const PERSONA_COLUMNS: PersonaCol[] = [
  { role: "admin",  label: "Admin",          sublabel: "Full access",    icon: ShieldCheck },
  { role: "member", label: "VSD",            sublabel: "Vertical leads", icon: Briefcase },
  { role: "user",   label: "BOPMs/Creative", sublabel: "Delivery teams", icon: Users },
];

// Capability options surfaced in the Can-view / Can-edit dropdowns, per section.
// Selections are persisted as a comma-joined string in route_access_summaries.
const VIEW_OPTIONS: Record<string, string[]> = {
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

// Sensible defaults shown when no row exists yet in route_access_summaries.
const DEFAULT_SUMMARY: Record<AppRole, Partial<Record<string, { view: string[]; edit: string[] }>>> = {
  admin: {},
  member: {
    "clients":     { view: ["All clients", "Financial summary"], edit: ["Edit own deals", "Edit financials", "Edit RGY", "Edit staffing"] },
    "rgy-health":  { view: ["Own pod RGY", "Issue history"],     edit: ["Mark RGY (own deals)", "Log issues & action plans"] },
    "mbr-tracker": { view: ["Own pod MBRs"],                     edit: ["Schedule MBRs", "Upload notes", "Mark done"] },
    "staffing":    { view: ["All allocations"],                  edit: ["Assign people (own deals)", "Edit allocations"] },
    "revenue":     { view: ["Pod revenue"],                      edit: ["No edit access"] },
  },
  user: {
    "clients":     { view: ["Own deals only", "Financial summary"],
                     edit: ["Edit own deals"] },
    "rgy-health":  { view: ["Own deals RGY", "Table view only (no insights)", "Issue history"],
                     edit: ["Mark RGY (own deals)", "Log issues & action plans"] },
    "mbr-tracker": { view: ["Own deals MBRs", "Table view only (no MoM / Trend)", "Notes & transcripts"],
                     edit: ["Schedule MBRs", "Upload notes", "Mark done"] },
    "staffing":    { view: ["Own deals staffing", "Own allocations only", "People & Matrix only (no Deal view)"],
                     edit: ["Assign people (own deals)", "Edit allocations"] },
  },
  view_only: {},
};

export function AccessControlsTab() {
  const [rows, setRows] = useState<RouteVis[]>([]);
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<AppRole>("member");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: visRows }, { data: sumRows }] = await Promise.all([
      supabase.from("route_visibility").select("role, route_key, visible"),
      supabase.from("route_access_summaries").select("role, route_key, view_summary, edit_summary"),
    ]);
    setRows((visRows || []) as RouteVis[]);
    setSummaries((sumRows || []) as SummaryRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const isVisible = (role: AppRole, route: string) =>
    rows.find((r) => r.role === role && r.route_key === route)?.visible ?? false;

  const toggle = async (role: AppRole, route: string, next: boolean) => {
    const key = `${role}:${route}`;
    setSaving(key);
    const existing = rows.find((r) => r.role === role && r.route_key === route);
    if (existing) {
      const { error } = await supabase
        .from("route_visibility")
        .update({ visible: next })
        .eq("role", role)
        .eq("route_key", route);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("route_visibility")
        .insert([{ role, route_key: route, visible: next }]);
      if (error) toast.error(error.message);
    }
    setRows((prev) => {
      const copy = prev.filter((r) => !(r.role === role && r.route_key === route));
      copy.push({ role, route_key: route, visible: next });
      return copy;
    });
    setSaving(null);
    toast.success("Access updated");
  };

  const getSelected = (role: AppRole, route: string): { view: string[]; edit: string[] } => {
    const row = summaries.find((s) => s.role === role && s.route_key === route);
    if (row) {
      return { view: splitTokens(row.view_summary), edit: splitTokens(row.edit_summary) };
    }
    const def = DEFAULT_SUMMARY[role]?.[route];
    return { view: def?.view ?? [], edit: def?.edit ?? [] };
  };

  const persistSummary = async (
    role: AppRole,
    route: string,
    field: "view" | "edit",
    value: string,
  ) => {
    const existing = summaries.find((s) => s.role === role && s.route_key === route);
    const payload = {
      role,
      route_key: route,
      view_summary: field === "view" ? value : (existing?.view_summary ?? ""),
      edit_summary: field === "edit" ? value : (existing?.edit_summary ?? ""),
    };
    if (existing) {
      const { error } = await supabase
        .from("route_access_summaries")
        .update(payload)
        .eq("role", role)
        .eq("route_key", route);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase
        .from("route_access_summaries")
        .insert([payload]);
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
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    await persistSummary(role, route, field, joinTokens(next));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const visibleCount = (role: AppRole) =>
    ALL_ROUTE_KEYS.filter((rk) => isVisible(role, rk)).length;
  const totalRoutes = ALL_ROUTE_KEYS.length;

  // Reusable cell: a popover trigger button that summarises selected options;
  // the popover body is a checklist of all available capabilities for this section/field.
  const CapabilityCell = ({
    route,
    field,
    disabled,
  }: {
    route: string;
    field: "view" | "edit";
    disabled?: boolean;
  }) => {
    const selected = getSelected(activePersona, route)[field];
    const options = (field === "view" ? VIEW_OPTIONS : EDIT_OPTIONS)[route] || [];
    const label =
      selected.length === 0
        ? <span className="italic text-muted-foreground">No access selected</span>
        : selected.length <= 2
          ? selected.join(", ")
          : `${selected.slice(0, 2).join(", ")} +${selected.length - 2} more`;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 w-full text-left rounded border border-border/60 bg-background px-2 py-1.5 text-xs hover:bg-muted/40 transition-colors",
              disabled && "opacity-50 cursor-not-allowed",
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
                <label
                  key={opt}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleOption(activePersona, route, field, opt)}
                  />
                  <span className="text-xs">{opt}</span>
                </label>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-border mt-1 pt-1 px-2 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() => persistSummary(activePersona, route, field, "")}
              >
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
          Toggle which sections each persona can see by default, and pick exactly which capabilities they can view and edit. Personas match the
          <span className="font-medium text-foreground"> Admin / VSD / BOPMs · Creative</span> switcher in the top bar.
        </p>
      </div>

      {/* Persona summary pills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                  {visibleCount(p.role)}/{totalRoutes} sections · {p.sublabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
        Need to grant a single person <strong>edit</strong> access on a section their role can only read (or vice-versa)?
        Open <strong>Users &amp; Roles</strong> → <strong>Customize</strong> next to that user.
      </div>

      {/* Per-persona section list with capability dropdowns */}
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
          <div className="text-[11px] text-muted-foreground">
            {visibleCount(activePersona)} of {totalRoutes} sections enabled
          </div>
        </div>

        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium w-44">Section</th>
              <th className="text-center px-3 py-2 font-medium w-20">Access</th>
              <th className="text-left px-3 py-2 font-medium">
                <Eye className="h-3 w-3 inline mr-1" /> Can view
              </th>
              <th className="text-left px-3 py-2 font-medium">
                <Pencil className="h-3 w-3 inline mr-1" /> Can edit
              </th>
            </tr>
          </thead>
          <tbody>
            {ALL_ROUTE_KEYS.map((route) => {
              const key = `${activePersona}:${route}`;
              const checked = isVisible(activePersona, route);
              return (
                <tr key={route} className="border-b border-border/50 align-top">
                  <td className="px-3 py-2 text-xs font-medium text-foreground">
                    {ROUTE_LABELS[route] || route}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch
                      checked={checked}
                      onCheckedChange={(v) => toggle(activePersona, route, v)}
                      disabled={saving === key}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <CapabilityCell route={route} field="view" disabled={!checked} />
                  </td>
                  <td className="px-3 py-2">
                    <CapabilityCell route={route} field="edit" disabled={!checked} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Compact cross-persona matrix (visibility only) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-foreground uppercase tracking-wider">Visibility matrix</h3>
          <span className="text-[11px] text-muted-foreground">All personas, side-by-side</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Section
                </th>
                {PERSONA_COLUMNS.map((p) => {
                  const Icon = p.icon;
                  const isActive = activePersona === p.role;
                  return (
                    <th
                      key={p.role}
                      className={cn(
                        "px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider w-32 cursor-pointer",
                        isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => setActivePersona(p.role)}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        {p.label}
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
                    const role = p.role;
                    const key = `${role}:${route}`;
                    const isActive = activePersona === role;
                    return (
                      <td key={role} className={cn("px-3 py-2 text-center", isActive && "bg-primary/5")}>
                        <Switch
                          checked={isVisible(role, route)}
                          onCheckedChange={(v) => toggle(role, route, v)}
                          disabled={saving === key}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
