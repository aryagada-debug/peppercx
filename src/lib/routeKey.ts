// Maps any path under the app to a stable, sidebar-level route_key so
// per-page analytics aggregate cleanly (e.g. /deals/abc123 → "deal-detail").
export function routeKeyFromPath(pathname: string): string {
  const p = pathname.split("?")[0].split("#")[0];
  if (p === "/" || p === "/home") return "home";
  if (p === "/dashboard") return "home";
  if (p.startsWith("/deals/")) return "deal-detail";
  if (p === "/deals" || p === "/clients") return "clients";
  if (p.startsWith("/staffing")) return "staffing";
  if (p.startsWith("/people-ops")) return "people-ops";
  if (p.startsWith("/targets")) return "targets";
  if (p.startsWith("/rgy-health")) return "rgy-health";
  if (p.startsWith("/mbr-tracker")) return "mbr-tracker";
  if (p.startsWith("/onboarding")) return "onboarding";
  if (p.startsWith("/settings")) return "settings";
  if (p.startsWith("/help")) return "help";
  if (p.startsWith("/trash")) return "trash";
  if (p.startsWith("/login") || p.startsWith("/signup") || p.startsWith("/forgot-password") || p.startsWith("/reset-password") || p.startsWith("/calendar/")) {
    return "auth";
  }
  // Fallback: first segment.
  const seg = p.split("/").filter(Boolean)[0] || "unknown";
  return seg;
}

export const ROUTE_KEY_LABELS: Record<string, string> = {
  home: "Home",
  clients: "Clients & Deals",
  "deal-detail": "Deal Detail",
  staffing: "Staffing",
  "people-ops": "People Ops",
  targets: "Targets",
  "rgy-health": "RGY Health",
  "mbr-tracker": "MBR Tracker",
  onboarding: "Onboarding",
  settings: "Settings",
  help: "Help",
  trash: "Trash",
  auth: "Auth",
};

export function routeKeyLabel(key: string): string {
  return ROUTE_KEY_LABELS[key] || key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}