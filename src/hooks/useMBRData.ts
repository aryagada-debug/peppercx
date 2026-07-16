import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  dealType: string;
  startDate: string | null;
}

// A deal is considered a Retainer if its deal_type is "Retainer" (or contains
// "retainer" without "non"). Fallback to customer_type when deal_type is empty.
export function isRetainerDeal(d: { dealType?: string; customerType?: string }): boolean {
  const dt = (d.dealType || "").toLowerCase().trim();
  if (dt) {
    if (dt.includes("non")) return false;
    return dt.includes("retainer");
  }
  const ct = (d.customerType || "").toLowerCase().trim();
  if (!ct) return true; // unknown -> treat as retainer by default to preserve prior behavior
  if (ct.includes("non retainer") || ct.includes("non-retainer")) return false;
  return true;
}

export interface ActionItem {
  task: string;
  owner: string;
  deadline: string;
  done: boolean;
}

export interface MBREntry {
  id: string;
  dealId: string;
  weekStart: string;
  status: string;
  mode: string | null;
  notes: string | null;
  updatedBy: string;
  sentiment: string | null;
  fathomLink: string | null;
  transcript: string | null;
  aiSummary: string | null;
  actionItems: ActionItem[];
  scheduledDate: string | null;
  anirudhAdded: boolean;
  anirudhJoining: boolean;
  inputRecordedAt: string | null;
  mbrPptLink: string | null;
}

export interface VSDSummary {
  vsd: string;
  retainerAccounts: number;
  done: number;
  notDone: number;
  pending: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  scheduledCount: number;
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

function mapEntry(e: any): MBREntry {
  return {
    id: e.id,
    dealId: e.deal_id,
    weekStart: e.week_start,
    status: e.status,
    mode: e.mode,
    notes: e.notes,
    updatedBy: e.updated_by,
    sentiment: e.sentiment || null,
    fathomLink: e.fathom_link || null,
    transcript: e.transcript || null,
    aiSummary: e.ai_summary || null,
    actionItems: Array.isArray(e.action_items) ? e.action_items : [],
    scheduledDate: e.scheduled_date || null,
    anirudhAdded: !!e.anirudh_added,
    anirudhJoining: !!e.anirudh_joining,
    inputRecordedAt: e.input_recorded_at || null,
    mbrPptLink: e.mbr_ppt_link || null,
  };
}

const MBR_DEALS_KEY = ["mbr", "deals"] as const;
const MBR_ENTRIES_KEY = ["mbr", "entries"] as const;

async function fetchMBRDeals(): Promise<MBRDeal[]> {
  const { data } = await supabase
    .from("staffing_deals")
    .select("id, pc_code, new_deal_id_formulated, account, deal_name, vsd, principal_bopm, senior_bopm, bopm, customer_status, customer_type, service_line_tagging, business_unit, mrr, total_deal_value, net_deal_value, deal_type, start_date");
  if (!data) return [];
  return data
    .filter((d: any) => {
      const ct = (d.customer_type || "").toLowerCase().trim();
      // Keep retainers and non-retainers; only drop churned / irrelevant.
      if (ct === "churned" || ct.includes("churned")) return false;
      if (ct === "irrelevant") return false;
      return true;
    })
    .map((d: any) => ({
      id: d.id,
      pcCode: d.pc_code,
      dealId: d.new_deal_id_formulated || "",
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
      dealType: d.deal_type || "",
      startDate: d.start_date || null,
    }));
}

async function fetchMBREntries(): Promise<MBREntry[]> {
  const { data } = await supabase
    .from("mbr_entries")
    .select("*")
    .order("week_start", { ascending: false });
  return (data || []).map(mapEntry);
}

export function useMBRData() {
  const qc = useQueryClient();

  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: MBR_DEALS_KEY,
    queryFn: fetchMBRDeals,
  });
  const { data: allEntries = [], isLoading: entriesLoading, refetch: refetchEntries } = useQuery({
    queryKey: MBR_ENTRIES_KEY,
    queryFn: fetchMBREntries,
  });
  const loading = dealsLoading || entriesLoading;

  // Realtime sync for mbr_entries — debounced via React Query invalidation,
  // skipped while the tab is hidden, and shared by every consumer of the
  // ["mbr","entries"] query.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        qc.invalidateQueries({ queryKey: MBR_ENTRIES_KEY });
      }, 300);
    };
    const channel = supabase
      .channel("mbr-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "mbr_entries" }, schedule)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Get the latest entry per deal (most recent week_start)
  const latestEntryPerDeal = (() => {
    const map = new Map<string, MBREntry>();
    // allEntries is already sorted desc by week_start
    for (const entry of allEntries) {
      if (!map.has(entry.dealId)) {
        map.set(entry.dealId, entry);
      }
    }
    return map;
  })();

  const entries = Array.from(latestEntryPerDeal.values());

  // Group entries by month (YYYY-MM) → Map<dealId, MBREntry> (latest per deal per month)
  const entriesByMonth = useMemo(() => {
    const monthMap = new Map<string, Map<string, MBREntry>>();
    for (const entry of allEntries) {
      const month = entry.weekStart.substring(0, 7); // "YYYY-MM"
      if (!monthMap.has(month)) monthMap.set(month, new Map());
      const dealMap = monthMap.get(month)!;
      // allEntries sorted desc, so first entry per deal per month is latest
      if (!dealMap.has(entry.dealId)) {
        dealMap.set(entry.dealId, entry);
      }
    }
    return monthMap;
  }, [allEntries]);

  // Available months sorted chronologically
  const availableMonths = useMemo(() => {
    return Array.from(entriesByMonth.keys()).sort();
  }, [entriesByMonth]);

  const upsertEntry = useCallback(
    async (params: {
      dealId: string;
      status: string;
      mode: string | null;
      notes: string | null;
      updatedBy: string;
      sentiment?: string | null;
      fathomLink?: string | null;
      transcript?: string | null;
      aiSummary?: string | null;
      actionItems?: ActionItem[];
      scheduledDate?: string | null;
      anirudhAdded?: boolean;
      mbrPptLink?: string | null;
      mbrDate?: string | null; // yyyy-MM-dd — date the MBR was conducted; drives which week/month the entry belongs to
      anirudhJoining?: boolean;
    }) => {
      const weekStart = params.mbrDate ? getMonday(new Date(params.mbrDate)) : getMonday(new Date());
      const row: any = {
        deal_id: params.dealId,
        week_start: weekStart,
        status: params.status,
        mode: params.mode,
        notes: params.notes,
        updated_by: params.updatedBy,
      };
      if (params.sentiment !== undefined) row.sentiment = params.sentiment;
      if (params.fathomLink !== undefined) row.fathom_link = params.fathomLink;
      if (params.transcript !== undefined) row.transcript = params.transcript;
      if (params.aiSummary !== undefined) row.ai_summary = params.aiSummary;
      if (params.actionItems !== undefined) row.action_items = params.actionItems;
      if (params.scheduledDate !== undefined) row.scheduled_date = params.scheduledDate;
      if (params.anirudhAdded !== undefined) row.anirudh_added = params.anirudhAdded;
      if (params.mbrPptLink !== undefined) row.mbr_ppt_link = params.mbrPptLink;
      if (params.anirudhJoining !== undefined) row.anirudh_joining = params.anirudhJoining;
      if (params.status === "Done") row.input_recorded_at = new Date().toISOString();

      // Optimistic cache patch so the UI reflects the change instantly.
      const prev = qc.getQueryData<MBREntry[]>([...MBR_ENTRIES_KEY]) || [];
      const existing = prev.find((e) => e.dealId === params.dealId && e.weekStart === weekStart);
      const optimistic: MBREntry = {
        id: existing?.id ?? `optimistic-${params.dealId}-${weekStart}`,
        dealId: params.dealId,
        weekStart,
        status: params.status,
        mode: params.mode,
        notes: params.notes,
        updatedBy: params.updatedBy,
        sentiment: params.sentiment !== undefined ? params.sentiment : existing?.sentiment ?? null,
        fathomLink: params.fathomLink !== undefined ? params.fathomLink : existing?.fathomLink ?? null,
        transcript: params.transcript !== undefined ? params.transcript : existing?.transcript ?? null,
        aiSummary: params.aiSummary !== undefined ? params.aiSummary : existing?.aiSummary ?? null,
        actionItems: params.actionItems !== undefined ? params.actionItems : existing?.actionItems ?? [],
        scheduledDate: params.scheduledDate !== undefined ? params.scheduledDate : existing?.scheduledDate ?? null,
        anirudhAdded: params.anirudhAdded !== undefined ? !!params.anirudhAdded : existing?.anirudhAdded ?? false,
        anirudhJoining: existing?.anirudhJoining ?? false,
        inputRecordedAt: params.status === "Done" ? new Date().toISOString() : existing?.inputRecordedAt ?? null,
        mbrPptLink: params.mbrPptLink !== undefined ? params.mbrPptLink : existing?.mbrPptLink ?? null,
      };
      const next = existing
        ? prev.map((e) => (e === existing ? optimistic : e))
        : [optimistic, ...prev];
      qc.setQueryData([...MBR_ENTRIES_KEY], next);

      try {
        await (supabase.from("mbr_entries") as any).upsert(
          row,
          { onConflict: "deal_id,week_start" }
        ).select();
      } catch (err) {
        // Roll back on failure.
        qc.setQueryData([...MBR_ENTRIES_KEY], prev);
        throw err;
      }

      // If an MBR was scheduled (or marked done) for the current month,
      // auto-close any open "Schedule MBR" auto-task for this deal.
      try {
        const sd = params.scheduledDate || (params.status === "Done" ? new Date().toISOString().slice(0, 10) : null);
        if (sd) {
          const d = new Date(sd);
          const now = new Date();
          if (d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()) {
            await (supabase.from("deal_tasks") as any)
              .update({ stage: "Done" })
              .eq("deal_id", params.dealId)
              .eq("phase", "MBR")
              .neq("stage", "Done")
              .ilike("title", "Schedule MBR%");
          }
        }
      } catch (_) { /* non-fatal */ }

      // Reconcile with canonical server row (real id, timestamps).
      qc.invalidateQueries({ queryKey: [...MBR_ENTRIES_KEY] });
    },
    [qc],
  );

  const toggleAnirudhJoining = useCallback(
    async (dealId: string, joining: boolean) => {
      const weekStart = getMonday(new Date());
      const prev = qc.getQueryData<MBREntry[]>([...MBR_ENTRIES_KEY]) || [];
      const existing = prev.find((e) => e.dealId === dealId && e.weekStart === weekStart);
      const optimistic: MBREntry = existing
        ? { ...existing, anirudhJoining: joining }
        : {
            id: `optimistic-${dealId}-${weekStart}`,
            dealId, weekStart, status: "Pending", mode: null, notes: null, updatedBy: "",
            sentiment: null, fathomLink: null, transcript: null, aiSummary: null,
            actionItems: [], scheduledDate: null, anirudhAdded: false, anirudhJoining: joining,
            inputRecordedAt: null, mbrPptLink: null,
          };
      const next = existing
        ? prev.map((e) => (e === existing ? optimistic : e))
        : [optimistic, ...prev];
      qc.setQueryData([...MBR_ENTRIES_KEY], next);
      try {
        await (supabase.from("mbr_entries") as any).upsert(
          { deal_id: dealId, week_start: weekStart, anirudh_joining: joining, status: "Pending", updated_by: "" },
          { onConflict: "deal_id,week_start" }
        ).select();
      } catch (err) {
        qc.setQueryData([...MBR_ENTRIES_KEY], prev);
        throw err;
      }
      qc.invalidateQueries({ queryKey: [...MBR_ENTRIES_KEY] });
    },
    [qc]
  );

  // Computed: VSD summary using latest entries
  const vsdSummary: VSDSummary[] = (() => {
    const vsdMap = new Map<string, { total: number; done: number; notDone: number; green: number; yellow: number; red: number; scheduled: number }>();

    for (const deal of deals) {
      const v = deal.vsd || "Unknown";
      if (!vsdMap.has(v)) vsdMap.set(v, { total: 0, done: 0, notDone: 0, green: 0, yellow: 0, red: 0, scheduled: 0 });
      const s = vsdMap.get(v)!;
      s.total++;
      const entry = latestEntryPerDeal.get(deal.id);
      if (entry) {
        if (entry.status === "Done") s.done++;
        else if (entry.status === "Not Done") s.notDone++;
        if (entry.sentiment === "Green") s.green++;
        else if (entry.sentiment === "Yellow") s.yellow++;
        else if (entry.sentiment === "Red") s.red++;
        if (entry.scheduledDate) s.scheduled++;
      }
    }

    return Array.from(vsdMap.entries())
      .map(([vsd, s]) => ({
        vsd,
        retainerAccounts: s.total,
        done: s.done,
        notDone: s.notDone,
        pending: s.total - s.done - s.notDone,
        greenCount: s.green,
        yellowCount: s.yellow,
        redCount: s.red,
        scheduledCount: s.scheduled,
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
    allEntries,
    loading,
    upsertEntry,
    toggleAnirudhJoining,
    vsdSummary,
    totals,
    entriesByMonth,
    availableMonths,
    refresh: () => refetchEntries(),
  };
}
