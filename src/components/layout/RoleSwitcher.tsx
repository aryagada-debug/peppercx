import { useLayoutEffect, useRef, useState } from "react";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { ShieldCheck, Briefcase, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Persona = {
  key: "admin" | "vsd" | "bopm";
  label: string;
  icon: typeof ShieldCheck;
  /** AppRole to apply via setViewAsRole (null = no override → use true admin role) */
  viewAs: AppRole | null;
};

const PERSONAS: Persona[] = [
  { key: "admin", label: "Admin", icon: ShieldCheck, viewAs: null },
  { key: "vsd", label: "VSD", icon: Briefcase, viewAs: "member" },
  { key: "bopm", label: "BOPMs/Creative", icon: Users, viewAs: "user" },
];

function activePersonaKey(viewAsRole: AppRole | null): Persona["key"] {
  if (!viewAsRole) return "admin";
  if (viewAsRole === "member") return "vsd";
  return "bopm";
}

export function RoleSwitcher() {
  const { isActuallyAdmin, viewAsRole, setViewAsRole } = useUserRole();
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const activeKey = activePersonaKey(viewAsRole);

  useLayoutEffect(() => {
    const btn = btnRefs.current[activeKey];
    const container = containerRef.current;
    if (!btn || !container) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setIndicator({ left: bRect.left - cRect.left, width: bRect.width });
  }, [activeKey]);

  if (!isActuallyAdmin) return null;

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-xs"
    >
      {indicator && (
        <div
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-sm bg-primary transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      {PERSONAS.map((p) => {
        const Icon = p.icon;
        const isActive = p.key === activeKey;
        return (
          <button
            key={p.key}
            ref={(el) => (btnRefs.current[p.key] = el)}
            onClick={() => setViewAsRole(p.viewAs)}
            className={cn(
              "relative z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-sm transition-colors duration-300",
              isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            title={`View as ${p.label}`}
            type="button"
          >
            <Icon className="h-3.5 w-3.5" />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
