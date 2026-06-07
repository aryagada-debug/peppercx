import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, Users, UserCheck, DollarSign,
  Target, Activity, FileText, MessageSquare, Clock,
  CheckSquare, Settings, Building2, BookOpen, Contact,
  ChevronDown, Home, ChevronsLeft, ChevronsRight,
  Trash2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsLeadershipViewer } from "@/hooks/useIsLeadershipViewer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Prefetch lazy route chunks on hover/focus so clicking a sidebar item
// feels instant instead of waiting on the Suspense fallback.
const routePrefetch: Record<string, () => Promise<unknown>> = {
  "/home": () => import("@/pages/Home"),
  "/": () => import("@/pages/Index"),
  "/clients": () => import("@/pages/Clients"),
  "/staffing": () => import("@/pages/Staffing"),
  "/people-ops": () => import("@/pages/PeopleOps"),
  "/targets": () => import("@/pages/Targets"),
  "/rgy-health": () => import("@/pages/RGYHealth"),
  "/mbr-tracker": () => import("@/pages/MBRTracker"),
  "/settings": () => import("@/pages/Settings"),
  "/help": () => import("@/pages/Help"),
  "/trash": () => import("@/pages/Trash"),
  "/contacts": () => import("@/pages/Contacts"),
  "/leadership-interventions": () => import("@/pages/LeadershipInterventions"),
};
const prefetched = new Set<string>();
const prefetchRoute = (to: string) => {
  if (prefetched.has(to)) return;
  const loader = routePrefetch[to];
  if (!loader) return;
  prefetched.add(to);
  loader().catch(() => prefetched.delete(to));
};

const navSections = [
  {
    label: "Core",
    items: [
      { to: "/home", icon: Home, label: "Home", routeKey: "home" },
      { to: "/clients", icon: Building2, label: "Clients & Deals", routeKey: "clients" },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/staffing", icon: UserCheck, label: "Staffing & Capacity", routeKey: "staffing" },
      { to: "/people-ops", icon: Users, label: "People Ops", routeKey: "people-ops" },
    ],
  },
  {
    label: "Health & Reviews",
    items: [
      { to: "/rgy-health", icon: Activity, label: "RGY Health", routeKey: "rgy-health" },
      { to: "/mbr-tracker", icon: FileText, label: "MBR Tracker", routeKey: "mbr-tracker" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/settings", icon: Settings, label: "Settings", routeKey: "settings" },
      { to: "/help", icon: BookOpen, label: "Help & Guide", routeKey: "home" },
      { to: "/trash", icon: Trash2, label: "Trash", routeKey: "settings" },
    ],
  },
];

const COLLAPSE_KEY = "pepper.sidebar.collapsed";

export function AppSidebar() {
  const location = useLocation();
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  const { visibleRoutes, loading, isAdmin, isActuallyAdmin } = useUserRole();
  const isLeader = useIsLeadershipViewer();

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const toggleGroup = (label: string) => {
    setGroupCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const sectionsWithAdmin = navSections.map(section => {
    if (section.label === "Core") {
      return {
        ...section,
        items: (isAdmin || isActuallyAdmin)
          ? [...section.items, { to: "/contacts", icon: Contact, label: "Contacts", routeKey: "home" }]
          : section.items,
      };
    }
    if (section.label === "Health & Reviews" && isLeader) {
      return {
        ...section,
        items: [
          ...section.items,
          { to: "/leadership-interventions", icon: AlertTriangle, label: "Leadership Interventions", routeKey: "home" },
        ],
      };
    }
    return section;
  });

  const filteredSections = sectionsWithAdmin
    .map(section => ({
      ...section,
      items: section.items.filter(item => loading || visibleRoutes.has(item.routeKey)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "h-screen border-r border-sidebar-border bg-sidebar flex flex-col flex-shrink-0 overflow-y-auto transition-[width] duration-200 ease-out",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <div className={cn(
          "h-14 flex items-center border-b border-sidebar-border",
          collapsed ? "px-2 justify-center" : "px-5 justify-between",
        )}>
          {!collapsed && (
            <div className="flex items-baseline">
              <span className="text-base font-bold tracking-tight text-foreground">Pepper</span>
              <span className="ml-1.5 text-caption text-primary font-semibold">OS</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className={cn("flex-1 py-3 space-y-1", collapsed ? "px-1.5" : "px-3")}>
          {filteredSections.map((section) => (
            <div key={section.label}>
              {!collapsed ? (
                <button
                  onClick={() => toggleGroup(section.label)}
                  className="flex items-center justify-between w-full px-2 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                >
                  {section.label}
                  <ChevronDown className={cn("h-3 w-3 transition-transform", groupCollapsed[section.label] && "-rotate-90")} />
                </button>
              ) : (
                <div className="my-2 mx-2 h-px bg-sidebar-border/60" aria-hidden />
              )}

              {(collapsed || !groupCollapsed[section.label]) && (
                <div className={cn("space-y-0.5", collapsed ? "" : "mb-2")}>
                  {section.items.map((item) => {
                    const link = (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onMouseEnter={() => prefetchRoute(item.to)}
                        onFocus={() => prefetchRoute(item.to)}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center rounded-md text-ui transition-colors",
                            collapsed
                              ? "justify-center h-9 w-9 mx-auto"
                              : "gap-2.5 px-2.5 py-1.5",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/50",
                          )
                        }
                        end={item.to === "/"}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    );
                    if (!collapsed) return link;
                    return (
                      <Tooltip key={item.to}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-4")}>
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2.5")}>
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-caption font-semibold">
              AK
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-ui font-medium truncate text-foreground">Admin User</p>
                <p className="text-caption text-muted-foreground truncate">Central CX</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
