import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ALL_ROUTE_KEYS, ROLE_LABELS, type AppRole } from "@/hooks/useUserRole";

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

const ROLE_COLUMNS: AppRole[] = ["view_only", "user", "member", "admin"];

export function AccessControlsTab() {
  const [rows, setRows] = useState<RouteVis[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Access Controls</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Toggle which sections each role can see by default.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
        Need to grant a single person <strong>edit</strong> access on a section their role can only read (or vice-versa)?
        Open <strong>Users &amp; Roles</strong> → <strong>Customize</strong> next to that user. Per-user overrides support
        Hidden / Read-only / Editable per section without changing their role.
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Section
              </th>
              {ROLE_COLUMNS.map((role) => (
                <th key={role} className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground w-28">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_ROUTE_KEYS.map((route) => (
              <tr key={route} className="border-b border-border/50">
                <td className="px-3 py-2 text-xs font-medium text-foreground">{ROUTE_LABELS[route] || route}</td>
                {ROLE_COLUMNS.map((role) => {
                  const key = `${role}:${route}`;
                  return (
                    <td key={role} className="px-3 py-2 text-center">
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
  );
}
