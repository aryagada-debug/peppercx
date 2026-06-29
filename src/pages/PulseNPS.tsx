import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PulseSurveyTab from "@/components/rgy/PulseSurveyTab";
import { useCanEditRgy } from "@/hooks/useCanEditRgy";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

const ACTIVE_STATUSES = [
  "Active Deal",
  "New Deal in SLA/PO",
  "Deal Disputed",
  "Deal in Renewal Process",
];

export default function PulseNPS() {
  const { canEdit: canEditRgy, loading: roleLoading } = useCanEditRgy();

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["pulse-nps-deals"],
    enabled: canEditRgy,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staffing_deals")
        .select("id, new_deal_id_formulated, deal_name, account, vsd, principal_bopm, senior_bopm, bopm, deal_status")
        .in("deal_status", ACTIVE_STATUSES)
        .order("account", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []).map((d: any) => ({
        deal_id: d.new_deal_id_formulated || d.id,
        raw_id: d.id,
        account: d.account ?? null,
        deal_name: d.deal_name ?? null,
        vsd: d.vsd ?? null,
        principal_bopm: d.principal_bopm ?? null,
        senior_bopm: d.senior_bopm ?? null,
        bopm: d.bopm ?? null,
        deal_status: d.deal_status ?? null,
      }));
    },
  });

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
        <div className="p-8 text-sm text-muted-foreground">
          You don't have access to Pulse / NPS surveys.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Pulse / NPS</h1>
        <p className="text-sm text-muted-foreground">Send NPS/CSAT surveys to stakeholders mapped against your deals.</p>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading deals…
        </div>
      ) : (
        <PulseSurveyTab deals={deals as any} />
      )}
    </div>
    </AppLayout>
  );
}