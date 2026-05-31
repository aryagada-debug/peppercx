/**
 * Overview — default landing for Staffing & Capacity (admin / VSD / cap-lead).
 * Merges the old "Deal view" pivot and "Lock Analytics" charts into one
 * scrollable analytics screen, fronted by a sharper KPI strip.
 */
import { useMemo } from "react";
import { formatINR } from "@/lib/csvTargets";
import { cn } from "@/lib/utils";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";
import { ACTIVE_DEAL_STATUSES } from "@/data/staffingData";
import { DealViewTab } from "./DealViewTab";
import { LockAnalyticsTab } from "./LockAnalyticsTab";

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
  onUpdateDeal?: (dealId: string, updates: Partial<Deal>) => void;
  bopmFilterScopedVsd?: string | null;
}

function classifyStaffing(deal: Deal): "Already Staffed" | "No Staffing Needed" | "Staffing Needed" | null {
  const s = (deal.staffingStatus || "").toLowerCase().trim();
  if (!s) return null;
  if (s.includes("already") || s.includes("staffed")) return "Already Staffed";
  if (s.includes("not needed") || s.includes("no staffing") || s === "no") return "No Staffing Needed";
  if (s.includes("needed") || s.includes("required") || s.includes("open")) return "Staffing Needed";
  return null;
}

export function OverviewTab({ deals, people, assignments, onUpdateDeal, bopmFilterScopedVsd }: Props) {
  const kpis = useMemo(() => {
    const activeDeals = deals.filter(d => ACTIVE_DEAL_STATUSES.has(d.dealStatus));
    const dealIdsWithAssign = new Set(assignments.map(a => a.dealId));

    let already = 0, needed = 0, noNeed = 0;
    activeDeals.forEach(d => {
      const bucket = classifyStaffing(d) ?? (dealIdsWithAssign.has(d.id) ? "Already Staffed" : "Staffing Needed");
      if (bucket === "Already Staffed") already++;
      else if (bucket === "Staffing Needed") needed++;
      else noNeed++;
    });

    const lockable = activeDeals.filter(d => (classifyStaffing(d) ?? (dealIdsWithAssign.has(d.id) ? "Already Staffed" : "Staffing Needed")) !== "No Staffing Needed");
    const locked = lockable.filter(d => !!d.staffingLockedAt).length;
    const unlocked = lockable.length - locked;
    const pctLocked = lockable.length ? Math.round((locked / lockable.length) * 100) : 0;

    const totalMRR = activeDeals.reduce((s, d) => s + (d.mrr || 0), 0);

    return {
      total: activeDeals.length,
      already, needed, noNeed,
      locked, unlocked, pctLocked,
      totalMRR,
    };
  }, [deals, assignments]);

  const tiles: Array<{ label: string; value: string; sub?: string; tone?: "green" | "amber" | "red" | "muted" }> = [
    { label: "Active deals", value: String(kpis.total) },
    { label: "Already staffed", value: String(kpis.already), tone: "green" },
    { label: "Staffing needed", value: String(kpis.needed), tone: kpis.needed > 0 ? "red" : "muted" },
    { label: "No staffing needed", value: String(kpis.noNeed), tone: "muted" },
    { label: "Locked", value: String(kpis.locked), sub: `${kpis.pctLocked}% of needing staffing`, tone: "green" },
    { label: "Unlocked", value: String(kpis.unlocked), sub: "to close out", tone: kpis.unlocked > 0 ? "amber" : "muted" },
    { label: "Total MRR", value: formatINR(kpis.totalMRR) },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {tiles.map(t => (
          <div key={t.label} className="bg-card border border-border rounded-lg px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t.label}</div>
            <div className={cn(
              "text-xl font-medium mt-1 tabular-nums",
              t.tone === "green" && "text-positive",
              t.tone === "amber" && "text-warning",
              t.tone === "red" && "text-destructive",
              t.tone === "muted" && "text-muted-foreground",
            )}>{t.value}</div>
            {t.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{t.sub}</div>}
          </div>
        ))}
      </div>

      {/* Staffing status pivot (former Deal view) */}
      <section>
        <h2 className="text-ui font-medium text-foreground mb-2">Staffing status by VSD / BOPM</h2>
        <DealViewTab
          deals={deals}
          people={people}
          assignments={assignments}
          onUpdateDeal={onUpdateDeal}
          bopmFilterScopedVsd={bopmFilterScopedVsd}
        />
      </section>

      {/* Lock distribution + unstaffed action list (former Lock Analytics) */}
      <section>
        <h2 className="text-ui font-medium text-foreground mb-2">Lock status &amp; close-out queue</h2>
        <LockAnalyticsTab deals={deals} />
      </section>
    </div>
  );
}