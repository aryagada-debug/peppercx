import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Download, Trash2, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Variant = "contract" | "sow";

interface Props {
  dealId: string;
  variant: Variant;
  compact?: boolean;
  onChange?: (path: string | null) => void;
}

const COLUMN: Record<Variant, "contract_file_path" | "sow_file_path"> = {
  contract: "contract_file_path",
  sow: "sow_file_path",
};

const LABEL: Record<Variant, string> = {
  contract: "Client Contract",
  sow: "SoW Document",
};

const ACCEPT: Record<Variant, string> = {
  contract: ".pdf,.doc,.docx",
  sow: ".xlsx,.xls,.pdf,.csv",
};

const ICON: Record<Variant, typeof FileText> = {
  contract: FileText,
  sow: FileSpreadsheet,
};

export function DealDocsUpload({ dealId, variant, compact, onChange }: Props) {
  const col = COLUMN[variant];
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = ICON[variant];

  // Load current path
  useEffect(() => {
    let cancel = false;
    if (!dealId) return;
    supabase.from("staffing_deals").select(col).eq("id", dealId).maybeSingle().then(({ data }) => {
      if (cancel) return;
      setPath((data as any)?.[col] ?? null);
    });
    return () => { cancel = true; };
  }, [dealId, col]);

  const fileName = path ? path.split("/").pop() : null;

  const handlePick = () => inputRef.current?.click();

  const handleUpload = async (file: File) => {
    if (!dealId) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const folder = variant === "contract" ? "contracts" : "sow";
      // Sanitize filename: keep base, drop unsafe chars
      const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) || "file";
      const objectPath = `${folder}/${dealId}/${Date.now()}-${base}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("deal-documents")
        .upload(objectPath, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;

      // Remove previous file if any
      if (path) {
        await supabase.storage.from("deal-documents").remove([path]).catch(() => {});
      }

      const { error: dbErr } = await supabase
        .from("staffing_deals")
        .update({ [col]: objectPath } as any)
        .eq("id", dealId);
      if (dbErr) throw dbErr;

      setPath(objectPath);
      onChange?.(objectPath);
      toast.success(`${LABEL[variant]} uploaded`);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDownload = async () => {
    if (!path) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.storage
        .from("deal-documents")
        .createSignedUrl(path, 60 * 5);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open file");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!path || !dealId) return;
    if (!confirm(`Remove ${LABEL[variant]}?`)) return;
    setBusy(true);
    try {
      await supabase.storage.from("deal-documents").remove([path]).catch(() => {});
      const { error } = await supabase
        .from("staffing_deals")
        .update({ [col]: null } as any)
        .eq("id", dealId);
      if (error) throw error;
      setPath(null);
      onChange?.(null);
      toast.success(`${LABEL[variant]} removed`);
    } catch (e: any) {
      toast.error(e?.message ?? "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", compact && "gap-1")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground">{LABEL[variant]}</span>
        </div>
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {path ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            className="flex-1 min-w-0 text-left text-xs text-primary hover:underline truncate"
            title={fileName || ""}
          >
            {fileName}
          </button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleDownload} disabled={busy} title="Download">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handlePick} disabled={busy} title="Replace">
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={handleRemove} disabled={busy} title="Remove">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="h-8 justify-start" onClick={handlePick} disabled={busy}>
          <Upload className="h-3.5 w-3.5 mr-2" />
          Upload {LABEL[variant]}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[variant]}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
        }}
      />
    </div>
  );
}