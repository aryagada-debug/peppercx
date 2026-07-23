import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColHeader, type SortState } from "@/components/table/ColHeader";
import { BopmFilter, dealMatchesBopm } from "@/components/access/BopmFilter";
import { DealTypeFilter, dealMatchesType, type DealTypeFilterValue } from "@/components/filters/DealTypeFilter";
import { useDealsQuery } from "@/hooks/queries/useDealsQuery";
import { useVsdUsers, useAllPersonNames } from "@/hooks/queries/legacy";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileText, Link as LinkIcon, Search, Upload, Loader2, Download } from "lucide-react";
import { Trash2 } from "lucide-react";
import { PEPPER_BUSINESS_UNITS } from "@/data/staffingData";

type Quarter = "JFM" | "AMJ" | "JAS" | "OND";
const QUARTERS: Quarter[] = ["JFM", "AMJ", "JAS", "OND"];
type Status = "Pending" | "Scheduled" | "Done";

function currentQuarter(d = new Date()): Quarter {
  const m = d.getMonth();
  if (m <= 2) return "JFM";
  if (m <= 5) return "AMJ";
  if (m <= 8) return "JAS";
  return "OND";
}

interface OneOnOne {
  id: string;
  deal_id: string;
  quarter: Quarter;
  year: number;
  status: Status;
  fathom_url: string | null;
  insights_pdf_path: string | null;
  notes: string | null;
}

const STATUS_STYLES: Record<Status, string> = {
  Pending: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  Scheduled: "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700",
  Done: "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700",
};

const QUARTER_STYLES: Record<Quarter, { header: string; sub: string; cell: string; accent: string }> = {
  JFM: {
    header: "bg-sky-100/70 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200 border-b-2 border-sky-400",
    sub: "bg-sky-50/60 text-sky-800 dark:bg-sky-900/20 dark:text-sky-300",
    cell: "bg-sky-50/30 dark:bg-sky-950/20",
    accent: "text-sky-600 dark:text-sky-400",
  },
  AMJ: {
    header: "bg-emerald-100/70 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200 border-b-2 border-emerald-400",
    sub: "bg-emerald-50/60 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
    cell: "bg-emerald-50/30 dark:bg-emerald-950/20",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  JAS: {
    header: "bg-amber-100/70 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-b-2 border-amber-400",
    sub: "bg-amber-50/60 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
    cell: "bg-amber-50/30 dark:bg-amber-950/20",
    accent: "text-amber-600 dark:text-amber-400",
  },
  OND: {
    header: "bg-violet-100/70 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200 border-b-2 border-violet-400",
    sub: "bg-violet-50/60 text-violet-800 dark:bg-violet-900/20 dark:text-violet-300",
    cell: "bg-violet-50/30 dark:bg-violet-950/20",
    accent: "text-violet-600 dark:text-violet-400",
  },
};

const ACTIVE_STATUSES = new Set([
  "Active Deal",
  "New Deal in SLA/PO",
  "Deal Disputed",
  "Deal in Renewal Process",
]);

function useOneOnOnes(year: number) {
  return useQuery({
    queryKey: ["client-one-on-ones", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_one_on_ones")
        .select("*")
        .eq("year", year);
      if (error) throw error;
      return (data || []) as OneOnOne[];
    },
  });
}

function QuarterCell({
  deal, quarter, year, record, onSaved,
}: {
  deal: { id: string; account: string; dealName: string };
  quarter: Quarter;
  year: number;
  record?: OneOnOne;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(record?.status || "Pending");
  const [fathom, setFathom] = useState(record?.fathom_url || "");
  const [notes, setNotes] = useState(record?.notes || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfPath, setPdfPath] = useState(record?.insights_pdf_path || "");

  useEffect(() => {
    if (open) {
      setStatus(record?.status || "Pending");
      setFathom(record?.fathom_url || "");
      setNotes(record?.notes || "");
      setPdfPath(record?.insights_pdf_path || "");
    }
  }, [open, record]);

  const displayStatus: Status = record?.status || "Pending";

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = {
        deal_id: deal.id,
        quarter,
        year,
        status,
        fathom_url: fathom || null,
        notes: notes || null,
        insights_pdf_path: pdfPath || null,
      };
      const { error } = await supabase
        .from("client_one_on_ones")
        .upsert(payload, { onConflict: "deal_id,quarter,year" });
      if (error) throw error;
      toast.success("Saved");
      onSaved();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("PDF must be under 20MB");
      return;
    }
    setUploading(true);
    try {
      const safeId = deal.id.replace(/[^a-zA-Z0-9_-]/g, "_");
      const path = `${safeId}/${year}-${quarter}-${Date.now()}.pdf`;
      const { error } = await supabase.storage
        .from("client-one-on-ones")
        .upload(path, file, { contentType: "application/pdf", upsert: true });
      if (error) throw error;
      setPdfPath(path);
      toast.success("PDF uploaded — remember to Save");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function openPdf(path: string) {
    const { data, error } = await supabase.storage
      .from("client-one-on-ones")
      .createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) {
      toast.error("Cannot open PDF");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function deleteFathom() {
    if (!record) { setFathom(""); return; }
    const { error } = await supabase
      .from("client_one_on_ones")
      .update({ fathom_url: null })
      .eq("id", record.id);
    if (error) { toast.error(error.message); return; }
    setFathom("");
    toast.success("Fathom link removed");
    onSaved();
  }

  async function deletePdf() {
    const path = pdfPath;
    if (!path) return;
    try {
      await supabase.storage.from("client-one-on-ones").remove([path]);
    } catch {}
    if (record) {
      const { error } = await supabase
        .from("client_one_on_ones")
        .update({ insights_pdf_path: null })
        .eq("id", record.id);
      if (error) { toast.error(error.message); return; }
    }
    setPdfPath("");
    toast.success("PDF removed");
    onSaved();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "min-w-[86px] inline-flex flex-col items-center gap-1 px-2 py-1 rounded-md text-[11px] hover:opacity-80 transition",
            STATUS_STYLES[displayStatus],
          )}
        >
          <span className="font-medium">{displayStatus}</span>
          {displayStatus === "Done" && (
            <span className="flex items-center gap-1">
              {record?.fathom_url && <LinkIcon className="h-3 w-3" />}
              {record?.insights_pdf_path && <FileText className="h-3 w-3" />}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-4" align="start">
        <div className="space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {quarter} {year} · {deal.account}
            </div>
            <div className="text-sm font-medium truncate">{deal.dealName}</div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === "Done" && (
            <>
              <div>
                <label className="text-xs text-muted-foreground">Fathom link</label>
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    value={fathom}
                    onChange={(e) => setFathom(e.target.value)}
                    placeholder="https://fathom.video/..."
                    className="h-8 text-xs"
                  />
                  {(record?.fathom_url || fathom) && (
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={deleteFathom} title="Remove link">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Insights PDF</label>
                <div className="flex items-center gap-2 mt-1">
                  <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs cursor-pointer hover:bg-secondary">
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    {pdfPath ? "Replace" : "Upload PDF"}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {pdfPath && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => openPdf(pdfPath)}
                      >
                        <FileText className="h-3 w-3 mr-1" /> View
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={deletePdf} title="Remove PDF">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs text-muted-foreground">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="text-xs mt-1"
              placeholder="Key discussion points, action items, sentiment…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

async function openPdfPath(path: string) {
  const { data, error } = await supabase.storage
    .from("client-one-on-ones")
    .createSignedUrl(path, 60 * 5);
  if (error || !data?.signedUrl) { toast.error("Cannot open PDF"); return; }
  window.open(data.signedUrl, "_blank");
}

function QuarterCells({
  deal, quarter, year, record, onSaved,
}: {
  deal: { id: string; account: string; dealName: string };
  quarter: Quarter;
  year: number;
  record?: OneOnOne;
  onSaved: () => void;
}) {
  async function clearFathom() {
    if (!record) return;
    const { error } = await supabase
      .from("client_one_on_ones")
      .update({ fathom_url: null })
      .eq("id", record.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Fathom link removed");
    onSaved();
  }
  async function clearPdf() {
    if (!record?.insights_pdf_path) return;
    try { await supabase.storage.from("client-one-on-ones").remove([record.insights_pdf_path]); } catch {}
    const { error } = await supabase
      .from("client_one_on_ones")
      .update({ insights_pdf_path: null })
      .eq("id", record.id);
    if (error) { toast.error(error.message); return; }
    toast.success("PDF removed");
    onSaved();
  }

  return (
    <>
      <td className={cn("py-2 px-2 text-center border-l border-border", QUARTER_STYLES[quarter].cell)}>
        <QuarterCell
          deal={deal}
          quarter={quarter}
          year={year}
          record={record}
          onSaved={onSaved}
        />
      </td>
      <td className={cn("py-2 px-3 text-center min-w-[140px]", QUARTER_STYLES[quarter].cell)}>
        {record?.fathom_url ? (
          <div className="inline-flex items-center gap-1.5">
            <a
              href={record.fathom_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/70 dark:bg-slate-900/40 border border-border hover:border-primary hover:text-primary text-[11px] font-medium transition-colors"
              title={record.fathom_url}
            >
              <LinkIcon className="h-3 w-3" />
              Open
            </a>
            <button
              onClick={clearFathom}
              title="Remove link"
              className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-[11px]">No link</span>
        )}
      </td>
      <td className={cn("py-2 px-3 text-center min-w-[140px]", QUARTER_STYLES[quarter].cell)}>
        {record?.insights_pdf_path ? (
          <div className="inline-flex items-center gap-1.5">
            <button
              onClick={() => openPdfPath(record.insights_pdf_path!)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/70 dark:bg-slate-900/40 border border-border hover:border-primary hover:text-primary text-[11px] font-medium transition-colors"
              title="Open PDF"
            >
              <FileText className="h-3 w-3" />
              View
            </button>
            <button
              onClick={clearPdf}
              title="Remove PDF"
              className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-[11px]">No PDF</span>
        )}
      </td>
    </>
  );
}

export default function ClientOneOnOnesPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedQuarters, setSelectedQuarters] = useState<Quarter[]>([currentQuarter()]);
  const [search, setSearch] = useState("");
  const [vsdFilter, setVsdFilter] = useState<string>("All");
  const [bopmFilter, setBopmFilter] = useState<string>("All");
  const [dealType, setDealType] = useState<DealTypeFilterValue>("All");
  const [buFilter, setBuFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("Active");
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sortState, setSortState] = useState<SortState>({ sortKey: "account", sortDir: "asc" });

  const dealsQ = useDealsQuery();
  const oooQ = useOneOnOnes(year);
  const qc = useQueryClient();
  const { canonVsd } = useVsdUsers();
  const allPersonNames = useAllPersonNames();

  const deals = dealsQ.data || [];
  const records = oooQ.data || [];

  const byKey = useMemo(() => {
    const m = new Map<string, OneOnOne>();
    for (const r of records) m.set(`${r.deal_id}:${r.quarter}`, r);
    return m;
  }, [records]);

  const vsdOptions = useMemo(() => {
    const s = new Set<string>();
    for (const d of deals) if (d.vsd) s.add(canonVsd(d.vsd) || d.vsd);
    return Array.from(s).sort();
  }, [deals, canonVsd]);

  const buOptions = PEPPER_BUSINESS_UNITS;

  const visibleQuarters = useMemo<Quarter[]>(
    () => QUARTERS.filter(q => selectedQuarters.includes(q)),
    [selectedQuarters],
  );
  const qCount = visibleQuarters.length;
  const colspan = 4 + qCount * 3;

  const toggleQuarter = (q: Quarter) => {
    setSelectedQuarters(prev => {
      const has = prev.includes(q);
      if (has && prev.length === 1) return prev; // keep at least one
      return has ? prev.filter(x => x !== q) : [...prev, q];
    });
  };

  const filtered = useMemo(() => {
    let rows = deals.slice();
    if (statusFilter === "Active") rows = rows.filter(d => ACTIVE_STATUSES.has(d.dealStatus));
    else if (statusFilter !== "All") rows = rows.filter(d => d.dealStatus === statusFilter);
    if (vsdFilter !== "All") rows = rows.filter(d => (canonVsd(d.vsd) || d.vsd) === vsdFilter);
    if (bopmFilter !== "All") rows = rows.filter(d => dealMatchesBopm(d as any, bopmFilter, allPersonNames));
    if (dealType !== "All") rows = rows.filter(d => dealMatchesType(d.dealType, dealType));
    if (buFilter !== "All") rows = rows.filter(d => (d.businessUnit || d.pepperBusinessUnit || "") === buFilter);

    const s = search.trim().toLowerCase();
    if (s) {
      rows = rows.filter(d =>
        (d.account || "").toLowerCase().includes(s) ||
        (d.dealName || "").toLowerCase().includes(s) ||
        (d.id || "").toLowerCase().includes(s),
      );
    }

    // Per-column filters
    rows = rows.filter(d => {
      for (const [k, v] of Object.entries(colFilters)) {
        if (!v) continue;
        const val = String((d as any)[k] ?? "").toLowerCase();
        if (!val.includes(v.toLowerCase())) return false;
      }
      return true;
    });

    const { sortKey, sortDir } = sortState;
    if (sortKey) {
      rows.sort((a, b) => {
        const av = (a as any)[sortKey];
        const bv = (b as any)[sortKey];
        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av;
        }
        return sortDir === "asc"
          ? String(av ?? "").localeCompare(String(bv ?? ""))
          : String(bv ?? "").localeCompare(String(av ?? ""));
      });
    }
    return rows;
  }, [deals, statusFilter, vsdFilter, bopmFilter, dealType, buFilter, search, colFilters, sortState, canonVsd, allPersonNames]);

  const onSort = (k: string) => {
    setSortState(prev => ({
      sortKey: k,
      sortDir: prev.sortKey === k && prev.sortDir === "asc" ? "desc" : "asc",
    }));
  };
  const setFilter = (k: string, v: string) => setColFilters(p => ({ ...p, [k]: v }));
  const clearFilter = (k: string) => setColFilters(p => { const n = { ...p }; delete n[k]; return n; });

  const headerProps = { sortState, onSort, colFilters, openFilter, setOpenFilter, setFilter, clearFilter };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["client-one-on-ones", year] });

  const yearOptions = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  function exportCsv() {
    const rows = filtered;
    const header = ["Client","Deal","MRR","Total revenue", ...visibleQuarters.flatMap(q => [`${q} status`, `${q} fathom`, `${q} pdf`, `${q} notes`])];
    const lines = [header.join(",")];
    for (const d of rows) {
      const cells: string[] = [d.account || "", d.dealName || "", String(d.mrr ?? ""), String(d.totalDealValue ?? "")];
      for (const q of visibleQuarters) {
        const r = byKey.get(`${d.id}:${q}`);
        cells.push(r?.status || "Pending", r?.fathom_url || "", r?.insights_pdf_path ? "yes" : "", (r?.notes || "").replace(/\s+/g, " "));
      }
      lines.push(cells.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `client-1on1s-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 overflow-auto h-full">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-medium">Client 1-1s</h1>
            <p className="text-xs text-muted-foreground">
              Quarterly customer 1-1 tracker · Admins only
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  Quarters: {selectedQuarters.length === 4 ? "All" : selectedQuarters.join(", ")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-2" align="end">
                <div className="space-y-1">
                  {QUARTERS.map(q => {
                    const checked = selectedQuarters.includes(q);
                    return (
                      <label key={q} className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleQuarter(q)}
                          className="h-3.5 w-3.5"
                        />
                        <span>{q}</span>
                      </label>
                    );
                  })}
                  <div className="flex justify-between pt-1 border-t border-border mt-1">
                    <button
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedQuarters([currentQuarter()])}
                    >
                      Current
                    </button>
                    <button
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedQuarters([...QUARTERS])}
                    >
                      Select all
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, deal, ID…"
              className="h-8 w-[240px] pl-7 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active deals only</SelectItem>
              <SelectItem value="All">All statuses</SelectItem>
              <SelectItem value="Active Deal">Active Deal</SelectItem>
              <SelectItem value="New Deal in SLA/PO">New Deal in SLA/PO</SelectItem>
              <SelectItem value="Deal Disputed">Deal Disputed</SelectItem>
              <SelectItem value="Deal in Renewal Process">Deal in Renewal Process</SelectItem>
              <SelectItem value="Deal Completed Successfully">Completed</SelectItem>
              <SelectItem value="Deal Churned / Lost">Churned / Lost</SelectItem>
            </SelectContent>
          </Select>
          <Select value={vsdFilter} onValueChange={setVsdFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="VSD" /></SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value="All">All VSDs</SelectItem>
              {vsdOptions.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <BopmFilter value={bopmFilter} onChange={setBopmFilter} />
          <DealTypeFilter value={dealType} onChange={setDealType} />
          <Select value={buFilter} onValueChange={setBuFilter}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Business unit" /></SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value="All">All BUs</SelectItem>
              {buOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-[11px] text-muted-foreground ml-auto">
            {filtered.length} deals
          </div>
        </div>

        <div className="border border-border rounded-md overflow-auto bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 sticky top-0 z-10">
              <tr className="group/headrow">
                <ColHeader label="Client" colKey="account" sortKey="account" {...headerProps} />
                <ColHeader label="Deal" colKey="dealName" sortKey="dealName" {...headerProps} />
                <ColHeader label="MRR" colKey="mrr" sortKey="mrr" align="right" numeric {...headerProps} />
                <ColHeader label="Total revenue" colKey="totalDealValue" sortKey="totalDealValue" align="right" numeric {...headerProps} />
                {visibleQuarters.map(q => (
                  <th
                    key={q}
                    colSpan={3}
                    className={cn(
                      "py-2 px-3 text-[11px] uppercase tracking-wider font-semibold text-center border-l border-border",
                      QUARTER_STYLES[q].header,
                    )}
                  >
                    {q} {year}
                  </th>
                ))}
              </tr>
              <tr>
                <th colSpan={4}></th>
                {visibleQuarters.map(q => (
                  <Fragment key={q}>
                    <th className={cn("py-1.5 px-2 text-[10px] uppercase tracking-wider font-medium text-center border-l border-border", QUARTER_STYLES[q].sub)}>Status</th>
                    <th className={cn("py-1.5 px-3 text-[10px] uppercase tracking-wider font-medium text-center min-w-[140px]", QUARTER_STYLES[q].sub)}>Fathom link</th>
                    <th className={cn("py-1.5 px-3 text-[10px] uppercase tracking-wider font-medium text-center min-w-[140px]", QUARTER_STYLES[q].sub)}>Insights PDF</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {dealsQ.isLoading || oooQ.isLoading ? (
                <tr><td colSpan={colspan} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={colspan} className="text-center py-8 text-muted-foreground">No deals match the current filters.</td></tr>
              ) : filtered.map(d => (
                <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                  <td className="py-2 px-3 font-medium">{d.account}</td>
                  <td className="py-2 px-3">{d.dealName}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{d.mrr ? d.mrr.toLocaleString() : "—"}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{d.totalDealValue ? d.totalDealValue.toLocaleString() : "—"}</td>
                  {visibleQuarters.map(q => {
                    const rec = byKey.get(`${d.id}:${q}`);
                    return (
                      <QuarterCells
                        key={q}
                        deal={{ id: d.id, account: d.account, dealName: d.dealName }}
                        quarter={q}
                        year={year}
                        record={rec}
                        onSaved={invalidate}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}