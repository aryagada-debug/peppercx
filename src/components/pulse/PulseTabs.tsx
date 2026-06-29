import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export function PulseTabs() {
  const base = "px-3 py-1.5 rounded-md text-xs font-medium transition-colors";
  return (
    <div className="inline-flex gap-0.5 bg-secondary rounded-lg p-0.5">
      <NavLink
        to="/pulse-nps"
        end
        className={({ isActive }) =>
          cn(base, isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
        }
      >
        Send
      </NavLink>
      <NavLink
        to="/pulse-nps/analytics"
        className={({ isActive }) =>
          cn(base, isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
        }
      >
        Analytics
      </NavLink>
    </div>
  );
}