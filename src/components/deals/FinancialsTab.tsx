import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

interface Props {
  rows: FinancialRow[];
  dealId: string;
  onAdd: (row: Omit<FinancialRow, "id">) => void;
  onUpdate: (id: string, updates: Partial<FinancialRow>) => void;
  onDelete: (id: string) => void;
}

const fmtCurrency = (n: number) => {
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

export function FinancialsTab({ rows, dealId, onAdd, onUpdate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRow, setNewRow] = useState({ month: "", contracted: 0, consumption: 0, plannedGmPct: 0, actualGmPct: 0, invoiced: 0, received: 0, outstanding: 0, invoiceDate: "", receivedDate: "", outstandingDate: "" });

  const handleAdd = () => {
    if (!newRow.month) return;
    onAdd({ ...newRow, dealId });
    setNewRow({ month: "", contracted: 0, consumption: 0, plannedGmPct: 0, actualGmPct: 0, invoiced: 0, received: 0, outstanding: 0, invoiceDate: "", receivedDate: "", outstandingDate: "" });
    setAdding(false);
  };

  const totals = {
    contracted: rows.reduce((s, r) => s + r.contracted, 0),
    consumption: rows.reduce((s, r) => s + r.consumption, 0),
    invoiced: rows.reduce((s, r) => s + r.invoiced, 0),
    received: rows.reduce((s, r) => s + r.received, 0),
    outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Contracted", value: fmtCurrency(totals.contracted) },
          { label: "Total Consumption", value: fmtCurrency(totals.consumption) },
          { label: "Total Invoiced", value: fmtCurrency(totals.invoiced) },
          { label: "Total Received", value: fmtCurrency(totals.received) },
          { label: "Outstanding", value: fmtCurrency(totals.outstanding), alert: totals.outstanding > 0 },
        ].map(k => (
          <div key={k.label} className="data-card">
            <p className="metric-label">{k.label}</p>
            <p className={cn("metric-value mt-1", k.alert && "text-destructive")}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-ui font-bold text-foreground">Monthly Financials</h3>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Month
        </Button>
      </div>

      <div className="data-card !p-0 overflow-x-auto">
        <table className="w-full text-ui">
          <thead>
            <tr className="bg-accent/20 border-b border-border">
              {["Month", "Contracted", "Consumption", "Planned GM%", "Actual GM%", "Invoiced", "Received", "Outstanding", ""].map(h => (
                <th key={h} className={cn("py-2.5 px-3 text-caption uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap", h === "Month" || h === "" ? "text-left" : "text-right")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="border-b border-border bg-accent/10">
                <td className="py-2 px-3"><Input type="month" value={newRow.month} onChange={e => setNewRow(p => ({ ...p, month: e.target.value }))} className="h-8 text-caption w-32" /></td>
                <td className="py-2 px-3"><Input type="number" value={newRow.contracted || ""} onChange={e => setNewRow(p => ({ ...p, contracted: Number(e.target.value) }))} className="h-8 text-caption w-24 text-right" /></td>
                <td className="py-2 px-3"><Input type="number" value={newRow.consumption || ""} onChange={e => setNewRow(p => ({ ...p, consumption: Number(e.target.value) }))} className="h-8 text-caption w-24 text-right" /></td>
                <td className="py-2 px-3"><Input type="number" value={newRow.plannedGmPct || ""} onChange={e => setNewRow(p => ({ ...p, plannedGmPct: Number(e.target.value) }))} className="h-8 text-caption w-20 text-right" /></td>
                <td className="py-2 px-3"><Input type="number" value={newRow.actualGmPct || ""} onChange={e => setNewRow(p => ({ ...p, actualGmPct: Number(e.target.value) }))} className="h-8 text-caption w-20 text-right" /></td>
                <td className="py-2 px-3"><Input type="number" value={newRow.invoiced || ""} onChange={e => setNewRow(p => ({ ...p, invoiced: Number(e.target.value) }))} className="h-8 text-caption w-24 text-right" /></td>
                <td className="py-2 px-3"><Input type="number" value={newRow.received || ""} onChange={e => setNewRow(p => ({ ...p, received: Number(e.target.value) }))} className="h-8 text-caption w-24 text-right" /></td>
                <td className="py-2 px-3"><Input type="number" value={newRow.outstanding || ""} onChange={e => setNewRow(p => ({ ...p, outstanding: Number(e.target.value) }))} className="h-8 text-caption w-24 text-right" /></td>
                <td className="py-2 px-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={handleAdd} className="h-7 text-caption text-primary">Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="h-7 text-caption">Cancel</Button>
                  </div>
                </td>
              </tr>
            )}
            {rows.map(row => (
              <EditableFinancialRow key={row.id} row={row} onUpdate={onUpdate} onDelete={onDelete} isEditing={editingId === row.id} onStartEdit={() => setEditingId(row.id)} onStopEdit={() => setEditingId(null)} />
            ))}
            {rows.length === 0 && !adding && (
              <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No financial data recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditableFinancialRow({ row, onUpdate, onDelete, isEditing, onStartEdit, onStopEdit }: {
  row: FinancialRow; onUpdate: (id: string, u: Partial<FinancialRow>) => void; onDelete: (id: string) => void;
  isEditing: boolean; onStartEdit: () => void; onStopEdit: () => void;
}) {
  const [local, setLocal] = useState(row);

  const save = () => {
    onUpdate(row.id, local);
    onStopEdit();
  };

  if (isEditing) {
    return (
      <tr className="border-b border-border/50 bg-accent/10">
        <td className="py-2 px-3 font-mono text-caption">{row.month}</td>
        <td className="py-2 px-3"><Input type="number" value={local.contracted || ""} onChange={e => setLocal(p => ({ ...p, contracted: Number(e.target.value) }))} className="h-7 text-caption w-24 text-right" /></td>
        <td className="py-2 px-3"><Input type="number" value={local.consumption || ""} onChange={e => setLocal(p => ({ ...p, consumption: Number(e.target.value) }))} className="h-7 text-caption w-24 text-right" /></td>
        <td className="py-2 px-3"><Input type="number" value={local.plannedGmPct || ""} onChange={e => setLocal(p => ({ ...p, plannedGmPct: Number(e.target.value) }))} className="h-7 text-caption w-20 text-right" /></td>
        <td className="py-2 px-3"><Input type="number" value={local.actualGmPct || ""} onChange={e => setLocal(p => ({ ...p, actualGmPct: Number(e.target.value) }))} className="h-7 text-caption w-20 text-right" /></td>
        <td className="py-2 px-3"><Input type="number" value={local.invoiced || ""} onChange={e => setLocal(p => ({ ...p, invoiced: Number(e.target.value) }))} className="h-7 text-caption w-24 text-right" /></td>
        <td className="py-2 px-3"><Input type="number" value={local.received || ""} onChange={e => setLocal(p => ({ ...p, received: Number(e.target.value) }))} className="h-7 text-caption w-24 text-right" /></td>
        <td className="py-2 px-3"><Input type="number" value={local.outstanding || ""} onChange={e => setLocal(p => ({ ...p, outstanding: Number(e.target.value) }))} className="h-7 text-caption w-24 text-right" /></td>
        <td className="py-2 px-3">
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={save} className="h-7 text-caption text-primary">Save</Button>
            <Button size="sm" variant="ghost" onClick={onStopEdit} className="h-7 text-caption">Cancel</Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/50 hover:bg-accent/10 cursor-pointer group" onDoubleClick={onStartEdit}>
      <td className="py-2.5 px-3 text-foreground font-mono text-caption">{row.month}</td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmtCurrency(row.contracted)}</td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmtCurrency(row.consumption)}</td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{row.plannedGmPct}%</td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{row.actualGmPct}%</td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmtCurrency(row.invoiced)}</td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmtCurrency(row.received)}</td>
      <td className={cn("py-2.5 px-3 text-right font-mono tabular-nums", row.outstanding > 0 && "text-destructive")}>{fmtCurrency(row.outstanding)}</td>
      <td className="py-2.5 px-3">
        <Button size="sm" variant="ghost" onClick={() => onDelete(row.id)} className="h-7 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </td>
    </tr>
  );
}
