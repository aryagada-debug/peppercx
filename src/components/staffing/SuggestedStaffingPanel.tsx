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
  id: string;
  staffing_deal_id: string;
  role_key: string;
  person_name: string;
  allocation_pct: number;
  status: string;
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

  const visible = useMemo(() => suggestions, [suggestions]);

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

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> Suggested from handover
        </span>
        <Badge variant="outline" className="text-[10px]">{visible.length} pending</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Roles proposed during the Deal Handover. Assign a person and confirm to add as a real staffing row, or dismiss.
      </p>
      <div className="divide-y divide-border/60 rounded-md bg-card">
        {visible.map(s => (
          <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">
                {humanRole(s.role_key)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Suggested {s.allocation_pct || 0}% · pick a person
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setApplying(s)}>
                <Check className="h-3.5 w-3.5 mr-1" /> Assign person
              </Button>
              <Button size="sm" variant="ghost" onClick={() => updateStatus(s.id, "dismissed")}>
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
            updateStatus(applying.id, "applied");
            setApplying(null);
          }}
        />
      )}
    </div>
  );
}