import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NoteRow {
  id: string;
  dimension: string;
  from_value: string;
  to_value: string;
  note: string;
  updated_by_name: string;
  created_at: string;
}

const valueClass = (v: string) => {
  switch ((v || "").toUpperCase()) {
    case "R": return "bg-destructive/15 text-destructive";
    case "Y": return "bg-warning/15 text-warning";
    case "G": return "bg-positive/15 text-positive";
    case "NA": return "bg-muted text-muted-foreground";
    case "": case "PENDING": return "bg-secondary text-muted-foreground";
    default: return "bg-secondary text-muted-foreground";
  }
};

const valueLabel = (v: string) => {
  if (!v) return "—";
  if (v === "PENDING") return "—";
  return v.toUpperCase();
};

const dimensionLabels: Record<string, string> = {
  customer: "Customer",
  internal: "Internal",
  delivery: "Delivery",
  consumption: "Consumption",
  account_health: "Account Health",
  finance_billing: "Finance / Billing",
  capability_seo: "SEO Capability",
  capability_creative: "Creative Capability",
  content: "Content",
  seo: "SEO",
  supply: "Supply",
  copy: "Copy",
  design: "Design",
  video: "Video",
  invoicing: "Invoicing",
  receivables: "Receivables",
  margins: "Margins",
};

interface Props {
  dealId: string;
  trigger?: React.ReactNode;
  inline?: boolean;
}

export function RGYHistoryPopover({ dealId, trigger, inline }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (supabase as any)
      .from("deal_rgy_notes")
      .select("id, dimension, from_value, to_value, note, updated_by_name, created_at")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }: any) => {
        setItems(data || []);
        setLoading(false);
      });
  }, [open, dealId]);

  const content = (
    <div className="w-80 max-h-96 overflow-y-auto p-3">
      <div className="text-ui font-semibold text-foreground mb-2">RGY change history</div>
      {loading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      {!loading && items.length === 0 && (
        <div className="text-caption text-muted-foreground py-4 text-center">
          No changes recorded yet.
        </div>
      )}
      {!loading && items.map(it => (
        <div key={it.id} className="border-b border-border last:border-0 py-2">
          <div className="text-caption text-foreground">
            <span className="font-medium">{it.updated_by_name || "Unknown"}</span>{" "}
            changed <span className="font-medium">{dimensionLabels[it.dimension] || it.dimension}</span>{" "}
            from <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded text-caption font-bold", valueClass(it.from_value))}>{valueLabel(it.from_value)}</span>{" → "}
            <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded text-caption font-bold", valueClass(it.to_value))}>{valueLabel(it.to_value)}</span>
          </div>
          <div className="text-caption text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
          </div>
          {it.note && (
            <div className="text-caption text-foreground bg-secondary rounded px-2 py-1 mt-1">
              "{it.note}"
            </div>
          )}
        </div>
      ))}
    </div>
  );

  if (inline) return content;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="View RGY history"
          >
            <History className="h-3.5 w-3.5" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">{content}</PopoverContent>
    </Popover>
  );
}