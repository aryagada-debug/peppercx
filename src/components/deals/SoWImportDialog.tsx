import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2 } from "lucide-react";

const TEAM_OPTIONS = ["Account Management", "Content", "SEO", "Creative", "Video"];

interface ParsedItem {
  scope: string;
  team_capability: string;
  revenue_share: number;
  line_item_value: number;
  suggested_teams: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dealId: string;
  onImport: (item: { dealId: string; scope: string; revenueShare: number; teamCapability: string; teams: string[]; lineItemValue: number }) => Promise<void> | void;
}

export const SoWImportDialog = ({ open, onOpenChange, dealId, onImport }: Props) => {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState<ParsedItem[]>([]);

  const reset = () => { setStep("upload"); setItems([]); setParsing(false); setImporting(false); };

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const { data, error } = await supabase.functions.invoke("parse-sow-excel", { body: { fileBase64: base64 } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const parsed: ParsedItem[] = (data?.items ?? []).map((x: any) => ({
        scope: x.scope ?? "",
        team_capability: x.team_capability ?? "",
        revenue_share: Number(x.revenue_share) || 0,
        line_item_value: Number(x.line_item_value) || 0,
        suggested_teams: Array.isArray(x.suggested_teams) ? x.suggested_teams : [],
      }));
      if (parsed.length === 0) {
        toast({ title: "No items found", description: "AI could not extract SoW items from this file.", variant: "destructive" });
      } else {
        setItems(parsed);
        setStep("review");
      }
    } catch (e: any) {
      toast({ title: "Parse failed", description: e.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      for (const it of items) {
        await onImport({
          dealId,
          scope: it.scope,
          revenueShare: it.revenue_share,
          teamCapability: it.team_capability,
          teams: it.suggested_teams,
          lineItemValue: it.line_item_value,
        });
      }
      toast({ title: "Imported", description: `${items.length} SoW items added.` });
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<ParsedItem>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const toggleTeam = (idx: number, team: string) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const has = it.suggested_teams.includes(team);
      return { ...it, suggested_teams: has ? it.suggested_teams.filter(t => t !== team) : [...it.suggested_teams, team] };
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import SoW from Excel</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
            <label className="cursor-pointer flex flex-col items-center gap-3 border-2 border-dashed border-border rounded-xl px-12 py-10 hover:bg-accent/30 transition-colors">
              {parsing ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">AI is parsing your file...</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop or click to upload .xlsx</p>
                  <p className="text-xs text-muted-foreground">Any layout — AI will extract line items</p>
                </>
              )}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={parsing}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex-1 overflow-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 sticky top-0">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="p-2 w-[35%]">Scope</th>
                    <th className="p-2 w-[110px] text-right">Value (₹)</th>
                    <th className="p-2 w-[80px] text-right">Share %</th>
                    <th className="p-2 w-[120px]">Capability</th>
                    <th className="p-2">Teams</th>
                    <th className="p-2 w-[40px]" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="p-2"><Input value={it.scope} onChange={e => updateItem(i, { scope: e.target.value })} className="h-8 text-sm" /></td>
                      <td className="p-2"><Input type="number" value={it.line_item_value || ""} onChange={e => updateItem(i, { line_item_value: Number(e.target.value) || 0 })} className="h-8 text-sm text-right" /></td>
                      <td className="p-2"><Input type="number" value={it.revenue_share || ""} onChange={e => updateItem(i, { revenue_share: Number(e.target.value) || 0 })} className="h-8 text-sm text-right" /></td>
                      <td className="p-2"><Input value={it.team_capability} onChange={e => updateItem(i, { team_capability: e.target.value })} className="h-8 text-sm" /></td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-2">
                          {TEAM_OPTIONS.map(team => (
                            <label key={team} className="flex items-center gap-1 text-xs cursor-pointer">
                              <Checkbox checked={it.suggested_teams.includes(team)} onCheckedChange={() => toggleTeam(i, team)} />
                              {team}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="p-2">
                        <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("upload")} disabled={importing}>Back</Button>
              <Button onClick={handleImport} disabled={importing || items.length === 0}>
                {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Import {items.length} item{items.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
