import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Props = {
  vsd?: string | null;
  bu?: string | null;
  capability?: string | null;
  dealType?: string | null;
  mrr?: number | null;
  excludeDealId?: string | null;
  createdDealId?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  vsd: "VSD",
  principal_bopm: "Principal BOPM",
  senior_bopm: "Senior BOPM",
  bopm: "BOPM",
  managing_editor: "Managing Editor",
  content_lead: "Content Lead",
  senior_editor: "Senior Editor",
  seo_leader: "SEO Leader",
  seo_group_head: "SEO Group Head",
  sr_seo_manager: "Sr. SEO Manager",
  seo_manager: "SEO Manager",
  sr_seo_analyst: "Sr. SEO Analyst",
  seo_analyst: "SEO Analyst",
};
const humanRole = (k: string) =>
  ROLE_LABELS[k] || k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

const BOPM_ROLES = new Set(["vsd", "principal_bopm", "senior_bopm", "bopm"]);
const normName = (s?: string | null) =>
  (s || "").toLowerCase().replace(/\s+/g, " ").trim();

export function SuggestedStaffingCard({
  vsd, bu, capability, dealType, mrr, excludeDealId, createdDealId,
}: Props) {
  const enabled = !!(capability || bu || vsd || dealType);

  const { data, isLoading } = useQuery({
    enabled,
    queryKey: ["handover-suggested-staffing", { vsd, bu, capability, dealType, mrr, excludeDealId }],
    queryFn: async () => {
      // Resolve the confirmed VSD → person id → full reporting subtree.
      // BOPM-type suggestions (Principal/Senior/BOPM) are restricted to this
      // subtree so we never suggest a BOPM who doesn't actually roll up to
      // the VSD Anirudh confirmed on the handover.
      let vsdPersonId: string | null = null;
      let vsdSubtreeIds: Set<string> | null = null;
      if (vsd && vsd.trim()) {
        const wanted = normName(vsd);
        const { data: peoplePool } = await supabase
          .from("staffing_people")
          .select("id, name, role_title, designation, leaving, tbh")
          .eq("leaving", false)
          .eq("tbh", false);
        const matches = ((peoplePool as any[]) || []).filter(p => normName(p.name) === wanted);
        const vsdMatch =
          matches.find(p =>
            /\bvsd\b|vertical service delivery|service delivery (leader|director)/i
              .test(`${p.role_title || ""} ${p.designation || ""}`),
          ) || matches[0];
        if (vsdMatch?.id) {
          vsdPersonId = vsdMatch.id;
          const { data: subtree } = await supabase.rpc("person_subtree", { _root_id: vsdMatch.id });
          vsdSubtreeIds = new Set<string>(((subtree as any[]) || []).map((x) => x.person_id));
          vsdSubtreeIds.add(vsdMatch.id);
        }
      }

      // Pull a candidate pool. Keep it bounded.
      const { data: deals } = await supabase
        .from("staffing_deals")
        .select("id, vsd, business_unit, capability_line, deal_type, mrr")
        .limit(800);
      const pool = (deals as any[]) || [];
      const mrrNum = typeof mrr === "number" ? mrr : null;

      const scored = pool
        .filter((d) => d.id !== excludeDealId)
        .map((d) => {
          let s = 0;
          if (capability && d.capability_line && d.capability_line === capability) s += 3;
          if (bu && d.business_unit && d.business_unit === bu) s += 2;
          if (vsd && d.vsd && d.vsd.toLowerCase().includes(vsd.toLowerCase())) s += 2;
          if (dealType && d.deal_type && d.deal_type === dealType) s += 1;
          if (mrrNum && d.mrr && Math.abs(d.mrr - mrrNum) <= mrrNum * 0.3) s += 1;
          return { id: d.id as string, score: s };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const ids = scored.map((x) => x.id);
      if (!ids.length) return { totalCompared: 0, rows: [] as any[], vsdName: vsd || "", vsdPersonId };

      const { data: assigns } = await supabase
        .from("staffing_assignments")
        .select("staffing_deal_id, role_key, person_id, allocation_pct")
        .in("staffing_deal_id", ids);
      const a = (assigns as any[]) || [];
      const personIds = Array.from(new Set(a.map((x) => x.person_id).filter(Boolean)));
      const { data: people } = personIds.length
        ? await supabase.from("staffing_people").select("id, name").in("id", personIds)
        : { data: [] as any[] };
      const nameById = new Map<string, string>(((people as any[]) || []).map((p) => [p.id, p.name]));

      // Group by normalized role
      const norm = (k: string) =>
        (k || "").toLowerCase().trim()
          .replace(/^rt_/, "")
          .replace(/\s+/g, "_")
          .replace("group_bopm", "principal_bopm");

      const byRole = new Map<string, { deals: Set<string>; allocs: number[]; persons: Map<string, number> }>();
      for (const r of a) {
        const rk = norm(r.role_key);
        if (!rk) continue;
        if (!byRole.has(rk)) byRole.set(rk, { deals: new Set(), allocs: [], persons: new Map() });
        const slot = byRole.get(rk)!;
        slot.deals.add(r.staffing_deal_id);
        if (typeof r.allocation_pct === "number") slot.allocs.push(r.allocation_pct);
        if (r.person_id) {
          slot.persons.set(r.person_id, (slot.persons.get(r.person_id) || 0) + 1);
        }
      }

      const rows = Array.from(byRole.entries())
        .map(([role, v]) => ({
          role,
          frequency: v.deals.size,
          medianPct: median(v.allocs),
          common: Array.from(v.persons.entries())
            // For leadership roles, only keep people inside the confirmed
            // VSD's reporting subtree so the "common people" never bleed
            // across pods.
            .filter(([pid]) =>
              BOPM_ROLES.has(role) && vsdSubtreeIds ? vsdSubtreeIds.has(pid) : true,
            )
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([pid]) => nameById.get(pid) || "—"),
        }))
        .sort((a, b) => b.frequency - a.frequency || b.medianPct - a.medianPct);

      // Make sure the confirmed VSD is always the first suggested row, even
      // if no comparable deal had a VSD assignment row.
      const hasVsdRow = rows.some(r => r.role === "vsd");
      if (!hasVsdRow && vsd && vsd.trim()) {
        rows.unshift({ role: "vsd", frequency: 0, medianPct: 0, common: [vsd.trim()] });
      }

      return { totalCompared: ids.length, rows, vsdName: vsd || "", vsdPersonId };
    },
  });

  const [sending, setSending] = useState(false);
  const sendAllToStaffing = async () => {
    if (!createdDealId || !data?.rows?.length) return;
    setSending(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const rows = data.rows.flatMap((r) => {
        const people = r.common.filter(Boolean);
        const base = {
          staffing_deal_id: createdDealId,
          role_key: r.role,
          allocation_pct: r.medianPct || 0,
          source: "handover",
          status: "pending",
          created_by: userData.user?.id ?? null,
        };
        if (!people.length) return [{ ...base, person_name: "" }];
        return people.map((pname) => ({ ...base, person_name: pname }));
      });
      const { error } = await supabase
        .from("staffing_suggestions")
        .upsert(rows, { onConflict: "staffing_deal_id,role_key,person_name", ignoreDuplicates: false });
      if (error) throw error;
      toast.success("Suggestions sent to Staffing — open the deal to confirm or edit.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to send suggestions");
    } finally {
      setSending(false);
    }
  };

  if (!enabled) return null;

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Suggested staffing (based on similar deals)
        </h3>
        <div className="flex items-center gap-2">
          {data && data.totalCompared > 0 && (
            <Badge variant="outline" className="text-[10px]">{data.totalCompared} comparable</Badge>
          )}
          {createdDealId && data && data.rows.length > 0 && (
            <Button size="sm" variant="default" onClick={sendAllToStaffing} disabled={sending}>
              <Send className="h-3 w-3 mr-1" />
              {sending ? "Sending…" : "Send all to Staffing"}
            </Button>
          )}
        </div>
      </div>
      {vsd && vsd.trim() && (
        <p className="text-[11px] text-muted-foreground">
          VSD locked to <span className="font-medium text-foreground">{vsd}</span>. BOPM suggestions are limited to this VSD's pod.
        </p>
      )}

      {isLoading && <p className="text-xs text-muted-foreground">Analysing comparable deals…</p>}

      {!isLoading && data && data.totalCompared < 2 && (
        <p className="text-xs text-muted-foreground">Not enough similar deals to suggest staffing yet.</p>
      )}

      {!isLoading && data && data.rows.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Typical %</TableHead>
                <TableHead className="text-xs">Frequency</TableHead>
                <TableHead className="text-xs">Common people</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.role}>
                  <TableCell className="text-sm">{humanRole(r.role)}</TableCell>
                  <TableCell className="text-sm">{r.medianPct ? `${r.medianPct}%` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.frequency} / {data.totalCompared}</TableCell>
                  <TableCell className="text-xs">{r.common.filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell className="text-right">
                    {createdDealId ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/staffing?tab=staffing&deal=${encodeURIComponent(createdDealId)}&prefill_role=${encodeURIComponent(r.role)}`}>Use</Link>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!createdDealId && (
            <p className="text-xs text-muted-foreground">Create the deal to apply these into Staffing.</p>
          )}
        </>
      )}
    </Card>
  );
}