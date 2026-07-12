import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCanEditRgy } from "@/hooks/useCanEditRgy";
import { Loader2 } from "lucide-react";
import { PulseTabs } from "@/components/pulse/PulseTabs";
import { AnalyticsKpis } from "@/components/pulse/AnalyticsKpis";
import { AnalyticsTable } from "@/components/pulse/AnalyticsTable";
import { AnalyticsResponsesTable } from "@/components/pulse/AnalyticsResponsesTable";
import {
  usePulseAnalyticsData,
  splitNames,
  normName,
  CAPABILITY_LABELS,
  capabilityLabel,
} from "@/components/pulse/useAnalyticsData";
import { useVsdUsers } from "@/hooks/queries/legacy";
import { useUserRole } from "@/hooks/useUserRole";
import { BopmFilter } from "@/components/access/BopmFilter";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type GroupBy = "vsd" | "bopm" | "deal" | "capability";
type Range = "30d" | "90d" | "qtd" | "ytd" | "all";
type BopmTier = "any" | "principal" | "senior" | "bopm";
type ViewMode = "summary" | "responses";

const UNASSIGNED_VSD = new Set(["", "Not Assigned", "Unassigned", "Not Applicable", "To Be Assigned", "Yet to be assigned"]);

function rangeToDates(r: Range): { start: string | null; end: string | null } {
  if (r === "all") return { start: null, end: null };
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  if (r === "30d") start = new Date(now.getTime() - 30 * 86400000);
  else if (r === "90d") start = new Date(now.getTime() - 90 * 86400000);
  else if (r === "qtd") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), q, 1);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
  }
  return { start: start.toISOString(), end };
}

export default function PulseNPSAnalytics() {
  const { canEdit: canEditRgy, loading: roleLoading } = useCanEditRgy();
  const { isAdmin, canEditAll } = useUserRole();
  const { vsdUsers } = useVsdUsers();
  const showVsdChips = !!(isAdmin || canEditAll);

  const [groupBy, setGroupBy] = useState<GroupBy>("vsd");
  const [view, setView] = useState<ViewMode>("summary");
  const [range, setRange] = useState<Range>("90d");
  const [activeVsd, setActiveVsd] = useState("All");
  const [activeBopm, setActiveBopm] = useState("All");
  const [capabilityFilter, setCapabilityFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [bopmTier, setBopmTier] = useState<BopmTier>("any");
  const [activeBU, setActiveBU] = useState<string>("All");
  const [activeCampaign, setActiveCampaign] = useState<string>("All");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["pulse-campaigns"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("pulse_campaigns").select("id, name").order("name");
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string }>;
    },
  });

  const { start, end } = useMemo(() => rangeToDates(range), [range]);

  const { invites, responses, capabilities, isLoading } = usePulseAnalyticsData(
    {
      startDate: start, endDate: end,
      vsd: activeVsd, bopm: activeBopm, capabilities: capabilityFilter,
      search, showClosed, bopmTier,
      businessUnit: activeBU, campaignId: activeCampaign,
    },
    canEditRgy,
  );

  // Apply VSD / BOPM / capability / search / closed filters in memory.
  const filtered = useMemo(() => {
    const capByDeal = new Map<string, Set<string>>();
    capabilities.forEach(c => {
      const s = capByDeal.get(c.deal_id) || new Set();
      s.add(c.role_key);
      capByDeal.set(c.deal_id, s);
    });

    const matchVsd = (raw: string | null) => {
      if (activeVsd === "All") return true;
      const names = splitNames(raw);
      if (activeVsd === "Unassigned") return names.length === 0 || names.every(n => UNASSIGNED_VSD.has(n));
      if (activeVsd === "Other") {
        const known = new Set(vsdUsers.map((u: any) => normName(u.displayName)));
        return names.some(n => !known.has(normName(n)));
      }
      return names.some(n => normName(n) === normName(activeVsd));
    };
    const matchBopm = (inv: any) => {
      if (activeBopm === "All") return true;
      const target = normName(activeBopm);
      return [inv.principal_bopm, inv.senior_bopm, inv.bopm]
        .flatMap(splitNames)
        .some(n => normName(n) === target);
    };
    const matchCap = (dealId: string) => {
      if (capabilityFilter.length === 0) return true;
      const s = capByDeal.get(dealId) || new Set();
      return capabilityFilter.some(k => s.has(k));
    };
    const matchClosed = (status: string | null | undefined) => {
      if (showClosed) return true;
      const v = (status || "").toLowerCase();
      // exclude obvious closed deals
      return !["closed", "lost", "churned", "closed lost", "closed won"].some(x => v.includes(x));
    };
    const matchSearch = (inv: any) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        (inv.account || "").toLowerCase().includes(s) ||
        (inv.deal_name || "").toLowerCase().includes(s) ||
        (inv.deal_id || "").toLowerCase().includes(s)
      );
    };
    const matchBU = (inv: any) => {
      if (activeBU === "All") return true;
      return (inv.business_unit || "").trim() === activeBU;
    };
    const matchCampaign = (inv: any) => {
      if (activeCampaign === "All") return true;
      if (activeCampaign === "none") return !inv.campaign_id;
      return inv.campaign_id === activeCampaign;
    };

    const invF = invites.filter(i => matchVsd(i.vsd) && matchBopm(i) && matchCap(i.deal_id) && matchClosed(i.deal_status) && matchSearch(i) && matchBU(i) && matchCampaign(i));
    const invIds = new Set(invF.map(i => i.id));
    const respF = responses.filter(r => invIds.has(r.invite_id));
    return { invF, respF };
  }, [invites, responses, capabilities, activeVsd, activeBopm, capabilityFilter, showClosed, search, vsdUsers, activeBU, activeCampaign]);

  if (roleLoading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </AppLayout>
    );
  }
  if (!canEditRgy) {
    return (
      <AppLayout>
        <div className="p-8 text-sm text-muted-foreground">You don't have access to Pulse / NPS analytics.</div>
      </AppLayout>
    );
  }

  const VSD_FILTERS = [
    { key: "All", label: "All" },
    ...vsdUsers.map((u: any) => ({ key: u.displayName, label: u.displayName })),
    { key: "Other", label: "Other" },
    { key: "Unassigned", label: "Unassigned" },
  ];

  const capabilityKeys = Object.keys(CAPABILITY_LABELS).filter(k => !["vsd","principal_bopm","senior_bopm","bopm"].includes(k));
  const buOptions = Array.from(new Set(invites.map(i => (i.business_unit || "").trim()).filter(Boolean))).sort();

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Pulse / NPS</h1>
            <p className="text-sm text-muted-foreground">Analytics across stakeholder survey responses.</p>
          </div>
          <PulseTabs />
        </div>

        {/* Filters */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">View</span>
            <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
              {([
                { k: "summary", l: "Summary" },
                { k: "responses", l: "Responses" },
              ] as { k: ViewMode; l: string }[]).map(v => (
                <button
                  key={v.k}
                  onClick={() => setView(v.k)}
                  className={cn("px-2.5 py-1 rounded-md text-[11px] font-medium",
                    view === v.k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {v.l}
                </button>
              ))}
            </div>

            {view === "summary" && (
              <>
                <span className="text-xs text-muted-foreground ml-3 mr-1">Group by</span>
                <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
                  {(["vsd","bopm","deal","capability"] as GroupBy[]).map(g => (
                    <button
                      key={g}
                      onClick={() => setGroupBy(g)}
                      className={cn("px-2.5 py-1 rounded-md text-[11px] font-medium capitalize",
                        groupBy === g ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </>
            )}

            <span className="text-xs text-muted-foreground ml-3 mr-1">Range</span>
            <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
              {([
                { k: "30d", l: "30d" }, { k: "90d", l: "90d" },
                { k: "qtd", l: "QTD" }, { k: "ytd", l: "YTD" }, { k: "all", l: "All" },
              ] as { k: Range; l: string }[]).map(r => (
                <button
                  key={r.k}
                  onClick={() => setRange(r.k)}
                  className={cn("px-2 py-1 rounded-md text-[11px] font-medium",
                    range === r.k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {r.l}
                </button>
              ))}
            </div>

            {view === "summary" && groupBy === "bopm" && (
              <>
                <span className="text-xs text-muted-foreground ml-3 mr-1">Tier</span>
                <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
                  {(["any","principal","senior","bopm"] as BopmTier[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setBopmTier(t)}
                      className={cn("px-2 py-1 rounded-md text-[11px] font-medium capitalize",
                        bopmTier === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {showVsdChips && (
              <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5 overflow-x-auto max-w-full">
                {VSD_FILTERS.map(v => (
                  <button
                    key={v.key}
                    onClick={() => setActiveVsd(v.key)}
                    className={cn("px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                      activeVsd === v.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
            <BopmFilter
              value={activeBopm}
              onChange={setActiveBopm}
              scopedVsd={showVsdChips && activeVsd !== "All" && activeVsd !== "Other" && activeVsd !== "Unassigned" ? activeVsd : undefined}
            />
            {buOptions.length > 0 && (
              <Select value={activeBU} onValueChange={setActiveBU}>
                <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Pepper BU" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All BUs</SelectItem>
                  {buOptions.map(bu => <SelectItem key={bu} value={bu}>{bu}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={activeCampaign} onValueChange={setActiveCampaign}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Campaign" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All campaigns</SelectItem>
                <SelectItem value="none">No campaign</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search deal/account…"
              className="h-8 px-3 rounded-md border border-border bg-card text-xs w-56"
            />
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
              <Checkbox checked={showClosed} onCheckedChange={(v) => setShowClosed(!!v)} />
              Include closed
            </label>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground mr-1">Capabilities:</span>
            {capabilityKeys.map(k => {
              const on = capabilityFilter.includes(k);
              return (
                <button
                  key={k}
                  onClick={() => setCapabilityFilter(prev => on ? prev.filter(x => x !== k) : [...prev, k])}
                  className={cn("px-2 py-0.5 rounded-full text-[10px] border",
                    on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}
                >
                  {capabilityLabel(k)}
                </button>
              );
            })}
            {capabilityFilter.length > 0 && (
              <button onClick={() => setCapabilityFilter([])} className="text-[10px] text-muted-foreground underline ml-1">
                clear
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
          </div>
        ) : invites.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No survey responses yet for these filters.
          </div>
        ) : (
          <>
            <AnalyticsKpis invites={filtered.invF} responses={filtered.respF} />
            {view === "summary" ? (
              <AnalyticsTable
                groupBy={groupBy}
                bopmTier={bopmTier}
                invites={filtered.invF}
                responses={filtered.respF}
                capabilities={capabilities}
              />
            ) : (
              <AnalyticsResponsesTable invites={filtered.invF} responses={filtered.respF} />
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}