import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MBRDeal {
  id: string;
  pcCode: string;
  dealId: string;
  account: string;
  dealName: string;
  vsd: string;
  principalBopm: string;
  seniorBopm: string;
  bopm: string;
  customerStatus: string;
  customerType: string;
  serviceLineTagging: string;
  businessUnit: string;
  mrr: number | null;
  totalDealValue: number | null;
  netDealValue: number | null;
}

export interface MBREntry {
  id: string;
  dealId: string;
  weekStart: string;
  status: string;
  mode: string | null;
  notes: string | null;
  updatedBy: string;
}

export interface VSDSummary {
  vsd: string;
  retainerAccounts: number;
  done: number;
  notDone: number;
  pending: number;
}

function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split("T")[0];
}

export function getWeekOptions(): { value: string; label: string }[] {
  const weeks: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -8; i <= 4; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i * 7);
    const monday = getMonday(d);
    const end = new Date(monday);
    end.setDate(end.getDate() + 6);
    const label = `${new Date(monday).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
    weeks.push({ value: monday, label });
  }
  return weeks;
}

export function useMBRData() {
  const [deals, setDeals] = useState<MBRDeal[]>([]);
  const [entries, setEntries] = useState<MBREntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(getMonday(new Date()));

  const loadDeals = useCallback(async () => {
    const { data } = await supabase
      .from("staffing_deals")
      .select("id, pc_code, deal_id, account, deal_name, vsd, principal_bopm, senior_bopm, bopm, customer_status, customer_type, service_line_tagging, business_unit, mrr, total_deal_value, net_deal_value, deal_type")
      .in("deal_type", ["Retainer"]);

    if (data) {
      setDeals(
        data
          .filter((d: any) => {
            const ct = (d.customer_type || "").toLowerCase();
            return ct.includes("retainer") && !ct.includes("non") && !ct.includes("churned");
          })
          .map((d: any) => ({
            id: d.id,
            pcCode: d.pc_code,
            dealId: d.deal_id,
            account: d.account,
            dealName: d.deal_name,
            vsd: d.vsd || "Unknown",
            principalBopm: d.principal_bopm || "",
            seniorBopm: d.senior_bopm || "",
            bopm: d.bopm || "",
            customerStatus: d.customer_status || "",
            customerType: d.customer_type || "",
            serviceLineTagging: d.service_line_tagging || "",
            businessUnit: d.business_unit || "",
            mrr: d.mrr ? Number(d.mrr) : null,
            totalDealValue: d.total_deal_value ? Number(d.total_deal_value) : null,
            netDealValue: d.net_deal_value ? Number(d.net_deal_value) : null,
          }))
      );
    }
  }, []);

  const loadEntries = useCallback(async (week: string) => {
    const { data } = await supabase
      .from("mbr_entries")
      .select("*")
      .eq("week_start", week);

    if (data) {
      setEntries(
        data.map((e: any) => ({
          id: e.id,
          dealId: e.deal_id,
          weekStart: e.week_start,
          status: e.status,
          mode: e.mode,
          notes: e.notes,
          updatedBy: e.updated_by,
        }))
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadDeals();
      await loadEntries(selectedWeek);
      setLoading(false);
    })();
  }, [selectedWeek]);

  const upsertEntry = useCallback(
    async (dealId: string, status: string, mode: string | null, notes: string | null, updatedBy: string) => {
      const { data, error } = await (supabase.from("mbr_entries") as any).upsert(
        {
          deal_id: dealId,
          week_start: selectedWeek,
          status,
          mode,
          notes,
          updated_by: updatedBy,
        },
        { onConflict: "deal_id,week_start" }
      ).select();

      if (!error && data?.[0]) {
        setEntries((prev) => {
          const existing = prev.findIndex((e) => e.dealId === dealId && e.weekStart === selectedWeek);
          const newEntry: MBREntry = {
            id: data[0].id,
            dealId: data[0].deal_id,
            weekStart: data[0].week_start,
            status: data[0].status,
            mode: data[0].mode,
            notes: data[0].notes,
            updatedBy: data[0].updated_by,
          };
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = newEntry;
            return updated;
          }
          return [...prev, newEntry];
        });
      }
    },
    [selectedWeek]
  );

  // Computed: VSD summary
  const vsdSummary: VSDSummary[] = (() => {
    const vsdMap = new Map<string, { total: number; done: number; notDone: number }>();
    const entryMap = new Map(entries.map((e) => [e.dealId, e]));

    for (const deal of deals) {
      const v = deal.vsd || "Unknown";
      if (!vsdMap.has(v)) vsdMap.set(v, { total: 0, done: 0, notDone: 0 });
      const s = vsdMap.get(v)!;
      s.total++;
      const entry = entryMap.get(deal.id);
      if (entry) {
        if (entry.status === "Done") s.done++;
        else if (entry.status === "Not Done") s.notDone++;
      }
    }

    return Array.from(vsdMap.entries())
      .map(([vsd, s]) => ({
        vsd,
        retainerAccounts: s.total,
        done: s.done,
        notDone: s.notDone,
        pending: s.total - s.done - s.notDone,
      }))
      .sort((a, b) => b.retainerAccounts - a.retainerAccounts);
  })();

  const totals = {
    retainerAccounts: deals.length,
    done: entries.filter((e) => e.status === "Done").length,
    notDone: entries.filter((e) => e.status === "Not Done").length,
    pending: deals.length - entries.filter((e) => e.status === "Done" || e.status === "Not Done" || e.status === "Not Required").length,
  };

  return {
    deals,
    entries,
    loading,
    selectedWeek,
    setSelectedWeek,
    upsertEntry,
    vsdSummary,
    totals,
    refresh: () => loadEntries(selectedWeek),
  };
}
