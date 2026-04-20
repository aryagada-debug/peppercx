import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, Users, UserCheck, DollarSign,
  Target, Activity, FileText, MessageSquare, Clock,
  CheckSquare, Settings, Building2, Calculator, BarChart3,
  ChevronDown, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";

const navSections = [
  {
    label: "Core",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard", routeKey: "dashboard" },
      { to: "/clients", icon: Building2, label: "Clients & Deals", routeKey: "clients" },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/staffing", icon: UserCheck, label: "Staffing & Capacity", routeKey: "staffing" },
      { to: "/revenue", icon: DollarSign, label: "Revenue", routeKey: "revenue" },
      { to: "/targets", icon: Target, label: "Targets", routeKey: "targets" },
      { to: "/central-cx", icon: ShieldCheck, label: "Central Cx", routeKey: "central-cx" },
    ],
  },
  {
    label: "Health & Reviews",
    items: [
      { to: "/rgy-health", icon: Activity, label: "RGY Health", routeKey: "rgy-health" },
      { to: "/mbr-tracker", icon: FileText, label: "MBR Tracker", routeKey: "mbr-tracker" },
      { to: "/slack-health", icon: MessageSquare, label: "Slack Health", routeKey: "slack-health" },
      { to: "/onboarding", icon: CheckSquare, label: "Onboarding", routeKey: "onboarding" },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/deal-desk", icon: BarChart3, label: "Deal Desk", routeKey: "deal-desk" },
      { to: "/seo-staffing", icon: Users, label: "SEO Staffing", routeKey: "seo-staffing" },
      { to: "/gm2-calculator", icon: Calculator, label: "GM2 Calculator", routeKey: "gm2-calculator" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/settings", icon: Settings, label: "Settings", routeKey: "settings" },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { visibleRoutes, loading } = useUserRole();

  const toggle = (label: string) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Filter sections based on role visibility
  const filteredSections = navSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => loading || visibleRoutes.has(item.routeKey)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <aside className="w-60 h-screen border-r border-sidebar-border bg-sidebar flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="h-14 flex items-center px-5 border-b border-sidebar-border">
        <span className="text-base font-bold tracking-tight text-foreground">Pepper</span>
        <span className="ml-1.5 text-caption text-primary font-semibold">OS</span>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-1">
        {filteredSections.map((section) => (
          <div key={section.label}>
            <button
              onClick={() => toggle(section.label)}
              className="flex items-center justify-between w-full px-2 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              {section.label}
              <ChevronDown className={cn("h-3 w-3 transition-transform", collapsed[section.label] && "-rotate-90")} />
            </button>
            {!collapsed[section.label] && (
              <div className="space-y-0.5 mb-2">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-ui transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                      )
                    }
                    end={item.to === "/"}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-caption font-semibold">
            AK
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ui font-medium truncate text-foreground">Admin User</p>
            <p className="text-caption text-muted-foreground truncate">Central CX</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
