import { useMemo, useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, ExternalLink, Mail, Phone, Linkedin, Users } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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

function joinBopm(d: { principal_bopm?: string | null; senior_bopm?: string | null; bopm?: string | null }) {
  return [d.principal_bopm, d.senior_bopm, d.bopm]
    .map(v => (v || "").trim())
    .filter(Boolean)
    .join(", ");
}

export default function Contacts() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [teamF, setTeamF] = useState("all");
  const [regionF, setRegionF] = useState("all");
  const [vsdF, setVsdF] = useState("all");
  const [influenceF, setInfluenceF] = useState("all");

  useEffect(() => {
    if (roleLoading || !isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: people, error: e1 }, { data: deals, error: e2 }, { data: clients, error: e3 }] = await Promise.all([
        supabase.from("deal_stakeholders").select("id,name,linkedin_url,email,phone,role,function,decision_power,deal_id,client_name"),
        supabase.from("staffing_deals").select("id,client_name,vsd,principal_bopm,senior_bopm,bopm,geo,client_id"),
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
          client_name: d?.client_name || p.client_name || "",
          vsd: d?.vsd || "",
          bopm: d ? joinBopm(d) : "",
          region: d?.geo || c?.geography || "",
        };
      });
      if (!cancelled) {
        setRows(merged);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, roleLoading]);

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

  if (!roleLoading && !isAdmin) return <Navigate to="/home" replace />;

  return (
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
    </div>
  );
}