import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { formatINR } from "@/lib/csvTargets";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCY_SYMBOL } from "@/lib/currency";
import { toast } from "sonner";
import { Plus, X, Check, FileCheck2, Truck, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface FinancialRow {
  id: string;
  dealId: string;
  month: string;
  contracted: number;
  consumption: number;
  plannedGmPct: number;
  actualGmPct: number;
  invoiced: number;
  received: number;
  outstanding: number;
  invoiceDate?: string;
  receivedDate?: string;
  outstandingDate?: string;
  contractionTarget?: number;
  deliveryTarget?: number;
  deliveryActual?: number;
  invoicingTarget?: number;
  receivablesTarget?: number;
}

interface DealInfo {
  totalDealValue?: number | null;
  mrr?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface Props {
  rows: FinancialRow[];
  dealId: string;
  deal?: DealInfo;
  onAdd: (row: Omit<FinancialRow, "id">) => void;
  onUpdate: (id: string, updates: Partial<FinancialRow>) => void;
  onDelete: (id: string) => void;
}

const fmtCurrency = (n: number) => {
  return formatINR(Number(n) || 0);
};

const fmtMonth = (m: string) => {
  const d = new Date(m);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

const attColor = (pct: number) => {
  if (pct >= 100) return "green";
  if (pct >= 70) return "amber";
  return "red";
};

const colorStyles = {
  green: { bg: "bg-[hsl(var(--success-bg))]", text: "text-positive", bar: "hsl(var(--positive))" },
  amber: { bg: "bg-[hsl(var(--warning-bg))]", text: "text-warning", bar: "hsl(var(--warning))" },
  red: { bg: "bg-[hsl(var(--danger-bg))]", text: "text-destructive", bar: "hsl(var(--destructive))" },
};

// ── Editable Table Cell ──
function EditableTableCell({ value, field, rowId, onUpdate, format = "currency", suffix = "", disabled = false, groupStart = false }: {
  value: number; field: string; rowId: string;
  onUpdate: (id: string, updates: Partial<FinancialRow>) => void;
  format?: "currency" | "percent";
  suffix?: string;
  disabled?: boolean;
  groupStart?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(String(value));
  const [showCheck, setShowCheck] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setLocalVal(String(value));
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, value]);

  const commit = useCallback(() => {
    setEditing(false);
    const num = Number(localVal);
    if (!isNaN(num) && num !== value) {
      onUpdate(rowId, { [field]: num } as Partial<FinancialRow>);
      setShowCheck(true);
      setTimeout(() => setShowCheck(false), 1200);
    }
  }, [localVal, value, field, rowId, onUpdate]);

  if (editing && !disabled) {
    return (
      <td className={cn("py-1 px-1.5 text-right", groupStart && "border-l border-border")}>
        <input
          ref={inputRef}
          type="number"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="w-20 h-7 rounded border border-primary bg-card px-1.5 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary"
        />
      </td>
    );
  }

  return (
    <td
      className={cn(
        "py-2.5 px-3 text-right tabular-nums relative",
        disabled ? "cursor-default" : "cursor-pointer hover:bg-muted/60 transition-colors",
        groupStart && "border-l border-border"
      )}
      onClick={() => { if (!disabled) setEditing(true); }}
    >
      {showCheck && <Check className="absolute left-0.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-positive" />}
      {format === "currency" ? fmtCurrency(value) : `${value}${suffix}`}
    </td>
  );
}

interface PropsExtended extends Props {
  canEdit?: boolean;
  canAddMonth?: boolean;
}

export function FinancialsTab({ rows, dealId, deal, onAdd, onUpdate, onDelete, canEdit = true, canAddMonth = true }: PropsExtended) {
  const [addOpen, setAddOpen] = useState(false);

  // Rows from contract start month through current month (inclusive),
  // used by the chart, monthly table and its totals.
  const displayRows = useMemo(() => {
    const start = deal?.startDate;
    if (!start) return rows;
    const startKey = start.slice(0, 7); // YYYY-MM
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return rows.filter(r => {
      const k = String(r.month).slice(0, 7);
      return k >= startKey && k <= curKey;
    });
  }, [rows, deal?.startDate]);

  const totals = useMemo(() => {
    const contracted = displayRows.reduce((s, r) => s + r.contracted, 0);
    const consumption = displayRows.reduce((s, r) => s + r.consumption, 0);
    const invoiced = displayRows.reduce((s, r) => s + r.invoiced, 0);
    const received = displayRows.reduce((s, r) => s + r.received, 0);
    const outstanding = invoiced - received;
    const contractionTarget = displayRows.reduce((s, r) => s + (r.contractionTarget ?? r.contracted), 0);
    const deliveryTarget = displayRows.reduce((s, r) => s + (r.deliveryTarget ?? 0), 0);
    const deliveryActual = displayRows.reduce((s, r) => s + (r.deliveryActual ?? 0), 0);
    const invoicingTarget = displayRows.reduce((s, r) => s + (r.invoicingTarget ?? 0), 0);
    const receivablesTarget = displayRows.reduce((s, r) => s + (r.receivablesTarget ?? 0), 0);
    return { contracted, consumption, invoiced, received, outstanding,
      contractionTarget, deliveryTarget, deliveryActual, invoicingTarget, receivablesTarget };
  }, [displayRows]);

  const netDealValue = deal?.totalDealValue || 0;
  const dealMrr = Number(deal?.mrr) || 0;

  // Number of months between two dates, inclusive on both ends.
  // Always returns at least 1 if both dates are valid.
  const monthsBetween = (start?: string | null, end?: string | null): number => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
    return Math.max(1, months);
  };

  const lifetimeMonths = useMemo(
    () => monthsBetween(deal?.startDate, deal?.endDate),
    [deal?.startDate, deal?.endDate]
  );

  // Pipeline health for an arbitrary subset of rows.
  // `targetOverride` replaces the contraction & delivery targets (used for YTD/Lifetime
  // roll-ups). `mrrTarget` always replaces the invoicing & receivables targets so that
  // retainer-style deals are measured against MRR × months for the period.
  const computePipeline = useCallback((subset: FinancialRow[], targetOverride?: number, mrrTarget?: number) => {
    const consumption = subset.reduce((s, r) => s + r.consumption, 0);
    const invoiced = subset.reduce((s, r) => s + r.invoiced, 0);
    const received = subset.reduce((s, r) => s + r.received, 0);
    const sumContractionTarget = subset.reduce((s, r) => s + (r.contractionTarget ?? r.contracted), 0);
    const sumDeliveryTarget = subset.reduce((s, r) => s + (r.deliveryTarget ?? 0), 0);
    const deliveryActual = subset.reduce((s, r) => s + (r.deliveryActual ?? 0), 0);
    const sumInvoicingTarget = subset.reduce((s, r) => s + (r.invoicingTarget ?? 0), 0);
    const sumReceivablesTarget = subset.reduce((s, r) => s + (r.receivablesTarget ?? 0), 0);
    const outstanding = invoiced - received;
    const contractionTarget = targetOverride ?? sumContractionTarget;
    const deliveryTarget = targetOverride ?? sumDeliveryTarget;
    // For retainer deals (MRR > 0), invoicing & receivables targets = MRR × months
    // in the period. Otherwise fall back to per-row sums / net deal value.
    const invTgt = mrrTarget ?? (sumInvoicingTarget || netDealValue);
    const recTgt = mrrTarget ?? (sumReceivablesTarget || invoiced);
    return {
      contraction: {
        att: contractionTarget > 0 ? (consumption / contractionTarget) * 100 : 0,
        value: consumption, target: contractionTarget,
        status: consumption >= contractionTarget && contractionTarget > 0
          ? `Over-contracted by ${fmtCurrency(consumption - contractionTarget)}`
          : `${fmtCurrency(Math.max(0, contractionTarget - consumption))} pending contraction`,
      },
      delivery: {
        att: deliveryTarget > 0 ? (deliveryActual / deliveryTarget) * 100 : 0,
        value: deliveryActual, target: deliveryTarget,
        status: `${fmtCurrency(Math.max(0, deliveryTarget - deliveryActual))} pending delivery`,
      },
      invoicing: {
        att: invTgt > 0 ? (invoiced / invTgt) * 100 : 0,
        value: invoiced, target: invTgt,
        status: `${fmtCurrency(Math.max(0, invTgt - invoiced))} pending invoicing`,
      },
      receivables: {
        att: recTgt > 0 ? (received / recTgt) * 100 : 0,
        value: received, target: recTgt,
        status: `${fmtCurrency(outstanding)} outstanding`,
      },
    };
  }, [netDealValue]);

  const periods = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth();
    const currentMonthRows = rows.filter(r => {
      const d = new Date(r.month);
      return d.getFullYear() === curY && d.getMonth() === curM;
    });
    // YTD = from contract start date through the current month (inclusive).
    // Lifetime = from contract start date through contract end date.
    const today = now.toISOString().slice(0, 10);
    const contractStart = deal?.startDate || "";
    const contractEnd = deal?.endDate || "";
    const currentMonthEnd = new Date(curY, curM + 1, 0).toISOString().slice(0, 10);
    const ytdEnd = contractEnd && contractEnd < today ? contractEnd : currentMonthEnd;
    const inRange = (m: string, start: string, end: string) => {
      if (!start || !end) return false;
      return m >= start.slice(0, 7) + "-01" && m <= end;
    };
    const ytdRows = contractStart
      ? rows.filter(r => inRange(r.month, contractStart, ytdEnd))
      : rows.filter(r => new Date(r.month).getFullYear() === curY);
    const lifetimeRows = contractStart && contractEnd
      ? rows.filter(r => inRange(r.month, contractStart, contractEnd))
      : rows;
    const ytdMonths = contractStart && ytdEnd && contractStart <= ytdEnd
      ? monthsBetween(contractStart, ytdEnd)
      : 0;
    const ytdTarget = dealMrr > 0 && ytdMonths > 0 ? dealMrr * ytdMonths : undefined;
    const lifetimeTarget = dealMrr > 0 && lifetimeMonths > 0 ? dealMrr * lifetimeMonths : undefined;
    const currentMrrTarget = dealMrr > 0 ? dealMrr : undefined;
    return {
      current: computePipeline(currentMonthRows, undefined, currentMrrTarget),
      ytd: computePipeline(ytdRows, undefined, ytdTarget),
      // Lifetime: contraction & delivery targets also use total deal value
      // (MRR × total contract months) for retainer deals.
      lifetime: computePipeline(lifetimeRows, lifetimeTarget, lifetimeTarget),
    };
  }, [rows, computePipeline, deal?.startDate, deal?.endDate, dealMrr, lifetimeMonths]);

  // Chart data
  const chartData = useMemo(() => displayRows.map(r => ({
    month: fmtMonth(r.month),
    target: r.contractionTarget ?? r.contracted,
    attainment: r.consumption,
    deliveryTarget: r.deliveryTarget ?? 0,
    deliveryActual: r.deliveryActual ?? 0,
    plannedGm: r.plannedGmPct,
    actualGm: r.actualGmPct,
    attColor: attColor((r.contractionTarget ?? r.contracted) > 0 ? (r.consumption / (r.contractionTarget ?? r.contracted)) * 100 : 0),
  })), [displayRows]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Section 1: Deal Snapshot ── */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground mb-3">Deal Snapshot</p>
        <div className="grid grid-cols-1 gap-3">
          {[
            { label: "Net deal value", value: fmtCurrency(netDealValue), sub: deal?.mrr ? `MRR ${fmtCurrency(deal.mrr)}` : "" },
          ].map((k: any) => {
            const ac = k.att != null ? attColor(k.att) : null;
            const cs = ac ? colorStyles[ac] : null;
            return (
              <div key={k.label} className="rounded-lg bg-muted p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{k.label}</p>
                  {cs && <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", cs.bg, cs.text)}>{k.att.toFixed(0)}%</span>}
                </div>
                <p className="text-xl font-medium mt-1">{k.value}</p>
                {k.sub && <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{k.sub}</p>}
                {k.alert && <p className="text-[11px] text-destructive mt-0.5">{k.alert}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 2: Pipeline Health Matrix (Current Month / YTD / Lifetime) ── */}
      <PipelineMatrix periods={periods} />

      {/* ── Section 3: Charts ── */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Contraction vs Target */}
          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium">Monthly contraction vs target</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary/55" /> Target</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-positive" /> Attainment</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(0)}L` : `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                <Bar dataKey="target" fill="hsl(var(--primary) / 0.55)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="attainment" fill="hsl(var(--positive))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gross Margin % */}
          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium">Gross margin %</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm border border-positive/55" style={{ borderStyle: "dashed" }} /> Planned</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-positive" /> Actual</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 60]} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="plannedGm" stroke="hsl(var(--positive) / 0.55)" strokeDasharray="6 3" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="actualGm" stroke="hsl(var(--positive))" dot={{ fill: "hsl(var(--positive))", r: 3 }} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Section 4: Monthly Financials Table ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-[13px] font-medium">Monthly financials</p>
          {canAddMonth && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1 text-[13px] font-medium text-primary bg-accent border border-primary/20 rounded-lg px-3 py-1.5 hover:bg-accent/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add month
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th rowSpan={2} className="py-2.5 px-3 font-medium text-muted-foreground text-left align-bottom">Month</th>
                <th colSpan={2} className="py-2 px-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-primary border-l border-border">Contraction</th>
                <th colSpan={2} className="py-2 px-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-positive border-l border-border">Delivery</th>
                <th colSpan={2} className="py-2 px-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-info border-l border-border">Invoiced</th>
                <th colSpan={2} className="py-2 px-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-destructive border-l border-border">Received</th>
              </tr>
              <tr className="border-b border-border">
                {[
                  { l: "Target", group: true }, { l: "Actual" },
                  { l: "Target", group: true }, { l: "Actual" },
                  { l: "Target", group: true }, { l: "Actual" },
                  { l: "Target", group: true }, { l: "Actual" },
                ].map((c, i) => (
                  <th key={i} className={cn("py-2 px-3 text-right text-[11px] font-medium text-muted-foreground whitespace-nowrap", c.group && "border-l border-border")}>{c.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
                    No financial data recorded yet. Click 'Add month' to get started.
                  </td>
                </tr>
              ) : (
                <>
                  {displayRows.map((row, idx) => {
                    const cTarget = row.contractionTarget ?? row.contracted;
                    const dTarget = row.deliveryTarget ?? 0;
                    const dActual = row.deliveryActual ?? 0;
                    const iTarget = row.invoicingTarget ?? 0;
                    const rTarget = row.receivablesTarget ?? 0;
                    return (
                      <tr key={row.id} className={cn("group", idx < displayRows.length - 1 && "border-b border-border/50")}>
                        <td className="py-2.5 px-3 font-medium text-muted-foreground">{fmtMonth(row.month)}</td>
                        <EditableTableCell value={cTarget} field="contractionTarget" rowId={row.id} onUpdate={onUpdate} disabled={!canEdit} groupStart />
                        <ActualCell value={row.consumption} target={cTarget} field="consumption" rowId={row.id} onUpdate={onUpdate} disabled={!canEdit} />
                        <EditableTableCell value={dTarget} field="deliveryTarget" rowId={row.id} onUpdate={onUpdate} disabled={!canEdit} groupStart />
                        <ActualCell value={dActual} target={dTarget} field="deliveryActual" rowId={row.id} onUpdate={onUpdate} disabled={!canEdit} />
                        <EditableTableCell value={iTarget} field="invoicingTarget" rowId={row.id} onUpdate={onUpdate} disabled={!canEdit} groupStart />
                        <ActualCell value={row.invoiced} target={iTarget} field="invoiced" rowId={row.id} onUpdate={onUpdate} disabled={!canEdit} />
                        <EditableTableCell value={rTarget} field="receivablesTarget" rowId={row.id} onUpdate={onUpdate} disabled={!canEdit} groupStart />
                        <ActualCell value={row.received} target={rTarget} field="received" rowId={row.id} onUpdate={onUpdate} disabled={!canEdit} />
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-muted font-medium border-t border-border">
                    <td className="py-2.5 px-3">Total</td>
                    <td className="py-2.5 px-3 text-right tabular-nums border-l border-border">{fmtCurrency(totals.contractionTarget)}</td>
                    <TotalActualCell value={totals.consumption} target={totals.contractionTarget} />
                    <td className="py-2.5 px-3 text-right tabular-nums border-l border-border">{fmtCurrency(totals.deliveryTarget)}</td>
                    <TotalActualCell value={totals.deliveryActual} target={totals.deliveryTarget} />
                    <td className="py-2.5 px-3 text-right tabular-nums border-l border-border">{fmtCurrency(totals.invoicingTarget)}</td>
                    <TotalActualCell value={totals.invoiced} target={totals.invoicingTarget} />
                    <td className="py-2.5 px-3 text-right tabular-nums border-l border-border">{fmtCurrency(totals.receivablesTarget)}</td>
                    <TotalActualCell value={totals.received} target={totals.receivablesTarget} />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 5: Contraction Bucket ── */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground mb-3">Contraction Bucket</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">YTD retainer MRR</p>
            <p className="text-xl font-medium mt-1">{fmtCurrency(bucket.ytdMrr)}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">YTD retainer contraction</p>
            <p className="text-xl font-medium mt-1">{fmtCurrency(bucket.ytdConsumption)}</p>
            <p className={cn("text-xs mt-0.5 font-medium", bucket.pct >= 100 ? "text-positive" : "text-warning")}>
              {bucket.pct.toFixed(0)}% of target
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Under-contraction</p>
            <p className="text-xl font-medium mt-1 text-positive">{fmtCurrency(bucket.under)}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Over-contraction</p>
            <p className="text-xl font-medium mt-1 text-destructive">{bucket.over > 0 ? `-${fmtCurrency(bucket.over)}` : fmtCurrency(0)}</p>
          </div>
        </div>
      </div>

      {/* ── Add Month Modal ── */}
      <AddMonthDialog open={addOpen} onOpenChange={setAddOpen} dealId={dealId} defaultMrr={deal?.mrr || 0} onAdd={onAdd} />
    </div>
  );
}

// ── Pipeline Health Card ──
function PipelineCard({ title, att, value, target, status }: { title: string; att: number; value: number; target: number; status: string }) {
  return PipelineCardImpl({ title, att, value, target, status });
}

function ActualCell({ value, target, field, rowId, onUpdate, disabled }: {
  value: number; target: number; field: string; rowId: string;
  onUpdate: (id: string, updates: Partial<FinancialRow>) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { setLocalVal(String(value)); setTimeout(() => inputRef.current?.select(), 0); } }, [editing, value]);
  const commit = () => {
    setEditing(false);
    const num = Number(localVal);
    if (!isNaN(num) && num !== value) onUpdate(rowId, { [field]: num } as Partial<FinancialRow>);
  };
  const att = target > 0 ? (value / target) * 100 : 0;
  const cs = colorStyles[attColor(att)];
  if (editing && !disabled) {
    return (
      <td className="py-1 px-1.5 text-right">
        <input
          ref={inputRef} type="number" value={localVal}
          onChange={e => setLocalVal(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="w-20 h-7 rounded border border-primary bg-card px-1.5 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary"
        />
      </td>
    );
  }
  return (
    <td
      className={cn("py-2.5 px-3 text-right tabular-nums whitespace-nowrap", disabled ? "cursor-default" : "cursor-pointer hover:bg-muted/60 transition-colors")}
      onClick={() => { if (!disabled) setEditing(true); }}
    >
      <span>{fmtCurrency(value)}</span>
      {target > 0 && (
        <span className={cn("ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium align-middle", cs.bg, cs.text)}>
          {att.toFixed(0)}%
        </span>
      )}
    </td>
  );
}

function TotalActualCell({ value, target }: { value: number; target: number }) {
  const att = target > 0 ? (value / target) * 100 : 0;
  const cs = colorStyles[attColor(att)];
  return (
    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
      <span>{fmtCurrency(value)}</span>
      {target > 0 && (
        <span className={cn("ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium align-middle", cs.bg, cs.text)}>
          {att.toFixed(0)}%
        </span>
      )}
    </td>
  );
}

function PipelineCardImpl({ title, att, value, target, status }: { title: string; att: number; value: number; target: number; status: string }) {
  const ac = attColor(att);
  const cs = colorStyles[ac];
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-medium">{title}</p>
        <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", cs.bg, cs.text)}>
          {att.toFixed(0)}%
        </span>
      </div>
      <p className="text-xl font-medium">{fmtCurrency(value)}</p>
      <p className="text-xs text-muted-foreground mt-0.5">Target: {fmtCurrency(target)}</p>
      <div className="mt-2 h-[5px] rounded bg-muted overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${Math.min(100, att)}%`, backgroundColor: cs.bar }} />
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">{status}</p>
    </div>
  );
}

// ── Pipeline Matrix (Metric × Period table) ──
type PipelineCell = { att: number; value: number; target: number; status: string };

const METRIC_CONFIG = [
  { key: "contraction" as const, title: "Contraction", subtitle: "Deals signed", icon: FileCheck2, accent: "hsl(var(--primary))", iconBg: "bg-accent", iconText: "text-primary", titleText: "text-primary" },
  { key: "delivery" as const, title: "Delivery", subtitle: "Work completed", icon: Truck, accent: "hsl(var(--positive))", iconBg: "bg-positive/10", iconText: "text-positive", titleText: "text-positive" },
  { key: "invoicing" as const, title: "Invoicing", subtitle: "Bills raised", icon: Receipt, accent: "hsl(var(--info))", iconBg: "bg-info/10", iconText: "text-info", titleText: "text-info" },
  { key: "receivables" as const, title: "Receivables", subtitle: "Payments received", icon: Wallet, accent: "hsl(var(--destructive))", iconBg: "bg-destructive/10", iconText: "text-destructive", titleText: "text-destructive" },
];

function PipelineMatrix({ periods }: { periods: { current: any; ytd: any; lifetime: any } }) {
  const cols = [
    { key: "current", label: "Current Month", data: periods.current },
    { key: "ytd", label: "YTD", data: periods.ytd },
    { key: "lifetime", label: "Lifetime", data: periods.lifetime },
  ] as const;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[minmax(180px,1.1fr)_repeat(3,minmax(0,1.4fr))] bg-muted/50 border-b border-border">
        <div className="py-3 px-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Metric</div>
        {cols.map(c => (
          <div key={c.key} className="py-3 px-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground border-l border-border">{c.label}</div>
        ))}
      </div>
      {METRIC_CONFIG.map((m, idx) => {
        const Icon = m.icon;
        return (
          <div
            key={m.key}
            className={cn(
              "grid grid-cols-[minmax(180px,1.1fr)_repeat(3,minmax(0,1.4fr))] relative",
              idx < METRIC_CONFIG.length - 1 && "border-b border-border/60"
            )}
          >
            <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: m.accent }} />
            <div className="py-4 pl-5 pr-4 flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", m.iconBg)}>
                <Icon className={cn("h-[18px] w-[18px]", m.iconText)} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className={cn("text-[14px] font-medium leading-tight", m.titleText)}>{m.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{m.subtitle}</p>
              </div>
            </div>
            {cols.map(c => {
              const cell: PipelineCell = c.data[m.key];
              return (
                <PipelineMatrixCell
                  key={c.key}
                  cell={cell}
                  metricKey={m.key}
                  accent={m.accent}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function PipelineMatrixCell({ cell, metricKey, accent }: { cell: PipelineCell; metricKey: string; accent: string }) {
  const { value, target, att } = cell;
  const hasTarget = target > 0;
  const ac = attColor(att);
  const cs = colorStyles[ac];
  const isZero = !hasTarget && value === 0;
  const gap = target - value;
  let gapLabel = "";
  if (hasTarget) {
    if (metricKey === "receivables") {
      if (att >= 100) gapLabel = gap === 0 ? `${fmtCurrency(0)} outstanding` : `+${fmtCurrency(-gap)}`;
      else gapLabel = `${fmtCurrency(gap)} outstanding`;
    } else {
      if (att >= 100) gapLabel = gap === 0 ? "On plan" : `+${fmtCurrency(-gap)}`;
      else gapLabel = `${fmtCurrency(gap)} gap`;
    }
  }
  return (
    <div className="py-4 px-4 border-l border-border/60 flex flex-col justify-between min-h-[90px]">
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-[20px] font-medium tabular-nums leading-none", isZero && "text-muted-foreground")}>
          {fmtCurrency(value)}
        </p>
        <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", hasTarget ? cs.bg : "bg-muted", hasTarget ? cs.text : "text-muted-foreground")}>
          {hasTarget ? `${att.toFixed(0)}%` : "0%"}
        </span>
      </div>
      {hasTarget && (
        <div className="mt-2 h-[3px] rounded bg-muted overflow-hidden">
          <div className="h-full rounded transition-all" style={{ width: `${Math.min(100, att)}%`, backgroundColor: cs.bar }} />
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
        <span>Target {fmtCurrency(target)}</span>
        {hasTarget && <span>{gapLabel}</span>}
      </div>
    </div>
  );
}

// ── Add Month Dialog ──
function AddMonthDialog({ open, onOpenChange, dealId, defaultMrr, onAdd }: {
  open: boolean; onOpenChange: (o: boolean) => void; dealId: string; defaultMrr: number;
  onAdd: (row: Omit<FinancialRow, "id">) => void;
}) {
  const { currency } = useCurrency();
  const sym = CURRENCY_SYMBOL[currency];
  const [form, setForm] = useState({
    month: "", contracted: defaultMrr, consumption: 0,
    plannedGmPct: 0, actualGmPct: 0, invoiced: 0, received: 0,
  });

  const handleSave = () => {
    if (!form.month) return;
    // Month input gives "YYYY-MM", DB needs "YYYY-MM-DD"
    const monthDate = form.month.length === 7 ? `${form.month}-01` : form.month;
    onAdd({
      dealId,
      month: monthDate,
      contracted: form.contracted,
      consumption: form.consumption,
      plannedGmPct: form.plannedGmPct,
      actualGmPct: form.actualGmPct,
      invoiced: form.invoiced,
      received: form.received,
      outstanding: form.invoiced - form.received,
    });
    setForm({ month: "", contracted: defaultMrr, consumption: 0, plannedGmPct: 0, actualGmPct: 0, invoiced: 0, received: 0 });
    onOpenChange(false);
    toast.success("Month added");
  };

  const fields = [
    { label: "Month", key: "month", type: "month" },
    { label: `Contracted (${sym})`, key: "contracted", type: "number" },
    { label: `Contraction (${sym})`, key: "consumption", type: "number" },
    { label: "Planned GM%", key: "plannedGmPct", type: "number" },
    { label: "Actual GM%", key: "actualGmPct", type: "number" },
    { label: `Invoiced (${sym})`, key: "invoiced", type: "number" },
    { label: `Received (${sym})`, key: "received", type: "number" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add financial month</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {fields.map(f => (
            <div key={f.key} className={f.key === "month" ? "col-span-2" : ""}>
              <Label className="text-xs">{f.label}</Label>
              <Input
                type={f.type}
                value={(form as any)[f.key] || ""}
                onChange={e => setForm(p => ({ ...p, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                className="mt-1 h-9"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-3 pt-3 border-t">
          <p className="text-xs text-muted-foreground">Outstanding: {fmtCurrency(form.invoiced - form.received)}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} className="bg-primary hover:bg-primary/90">Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
