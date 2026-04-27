import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  parseVsdCsv, parseDealCsv, vsdTemplateCsv, dealTemplateCsv, downloadCsv,
  type VsdTargetRow, type DealTargetRow,
} from "@/lib/csvTargets";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUploaded: () => void;
}

type Mode = "vsd" | "deal";

export function TargetsUploadDialog({ open, onOpenChange, onUploaded }: Props) {
  const [mode, setMode] = useState<Mode>("vsd");
  const [vsdRows, setVsdRows] = useState<VsdTargetRow[]>([]);
  const [dealRows, setDealRows] = useState<DealTargetRow[]>([]);
  const [errors, setErrors] = useState<{ line: number; message: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setVsdRows([]); setDealRows([]); setErrors([]); };

  const onFile = async (f: File) => {
    const text = await f.text();
    if (mode === "vsd") {
      const r = parseVsdCsv(text);
      setVsdRows(r.rows); setErrors(r.errors);
    } else {
      const r = parseDealCsv(text);
      setDealRows(r.rows); setErrors(r.errors);
    }
  };

  const onConfirm = async () => {
    setBusy(true);
    try {
      if (mode === "vsd") {
        if (!vsdRows.length) { toast.error("No valid rows to upload"); return; }
        const { error } = await supabase
          .from("vsd_financial_targets")
          .upsert(vsdRows, { onConflict: "month,vsd" });
        if (error) throw error;
        toast.success(`Uploaded ${vsdRows.length} VSD row${vsdRows.length === 1 ? "" : "s"}`);
      } else {
        if (!dealRows.length) { toast.error("No valid rows to upload"); return; }
        const { error } = await supabase
          .from("deal_financial_targets")
          .upsert(dealRows, { onConflict: "month,deal_id" });
        if (error) throw error;
        toast.success(`Uploaded ${dealRows.length} deal row${dealRows.length === 1 ? "" : "s"}`);
      }
      onUploaded();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const rowCount = mode === "vsd" ? vsdRows.length : dealRows.length;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Finance Targets</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); reset(); }}>
          <TabsList>
            <TabsTrigger value="vsd">By VSD</TabsTrigger>
            <TabsTrigger value="deal">By Deal</TabsTrigger>
          </TabsList>
          <TabsContent value="vsd" className="space-y-3 pt-3">
            <p className="text-sm text-muted-foreground">
              CSV columns: <code className="text-xs">month, vsd, contraction_target, contraction_actual, delivery_target, delivery_actual, invoicing_target, invoicing_actual, receivables_target, receivables_actual</code>
            </p>
            <Button variant="outline" size="sm" onClick={() => downloadCsv("vsd-targets-template.csv", vsdTemplateCsv())}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download template
            </Button>
          </TabsContent>
          <TabsContent value="deal" className="space-y-3 pt-3">
            <p className="text-sm text-muted-foreground">
              CSV columns: <code className="text-xs">month, deal_id, contraction_target, contraction_actual, delivery_target, delivery_actual, invoicing_target, invoicing_actual, receivables_target, receivables_actual</code>
            </p>
            <Button variant="outline" size="sm" onClick={() => downloadCsv("deal-targets-template.csv", dealTemplateCsv())}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download template
            </Button>
          </TabsContent>
        </Tabs>

        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose CSV file</Button>
        </div>

        {(rowCount > 0 || errors.length > 0) && (
          <div className="space-y-2 max-h-60 overflow-auto">
            {rowCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-positive">
                <CheckCircle2 className="h-4 w-4" /> {rowCount} valid row{rowCount === 1 ? "" : "s"} ready to upload
              </div>
            )}
            {errors.length > 0 && (
              <div className="text-sm">
                <div className="flex items-center gap-2 text-destructive mb-1">
                  <AlertTriangle className="h-4 w-4" /> {errors.length} issue{errors.length === 1 ? "" : "s"}
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 pl-6 list-disc">
                  {errors.slice(0, 20).map((e, i) => (
                    <li key={i}>Line {e.line || "header"}: {e.message}</li>
                  ))}
                  {errors.length > 20 && <li>…and {errors.length - 20} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={busy || rowCount === 0}>
            {busy ? "Uploading…" : `Upload ${rowCount} row${rowCount === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}