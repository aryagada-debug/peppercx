import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Loader2, ShieldCheck, Briefcase, Users, Eye } from "lucide-react";
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

type PersonaCol = {
  role: AppRole;
  label: string;
  sublabel: string;
  icon: typeof ShieldCheck;
};

// Personas mirror the top-bar role switcher (Admin / VSD / BOPMs/Creative),
// plus a "View Only" column for read-only stakeholders.
const PERSONA_COLUMNS: PersonaCol[] = [
  { role: "admin",     label: "Admin",          sublabel: "Full access",       icon: ShieldCheck },
  { role: "member",    label: "VSD",            sublabel: "Vertical leads",    icon: Briefcase },
  { role: "user",      label: "BOPMs/Creative", sublabel: "Delivery teams",    icon: Users },
  { role: "view_only", label: "View Only",      sublabel: "Read-only guests",  icon: Eye },
];

export function AccessControlsTab() {
  const [rows, setRows] = useState<RouteVis[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<AppRole>("member");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("route_visibility").select("role, route_key, visible");
    setRows((data || []) as RouteVis[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isVisible = (role: AppRole, route: string) =>
    rows.find((r) => r.role === role && r.route_key === route)?.visible ?? false;

  const toggle = async (role: AppRole, route: string, next: boolean) => {
    const key = `${role}:${route}`;
    setSaving(key);
    // upsert via update; if no row exists, insert
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Counts of visible sections per persona — used in the persona pills.
  const visibleCount = (role: AppRole) =>
    ALL_ROUTE_KEYS.filter((rk) => isVisible(role, rk)).length;
  const totalRoutes = ALL_ROUTE_KEYS.length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Access Controls</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Toggle which sections each persona can see by default. Personas match the
          <span className="font-medium text-foreground"> Admin / VSD / BOPMs · Creative</span> switcher in the top bar.
        </p>
      </div>

      {/* Persona summary pills — also act as the focus filter for the per-persona view below */}
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
                isActive
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted/40",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md",
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
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
        Open <strong>Users &amp; Roles</strong> → <strong>Customize</strong> next to that user. Per-user overrides support
        Hidden / Read-only / Editable per section without changing their role.
      </div>

      {/* Per-persona focused view: large toggles for the currently selected persona */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {ALL_ROUTE_KEYS.map((route) => {
            const key = `${activePersona}:${route}`;
            const checked = isVisible(activePersona, route);
            return (
              <label
                key={route}
                className="flex items-center justify-between gap-2 bg-card px-3 py-2 cursor-pointer hover:bg-muted/30"
              >
                <span className="text-xs text-foreground truncate">{ROUTE_LABELS[route] || route}</span>
                <Switch
                  checked={checked}
                  onCheckedChange={(v) => toggle(activePersona, route, v)}
                  disabled={saving === key}
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Full matrix — kept for cross-persona comparison */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-foreground uppercase tracking-wider">Full matrix</h3>
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
