import { AppSidebar } from "./AppSidebar";
import { GlobalSearch } from "@/components/dashboard/GlobalSearch";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import type { RGYRow } from "@/types/dashboard";

interface AppLayoutProps {
  children: React.ReactNode;
  onSearchSelectDeal?: (deal: RGYRow) => void;
}

export function AppLayout({ children, onSearchSelectDeal }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 md:px-8 h-12 border-b border-border shrink-0">
          <div />
          <div className="flex items-center gap-2">
            <GlobalSearch onSelectDeal={onSearchSelectDeal} />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1440px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
