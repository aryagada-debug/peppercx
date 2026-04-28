import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Briefcase, Users, Eye, Pencil, Check, X } from "lucide-react";
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

// Personas mirror the top-bar role switcher (Admin / VSD / BOPMs · Creative).
const PERSONA_COLUMNS: PersonaCol[] = [
  { role: "admin",  label: "Admin",          sublabel: "Full access",    icon: ShieldCheck },
  { role: "member", label: "VSD",            sublabel: "Vertical leads", icon: Briefcase },
  { role: "user",   label: "BOPMs/Creative", sublabel: "Delivery teams", icon: Users },
];

// Sensible defaults shown when no row exists yet in route_access_summaries.
const DEFAULT_SUMMARY: Record<AppRole, Partial<Record<string, { view: string; edit: string }>>> = {
  admin: {},
  member: {
    "clients":     { view: "All clients & deals across pods.", edit: "Own pod's deals, RGY, staffing, financials." },
    "rgy-health":  { view: "Full RGY board for own pod.",      edit: "Mark RGY, log issues & action plans." },
    "mbr-tracker": { view: "MBR status for own pod's deals.",  edit: "Schedule MBRs, upload notes, mark done." },
    "staffing":    { view: "All allocations.",                 edit: "Assign / unassign people on own deals." },
    "revenue":     { view: "Pod-level revenue.",               edit: "Read-only." },
  },
  user: {
    "clients":     { view: "Deals you are staffed on.",        edit: "Update fields on your own deals." },
    "rgy-health":  { view: "Your deals' RGY snapshot.",        edit: "Mark capability RGY (SEO/Creative)." },
    "mbr-tracker": { view: "MBRs for your deals.",             edit: "Add notes / action items." },
    "staffing":    { view: "Your allocations.",                edit: "Read-only." },
  },
  view_only: {},
};

export function AccessControlsTab() {
  const [rows, setRows] = useState<RouteVis[]>([]);
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<AppRole>("member");
  const [editing, setEditing] = useState<{ route: string; field: "view" | "edit" } | null>(null);
  const [draft, setDraft] = useState<string>("");

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

  const getSummary = (role: AppRole, route: string) => {
    const row = summaries.find((s) => s.role === role && s.route_key === route);
    const def = DEFAULT_SUMMARY[role]?.[route];
    return {
      view: row?.view_summary ?? def?.view ?? "",
      edit: row?.edit_summary ?? def?.edit ?? "",
    };
  };

  const saveSummary = async (role: AppRole, route: string, field: "view" | "edit", value: string) => {
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
    toast.success("Summary saved");
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Access Controls</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Toggle which sections each persona can see by default, and document what they can view vs edit. Personas match the
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

      {/* Per-persona section list with editable view/edit summaries */}
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
              const sum = getSummary(activePersona, route);
              const renderCell = (field: "view" | "edit", value: string) => {
                const isEditing = editing?.route === route && editing?.field === field;
                if (isEditing) {
                  return (
                    <div className="space-y-1.5">
                      <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="min-h-[60px] text-xs"
                        autoFocus
                        placeholder={field === "view" ? "What can this persona see?" : "What can this persona change?"}
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-6 px-2 text-[11px]"
                          onClick={async () => {
                            await saveSummary(activePersona, route, field, draft);
                            setEditing(null);
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" /> Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => setEditing(null)}
                        >
                          <X className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  );
                }
                return (
                  <button
                    type="button"
                    onClick={() => { setEditing({ route, field }); setDraft(value); }}
                    className="group flex items-start gap-1.5 text-left w-full hover:bg-muted/30 rounded px-1.5 py-1 -mx-1.5 -my-1"
                    title="Click to edit"
                  >
                    <span className={cn("flex-1 text-xs", value ? "text-foreground" : "text-muted-foreground italic")}>
                      {value || "Add summary…"}
                    </span>
                    <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-0.5 shrink-0" />
                  </button>
                );
              };

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
                  <td className={cn("px-3 py-2", !checked && "opacity-50")}>
                    {renderCell("view", sum.view)}
                  </td>
                  <td className={cn("px-3 py-2", !checked && "opacity-50")}>
                    {renderCell("edit", sum.edit)}
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
