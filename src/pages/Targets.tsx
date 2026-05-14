import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, differenceInCalendarMonths, addMonths, startOfMonth } from "date-fns";
import { Upload, Check, ChevronDown, ChevronRight, Copy, Sparkles, AlertTriangle } from "lucide-react";
import { useCurrencyVersion } from "@/contexts/CurrencyContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { TargetsUploadDialog } from "@/components/targets/TargetsUploadDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { METRICS, METRIC_LABELS, attainmentPct, attainmentTone, formatINR, type Metric } from "@/lib/csvTargets";

// ── Types ──
interface DealMeta {
  id: string;
  deal_name: string;
  account: string;
  vsd: string;
  bopm: string;
  mrr: number;
  total_deal_value: number;
  start_date: string | null;
  deal_status: string;
}
interface TargetRow {
  id?: string;
  deal_id: string;
  month: string; // YYYY-MM-DD
  contraction_target: number; contraction_actual: number;
  delivery_target: number;    delivery_actual: number;
  invoicing_target: number;   invoicing_actual: number;
  receivables_target: number; receivables_actual: number;
}
const ZERO_TARGET = (deal_id: string, month: string): TargetRow => ({
  deal_id, month,
  contraction_target: 0, contraction_actual: 0,
  delivery_target: 0,    delivery_actual: 0,
  invoicing_target: 0,   invoicing_actual: 0,
  receivables_target: 0, receivables_actual: 0,
});

const monthIso = (yyyymm: string) => `${yyyymm}-01`;
const prevMonthYYYYMM = (yyyymm: string) => format(addMonths(parseISO(`${yyyymm}-01`), -1), "yyyy-MM");
const nextMonthYYYYMM = (yyyymm: string) => format(addMonths(parseISO(`${yyyymm}-01`), 1), "yyyy-MM");

// Fiscal year start month for YTD = November.
function fiscalYearStartIso(monthIsoStr: string): string {
  const d = parseISO(monthIsoStr);
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-based; Nov = 10
  const startYear = m >= 10 ? y : y - 1;
  return format(new Date(startYear, 10, 1), "yyyy-MM-dd");
}

function pillTone(pct: number | null): string {
  if (pct === null) return "bg-muted text-muted-foreground";
  if (pct >= 95) return "bg-positive/15 text-positive";
  if (pct >= 80) return "bg-warning/15 text-warning";
  return "bg-destructive/15 text-destructive";
}

// Inline editable currency cell
function TargetCell({ value, prevValue, onSave, disabled, prevLabel, asTd = true }: {
  value: number;
  prevValue?: number;
  onSave: (v: number) => Promise<void>;
  disabled?: boolean;
  prevLabel?: string;
  asTd?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(String(value || ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setLocal(String(value || "")); }, [value, editing]);
  useEffect(() => { if (editing) setTimeout(() => inputRef.current?.select(), 0); }, [editing]);

  async function commit() {
    const num = Number(local) || 0;
    setEditing(false);
    if (num === value) return;
    setSaving(true);
    try {
      await onSave(num);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
      setLocal(String(value || ""));
    } finally {
      setSaving(false);
    }
  }

  const inner = (
    <>
      {editing && !disabled ? (
        <input
          ref={inputRef}
          type="number"
          value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setLocal(String(value || "")); setEditing(false); }
          }}
          className="w-24 h-7 rounded border border-primary bg-card px-1.5 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary"
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEditing(true)}
          className={cn(
            "w-full text-right rounded px-1.5 py-1 text-xs tabular-nums",
            disabled ? "cursor-default text-muted-foreground" : "hover:bg-muted/60 cursor-pointer",
            !value && "text-muted-foreground italic"
          )}
        >
          <span className="inline-flex items-center gap-1 justify-end">
            {saved && <Check className="h-3 w-3 text-positive" />}
            {value ? formatINR(value) : (disabled ? "—" : "Set target")}
          </span>
        </button>
      )}
      {prevValue !== undefined && prevValue > 0 && (
        <div className="text-[10px] text-muted-foreground text-right pr-1.5">
          {prevLabel || "Prev"} {formatINR(prevValue)}
        </div>
      )}
      {saving && <div className="text-[9px] text-muted-foreground text-right pr-1.5">saving…</div>}
    </>
  );
  return asTd ? (
    <td className="py-1 px-1.5 align-top">{inner}</td>
  ) : (
    <div className="py-1 px-1.5">{inner}</div>
  );
}

export default function Targets() {
  useCurrencyVersion();
  const { isAdmin } = useUserRole();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [overall, setOverall] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deals, setDeals] = useState<DealMeta[]>([]);
  const [targets, setTargets] = useState<Record<string, TargetRow>>({}); // key: deal_id
  const [prevTargets, setPrevTargets] = useState<Record<string, TargetRow>>({});
  const [allByDeal, setAllByDeal] = useState<Record<string, TargetRow[]>>({});
  const [nextTargets, setNextTargets] = useState<Record<string, TargetRow>>({});
  const [loading, setLoading] = useState(true);
  const [vsdFilter, setVsdFilter] = useState<string>("All");
  const [needsOnly, setNeedsOnly] = useState(false);
  const [behindOnly, setBehindOnly] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("saved");

  const monthLabel = overall ? "Overall (all months)" : format(parseISO(monthIso(month)), "MMMM yyyy");
  const prevYM = prevMonthYYYYMM(month);
  const prevLabel = format(parseISO(monthIso(prevYM)), "MMM");
  const nextYM = nextMonthYYYYMM(month);
  const nextLabel = format(parseISO(monthIso(nextYM)), "MMM yyyy");
  const fyStart = fiscalYearStartIso(monthIso(month));
  const fyStartLabel = format(parseISO(fyStart), "MMM");
  const ytdLabel = `YTD (${fyStartLabel}–${format(parseISO(monthIso(month)), "MMM")})`;

  // ── Load ──
  const load = useCallback(async () => {
    setLoading(true);
    const dealsP = supabase
      .from("staffing_deals")
      .select("id, deal_name, account, vsd, bopm, mrr, total_deal_value, start_date, deal_status")
      .in("deal_status", ["Active Deal", "New Deal in SLA/PO", "Deal - Open and WIP", "Deal in Renewal Process"])
      .order("deal_name");
    const tgtP = overall
      ? supabase.from("deal_financial_targets").select("*")
      : supabase.from("deal_financial_targets").select("*").eq("month", monthIso(month));
    const prevP = overall
      ? Promise.resolve({ data: [] as any[] })
      : supabase.from("deal_financial_targets").select("*").eq("month", monthIso(prevYM));
    const nextP = overall
      ? Promise.resolve({ data: [] as any[] })
      : supabase.from("deal_financial_targets").select("*").eq("month", monthIso(nextYM));
    // Load full target history (used for YTD + Lifetime calculations in expanded view).
    const allP = supabase.from("deal_financial_targets").select("*").limit(20000);
    // Pull actuals from deal_financials (consumption/invoiced/received) too —
    // many deals only record actuals there, not in deal_financial_targets.*_actual.
    const finP = overall
      ? supabase.from("deal_financials").select("deal_id, month, consumption, invoiced, received").limit(20000)
      : supabase.from("deal_financials").select("deal_id, month, consumption, invoiced, received").eq("month", monthIso(month));
    const finAllP = supabase
      .from("deal_financials")
      .select("deal_id, month, consumption, invoiced, received")
      .limit(20000);
    const [dealsRes, tgtRes, prevRes, nextRes, allRes, finRes, finAllRes] = await Promise.all([
      dealsP, tgtP, prevP, nextP, allP, finP, finAllP,
    ]);
    // Build deal_financials actuals lookup: per (deal_id, monthIso) → {consumption, invoiced, received}
    const finByKey = new Map<string, { consumption: number; invoiced: number; received: number }>();
    (finAllRes.data || []).forEach((r: any) => {
      const monthKey = String(r.month).slice(0, 10);
      finByKey.set(`${r.deal_id}__${monthKey}`, {
        consumption: Number(r.consumption) || 0,
        invoiced: Number(r.invoiced) || 0,
        received: Number(r.received) || 0,
      });
    });
    // Per-deal sum of all-time financials (for overall mode)
    const finSumByDeal = new Map<string, { consumption: number; invoiced: number; received: number }>();
    (finAllRes.data || []).forEach((r: any) => {
      const ex = finSumByDeal.get(r.deal_id) || { consumption: 0, invoiced: 0, received: 0 };
      ex.consumption += Number(r.consumption) || 0;
      ex.invoiced += Number(r.invoiced) || 0;
      ex.received += Number(r.received) || 0;
      finSumByDeal.set(r.deal_id, ex);
    });
    // Helper: prefer the *_actual on the targets row when > 0, otherwise fall back
    // to the corresponding column on deal_financials.
    const mergeActuals = (row: TargetRow, fin?: { consumption: number; invoiced: number; received: number }) => {
      if (!fin) return row;
      return {
        ...row,
        contraction_actual: row.contraction_actual || fin.consumption,
        invoicing_actual: row.invoicing_actual || fin.invoiced,
        receivables_actual: row.receivables_actual || fin.received,
      };
    };
    const dealRows = (dealsRes.data || []) as any[];
    setDeals(dealRows.map((d): DealMeta => ({
      id: d.id, deal_name: d.deal_name || d.id, account: d.account || "",
      vsd: d.vsd || "", bopm: d.bopm || "", mrr: Number(d.mrr) || 0,
      total_deal_value: Number(d.total_deal_value) || 0,
      start_date: d.start_date, deal_status: d.deal_status || "",
    })));
    const tMap: Record<string, TargetRow> = {};
    if (overall) {
      // Sum targets & actuals across all months per deal
      (tgtRes.data || []).forEach((r: any) => {
        const ex = tMap[r.deal_id] || ZERO_TARGET(r.deal_id, "ALL");
        METRICS.forEach(m => {
          (ex as any)[`${m}_target`] = (Number((ex as any)[`${m}_target`]) || 0) + (Number(r[`${m}_target`]) || 0);
          (ex as any)[`${m}_actual`] = (Number((ex as any)[`${m}_actual`]) || 0) + (Number(r[`${m}_actual`]) || 0);
        });
        tMap[r.deal_id] = ex;
      });
      // Layer in deal_financials actuals, only filling zeros so we never double-count.
      finSumByDeal.forEach((fin, deal_id) => {
        const ex = tMap[deal_id] || ZERO_TARGET(deal_id, "ALL");
        if (!ex.contraction_actual) ex.contraction_actual = fin.consumption;
        if (!ex.invoicing_actual)   ex.invoicing_actual   = fin.invoiced;
        if (!ex.receivables_actual) ex.receivables_actual = fin.received;
        tMap[deal_id] = ex;
      });
    } else {
      (tgtRes.data || []).forEach((r: any) => {
        const fin = finByKey.get(`${r.deal_id}__${monthIso(month)}`);
        tMap[r.deal_id] = mergeActuals(r as TargetRow, fin);
      });
      // For deals with no targets row but with deal_financials data this month,
      // synthesize a zero-target row so actuals still show.
      (finRes.data || []).forEach((r: any) => {
        if (tMap[r.deal_id]) return;
        tMap[r.deal_id] = mergeActuals(ZERO_TARGET(r.deal_id, monthIso(month)), {
          consumption: Number(r.consumption) || 0,
          invoiced: Number(r.invoiced) || 0,
          received: Number(r.received) || 0,
        });
      });
    }
    setTargets(tMap);
    const pMap: Record<string, TargetRow> = {};
    (prevRes.data || []).forEach((r: any) => {
      const fin = finByKey.get(`${r.deal_id}__${monthIso(prevYM)}`);
      pMap[r.deal_id] = mergeActuals(r as TargetRow, fin);
    });
    setPrevTargets(pMap);
    const nMap: Record<string, TargetRow> = {};
    (nextRes.data || []).forEach((r: any) => { nMap[r.deal_id] = r as TargetRow; });
    setNextTargets(nMap);
    const grouped: Record<string, TargetRow[]> = {};
    (allRes.data || []).forEach((r: any) => {
      const monthKey = String(r.month).slice(0, 10);
      const fin = finByKey.get(`${r.deal_id}__${monthKey}`);
      (grouped[r.deal_id] = grouped[r.deal_id] || []).push(mergeActuals(r as TargetRow, fin));
    });
    // Append financials-only months (no targets row) so YTD/Lifetime sums include them.
    const seenMonth = new Map<string, Set<string>>();
    (allRes.data || []).forEach((r: any) => {
      const set = seenMonth.get(r.deal_id) || new Set<string>();
      set.add(String(r.month).slice(0, 10));
      seenMonth.set(r.deal_id, set);
    });
    (finAllRes.data || []).forEach((r: any) => {
      const monthKey = String(r.month).slice(0, 10);
      const seen = seenMonth.get(r.deal_id);
      if (seen?.has(monthKey)) return;
      const stub = mergeActuals(ZERO_TARGET(r.deal_id, monthKey), {
        consumption: Number(r.consumption) || 0,
        invoiced: Number(r.invoiced) || 0,
        received: Number(r.received) || 0,
      });
      (grouped[r.deal_id] = grouped[r.deal_id] || []).push(stub);
    });
    setAllByDeal(grouped);
    setLoading(false);
  }, [month, prevYM, nextYM, overall]);

  useEffect(() => { void load(); }, [load]);

  // ── Save (upsert) one field ──
  const saveField = useCallback(
    async (deal_id: string, field: keyof TargetRow, value: number) => {
      const existing = targets[deal_id] || ZERO_TARGET(deal_id, monthIso(month));
      const next: any = { ...existing, [field]: value, deal_id, month: monthIso(month) };
      // Optimistic
      setTargets(prev => ({ ...prev, [deal_id]: next }));
      setSavingState("saving");
      const { data, error } = await supabase
        .from("deal_financial_targets")
        .upsert(next, { onConflict: "month,deal_id" })
        .select()
        .single();
      if (error) {
        setSavingState("idle");
        // Revert
        setTargets(prev => ({ ...prev, [deal_id]: existing }));
        throw error;
      }
      setTargets(prev => ({ ...prev, [deal_id]: data as TargetRow }));
      setSavingState("saved");
    },
    [targets, month]
  );

  const saveNextField = useCallback(
    async (deal_id: string, field: keyof TargetRow, value: number) => {
      const existing = nextTargets[deal_id] || ZERO_TARGET(deal_id, monthIso(nextYM));
      const row: any = { ...existing, [field]: value, deal_id, month: monthIso(nextYM) };
      setNextTargets(prev => ({ ...prev, [deal_id]: row }));
      setSavingState("saving");
      const { data, error } = await supabase
        .from("deal_financial_targets")
        .upsert(row, { onConflict: "month,deal_id" })
        .select()
        .single();
      if (error) {
        setSavingState("idle");
        setNextTargets(prev => ({ ...prev, [deal_id]: existing }));
        throw error;
      }
      setNextTargets(prev => ({ ...prev, [deal_id]: data as TargetRow }));
      setSavingState("saved");
    },
    [nextTargets, nextYM]
  );

  // ── Bulk: copy previous month targets for empty rows ──
  async function bulkCopyPrev() {
    const empties = filteredDeals.filter(d => !targets[d.id] || METRICS.every(m => !targets[d.id][`${m}_target` as keyof TargetRow]));
    const rows = empties
      .map(d => ({ deal_id: d.id, prev: prevTargets[d.id] }))
      .filter(x => x.prev)
      .map(({ deal_id, prev }) => ({
        deal_id, month: monthIso(month),
        contraction_target: prev!.contraction_target,
        contraction_actual: 0,
        delivery_target: prev!.delivery_target,
        delivery_actual: 0,
        invoicing_target: prev!.invoicing_target,
        invoicing_actual: 0,
        receivables_target: prev!.receivables_target,
        receivables_actual: 0,
      }));
    if (!rows.length) { toast.info("Nothing to copy"); return; }
    setSavingState("saving");
    const { error } = await supabase.from("deal_financial_targets").upsert(rows, { onConflict: "month,deal_id" });
    if (error) { toast.error(error.message); setSavingState("idle"); return; }
    toast.success(`Copied ${prevLabel} targets for ${rows.length} deals`);
    setSavingState("saved");
    await load();
  }

  async function bulkMatchMrr() {
    const rows = filteredDeals
      .filter(d => d.mrr > 0)
      .map(d => {
        const t = targets[d.id] || ZERO_TARGET(d.id, monthIso(month));
        const set = (cur: number, fallback: number) => cur > 0 ? cur : fallback;
        return {
          deal_id: d.id, month: monthIso(month),
          contraction_target: set(t.contraction_target, d.mrr),
          contraction_actual: t.contraction_actual,
          delivery_target: set(t.delivery_target, d.mrr),
          delivery_actual: t.delivery_actual,
          invoicing_target: set(t.invoicing_target, d.mrr),
          invoicing_actual: t.invoicing_actual,
          receivables_target: set(t.receivables_target, d.mrr),
          receivables_actual: t.receivables_actual,
        };
      });
    if (!rows.length) { toast.info("No MRR data on deals"); return; }
    setSavingState("saving");
    const { error } = await supabase.from("deal_financial_targets").upsert(rows, { onConflict: "month,deal_id" });
    if (error) { toast.error(error.message); setSavingState("idle"); return; }
    toast.success(`MRR-matched targets for ${rows.length} deals`);
    setSavingState("saved");
    await load();
  }

  // ── Derived ──
  const vsdList = useMemo(() => {
    const set = new Set<string>();
    deals.forEach(d => { if (d.vsd) set.add(d.vsd); });
    return ["All", ...Array.from(set).sort(), "Unassigned"];
  }, [deals]);

  const monthsElapsed = useCallback((startDate: string | null) => {
    if (!startDate) return 0;
    const m = differenceInCalendarMonths(parseISO(monthIso(month)), parseISO(startDate));
    return Math.max(0, m + 1);
  }, [month]);

  const expectedPace = useCallback((d: DealMeta) => d.mrr * monthsElapsed(d.start_date), [monthsElapsed]);

  const isBehindPace = useCallback((d: DealMeta) => {
    const t = targets[d.id];
    const expected = expectedPace(d);
    if (!t || expected <= 0) return false;
    return t.delivery_actual > 0 && t.delivery_actual < expected * 0.85;
  }, [targets, expectedPace]);

  const filteredDeals = useMemo(() => {
    let arr = deals;
    if (vsdFilter !== "All") {
      arr = arr.filter(d => vsdFilter === "Unassigned" ? !d.vsd : d.vsd === vsdFilter);
    }
    if (needsOnly) arr = arr.filter(d => !targets[d.id] || METRICS.every(m => !targets[d.id][`${m}_target` as keyof TargetRow]));
    if (behindOnly) arr = arr.filter(isBehindPace);
    return arr;
  }, [deals, vsdFilter, needsOnly, behindOnly, targets, isBehindPace]);

  // Summary totals (all deals, not filtered)
  const summary = useMemo(() => {
    const totals: Record<Metric, { target: number; actual: number }> = {
      contraction: { target: 0, actual: 0 },
      delivery:    { target: 0, actual: 0 },
      invoicing:   { target: 0, actual: 0 },
      receivables: { target: 0, actual: 0 },
    };
    let needs = 0;
    let behind = 0;
    deals.forEach(d => {
      const t = targets[d.id];
      const isEmpty = !t || METRICS.every(m => !t[`${m}_target` as keyof TargetRow]);
      if (isEmpty) needs++;
      if (isBehindPace(d)) behind++;
      if (t) {
        METRICS.forEach(m => {
          totals[m].target += Number((t as any)[`${m}_target`]) || 0;
          totals[m].actual += Number((t as any)[`${m}_actual`]) || 0;
        });
      }
    });
    return { totals, needs, behind, total: deals.length };
  }, [deals, targets, isBehindPace]);

  const bopmCount = useMemo(() => new Set(deals.map(d => d.bopm).filter(Boolean)).size, [deals]);

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-subhead font-semibold tracking-tight text-foreground">
              {overall ? "Overall financial performance (all months)" : `Set ${monthLabel} targets`}
            </h1>
            <p className="text-ui text-muted-foreground mt-1">
              {deals.length} deals · {bopmCount} BOPMs · tracking measured as MRR × months since start
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[11px] px-2 py-1 rounded-md",
              savingState === "saving" ? "bg-warning/10 text-warning" :
              savingState === "saved" ? "bg-positive/10 text-positive" : "bg-secondary text-muted-foreground"
            )}>
              {savingState === "saving" ? "Saving…" : savingState === "saved" ? "All saved" : "Idle"}
            </span>
            <button
              type="button"
              onClick={() => setOverall(v => !v)}
              className={cn(
                "text-[12px] px-2.5 py-1 rounded-md border transition-colors h-9",
                overall
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-foreground hover:bg-secondary"
              )}
            >
              Overall
            </button>
            {!overall && <DateRangeSelector value={month} onChange={setMonth} />}
            {isAdmin && !overall && (
              <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Import CSV
              </Button>
            )}
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="data-card">
            <p className="metric-label flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Deals needing {format(parseISO(monthIso(month)), "MMM")} targets
            </p>
            <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">{summary.needs}</p>
            <p className="text-[11px] text-muted-foreground">of {summary.total} deals</p>
            {summary.behind > 0 && (
              <p className="text-[11px] text-warning mt-1">{summary.behind} also behind expected pace</p>
            )}
          </div>
          {METRICS.map(m => {
            const t = summary.totals[m];
            const pct = attainmentPct(t.actual, t.target);
            return (
              <div key={m} className="data-card">
                <div className="flex items-baseline justify-between">
                  <p className="metric-label">{METRIC_LABELS[m]}</p>
                  <span className={cn("text-xs font-semibold tabular-nums", attainmentTone(pct))}>
                    {pct === null ? "—" : `${pct.toFixed(0)}%`}
                  </span>
                </div>
                <p className="text-lg font-semibold text-foreground mt-1 tabular-nums">{formatINR(t.actual)}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">/ {formatINR(t.target)} target</p>
              </div>
            );
          })}
        </div>

        {/* Bulk actions */}
        {isAdmin && !overall && (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 p-3 rounded-md border border-border bg-secondary/30">
            <p className="text-[12px] text-muted-foreground">
              {summary.needs} deals still need {format(parseISO(monthIso(month)), "MMM")} targets · {summary.behind} deals behind expected pace
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={bulkCopyPrev}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy {prevLabel} targets
              </Button>
              <Button size="sm" variant="outline" onClick={bulkMatchMrr}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Match MRR for empty fields
              </Button>
            </div>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {vsdList.map(v => (
            <button
              key={v}
              onClick={() => setVsdFilter(v)}
              className={cn(
                "text-[12px] px-2.5 py-1 rounded-md border transition-colors",
                vsdFilter === v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-secondary"
              )}
            >
              {v}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setNeedsOnly(v => !v)}
            className={cn("text-[12px] px-2.5 py-1 rounded-md border", needsOnly ? "bg-warning/15 border-warning text-warning" : "bg-card border-border hover:bg-secondary")}
          >
            Needs targets
          </button>
          <button
            onClick={() => setBehindOnly(v => !v)}
            className={cn("text-[12px] px-2.5 py-1 rounded-md border", behindOnly ? "bg-destructive/15 border-destructive text-destructive" : "bg-card border-border hover:bg-secondary")}
          >
            Behind pace
          </button>
        </div>

        {/* Table */}
        <div className="data-card p-0 overflow-hidden">
          {loading ? (
            <div className="h-48 bg-muted/30 animate-pulse" />
          ) : filteredDeals.length === 0 ? (
            <div className="p-8 text-center text-ui text-muted-foreground">No deals match the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-ui">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left py-2 pl-3 pr-2 font-medium w-8"></th>
                    <th className="text-left py-2 pr-3 font-medium">Deal</th>
                    <th className="text-right py-2 px-2 font-medium">Size</th>
                    <th className="text-left py-2 px-2 font-medium">Delivery vs expected pace</th>
                    <th colSpan={4} className="text-center py-2 px-2 font-medium border-l border-border">{overall ? "All months — cumulative target vs actual" : `${format(parseISO(monthIso(month)), "MMM yyyy")} targets`}</th>
                  </tr>
                  <tr className="border-b border-border bg-secondary/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th colSpan={4}></th>
                    {METRICS.map(m => (
                      <th key={m} className="text-right py-1.5 px-2 font-medium border-l border-border/50">{METRIC_LABELS[m]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map(d => {
                    const t = targets[d.id] || ZERO_TARGET(d.id, monthIso(month));
                    const prev = prevTargets[d.id];
                    const expected = expectedPace(d);
                    const monthsN = monthsElapsed(d.start_date);
                    const deliveryAct = t.delivery_actual;
                    const pacePct = expected > 0 ? Math.min(100, (deliveryAct / expected) * 100) : 0;
                    const paceColor = pacePct >= 95 ? "bg-positive" : pacePct >= 70 ? "bg-warning" : "bg-destructive";
                    const isOpen = !!expanded[d.id];
                    return (
                      <Fragment key={d.id}>
                        <tr className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="py-2.5 pl-3 pr-2 align-top">
                            <button
                              onClick={() => setExpanded(p => ({ ...p, [d.id]: !p[d.id] }))}
                              className="text-muted-foreground hover:text-foreground"
                              title={isOpen ? "Collapse" : "Expand"}
                            >
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="py-2.5 pr-3 align-top">
                            <Link to={`/deals/${d.id}`} className="font-medium text-foreground hover:text-primary block">
                              {d.deal_name}
                            </Link>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                              {d.account}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {d.id} · {d.bopm || "—"}{d.vsd && ` · VSD ${d.vsd}`}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right align-top">
                            <div className="font-semibold text-foreground tabular-nums">{formatINR(d.total_deal_value)}</div>
                            <div className="text-[11px] text-muted-foreground tabular-nums">{formatINR(d.mrr)} MRR</div>
                          </td>
                          <td className="py-2.5 px-2 align-top w-[260px]">
                            <div className="text-[11px] text-muted-foreground">
                              {formatINR(d.mrr)} × {monthsN}mo = {formatINR(expected)}
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary mt-1.5 overflow-hidden">
                              <div className={cn("h-full rounded-full", paceColor)} style={{ width: `${pacePct}%` }} />
                            </div>
                            <div className="flex items-baseline justify-between mt-1">
                              <span className="text-[11px] tabular-nums text-foreground">{formatINR(deliveryAct)} of {formatINR(expected)}</span>
                              <span className={cn("text-[11px] font-semibold tabular-nums", attainmentTone(expected > 0 ? (deliveryAct / expected) * 100 : null))}>
                                {expected > 0 ? `${Math.round((deliveryAct / expected) * 100)}%` : "—"}
                              </span>
                            </div>
                          </td>
                          {METRICS.map(m => (
                            <TargetCell
                              key={m}
                              value={Number((t as any)[`${m}_target`]) || 0}
                              prevValue={!overall && prev ? Number((prev as any)[`${m}_target`]) || 0 : undefined}
                              prevLabel={prevLabel}
                              disabled={!isAdmin || overall}
                              onSave={(v) => saveField(d.id, `${m}_target` as keyof TargetRow, v)}
                            />
                          ))}
                        </tr>
                        {isOpen && (() => {
                          const history = allByDeal[d.id] || [];
                          const curIso = monthIso(month);
                          // Sums helpers
                          const sumWhere = (pred: (iso: string) => boolean) => {
                            const acc: Record<Metric, { t: number; a: number }> = {
                              contraction: { t: 0, a: 0 },
                              delivery: { t: 0, a: 0 },
                              invoicing: { t: 0, a: 0 },
                              receivables: { t: 0, a: 0 },
                            };
                            history.forEach(r => {
                              if (!pred(r.month)) return;
                              METRICS.forEach(m => {
                                acc[m].t += Number((r as any)[`${m}_target`]) || 0;
                                acc[m].a += Number((r as any)[`${m}_actual`]) || 0;
                              });
                            });
                            return acc;
                          };
                          const ytd = sumWhere(iso => iso >= fyStart && iso <= curIso);
                          const lifetime = sumWhere(() => true);
                          const nextRow = nextTargets[d.id];
                          return (
                            <tr className="border-b border-border bg-secondary/10">
                              <td colSpan={8} className="px-6 py-4">
                                {/* Stats strip */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                  <div className="rounded-md border border-border bg-card px-3 py-2">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Deal Value</div>
                                    <div className="text-sm font-semibold text-foreground tabular-nums">{formatINR(d.total_deal_value)}</div>
                                  </div>
                                  <div className="rounded-md border border-border bg-card px-3 py-2">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">MRR</div>
                                    <div className="text-sm font-semibold text-foreground tabular-nums">{formatINR(d.mrr)}</div>
                                  </div>
                                  <div className="rounded-md border border-border bg-card px-3 py-2">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Months Elapsed</div>
                                    <div className="text-sm font-semibold text-foreground tabular-nums">{monthsN}</div>
                                  </div>
                                  <div className="rounded-md border border-border bg-card px-3 py-2">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">VSD · BOPM</div>
                                    <div className="text-sm font-medium text-foreground truncate">{(d.vsd || "—") + " · " + (d.bopm || "—")}</div>
                                  </div>
                                </div>

                                {/* Pace banner */}
                                <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[12px] text-foreground mb-3">
                                  <span className="font-medium text-primary">Expected pace</span> for this deal: {formatINR(d.mrr)} MRR × {monthsN} months = <span className="font-medium">{formatINR(expected)}</span> of each metric by end of {format(parseISO(curIso), "MMMM")}.
                                </div>

                                {/* Period table */}
                                <div className="rounded-md border border-border bg-card overflow-hidden">
                                  <table className="w-full text-[12px]">
                                    <thead>
                                      <tr className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                                        <th className="text-left py-2 pl-3 pr-2 font-medium w-[120px]"></th>
                                        <th className="text-left py-2 px-3 font-medium">{format(parseISO(curIso), "MMMM yyyy")}</th>
                                        <th className="text-left py-2 px-3 font-medium">{ytdLabel}</th>
                                        <th className="text-left py-2 px-3 font-medium">Lifetime</th>
                                        <th className="text-right py-2 pl-3 pr-3 font-medium text-primary">{nextLabel} target</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {METRICS.map(m => {
                                        const curT = Number((t as any)[`${m}_target`]) || 0;
                                        const curA = Number((t as any)[`${m}_actual`]) || 0;
                                        const curPct = attainmentPct(curA, curT);
                                        const ytdT = ytd[m].t;
                                        const ytdA = ytd[m].a;
                                        const ytdPct = attainmentPct(ytdA, ytdT);
                                        const lifeT = lifetime[m].t;
                                        const lifeA = lifetime[m].a;
                                        const lifePct = attainmentPct(lifeA, lifeT);
                                        const cell = (exp: number, actual: number, pct: number | null) => (
                                          <div className="flex items-center gap-2">
                                            <div className="flex-1 rounded-md border border-border/70 bg-background px-2 py-1.5 text-foreground tabular-nums">
                                              <span className="text-muted-foreground">Exp {formatINR(exp)} →</span> <span className="font-medium">{formatINR(actual)}</span>
                                            </div>
                                            <span className={cn("inline-flex items-center justify-center min-w-[44px] px-1.5 py-0.5 rounded-full text-[10px] font-medium tabular-nums", pillTone(pct))}>
                                              {pct === null ? "—" : `${Math.round(pct)}%`}
                                            </span>
                                          </div>
                                        );
                                        return (
                                          <tr key={m} className="border-t border-border/50">
                                            <td className="py-2 pl-3 pr-2 text-foreground font-medium">{METRIC_LABELS[m]}</td>
                                            <td className="py-2 px-3">{cell(curT, curA, curPct)}</td>
                                            <td className="py-2 px-3">{cell(ytdT, ytdA, ytdPct)}</td>
                                            <td className="py-2 px-3">{cell(lifeT, lifeA, lifePct)}</td>
                                            <td className="py-2 pl-3 pr-2">
                                              <div className="flex justify-end">
                                                <TargetCell
                                                  value={Number((nextRow as any)?.[`${m}_target`]) || 0}
                                                  disabled={!isAdmin || overall}
                                                  onSave={(v) => saveNextField(d.id, `${m}_target` as keyof TargetRow, v)}
                                                  asTd={false}
                                                />
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-3">
                                  Edits flow into this deal's <Link to={`/deals/${d.id}`} className="text-primary hover:underline">Financials tab</Link> automatically.
                                </p>
                              </td>
                            </tr>
                          );
                        })()}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/40 font-medium text-[12px]">
                    <td colSpan={4} className="py-2.5 pl-3 pr-2 text-muted-foreground">
                      Showing {filteredDeals.length} of {deals.length} deals · subtotals
                    </td>
                    {METRICS.map(m => {
                      const subtotal = filteredDeals.reduce((s, d) => s + (Number((targets[d.id] as any)?.[`${m}_target`]) || 0), 0);
                      return (
                        <td key={m} className="py-2.5 px-2 text-right tabular-nums text-foreground border-l border-border/50">
                          {formatINR(subtotal)}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {!isAdmin && (
          <p className="text-[11px] text-muted-foreground mt-3">
            Read-only view. Ask an admin to update targets.
          </p>
        )}

        <TargetsUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={load} defaultMonth={month} />
      </div>
    </AppLayout>
  );
}
