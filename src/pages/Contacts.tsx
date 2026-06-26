import { useMemo, useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, ExternalLink, Mail, Phone, Linkedin, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ColHeader, type SortState } from "@/components/table/ColHeader";

type Row = {
  id: string;
  name: string;
  linkedin_url: string;
  email: string;
  phone: string;
  role: string;        // Designation
  function: string;    // Team
  decision_power: number;
  deal_id: string;
  client_name: string;
  vsd: string;
  bopm: string;
  region: string;
};

type DealLite = {
  id: string;
  account: string;
  deal_name: string;
  vsd: string;
  bopm: string;
  region: string;
  deal_status: string;
};

function joinBopm(d: { principal_bopm?: string | null; senior_bopm?: string | null; bopm?: string | null }) {
  return [d.principal_bopm, d.senior_bopm, d.bopm]
    .map(v => (v || "").trim())
    .filter(Boolean)
    .join(", ");
}

export default function Contacts() {
  const { isAdmin, isActuallyAdmin, loading: roleLoading } = useUserRole();
  const canView = isAdmin || isActuallyAdmin;
  const [rows, setRows] = useState<Row[]>([]);
  const [allDeals, setAllDeals] = useState<DealLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [teamF, setTeamF] = useState("all");
  const [regionF, setRegionF] = useState("all");
  const [vsdF, setVsdF] = useState("all");
  const [influenceF, setInfluenceF] = useState("all");

  useEffect(() => {
    if (roleLoading || !canView) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: people, error: e1 }, { data: deals, error: e2 }, { data: clients, error: e3 }] = await Promise.all([
        supabase.from("deal_stakeholders").select("id,name,linkedin_url,email,phone,role,function,decision_power,deal_id,client_name"),
        supabase.from("staffing_deals").select("id,account,deal_name,vsd,principal_bopm,senior_bopm,bopm,geo,client_id,deal_status"),
        supabase.from("clients").select("id,name,geography"),
      ]);
      if (e1 || e2 || e3) {
        toast.error("Failed to load contacts");
        setLoading(false);
        return;
      }
      const dealMap = new Map<string, any>();
      (deals || []).forEach(d => dealMap.set(d.id, d));
      const clientMap = new Map<string, any>();
      (clients || []).forEach(c => clientMap.set(c.id, c));

      const merged: Row[] = (people || []).map((p: any) => {
        const d = dealMap.get(p.deal_id);
        const c = d?.client_id ? clientMap.get(d.client_id) : null;
        return {
          id: p.id,
          name: p.name || "",
          linkedin_url: p.linkedin_url || "",
          email: p.email || "",
          phone: p.phone || "",
          role: p.role || "",
          function: p.function || "",
          decision_power: p.decision_power || 0,
          deal_id: p.deal_id || "",
          client_name: c?.name || d?.account || d?.deal_name || p.client_name || "",
          vsd: d?.vsd || "",
          bopm: d ? joinBopm(d) : "",
          region: d?.geo || c?.geography || "",
        };
      });
      if (!cancelled) {
        setRows(merged);
        setAllDeals((deals || []).map((d: any) => ({
          id: d.id,
          account: d.account || "",
          deal_name: d.deal_name || "",
          vsd: d.vsd || "",
          bopm: joinBopm(d),
          region: d.geo || "",
          deal_status: d.deal_status || "",
        })));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canView, roleLoading]);

  const teams = useMemo(() => Array.from(new Set(rows.map(r => r.function).filter(Boolean))).sort(), [rows]);
  const regions = useMemo(() => Array.from(new Set(rows.map(r => r.region).filter(Boolean))).sort(), [rows]);
  const vsds = useMemo(() => Array.from(new Set(rows.map(r => r.vsd).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => {
      if (teamF !== "all" && r.function !== teamF) return false;
      if (regionF !== "all" && r.region !== regionF) return false;
      if (vsdF !== "all" && r.vsd !== vsdF) return false;
      if (influenceF !== "all" && String(r.decision_power) !== influenceF) return false;
      if (!s) return true;
      return [r.name, r.email, r.role, r.client_name, r.deal_id, r.vsd].some(v => v?.toLowerCase().includes(s));
    });
  }, [rows, q, teamF, regionF, vsdF, influenceF]);

  const dealCount = useMemo(() => new Set(filtered.map(r => r.deal_id)).size, [filtered]);

  // ── Insights: per-deal contact counts grouped by VSD ──
  const [insightsVsdF, setInsightsVsdF] = useState("all");
  const [insightsStatusF, setInsightsStatusF] = useState("Active Deal");
  const [insightsOnlyMissing, setInsightsOnlyMissing] = useState(false);
  const [insightsSort, setInsightsSort] = useState<SortState>({ sortKey: "contactCount", sortDir: "asc" });
  const [insightsColFilters, setInsightsColFilters] = useState<Record<string, string>>({});
  const [insightsOpenFilter, setInsightsOpenFilter] = useState<string | null>(null);
  const setInsightsFilter = (k: string, v: string) =>
    setInsightsColFilters(prev => (v ? { ...prev, [k]: v } : Object.fromEntries(Object.entries(prev).filter(([kk]) => kk !== k))));
  const clearInsightsFilter = (k: string) =>
    setInsightsColFilters(prev => Object.fromEntries(Object.entries(prev).filter(([kk]) => kk !== k)));
  const toggleInsightsSort = (k: string) =>
    setInsightsSort(s => (s.sortKey === k ? { sortKey: k, sortDir: s.sortDir === "asc" ? "desc" : "asc" } : { sortKey: k, sortDir: "asc" }));
  const dealStatuses = useMemo(
    () => Array.from(new Set(allDeals.map(d => d.deal_status).filter(Boolean))).sort(),
    [allDeals],
  );
  const insightsVsdOptions = useMemo(
    () => Array.from(new Set(allDeals.map(d => d.vsd || "Unassigned"))).sort(),
    [allDeals],
  );
  // Org Mapping shares stakeholders across all deals of the same client (keyed
  // on client_name). Mirror that here so Insights doesn't flag a deal as
  // "missing" when opening its Org Map would actually show contacts.
  const normKey = (s: string) => (s || "").trim().toLowerCase();
  const { contactsByClient, contactsByDealFallback } = useMemo(() => {
    const byClient = new Map<string, number>();
    const byDeal = new Map<string, number>();
    for (const r of rows) {
      const ck = normKey(r.client_name);
      if (ck) byClient.set(ck, (byClient.get(ck) || 0) + 1);
      else if (r.deal_id) byDeal.set(r.deal_id, (byDeal.get(r.deal_id) || 0) + 1);
    }
    return { contactsByClient: byClient, contactsByDealFallback: byDeal };
  }, [rows]);
  const getDealContactCount = (d: DealLite) => {
    const ck = normKey(d.account);
    if (ck && contactsByClient.has(ck)) return contactsByClient.get(ck) || 0;
    return contactsByDealFallback.get(d.id) || 0;
  };
  const insightsGroups = useMemo(() => {
    const accountF = (insightsColFilters.account || "").toLowerCase();
    const dealF = (insightsColFilters.deal || "").toLowerCase();
    const bopmF = (insightsColFilters.bopm || "").toLowerCase();
    const regionF = (insightsColFilters.region || "").toLowerCase();
    const statusF = (insightsColFilters.status || "").toLowerCase();
    const countF = insightsColFilters.contactCount;
    const scoped = allDeals.filter(d => {
      if (insightsStatusF !== "all" && d.deal_status !== insightsStatusF) return false;
      const vsd = d.vsd || "Unassigned";
      if (insightsVsdF !== "all" && vsd !== insightsVsdF) return false;
      const count = getDealContactCount(d);
      if (insightsOnlyMissing && count > 0) return false;
      if (accountF && !(d.account || "").toLowerCase().includes(accountF)) return false;
      if (dealF && !(d.deal_name || "").toLowerCase().includes(dealF)) return false;
      if (bopmF && !(d.bopm || "").toLowerCase().includes(bopmF)) return false;
      if (regionF && (d.region || "").toLowerCase() !== regionF) return false;
      if (statusF && (d.deal_status || "").toLowerCase() !== statusF) return false;
      if (countF !== undefined && countF !== "" && count !== Number(countF)) return false;
      return true;
    });
    const byVsd = new Map<string, { vsd: string; deals: (DealLite & { contactCount: number })[]; total: number; missing: number }>();
    for (const d of scoped) {
      const vsd = d.vsd || "Unassigned";
      const count = getDealContactCount(d);
      if (!byVsd.has(vsd)) byVsd.set(vsd, { vsd, deals: [], total: 0, missing: 0 });
      const g = byVsd.get(vsd)!;
      g.deals.push({ ...d, contactCount: count });
      g.total += count;
      if (count === 0) g.missing++;
    }
    const sk = insightsSort.sortKey;
    const dir = insightsSort.sortDir === "asc" ? 1 : -1;
    const cmp = (a: any, b: any) => {
      if (!sk) return 0;
      const av = (a as any)[sk] ?? "";
      const bv = (b as any)[sk] ?? "";
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    };
    return Array.from(byVsd.values())
      .map(g => ({
        ...g,
        deals: g.deals.sort(cmp),
      }))
      .sort((a, b) => b.missing - a.missing || a.vsd.localeCompare(b.vsd));
  }, [allDeals, contactsByClient, contactsByDealFallback, insightsVsdF, insightsStatusF, insightsOnlyMissing, insightsColFilters, insightsSort]);

  const insightsRegionOpts = useMemo(
    () => Array.from(new Set(allDeals.map(d => d.region).filter(Boolean))).sort(),
    [allDeals],
  );
  const insightsStatusOpts = useMemo(
    () => Array.from(new Set(allDeals.map(d => d.deal_status).filter(Boolean))).sort(),
    [allDeals],
  );

  const exportXlsx = () => {
    const data = filtered.map(r => ({
      "Name of Person": r.name,
      "LinkedIn Link": r.linkedin_url,
      "Email": r.email,
      "Phone Number": r.phone,
      "Designation": r.role,
      "Team Name": r.function,
      "Level of Influence": r.decision_power || "",
      "Deal ID": r.deal_id,
      "Client / Deal": r.client_name,
      "VSD": r.vsd,
      "BOPM": r.bopm,
      "Region": r.region,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const widths = [22, 32, 28, 16, 22, 24, 8, 14, 28, 22, 32, 14];
    ws["!cols"] = widths.map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contacts");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `contacts-${date}.xlsx`);
    toast.success("Exported contacts");
  };

  if (!roleLoading && !canView) return <Navigate to="/home" replace />;

  return (
    <AppLayout>
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All people mapped across deals · admin only
            {!loading && (
              <span className="ml-2 inline-flex items-center gap-1 text-foreground">
                · <span className="font-medium">{filtered.length}</span> contacts across <span className="font-medium">{dealCount}</span> deals
              </span>
            )}
          </p>
        </div>
      </div>

      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-4 mt-0">
          <div className="flex justify-end">
            <Button size="sm" onClick={exportXlsx} disabled={!filtered.length}>
              <Download className="h-4 w-4" /> Export to Excel
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, role, deal, VSD…" className="pl-9 h-9" />
        </div>
        <Select value={teamF} onValueChange={setTeamF}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="All teams" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={regionF} onValueChange={setRegionF}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All regions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {regions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={vsdF} onValueChange={setVsdF}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="All VSDs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All VSDs</SelectItem>
            {vsds.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={influenceF} onValueChange={setInfluenceF}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All influence" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All influence</SelectItem>
            {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} of 5</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2.5">Name</th>
                <th className="text-left px-3 py-2.5">Designation</th>
                <th className="text-left px-3 py-2.5">Team</th>
                <th className="text-left px-3 py-2.5">Email</th>
                <th className="text-left px-3 py-2.5">Phone</th>
                <th className="text-left px-3 py-2.5">LinkedIn</th>
                <th className="text-left px-3 py-2.5">Influence</th>
                <th className="text-left px-3 py-2.5">Deal</th>
                <th className="text-left px-3 py-2.5">VSD</th>
                <th className="text-left px-3 py-2.5">BOPM</th>
                <th className="text-left px-3 py-2.5">Region</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={11} className="text-center text-muted-foreground py-10">Loading contacts…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={11} className="text-center py-12">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-foreground font-medium">No contacts found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting filters or map stakeholders inside a deal's Org Map.</p>
                </td></tr>
              )}
              {!loading && filtered.map(r => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{r.name || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.role || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.function || "—"}</td>
                  <td className="px-3 py-2.5">
                    {r.email ? <a href={`mailto:${r.email}`} className="text-primary hover:underline inline-flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</a> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {r.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span> : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.linkedin_url ? (
                      <a href={r.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        <Linkedin className="h-3 w-3" /> Profile
                      </a>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= r.decision_power ? "bg-primary" : "bg-muted"}`} />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {r.deal_id ? (
                      <Link to={`/deals/${r.deal_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                        {r.client_name || r.deal_id} <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{r.vsd || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.bopm || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{r.region || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4 mt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={insightsStatusF} onValueChange={setInsightsStatusF}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {dealStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={insightsVsdF} onValueChange={setInsightsVsdF}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="All VSDs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All VSDs</SelectItem>
                {insightsVsdOptions.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant={insightsOnlyMissing ? "default" : "outline"}
              onClick={() => setInsightsOnlyMissing(v => !v)}
              className="h-9"
            >
              <AlertTriangle className="h-4 w-4" />
              {insightsOnlyMissing ? "Showing missing only" : "Show missing only"}
            </Button>
            <div className="ml-auto text-xs text-muted-foreground">
              {insightsGroups.reduce((s, g) => s + g.deals.length, 0)} deals ·{" "}
              <span className="text-destructive font-medium">
                {insightsGroups.reduce((s, g) => s + g.missing, 0)} missing contacts
              </span>
            </div>
          </div>

          {loading && (
            <div className="text-center text-sm text-muted-foreground py-10">Loading insights…</div>
          )}
          {!loading && insightsGroups.length === 0 && (
            <div className="rounded-lg border border-border bg-card py-12 text-center">
              <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-foreground font-medium">No deals match</p>
            </div>
          )}
          {!loading && insightsGroups.map(g => (
            <div key={g.vsd} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{g.vsd}</span>
                  <Badge variant="secondary" className="text-[10px]">{g.deals.length} deals</Badge>
                  <Badge variant="outline" className="text-[10px]">{g.total} contacts</Badge>
                </div>
                {g.missing > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {g.missing} missing
                  </Badge>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr className="group/headrow">
                      <ColHeader label="Account" colKey="account" sortKey="account" sortState={insightsSort} onSort={toggleInsightsSort} colFilters={insightsColFilters} openFilter={insightsOpenFilter} setOpenFilter={setInsightsOpenFilter} setFilter={setInsightsFilter} clearFilter={clearInsightsFilter} />
                      <ColHeader label="Deal" colKey="deal" sortKey="deal_name" sortState={insightsSort} onSort={toggleInsightsSort} colFilters={insightsColFilters} openFilter={insightsOpenFilter} setOpenFilter={setInsightsOpenFilter} setFilter={setInsightsFilter} clearFilter={clearInsightsFilter} />
                      <ColHeader label="BOPM" colKey="bopm" sortKey="bopm" sortState={insightsSort} onSort={toggleInsightsSort} colFilters={insightsColFilters} openFilter={insightsOpenFilter} setOpenFilter={setInsightsOpenFilter} setFilter={setInsightsFilter} clearFilter={clearInsightsFilter} />
                      <ColHeader label="Region" colKey="region" sortKey="region" sortState={insightsSort} onSort={toggleInsightsSort} colFilters={insightsColFilters} openFilter={insightsOpenFilter} setOpenFilter={setInsightsOpenFilter} setFilter={setInsightsFilter} clearFilter={clearInsightsFilter} options={insightsRegionOpts} />
                      <ColHeader label="Status" colKey="status" sortKey="deal_status" sortState={insightsSort} onSort={toggleInsightsSort} colFilters={insightsColFilters} openFilter={insightsOpenFilter} setOpenFilter={setInsightsOpenFilter} setFilter={setInsightsFilter} clearFilter={clearInsightsFilter} options={insightsStatusOpts} />
                      <ColHeader label="# Contacts" colKey="contactCount" sortKey="contactCount" align="right" numeric sortState={insightsSort} onSort={toggleInsightsSort} colFilters={insightsColFilters} openFilter={insightsOpenFilter} setOpenFilter={setInsightsOpenFilter} setFilter={setInsightsFilter} clearFilter={clearInsightsFilter} />
                    </tr>
                  </thead>
                  <tbody>
                    {g.deals.map(d => {
                      const missing = d.contactCount === 0;
                      return (
                        <tr key={d.id} className={`border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors ${missing ? "bg-destructive/5" : ""}`}>
                          <td className="px-3 py-2 text-foreground whitespace-nowrap">{d.account || "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Link to={`/deals/${d.id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                              {d.deal_name || d.id} <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{d.bopm || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{d.region || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{d.deal_status || "—"}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {missing ? (
                              <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                                <AlertTriangle className="h-3 w-3" /> 0
                              </span>
                            ) : (
                              <span className="text-foreground">{d.contactCount}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
    </AppLayout>
  );
}