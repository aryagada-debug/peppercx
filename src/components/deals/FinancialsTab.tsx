import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { formatINR } from "@/lib/csvTargets";
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
  green: { bg: "bg-[#EAF3DE]", text: "text-[#27500A]", bar: "#639922" },
  amber: { bg: "bg-[#FAEEDA]", text: "text-[#633806]", bar: "#BA7517" },
  red: { bg: "bg-[#FCEBEB]", text: "text-[#791F1F]", bar: "#E24B4A" },
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
      <td className={cn("py-1 px-1.5 text-right", groupStart && "border-l border-[#D3D1C7]")}>
        <input
          ref={inputRef}
          type="number"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="w-20 h-7 rounded border border-[#534AB7] bg-white px-1.5 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-[#534AB7]"
        />
      </td>
    );
  }

  return (
    <td
      className={cn(
        "py-2.5 px-3 text-right tabular-nums relative",
        disabled ? "cursor-default" : "cursor-pointer hover:bg-[#F1EFE8]/60 transition-colors",
        groupStart && "border-l border-[#D3D1C7]"
      )}
      onClick={() => { if (!disabled) setEditing(true); }}
    >
      {showCheck && <Check className="absolute left-0.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#639922]" />}
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

  const totals = useMemo(() => {
    const contracted = rows.reduce((s, r) => s + r.contracted, 0);
    const consumption = rows.reduce((s, r) => s + r.consumption, 0);
    const invoiced = rows.reduce((s, r) => s + r.invoiced, 0);
    const received = rows.reduce((s, r) => s + r.received, 0);
    const outstanding = invoiced - received;
    const contractionTarget = rows.reduce((s, r) => s + (r.contractionTarget ?? r.contracted), 0);
    const deliveryTarget = rows.reduce((s, r) => s + (r.deliveryTarget ?? 0), 0);
    const deliveryActual = rows.reduce((s, r) => s + (r.deliveryActual ?? 0), 0);
    const invoicingTarget = rows.reduce((s, r) => s + (r.invoicingTarget ?? 0), 0);
    const receivablesTarget = rows.reduce((s, r) => s + (r.receivablesTarget ?? 0), 0);
    return { contracted, consumption, invoiced, received, outstanding,
      contractionTarget, deliveryTarget, deliveryActual, invoicingTarget, receivablesTarget };
  }, [rows]);

  const netDealValue = deal?.totalDealValue || 0;

  // Pipeline health for an arbitrary subset of rows
  const computePipeline = useCallback((subset: FinancialRow[]) => {
    const consumption = subset.reduce((s, r) => s + r.consumption, 0);
    const invoiced = subset.reduce((s, r) => s + r.invoiced, 0);
    const received = subset.reduce((s, r) => s + r.received, 0);
    const contractionTarget = subset.reduce((s, r) => s + (r.contractionTarget ?? r.contracted), 0);
    const deliveryTarget = subset.reduce((s, r) => s + (r.deliveryTarget ?? 0), 0);
    const deliveryActual = subset.reduce((s, r) => s + (r.deliveryActual ?? 0), 0);
    const invoicingTarget = subset.reduce((s, r) => s + (r.invoicingTarget ?? 0), 0);
    const receivablesTarget = subset.reduce((s, r) => s + (r.receivablesTarget ?? 0), 0);
    const outstanding = invoiced - received;
    const invTgt = invoicingTarget || netDealValue;
    const recTgt = receivablesTarget || invoiced;
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
    const ytdRows = rows.filter(r => new Date(r.month).getFullYear() === curY);
    return {
      current: computePipeline(currentMonthRows),
      ytd: computePipeline(ytdRows),
      lifetime: computePipeline(rows),
    };
  }, [rows, computePipeline]);

  // Chart data
  const chartData = useMemo(() => rows.map(r => ({
    month: fmtMonth(r.month),
    target: r.contractionTarget ?? r.contracted,
    attainment: r.consumption,
    deliveryTarget: r.deliveryTarget ?? 0,
    deliveryActual: r.deliveryActual ?? 0,
    plannedGm: r.plannedGmPct,
    actualGm: r.actualGmPct,
    attColor: attColor((r.contractionTarget ?? r.contracted) > 0 ? (r.consumption / (r.contractionTarget ?? r.contracted)) * 100 : 0),
  })), [rows]);

  // Consumption bucket
  const bucket = useMemo(() => {
    const ytdMrr = totals.contracted;
    const ytdConsumption = totals.consumption;
    const under = Math.max(0, ytdMrr - ytdConsumption);
    const over = Math.max(0, ytdConsumption - ytdMrr);
    const pct = ytdMrr > 0 ? (ytdConsumption / ytdMrr) * 100 : 0;
    return { ytdMrr, ytdConsumption, under, over, pct };
  }, [totals]);

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
              <div key={k.label} className="rounded-lg bg-[#F1EFE8] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{k.label}</p>
                  {cs && <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", cs.bg, cs.text)}>{k.att.toFixed(0)}%</span>}
                </div>
                <p className="text-xl font-medium mt-1">{k.value}</p>
                {k.sub && <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{k.sub}</p>}
                {k.alert && <p className="text-[11px] text-[#791F1F] mt-0.5">{k.alert}</p>}
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
          <div className="rounded-xl border border-[#D3D1C7] bg-white p-3.5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium">Monthly contraction vs target</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#AFA9EC]" /> Target</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#639922]" /> Attainment</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(0)}L` : `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                <Bar dataKey="target" fill="#AFA9EC" radius={[3, 3, 0, 0]} />
                <Bar dataKey="attainment" fill="#639922" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gross Margin % */}
          <div className="rounded-xl border border-[#D3D1C7] bg-white p-3.5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium">Gross margin %</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm border border-[#8EDBC3]" style={{ borderStyle: "dashed" }} /> Planned</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#1D9E75]" /> Actual</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 60]} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="plannedGm" stroke="#8EDBC3" strokeDasharray="6 3" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="actualGm" stroke="#1D9E75" dot={{ fill: "#1D9E75", r: 3 }} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Section 4: Monthly Financials Table ── */}
      <div className="rounded-xl border border-[#D3D1C7] bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D3D1C7]">
          <p className="text-[13px] font-medium">Monthly financials</p>
          {canAddMonth && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1 text-[13px] font-medium text-[#534AB7] bg-[#EEEDFE] border border-[#534AB7]/20 rounded-lg px-3 py-1.5 hover:bg-[#E3E1FC] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add month
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#D3D1C7] bg-[#FAF9F4]">
                <th rowSpan={2} className="py-2.5 px-3 font-medium text-muted-foreground text-left align-bottom">Month</th>
                <th colSpan={2} className="py-2 px-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-[#534AB7] border-l border-[#D3D1C7]">Contraction</th>
                <th colSpan={2} className="py-2 px-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-[#1D9E75] border-l border-[#D3D1C7]">Delivery</th>
                <th colSpan={2} className="py-2 px-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-[#3267C7] border-l border-[#D3D1C7]">Invoiced</th>
                <th colSpan={2} className="py-2 px-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-[#C7414C] border-l border-[#D3D1C7]">Received</th>
              </tr>
              <tr className="border-b border-[#D3D1C7]">
                {[
                  { l: "Target", group: true }, { l: "Actual" },
                  { l: "Target", group: true }, { l: "Actual" },
                  { l: "Target", group: true }, { l: "Actual" },
                  { l: "Target", group: true }, { l: "Actual" },
                ].map((c, i) => (
                  <th key={i} className={cn("py-2 px-3 text-right text-[11px] font-medium text-muted-foreground whitespace-nowrap", c.group && "border-l border-[#D3D1C7]")}>{c.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
                    No financial data recorded yet. Click 'Add month' to get started.
                  </td>
                </tr>
              ) : (
                <>
                  {rows.map((row, idx) => {
                    const cTarget = row.contractionTarget ?? row.contracted;
                    const dTarget = row.deliveryTarget ?? 0;
                    const dActual = row.deliveryActual ?? 0;
                    const iTarget = row.invoicingTarget ?? 0;
                    const rTarget = row.receivablesTarget ?? 0;
                    return (
                      <tr key={row.id} className={cn("group", idx < rows.length - 1 && "border-b border-[#D3D1C7]/50")}>
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
                  <tr className="bg-[#F1EFE8] font-medium border-t border-[#D3D1C7]">
                    <td className="py-2.5 px-3">Total</td>
                    <td className="py-2.5 px-3 text-right tabular-nums border-l border-[#D3D1C7]">{fmtCurrency(totals.contractionTarget)}</td>
                    <TotalActualCell value={totals.consumption} target={totals.contractionTarget} />
                    <td className="py-2.5 px-3 text-right tabular-nums border-l border-[#D3D1C7]">{fmtCurrency(totals.deliveryTarget)}</td>
                    <TotalActualCell value={totals.deliveryActual} target={totals.deliveryTarget} />
                    <td className="py-2.5 px-3 text-right tabular-nums border-l border-[#D3D1C7]">{fmtCurrency(totals.invoicingTarget)}</td>
                    <TotalActualCell value={totals.invoiced} target={totals.invoicingTarget} />
                    <td className="py-2.5 px-3 text-right tabular-nums border-l border-[#D3D1C7]">{fmtCurrency(totals.receivablesTarget)}</td>
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
          <div className="rounded-lg bg-[#F1EFE8] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">YTD retainer MRR</p>
            <p className="text-xl font-medium mt-1">{fmtCurrency(bucket.ytdMrr)}</p>
          </div>
          <div className="rounded-lg bg-[#F1EFE8] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">YTD retainer contraction</p>
            <p className="text-xl font-medium mt-1">{fmtCurrency(bucket.ytdConsumption)}</p>
            <p className={cn("text-xs mt-0.5 font-medium", bucket.pct >= 100 ? "text-[#27500A]" : "text-[#633806]")}>
              {bucket.pct.toFixed(0)}% of target
            </p>
          </div>
          <div className="rounded-lg bg-[#F1EFE8] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Under-contraction</p>
            <p className="text-xl font-medium mt-1 text-[#27500A]">{fmtCurrency(bucket.under)}</p>
          </div>
          <div className="rounded-lg bg-[#F1EFE8] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Over-contraction</p>
            <p className="text-xl font-medium mt-1 text-[#791F1F]">{bucket.over > 0 ? `-${fmtCurrency(bucket.over)}` : "₹0"}</p>
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
          className="w-20 h-7 rounded border border-[#534AB7] bg-white px-1.5 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-[#534AB7]"
        />
      </td>
    );
  }
  return (
    <td
      className={cn("py-2.5 px-3 text-right tabular-nums whitespace-nowrap", disabled ? "cursor-default" : "cursor-pointer hover:bg-[#F1EFE8]/60 transition-colors")}
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
    <div className="rounded-xl border border-[#D3D1C7] bg-white p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-medium">{title}</p>
        <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", cs.bg, cs.text)}>
          {att.toFixed(0)}%
        </span>
      </div>
      <p className="text-xl font-medium">{fmtCurrency(value)}</p>
      <p className="text-xs text-muted-foreground mt-0.5">Target: {fmtCurrency(target)}</p>
      <div className="mt-2 h-[5px] rounded bg-[#F1EFE8] overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${Math.min(100, att)}%`, backgroundColor: cs.bar }} />
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">{status}</p>
    </div>
  );
}

// ── Pipeline Matrix (Metric × Period table) ──
type PipelineCell = { att: number; value: number; target: number; status: string };
type PipelinePeriods = {
  current: { contraction: PipelineCell; delivery: PipelineCell; invoicing: PipelineCell; receivables: PipelineCell };
  ytd: typeof PipelinePeriodsRef extends never ? never : any;
  lifetime: any;
};
const PipelinePeriodsRef = null as never;

const METRIC_CONFIG = [
  { key: "contraction" as const, title: "Contraction", subtitle: "Deals signed", icon: FileCheck2, accent: "#7B6BD9", iconBg: "bg-[#EEEDFE]", iconText: "text-[#534AB7]", titleText: "text-[#534AB7]" },
  { key: "delivery" as const, title: "Delivery", subtitle: "Work completed", icon: Truck, accent: "#1D9E75", iconBg: "bg-[#DEF2EA]", iconText: "text-[#1D9E75]", titleText: "text-[#1D9E75]" },
  { key: "invoicing" as const, title: "Invoicing", subtitle: "Bills raised", icon: Receipt, accent: "#3267C7", iconBg: "bg-[#E1EAF8]", iconText: "text-[#3267C7]", titleText: "text-[#3267C7]" },
  { key: "receivables" as const, title: "Receivables", subtitle: "Payments received", icon: Wallet, accent: "#C7414C", iconBg: "bg-[#F8E1E3]", iconText: "text-[#C7414C]", titleText: "text-[#C7414C]" },
];

function PipelineMatrix({ periods }: { periods: { current: any; ytd: any; lifetime: any } }) {
  const cols = [
    { key: "current", label: "Current Month", data: periods.current },
    { key: "ytd", label: "YTD", data: periods.ytd },
    { key: "lifetime", label: "Lifetime", data: periods.lifetime },
  ] as const;
  return (
    <div className="rounded-xl border border-[#D3D1C7] bg-white overflow-hidden">
      <div className="grid grid-cols-[minmax(180px,1.1fr)_repeat(3,minmax(0,1.4fr))] bg-[#FAF9F4] border-b border-[#D3D1C7]">
        <div className="py-3 px-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Metric</div>
        {cols.map(c => (
          <div key={c.key} className="py-3 px-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground border-l border-[#D3D1C7]">{c.label}</div>
        ))}
      </div>
      {METRIC_CONFIG.map((m, idx) => {
        const Icon = m.icon;
        return (
          <div
            key={m.key}
            className={cn(
              "grid grid-cols-[minmax(180px,1.1fr)_repeat(3,minmax(0,1.4fr))] relative",
              idx < METRIC_CONFIG.length - 1 && "border-b border-[#D3D1C7]/60"
            )}
          >
            <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: m.accent }} />
            <div className="py-4 pl-5 pr-4 flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", m.iconBg)}>
                <Icon className={cn("h-4.5 w-4.5", m.iconText)} strokeWidth={1.75} />
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
      if (att >= 100) gapLabel = gap === 0 ? "₹0 outstanding" : `+${fmtCurrency(-gap)}`;
      else gapLabel = `${fmtCurrency(gap)} outstanding`;
    } else {
      if (att >= 100) gapLabel = gap === 0 ? "On plan" : `+${fmtCurrency(-gap)}`;
      else gapLabel = `${fmtCurrency(gap)} gap`;
    }
  }
  return (
    <div className="py-4 px-4 border-l border-[#D3D1C7]/60 flex flex-col justify-between min-h-[90px]">
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-[20px] font-medium tabular-nums leading-none", isZero && "text-muted-foreground")}>
          {fmtCurrency(value)}
        </p>
        <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", hasTarget ? cs.bg : "bg-[#F1EFE8]", hasTarget ? cs.text : "text-muted-foreground")}>
          {hasTarget ? `${att.toFixed(0)}%` : "0%"}
        </span>
      </div>
      {hasTarget && (
        <div className="mt-2 h-[3px] rounded bg-[#F1EFE8] overflow-hidden">
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
    { label: "Contracted (₹)", key: "contracted", type: "number" },
    { label: "Contraction (₹)", key: "consumption", type: "number" },
    { label: "Planned GM%", key: "plannedGmPct", type: "number" },
    { label: "Actual GM%", key: "actualGmPct", type: "number" },
    { label: "Invoiced (₹)", key: "invoiced", type: "number" },
    { label: "Received (₹)", key: "received", type: "number" },
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
            <Button size="sm" onClick={handleSave} className="bg-[#534AB7] hover:bg-[#4A42A3]">Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
