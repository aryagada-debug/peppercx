import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, X, Check } from "lucide-react";
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
  if (!n && n !== 0) return "—";
  if (n === 0) return "₹0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(0)}K`;
  return `${sign}₹${abs}`;
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
function EditableTableCell({ value, field, rowId, onUpdate, format = "currency", suffix = "" }: {
  value: number; field: string; rowId: string;
  onUpdate: (id: string, updates: Partial<FinancialRow>) => void;
  format?: "currency" | "percent";
  suffix?: string;
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

  if (editing) {
    return (
      <td className="py-1 px-1.5 text-right">
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
      className="py-2.5 px-3 text-right tabular-nums cursor-pointer hover:bg-[#F1EFE8]/60 transition-colors relative"
      onClick={() => setEditing(true)}
    >
      {showCheck && <Check className="absolute left-0.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#639922]" />}
      {format === "currency" ? fmtCurrency(value) : `${value}${suffix}`}
    </td>
  );
}

export function FinancialsTab({ rows, dealId, deal, onAdd, onUpdate, onDelete }: Props) {
  const [addOpen, setAddOpen] = useState(false);

  const totals = useMemo(() => {
    const contracted = rows.reduce((s, r) => s + r.contracted, 0);
    const consumption = rows.reduce((s, r) => s + r.consumption, 0);
    const invoiced = rows.reduce((s, r) => s + r.invoiced, 0);
    const received = rows.reduce((s, r) => s + r.received, 0);
    const outstanding = invoiced - received;
    return { contracted, consumption, invoiced, received, outstanding };
  }, [rows]);

  const netDealValue = deal?.totalDealValue || 0;

  // Pipeline health calculations
  const pipeline = useMemo(() => {
    const consumptionAtt = totals.contracted > 0 ? (totals.consumption / totals.contracted) * 100 : 0;
    const deliveryAtt = totals.consumption > 0 ? (totals.consumption / totals.consumption) * 100 : 0; // delivered = consumption for now
    const invoicingAtt = netDealValue > 0 ? (totals.invoiced / netDealValue) * 100 : 0;
    const receivablesAtt = totals.invoiced > 0 ? (totals.received / totals.invoiced) * 100 : 0;
    return {
      consumption: { att: consumptionAtt, value: totals.consumption, target: totals.contracted },
      delivery: { att: deliveryAtt, value: totals.consumption, target: totals.consumption },
      invoicing: { att: invoicingAtt, value: totals.invoiced, target: netDealValue },
      receivables: { att: receivablesAtt, value: totals.received, target: totals.invoiced },
    };
  }, [totals, netDealValue]);

  // Chart data
  const chartData = useMemo(() => rows.map(r => ({
    month: fmtMonth(r.month),
    target: r.contracted,
    attainment: r.consumption,
    plannedGm: r.plannedGmPct,
    actualGm: r.actualGmPct,
    attColor: attColor(r.contracted > 0 ? (r.consumption / r.contracted) * 100 : 0),
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Net deal value", value: fmtCurrency(netDealValue) },
            { label: "Total MIS recognition", value: fmtCurrency(totals.consumption) },
            { label: "Total invoiced", value: fmtCurrency(totals.invoiced) },
            { label: "Total received", value: fmtCurrency(totals.received) },
            { label: "Outstanding", value: fmtCurrency(totals.outstanding), alert: totals.outstanding > 0 },
          ].map(k => (
            <div key={k.label} className="rounded-lg bg-[#F1EFE8] p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{k.label}</p>
              <p className={cn("text-xl font-medium mt-1", k.alert && "text-[#791F1F]")}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 2: Pipeline Health ── */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground mb-3">Pipeline Health</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <PipelineCard title="Consumption" att={pipeline.consumption.att} value={pipeline.consumption.value} target={pipeline.consumption.target}
            status={pipeline.consumption.att >= 100
              ? `Over-consumed by ${fmtCurrency(totals.consumption - totals.contracted)}`
              : `${fmtCurrency(totals.contracted - totals.consumption)} pending consumption`} />
          <PipelineCard title="Delivery" att={pipeline.delivery.att} value={pipeline.delivery.value} target={pipeline.delivery.target}
            status={`${fmtCurrency(Math.max(0, totals.consumption - totals.consumption))} pending delivery`} />
          <PipelineCard title="Invoicing" att={pipeline.invoicing.att} value={pipeline.invoicing.value} target={pipeline.invoicing.target}
            status={`${(100 - pipeline.invoicing.att).toFixed(0)}% of deal pending invoicing`} />
          <PipelineCard title="Receivables" att={pipeline.receivables.att} value={pipeline.receivables.value} target={pipeline.receivables.target}
            status={`${fmtCurrency(totals.outstanding)} outstanding`} />
        </div>
      </div>

      {/* ── Section 3: Charts ── */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Consumption vs Target */}
          <div className="rounded-xl border border-[#D3D1C7] bg-white p-3.5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium">Monthly consumption vs target</p>
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
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1 text-[13px] font-medium text-[#534AB7] bg-[#EEEDFE] border border-[#534AB7]/20 rounded-lg px-3 py-1.5 hover:bg-[#E3E1FC] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add month
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#D3D1C7]">
                {["Month", "Contracted", "Consumption", "Att%", "Planned GM%", "Actual GM%", "Invoiced", "Received", "Outstanding"].map((h, i) => (
                  <th key={h} className={cn("py-2.5 px-3 font-medium text-muted-foreground whitespace-nowrap", i === 0 ? "text-left" : "text-right")}>{h}</th>
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
                    const att = row.contracted > 0 ? (row.consumption / row.contracted) * 100 : 0;
                    const ac = attColor(att);
                    const cs = colorStyles[ac];
                    return (
                      <tr key={row.id} className={cn("group", idx < rows.length - 1 && "border-b border-[#D3D1C7]/50")}>
                        <td className="py-2.5 px-3 font-medium text-muted-foreground">{fmtMonth(row.month)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{fmtCurrency(row.contracted)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{fmtCurrency(row.consumption)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={cn("inline-block px-1.5 py-0.5 rounded text-[11px] font-medium", cs.bg, cs.text)}>
                            {att.toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{row.plannedGmPct}%</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{row.actualGmPct}%</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{fmtCurrency(row.invoiced)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{fmtCurrency(row.received)}</td>
                        <td className={cn("py-2.5 px-3 text-right tabular-nums", row.outstanding > 0 && "text-[#791F1F]")}>{fmtCurrency(row.outstanding)}</td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-[#F1EFE8] font-medium border-t border-[#D3D1C7]">
                    <td className="py-2.5 px-3">Total</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmtCurrency(totals.contracted)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmtCurrency(totals.consumption)}</td>
                    <td className="py-2.5 px-3 text-right">
                      {(() => {
                        const att = totals.contracted > 0 ? (totals.consumption / totals.contracted) * 100 : 0;
                        const ac = attColor(att);
                        const cs = colorStyles[ac];
                        return <span className={cn("inline-block px-1.5 py-0.5 rounded text-[11px]", cs.bg, cs.text)}>{att.toFixed(0)}%</span>;
                      })()}
                    </td>
                    <td className="py-2.5 px-3 text-right">—</td>
                    <td className="py-2.5 px-3 text-right">—</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmtCurrency(totals.invoiced)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmtCurrency(totals.received)}</td>
                    <td className={cn("py-2.5 px-3 text-right tabular-nums", totals.outstanding > 0 && "text-[#791F1F]")}>{fmtCurrency(totals.outstanding)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 5: Consumption Bucket ── */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground mb-3">Consumption Bucket</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg bg-[#F1EFE8] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">YTD retainer MRR</p>
            <p className="text-xl font-medium mt-1">{fmtCurrency(bucket.ytdMrr)}</p>
          </div>
          <div className="rounded-lg bg-[#F1EFE8] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">YTD retainer consumption</p>
            <p className="text-xl font-medium mt-1">{fmtCurrency(bucket.ytdConsumption)}</p>
            <p className={cn("text-xs mt-0.5 font-medium", bucket.pct >= 100 ? "text-[#27500A]" : "text-[#633806]")}>
              {bucket.pct.toFixed(0)}% of target
            </p>
          </div>
          <div className="rounded-lg bg-[#F1EFE8] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Under-consumption</p>
            <p className="text-xl font-medium mt-1 text-[#27500A]">{fmtCurrency(bucket.under)}</p>
          </div>
          <div className="rounded-lg bg-[#F1EFE8] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Over-consumption</p>
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
    onAdd({
      dealId,
      month: form.month,
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
    { label: "Consumption (₹)", key: "consumption", type: "number" },
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
