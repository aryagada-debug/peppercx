/**
 * Shows pending staffing suggestions (seeded from Deal Handover) for a deal.
 * Each row can be Applied (opens AddStaffingMemberDialog prefilled with the
 * suggested role / person / %) or Dismissed.
 */
import { useMemo, useState } from "react";
import { Sparkles, Check, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AddStaffingMemberDialog } from "./AddStaffingMemberDialog";
import type { Deal, Person, StaffingAssignment, RoleCategory } from "@/data/staffingData";

type Suggestion = {
  id: string; // "computed:<role>" when ephemeral
  staffing_deal_id: string;
  role_key: string;
  person_name: string;
  allocation_pct: number;
  status: string;
  frequency?: number;
  totalCompared?: number;
  ephemeral?: boolean;
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

const roleToCategory = (role: string): RoleCategory | undefined => {
  if (["vsd", "principal_bopm", "senior_bopm", "bopm"].includes(role)) return "Operations";
  if (["managing_editor", "content_lead", "senior_editor"].includes(role)) return "Content";
  if (["seo_leader", "seo_group_head", "sr_seo_manager", "seo_manager", "sr_seo_analyst", "seo_analyst"].includes(role)) return "SEO";
  return undefined;
};

const normRoleKey = (k: string) =>
  (k || "").toLowerCase().trim()
    .replace(/^rt_/, "")
    .replace(/\s+/g, "_")
    .replace("group_bopm", "principal_bopm");

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

interface Props {
  deal: Deal;
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
  onAddAssignment: (a: StaffingAssignment) => void;
  onUpdateAssignment: (id: string, patch: Partial<StaffingAssignment>) => void;
}

export function SuggestedStaffingPanel({
  deal, deals, people, assignments, onAddAssignment, onUpdateAssignment,
}: Props) {
  const qc = useQueryClient();
  const [applying, setApplying] = useState<Suggestion | null>(null);
  const [dismissedComputed, setDismissedComputed] = useState<Set<string>>(new Set());

  const { data: suggestions = [] } = useQuery({
    queryKey: ["staffing-suggestions", deal.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staffing_suggestions")
        .select("id, staffing_deal_id, role_key, person_name, allocation_pct, status")
        .eq("staffing_deal_id", deal.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Suggestion[];
    },
  });

  // Compute role-based suggestions from comparable deals when we don't have
  // handover-sourced suggestions to show.
  const { data: computed = [] } = useQuery({
    enabled: suggestions.length === 0,
    queryKey: [
      "computed-staffing-suggestions",
      deal.id,
      deal.businessUnit,
      deal.capabilityLine,
      deal.vsd,
      deal.dealType,
      deal.mrr,
    ],
    queryFn: async (): Promise<Suggestion[]> => {
      const { data: pool } = await supabase
        .from("staffing_deals")
        .select("id, vsd, business_unit, capability_line, deal_type, mrr")
        .limit(800);
      const mrrNum = typeof deal.mrr === "number" ? deal.mrr : null;
      const scored = ((pool as any[]) || [])
        .filter((d) => d.id !== deal.id)
        .map((d) => {
          let s = 0;
          if (deal.capabilityLine && d.capability_line === deal.capabilityLine) s += 3;
          if (deal.businessUnit && d.business_unit === deal.businessUnit) s += 2;
          if (deal.vsd && d.vsd && d.vsd.toLowerCase().includes(deal.vsd.toLowerCase())) s += 2;
          if (deal.dealType && d.deal_type === deal.dealType) s += 1;
          if (mrrNum && d.mrr && Math.abs(d.mrr - mrrNum) <= mrrNum * 0.3) s += 1;
          return { id: d.id as string, score: s };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const ids = scored.map((x) => x.id);
      const totalCompared = ids.length;
      if (!ids.length) {
        return deal.vsd
          ? [{
              id: "computed:vsd",
              staffing_deal_id: deal.id,
              role_key: "vsd",
              person_name: "",
              allocation_pct: 0,
              status: "pending",
              frequency: 0,
              totalCompared: 0,
              ephemeral: true,
            }]
          : [];
      }

      const { data: assigns } = await supabase
        .from("staffing_assignments")
        .select("staffing_deal_id, role_key, allocation_pct")
        .in("staffing_deal_id", ids);

      const byRole = new Map<string, { deals: Set<string>; allocs: number[] }>();
      for (const r of ((assigns as any[]) || [])) {
        const rk = normRoleKey(r.role_key);
        if (!rk) continue;
        if (!byRole.has(rk)) byRole.set(rk, { deals: new Set(), allocs: [] });
        const slot = byRole.get(rk)!;
        slot.deals.add(r.staffing_deal_id);
        if (typeof r.allocation_pct === "number") slot.allocs.push(r.allocation_pct);
      }

      const rows: Suggestion[] = Array.from(byRole.entries())
        .map(([role, v]) => ({
          id: `computed:${role}`,
          staffing_deal_id: deal.id,
          role_key: role,
          person_name: "",
          allocation_pct: median(v.allocs),
          status: "pending",
          frequency: v.deals.size,
          totalCompared,
          ephemeral: true,
        }))
        .sort((a, b) => (b.frequency! - a.frequency!) || (b.allocation_pct - a.allocation_pct));

      if (!rows.some((r) => r.role_key === "vsd") && deal.vsd) {
        rows.unshift({
          id: "computed:vsd",
          staffing_deal_id: deal.id,
          role_key: "vsd",
          person_name: "",
          allocation_pct: 0,
          status: "pending",
          frequency: 0,
          totalCompared,
          ephemeral: true,
        });
      }
      return rows;
    },
  });

  const visible = useMemo(() => {
    const base = suggestions.length > 0 ? suggestions : computed;
    // Hide roles already staffed on this deal, or locally dismissed computed rows.
    const staffed = new Set(
      assignments
        .filter((a) => a.dealId === deal.id)
        .map((a) => normRoleKey((a as any).roleKey || (a as any).role || ""))
        .filter(Boolean),
    );
    return base.filter((s) => {
      if (staffed.has(normRoleKey(s.role_key))) return false;
      if (s.ephemeral && dismissedComputed.has(s.role_key)) return false;
      return true;
    });
  }, [suggestions, computed, assignments, deal.id, dismissedComputed]);

  const updateStatus = async (id: string, status: "applied" | "dismissed") => {
    const { error } = await supabase
      .from("staffing_suggestions")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["staffing-suggestions", deal.id] });
  };

  if (visible.length === 0) return null;

  const usingComputed = suggestions.length === 0;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> {usingComputed ? "Suggested designations (from similar deals)" : "Suggested from handover"}
        </span>
        <Badge variant="outline" className="text-[10px]">{visible.length} pending</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {usingComputed
          ? "Based on comparable deals (BU, capability, VSD, deal type, MRR). Assign a person to add as a real staffing row, or dismiss."
          : "Roles proposed during the Deal Handover. Assign a person and confirm to add as a real staffing row, or dismiss."}
      </p>
      <div className="divide-y divide-border/60 rounded-md bg-card">
        {visible.map(s => (
          <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">
                {humanRole(s.role_key)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Suggested {s.allocation_pct || 0}%
                {s.ephemeral && typeof s.totalCompared === "number" && s.totalCompared > 0
                  ? ` · seen in ${s.frequency || 0}/${s.totalCompared} similar deals`
                  : ""}
                {" · pick a person"}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setApplying(s)}>
                <Check className="h-3.5 w-3.5 mr-1" /> Assign person
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                if (s.ephemeral) {
                  setDismissedComputed(prev => new Set(prev).add(s.role_key));
                } else {
                  updateStatus(s.id, "dismissed");
                }
              }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {applying && (
        <AddStaffingMemberDialog
          open={!!applying}
          onOpenChange={(o) => { if (!o) setApplying(null); }}
          people={people}
          assignments={assignments}
          deals={deals}
          dealId={deal.id}
          initialCategory={roleToCategory(applying.role_key)}
          initialPersonName={undefined}
          initialAllocationPct={applying.allocation_pct || 10}
          initialRoleKey={applying.role_key}
          onAdd={(a) => {
            onAddAssignment(a);
            if (applying.ephemeral) {
              setDismissedComputed(prev => new Set(prev).add(applying.role_key));
            } else {
              updateStatus(applying.id, "applied");
            }
            setApplying(null);
          }}
        />
      )}
    </div>
  );
}