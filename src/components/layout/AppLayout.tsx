import { AppSidebar } from "./AppSidebar";
import { GlobalSearch } from "@/components/dashboard/GlobalSearch";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { UserMenu } from "@/components/auth/UserMenu";
import { ApprovalsBadge } from "@/components/approvals/ApprovalsBadge";
import { RoleSwitcher } from "./RoleSwitcher";
import type { RGYRow } from "@/types/dashboard";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect, useState } from "react";

interface AppLayoutProps {
  children: React.ReactNode;
  onSearchSelectDeal?: (deal: RGYRow) => void;
}

export function AppLayout({ children, onSearchSelectDeal }: AppLayoutProps) {
  const { viewAsRole } = useUserRole();
  const [fading, setFading] = useState(false);

  useEffect(() => {
    setFading(true);
    const t = setTimeout(() => setFading(false), 180);
    return () => clearTimeout(t);
  }, [viewAsRole]);

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-3 md:px-4 h-12 border-b border-border shrink-0">
          <div />
          <div className="flex items-center gap-2">
            <RoleSwitcher />
            <GlobalSearch onSelectDeal={onSearchSelectDeal} />
            <ApprovalsBadge />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div
            className="w-full transition-opacity duration-200 ease-out"
            style={{ opacity: fading ? 0.55 : 1 }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
