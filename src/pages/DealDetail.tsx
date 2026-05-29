import { AppLayout } from "@/components/layout/AppLayout";
import { formatINR } from "@/lib/csvTargets";
import { useCurrencyVersion, useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCY_SYMBOL, formatMoney } from "@/lib/currency";
import { dealDisplayCurrency } from "@/lib/dealCurrency";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2, Pencil, Check, X, Calendar, Users, Eye, Edit2, ExternalLink, AlertTriangle, ChevronDown, ChevronUp, ChevronRight, Upload, CalendarCheck, Smile, TrendingUp, MessageSquare, Sparkles, RefreshCw, Wallet, Receipt, BadgeCheck, AlertCircle, Activity, IndianRupee } from "lucide-react";
import { getLinkLabel, getFileIcon } from "@/lib/fileLink";
import { format, differenceInCalendarMonths } from "date-fns";
import { cn } from "@/lib/utils";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffingQueries } from "@/hooks/queries/useStaffingQueries";
import { useStaffingMutations } from "@/hooks/queries/useStaffingMutations";
import { useDealAccess } from "@/hooks/useDealAccess";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { normalizeRoleKey, uid } from "@/data/staffingData";
import type { StaffingAssignment, Person, Deal, RoleCategory } from "@/data/staffingData";
import { useDealDetail } from "@/hooks/useDealDetail";
import { EditableRGY } from "@/components/deals/EditableRGY";
import { ResolveIssuesDialog } from "@/components/rgy/ResolveIssuesDialog";
import { FinancialsTab } from "@/components/deals/FinancialsTab";
import { TaskKanban } from "@/components/deals/TaskKanban";
import { PhaseTasksView } from "@/components/deals/PhaseTasksView";
import { DealRequestsTab } from "@/components/deals/DealRequestsTab";
import { OrgMappingTab } from "@/components/deals/orgmap/OrgMappingTab";
import { MBRInputDrawer } from "@/components/mbr/MBRInputDrawer";
import { MBRDetailDialog } from "@/components/mbr/MBRDetailDialog";
import { ScheduleOnlyDialog } from "@/components/mbr/ScheduleOnlyDialog";
import { useDealRgyRollup } from "@/hooks/useDealRgyRollup";
import { computeOverallCustomerScore, getOverallCustomerRGY } from "@/lib/overallCustomerRGY";
import { AddStaffingMemberDialog } from "@/components/staffing/AddStaffingMemberDialog";
import { RequestStaffingDialog } from "@/components/staffing/RequestStaffingDialog";
import { WeeklyStaffingGrid } from "@/components/deals/WeeklyStaffingGrid";
import { SoWImportDialog } from "@/components/deals/SoWImportDialog";
import { DealDocsUpload } from "@/components/deals/DealDocsUpload";
import { SlackChatBot } from "@/components/deals/SlackChatBot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import type { RGYWeekly } from "@/hooks/useDealDetail";
import { toast } from "sonner";
import { getWeekOptions } from "@/hooks/useMBRData";
import type { MBREntry } from "@/hooks/useMBRData";


const fmtDate = (d: string | undefined) => {
  if (!d) return "Not set";
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
};

const TABS = ["Overview", "Staffing", "Financials", "Tasks", "RGY Health", "MBR", "Org Mapping", "Requests"] as const;
type TabKey = typeof TABS[number];

const rgyColors: Record<string, string> = { G: "rgy-green", R: "rgy-red", Y: "rgy-yellow", NA: "rgy-na", TBU: "rgy-tbu" };
const rgySymbol: Record<string, string> = { G: "G", Y: "Y", R: "R", NA: "⊘", TBU: "⋯" };
// Comparable scale for trend logic. NA / TBU are non-comparable (null).
const rgyCompare: Record<string, number | null> = { G: 3, Y: 2, R: 1, NA: null, TBU: null };

const SERVICE_LINE_OPTIONS = [
  "Integrated Retainers - Content + SEO + Social or Content Hubs",
  "Content Studio - Talent Onsite/Virtual",
  "Pepper SEO - SEO + Content Retainer",
  "Pepper Content - Website/SEO Content",
  "Campaign Assets - Statics, Adapts, Asset Creation",
  "Pepper Content - B2B Full Funnel",
  "Light Video Production - Reels/YouTube/Podcast",
  "Creative/Social Media Retainer",
  "CRM/CLM Content - Lifecycle Marketing",
  "Campaigns - Influencer Marketing/Social",
  "Heavy Video Production - Films/DVCs/TVCs",
  "Translation/Localisation",
  "Other",
] as const;

const RGY_DIMENSIONS: { key: keyof RGYWeekly; label: string }[] = [
  { key: "customer", label: "Customer" },
  { key: "internal", label: "Internal" },
  { key: "content", label: "Content" },
  { key: "seo", label: "SEO" },
  { key: "supply", label: "Supply" },
  { key: "copy", label: "Copy" },
  { key: "design", label: "Design" },
  { key: "video", label: "Video" },
];

const rgyScore: Record<string, number> = { G: 3, Y: 2, R: 1, NA: 0 };

function RGYHistorySection({ rgyWeekly }: { rgyWeekly: RGYWeekly[] }) {
  const [view, setView] = useState<"trend" | "log" | "month">("trend");
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">RGY History</p>
        <div className="inline-flex bg-secondary rounded-md p-0.5">
          <button
            onClick={() => setView("trend")}
            className={cn("px-2 py-0.5 rounded text-[11px] font-medium transition-colors", view === "trend" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >Trend</button>
          <button
            onClick={() => setView("log")}
            className={cn("px-2 py-0.5 rounded text-[11px] font-medium transition-colors", view === "log" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >Weekly log</button>
          <button
            onClick={() => setView("month")}
            className={cn("px-2 py-0.5 rounded text-[11px] font-medium transition-colors", view === "month" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >Monthly log</button>
        </div>
      </div>
      {rgyWeekly.length === 0 ? (
        <div className="bg-card border border-border rounded-xl text-center py-8 px-5">
          <p className="text-muted-foreground">No weekly RGY data recorded yet. Use the editor above to set health status.</p>
        </div>
      ) : view === "trend" ? (
        <RGYTrendView rgyWeekly={rgyWeekly} />
      ) : view === "month" ? (
        <GroupedRGYHistory rgyWeekly={rgyWeekly} groupBy="month" />
      ) : (
        <GroupedRGYHistory rgyWeekly={rgyWeekly} groupBy="week" />
      )}
    </div>
  );
}

function RGYTrendView({ rgyWeekly }: { rgyWeekly: RGYWeekly[] }) {
  const { weeks, snapshotByWeek, movers, latestWeek, prevWeek } = useMemo(() => {
    // Latest snapshot per week
    const byWeek: Record<string, RGYWeekly> = {};
    [...rgyWeekly]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .forEach(r => { if (!byWeek[r.weekStart]) byWeek[r.weekStart] = r; });
    const sortedWeeks = Object.keys(byWeek).sort(); // ascending
    const lastN = sortedWeeks.slice(-8);
    const latestWeek = lastN[lastN.length - 1];
    const prevWeek = lastN[lastN.length - 2];
    const movers: { dim: string; from: string; to: string; dir: "up" | "down" }[] = [];
    if (latestWeek && prevWeek) {
      RGY_DIMENSIONS.forEach(({ key, label }) => {
        const a = (byWeek[prevWeek] as any)[key] || "G";
        const b = (byWeek[latestWeek] as any)[key] || "G";
        if (a !== b) {
          const sa = rgyCompare[a];
          const sb = rgyCompare[b];
          // Skip transitions involving NA/TBU on either side — non-comparable.
          if (sa == null || sb == null) return;
          const dir = sb > sa ? "up" : "down";
          movers.push({ dim: label, from: a, to: b, dir });
        }
      });
    }
    return { weeks: lastN, snapshotByWeek: byWeek, movers, latestWeek, prevWeek };
  }, [rgyWeekly]);

  const fmtWeekHeader = (w: string, idx: number, total: number) => {
    const d = new Date(w);
    const m = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    if (idx === total - 1) return `This wk\n${m}`;
    return `W-${total - 1 - idx}\n${m}`;
  };

  if (weeks.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Movers strip */}
      <div className="bg-card border border-border rounded-xl p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Movers this week</span>
          {movers.length === 0 ? (
            <span className="text-xs text-muted-foreground">No changes vs last week</span>
          ) : (
            movers.map((m, i) => (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border",
                  m.dir === "up"
                    ? "border-positive/40 text-positive bg-positive/5"
                    : "border-destructive/40 text-destructive bg-destructive/5"
                )}
              >
                {m.dir === "up" ? "↑" : "↓"} {m.dim}: {m.from} → {m.to}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Trend heatmap */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/40 border-b border-border">
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Dimension</th>
                {weeks.map((w, i) => (
                  <th key={w} className="text-center py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-pre-line">
                    {fmtWeekHeader(w, i, weeks.length)}
                  </th>
                ))}
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {RGY_DIMENSIONS.map(({ key, label }) => {
                const vals = weeks.map(w => ((snapshotByWeek[w] as any)?.[key] as string) || "G");
                // Δ vs previous populated week
                let delta: "up" | "down" | "stable" = "stable";
                let tip = "Stable";
                if (weeks.length >= 2) {
                  const a = vals[vals.length - 2];
                  const b = vals[vals.length - 1];
                  if (a !== b) {
                    const sa = rgyCompare[a];
                    const sb = rgyCompare[b];
                    if (sa != null && sb != null) {
                      delta = sb > sa ? "up" : "down";
                      tip = `Was ${a} last week, now ${b}`;
                    } else {
                      tip = `Was ${a} last week, now ${b} (non-comparable)`;
                    }
                  }
                }
                return (
                  <tr key={String(key)} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="py-2 px-3 text-xs font-medium text-foreground whitespace-nowrap">{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className="py-2 px-2 text-center">
                        <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold", rgyColors[v] || "rgy-na")} title={v === "NA" ? "Not Required" : v === "TBU" ? "To Be Updated" : v}>{rgySymbol[v] ?? v}</span>
                      </td>
                    ))}
                    <td className="py-2 px-3 text-xs whitespace-nowrap" title={tip}>
                      {delta === "up" && <span className="text-positive">↑ improved</span>}
                      {delta === "down" && <span className="text-destructive">↓ worsened</span>}
                      {delta === "stable" && <span className="text-muted-foreground">— stable</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Editable Cell ──
function EditableCell({ value, onSave, type = "text", prefix = "", placeholder = "—", size = "default" }: { value: string; onSave: (v: string) => void; type?: string; prefix?: string; placeholder?: string; size?: "default" | "lg" }) {
  const [editing, setEditing] = useState(false);
  const normalize = (v: string) => (type === "date" && v ? String(v).slice(0, 10) : v);
  const [local, setLocal] = useState(normalize(value));
  useEffect(() => { setLocal(normalize(value)); }, [value]);

  // Date cells get a Shadcn calendar popover so the prev/next month arrows
  // work reliably and we never auto-commit a half-typed value.
  if (type === "date") {
    const parsed = local ? new Date(local + "T00:00:00") : undefined;
    const display = parsed && !Number.isNaN(parsed.getTime()) ? format(parsed, "dd MMM yyyy") : placeholder;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-transparent hover:border-border px-2 h-7 text-sm text-left",
              !parsed && "text-muted-foreground"
            )}
          >
            <Calendar className="h-3.5 w-3.5 opacity-70" />
            <span>{display}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={parsed}
            onSelect={(d) => {
              if (!d) return;
              const iso = format(d, "yyyy-MM-dd");
              setLocal(iso);
              onSave(iso);
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={local}
          onChange={e => {
            const next = e.target.value;
            setLocal(next);
          }}
          type={type}
          className={cn(size === "lg" ? "h-10 text-2xl font-semibold font-mono tabular-nums w-full" : "h-7 text-sm w-full")}
          autoFocus
          onKeyDown={e => {
            if (e.key === "Enter") { onSave(local); setEditing(false); }
            if (e.key === "Escape") { setLocal(normalize(value)); setEditing(false); }
          }}
        />
        <button onClick={() => { onSave(local); setEditing(false); }} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={() => { setLocal(normalize(value)); setEditing(false); }} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1.5 cursor-pointer" onClick={() => setEditing(true)}>
      <span className={cn(
        size === "lg" ? "text-3xl font-semibold font-mono tabular-nums tracking-tight leading-tight" : "text-sm font-medium",
        value ? "text-foreground" : "text-muted-foreground",
      )}>{prefix}{normalize(value) || placeholder}</span>
      <Pencil className={cn("text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity", size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3")} />
    </div>
  );
}

// ── Financial Metric Card ──
function FinancialMetricCard({ label, value, subLabel, onSave }: { label: string; value: string; subLabel: string; onSave: (v: string) => void }) {
  const { currency } = useCurrency();
  return (
    <div className="rounded-lg bg-secondary/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <EditableCell value={value} onSave={onSave} type="number" prefix={CURRENCY_SYMBOL[currency]} placeholder="—" />
      <p className="text-xs text-muted-foreground mt-0.5">{subLabel}</p>
    </div>
  );
}

// ── Team Member Select (dropdown from staffing people) ──
function TeamMemberSelect({ currentName, role, color, people, onSelect }: {
  currentName: string; role: string; color: string; people: { id: string; name: string; roleTitle: string }[]; onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const initials = currentName && currentName !== "Not assigned" && currentName !== ""
    ? currentName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  // Deduplicate people by name
  const uniquePeople = people.filter((v, i, arr) => arr.findIndex(x => x.name === v.name) === i);

  return (
    <div className="flex items-center gap-3 py-2">
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0", color)}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="h-7 text-sm bg-transparent px-0 text-left text-foreground hover:underline cursor-pointer">
              {currentName || "Not assigned"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            <div className="flex flex-col">
              {uniquePeople.map(p => (
                <button
                  key={p.id}
                  className={cn(
                    "text-xs text-left px-2 py-1.5 rounded hover:bg-muted flex items-center justify-between",
                    p.name === currentName && "bg-muted font-medium"
                  )}
                  onClick={() => {
                    onSelect(p.name === currentName ? "" : p.name);
                    setOpen(false);
                  }}
                >
                  {p.name}
                  {p.name === currentName && <Check className="h-3 w-3 text-primary" />}
                </button>
              ))}
              {currentName && (
                <button
                  className="text-xs text-left px-2 py-1.5 rounded hover:bg-muted text-muted-foreground border-t mt-1 pt-1.5"
                  onClick={() => { onSelect(""); setOpen(false); }}
                >
                  — Clear —
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{role}</span>
    </div>
  );
}

// ── Unified Team Allocation Row ──
function TeamAllocationRow({ row }: {
  row: {
    key: string;
    name: string;
    role: string;
    pct: number;
    pickable?: { roleKey: string; people: { id: string; name: string; roleTitle: string }[]; onPick: (name: string) => void };
  };
}) {
  const [open, setOpen] = useState(false);
  const hasName = !!row.name && row.name !== "Not assigned";
  const initials = hasName
    ? row.name.split(" ").map(n => n[0]).filter(Boolean).join("").slice(0, 2).toUpperCase()
    : "—";
  const pct = Math.max(0, Math.min(100, row.pct || 0));
  const uniquePeople = row.pickable
    ? row.pickable.people.filter((v, i, arr) => arr.findIndex(x => x.name === v.name) === i)
    : [];

  return (
    <div className="flex items-center gap-3 py-2.5 px-1">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium text-foreground/80 shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        {row.pickable ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button className="text-sm font-medium text-foreground hover:underline cursor-pointer truncate text-left block max-w-full">
                {hasName ? row.name : "Not assigned"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="start">
              <div className="flex flex-col">
                {uniquePeople.map(p => (
                  <button
                    key={p.id}
                    className={cn(
                      "text-xs text-left px-2 py-1.5 rounded hover:bg-muted flex items-center justify-between",
                      p.name === row.name && "bg-muted font-medium"
                    )}
                    onClick={() => { row.pickable!.onPick(p.name === row.name ? "" : p.name); setOpen(false); }}
                  >
                    {p.name}
                    {p.name === row.name && <Check className="h-3 w-3 text-primary" />}
                  </button>
                ))}
                {hasName && (
                  <button
                    className="text-xs text-left px-2 py-1.5 rounded hover:bg-muted text-muted-foreground border-t mt-1 pt-1.5"
                    onClick={() => { row.pickable!.onPick(""); setOpen(false); }}
                  >
                    — Clear —
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <p className="text-sm font-medium text-foreground truncate">{hasName ? row.name : "—"}</p>
        )}
        <p className="text-[11px] text-muted-foreground truncate">{row.role}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-20 h-1 rounded bg-muted overflow-hidden">
          <div className="h-full bg-foreground/70 rounded" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground w-9 text-right">
          {hasName ? `${pct}%` : "—"}
        </span>
      </div>
    </div>
  );
}


function InlineLinkEditor({ value, label, onSave }: { value: string | null; label: string; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="h-6 text-xs w-[120px] px-1"
          placeholder="https://..."
          autoFocus
          onKeyDown={e => {
            if (e.key === "Enter") { onSave(draft || null); setEditing(false); }
            if (e.key === "Escape") { setDraft(value || ""); setEditing(false); }
          }}
        />
        <button onClick={() => { onSave(draft || null); setEditing(false); }} className="p-0.5"><Check className="h-3 w-3 text-positive" /></button>
        <button onClick={() => { setDraft(value || ""); setEditing(false); }} className="p-0.5"><X className="h-3 w-3 text-muted-foreground" /></button>
      </div>
    );
  }

  if (value) {
    const FileIco = getFileIcon(value);
    const display = getLinkLabel(value) || label;
    return (
      <div className="flex items-center gap-1">
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          title={value}
          className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1 max-w-[180px]"
        >
          <FileIco className="h-3 w-3 shrink-0" />
          <span className="truncate">{display}</span>
        </a>
        <button onClick={() => { setDraft(value); setEditing(true); }} className="p-0.5 opacity-0 group-hover:opacity-100"><Pencil className="h-3 w-3 text-muted-foreground" /></button>
      </div>
    );
  }

  return <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">+ Add</button>;
}

function InlineNotesEditor({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="h-6 text-xs w-[140px] px-1"
          placeholder="Add notes..."
          autoFocus
          onKeyDown={e => {
            if (e.key === "Enter") { onSave(draft || null); setEditing(false); }
            if (e.key === "Escape") { setDraft(value || ""); setEditing(false); }
          }}
        />
        <button onClick={() => { onSave(draft || null); setEditing(false); }} className="p-0.5"><Check className="h-3 w-3 text-positive" /></button>
        <button onClick={() => { setDraft(value || ""); setEditing(false); }} className="p-0.5"><X className="h-3 w-3 text-muted-foreground" /></button>
      </div>
    );
  }

  return (
    <button onClick={() => { setDraft(value || ""); setEditing(true); }} className="text-xs text-muted-foreground hover:text-foreground max-w-[150px] truncate text-left">
      {value || "+ Add"}
    </button>
  );
}

// ── AI summary of the latest MBR notes (2 sentences) ──
// Parse the AI summary text (markdown-ish bullets like `* **Title:** body`)
// and render as a clean, scannable list.
function StructuredSummary({ text }: { text: string }) {
  const items = useMemo(() => {
    const raw = (text || "").trim();
    if (!raw) return [] as { title: string; body: string }[];
    // Split on bullet markers "*" or "-" at start of a segment
    const parts = raw
      .split(/(?:^|\s)[\*\-]\s+(?=\*\*|[A-Z])/g)
      .map(s => s.trim())
      .filter(Boolean);
    const segs = parts.length > 1 ? parts : [raw];
    return segs.map(seg => {
      // Match **Title:** body or Title: body
      const m = seg.match(/^\*\*([^*]+?)\*\*[:\s]*([\s\S]*)$/) || seg.match(/^([A-Z][A-Za-z &/]{2,40}):\s*([\s\S]*)$/);
      if (m) return { title: m[1].replace(/:$/, "").trim(), body: m[2].trim() };
      return { title: "", body: seg.replace(/^\*+|\*+$/g, "").trim() };
    }).filter(x => x.body.length > 0);
  }, [text]);

  if (items.length === 0) return <p className="text-sm text-foreground leading-relaxed">{text}</p>;
  if (items.length === 1 && !items[0].title) {
    return <p className="text-sm text-foreground leading-relaxed">{items[0].body}</p>;
  }
  return (
    <ul className="space-y-1.5 mt-1">
      {items.map((it, i) => (
        <li key={i} className="text-sm text-foreground leading-relaxed flex gap-2">
          <span className="mt-2 h-1 w-1 rounded-full bg-primary shrink-0" />
          <span>
            {it.title && (
              <span className="font-medium text-foreground">{it.title}: </span>
            )}
            <span className="text-muted-foreground">{it.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function LatestMBRSummaryCard({ entries }: { entries: MBREntry[] }) {
  const latest = useMemo(() => {
    return entries.find(e => (e.notes && e.notes.trim().length > 10)) || null;
  }, [entries]);

  const [summary, setSummary] = useState<string>(latest?.aiSummary || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (force = false) => {
    if (!latest || !latest.notes) return;
    if (!force && latest.aiSummary && latest.aiSummary.trim().length > 0) {
      setSummary(latest.aiSummary);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("mbr-summarize-notes", {
        body: { mbr_entry_id: latest.id, notes: latest.notes },
      });
      if (fnErr) throw fnErr;
      setSummary(data?.summary || "");
    } catch (e) {
      console.error(e);
      setError("Summary unavailable");
    } finally {
      setLoading(false);
    }
  }, [latest]);

  useEffect(() => {
    if (!latest) { setSummary(""); return; }
    if (latest.aiSummary && latest.aiSummary.trim().length > 0) {
      setSummary(latest.aiSummary);
    } else if (latest.notes) {
      generate(false);
    }
  }, [latest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!latest) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-4">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/15 grid place-items-center shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Latest MBR Summary
              <span className="ml-2 text-[10px] font-normal normal-case tracking-normal text-muted-foreground/80">
                · {format(new Date(latest.weekStart), "dd MMM yyyy")}
              </span>
            </p>
            <button
              onClick={() => generate(true)}
              disabled={loading}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Regenerate summary"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
              {loading ? "Generating…" : "Regenerate"}
            </button>
          </div>
          {loading && !summary ? (
            <div className="space-y-1.5">
              <div className="h-3 w-11/12 bg-muted rounded animate-pulse" />
              <div className="h-3 w-9/12 bg-muted rounded animate-pulse" />
            </div>
          ) : error ? (
            <p className="text-sm text-muted-foreground italic">{error}</p>
          ) : summary ? (
            <StructuredSummary text={summary} />
          ) : (
            <p className="text-sm text-muted-foreground italic">No summary yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modern KPI tile for the Overview tab ──
function KpiTile({
  label, value, sublabel, icon: Icon, tone = "neutral", progressPct, editor,
}: {
  label: string;
  value?: string;
  sublabel?: string;
  icon: any;
  tone?: "neutral" | "primary" | "positive" | "warning" | "destructive";
  progressPct?: number;
  editor?: React.ReactNode;
}) {
  const toneMap = {
    neutral: { ring: "border-border", chip: "bg-secondary text-foreground", bar: "bg-muted-foreground/40", glow: "" },
    primary: { ring: "border-primary/25", chip: "bg-primary/15 text-primary", bar: "bg-primary", glow: "from-primary/8" },
    positive: { ring: "border-positive/30", chip: "bg-positive/15 text-positive", bar: "bg-positive", glow: "from-positive/8" },
    warning: { ring: "border-warning/30", chip: "bg-warning/15 text-warning", bar: "bg-warning", glow: "from-warning/8" },
    destructive: { ring: "border-destructive/30", chip: "bg-destructive/15 text-destructive", bar: "bg-destructive", glow: "from-destructive/8" },
  }[tone];

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md overflow-hidden",
        toneMap.ring,
      )}
    >
      {tone !== "neutral" && (
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-60", toneMap.glow)} />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <div className={cn("h-6 w-6 rounded-md grid place-items-center shrink-0", toneMap.chip)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="text-3xl font-semibold text-foreground font-mono tabular-nums tracking-tight leading-tight">
          {editor ? editor : (value || "—")}
        </div>
        {sublabel && (
          <p className="text-[11px] text-muted-foreground mt-1">{sublabel}</p>
        )}
        {typeof progressPct === "number" && (
          <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", toneMap.bar)}
              style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}


function DealMBRTab({ deal, dealId, mbrEntries, currentRGY, upsertMBREntry, deleteMBREntry, quickUpdateMBRField }: {
  deal: any;
  dealId: string;
  mbrEntries: MBREntry[];
  currentRGY: RGYWeekly | undefined;
  upsertMBREntry: (params: any, weekStart: string) => Promise<void>;
  deleteMBREntry: (id: string) => Promise<void>;
  quickUpdateMBRField: (entryId: string, field: string, value: any) => Promise<void>;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MBREntry | null>(null);
  const [viewEntry, setViewEntry] = useState<MBREntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleEntry, setScheduleEntry] = useState<MBREntry | null>(null);
  const [mbrSearchParams, setMbrSearchParams] = useSearchParams();

  // Auto-open the record drawer when navigated with ?action=record.
  useEffect(() => {
    if (mbrSearchParams.get("action") === "record") {
      setEditingEntry(null);
      setDrawerOpen(true);
      const next = new URLSearchParams(mbrSearchParams);
      next.delete("action");
      setMbrSearchParams(next, { replace: true });
    }
  }, [mbrSearchParams, setMbrSearchParams]);

  // Overall RGY rollup for this deal (band: R / Y / G / PENDING)
  const { rgyRollup } = useDealRgyRollup([dealId]);
  const overallBand = rgyRollup.get(dealId);

  const weekOptions = getWeekOptions();
  const currentWeek = weekOptions.find(w => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    return w.value === monday.toISOString().split("T")[0];
  })?.value || weekOptions[0]?.value || "";

  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  const dealForDrawer = {
    id: dealId,
    account: deal.account || "",
    dealName: deal.dealName || "",
    vsd: deal.vsd || "",
    pcCode: deal.pcCode || "",
  };

  const dealForDialog = {
    id: dealId,
    pcCode: deal.pcCode || "",
    dealId: deal.dealId || "",
    account: deal.account || "",
    dealName: deal.dealName || "",
    vsd: deal.vsd || "",
    principalBopm: deal.principalBopm || "",
    seniorBopm: deal.seniorBopm || "",
    bopm: deal.bopm || "",
    customerStatus: deal.customerStatus || "",
    customerType: deal.customerType || "",
    serviceLineTagging: deal.serviceLineTagging || "",
    businessUnit: deal.businessUnit || "",
    mrr: deal.mrr || null,
    totalDealValue: deal.totalDealValue || null,
    netDealValue: deal.netDealValue || null,
    dealType: (deal as any).dealType || "",
  };

  const handleRowClick = (entry: MBREntry) => {
    setViewEntry(entry);
  };

  const handleEdit = (entry: MBREntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEntry(entry);
    setSelectedWeek(entry.weekStart);
    setDrawerOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmId) {
      await deleteMBREntry(deleteConfirmId);
      toast.success("MBR entry deleted");
      setDeleteConfirmId(null);
    }
  };

  const handleNewMBR = () => {
    setEditingEntry(null);
    setDrawerOpen(true);
  };

  const handleSave = (data: any) => {
    const weekToUse = data.mbrDate || selectedWeek;
    upsertMBREntry(data, weekToUse);
    toast.success("MBR entry saved");
  };

  const sentimentColors: Record<string, string> = {
    Green: "bg-positive/15 text-positive",
    Yellow: "bg-warning/15 text-warning",
    Red: "bg-destructive/15 text-destructive",
  };

  const statusColors: Record<string, string> = {
    Done: "bg-positive/15 text-positive",
    "Not Done": "bg-destructive/15 text-destructive",
    Pending: "bg-warning/15 text-warning",
    "Not Required": "bg-muted text-muted-foreground",
  };

  // Sort descending by weekStart
  const sorted = useMemo(() => [...mbrEntries].sort((a, b) => b.weekStart.localeCompare(a.weekStart)), [mbrEntries]);
  const doneEntries = useMemo(() => sorted.filter(e => e.status === "Done"), [sorted]);
  const lastDone = doneEntries[0];

  // Missing month warning
  const currentMonthLabel = format(new Date(), "MMMM yyyy");
  const currentMonthPrefix = format(new Date(), "yyyy-MM");
  const hasMBRThisMonth = doneEntries.some(e => e.weekStart.startsWith(currentMonthPrefix));

  // Contract month math for MBR coverage KPI
  const totalMonths = useMemo(() => {
    if (deal?.startDate && deal?.endDate) {
      const m = differenceInCalendarMonths(new Date(deal.endDate), new Date(deal.startDate)) + 1;
      return m > 0 ? m : 0;
    }
    if (deal?.duration) {
      const n = parseInt(String(deal.duration).match(/\d+/)?.[0] || "0", 10);
      return n > 0 ? n : 0;
    }
    return 0;
  }, [deal?.startDate, deal?.endDate, deal?.duration]);

  const elapsedMonths = useMemo(() => {
    if (!deal?.startDate) return 0;
    const m = differenceInCalendarMonths(new Date(), new Date(deal.startDate)) + 1;
    if (totalMonths > 0) return Math.max(0, Math.min(m, totalMonths));
    return Math.max(0, m);
  }, [deal?.startDate, totalMonths]);

  const mbrHealth = useMemo(() => {
    const behind = elapsedMonths - doneEntries.length;
    if (behind <= 0) return { label: "On Track", tone: "positive" as const };
    return { label: `Behind by ${behind}`, tone: "warning" as const };
  }, [elapsedMonths, doneEntries.length]);

  // Slack activity flag
  const [slackActivity, setSlackActivity] = useState<{ count: number; isInactive: boolean; loading: boolean }>(
    { count: 0, isInactive: false, loading: true },
  );
  const slackChannelId = (deal as any)?.slackChannelId || "";
  const isActiveDeal = (deal as any)?.dealStatus === "Active Deal";
  useEffect(() => {
    let cancel = false;
    if (!dealId || !slackChannelId || !isActiveDeal) {
      setSlackActivity({ count: 0, isInactive: false, loading: false });
      return;
    }
    setSlackActivity((s) => ({ ...s, loading: true }));
    supabase.functions
      .invoke("slack-activity-check", { body: { mode: "status", deal_id: dealId } })
      .then(({ data }) => {
        if (cancel) return;
        setSlackActivity({
          count: data?.count ?? 0,
          isInactive: Boolean(data?.isInactive),
          loading: false,
        });
      })
      .catch(() => !cancel && setSlackActivity({ count: 0, isInactive: false, loading: false }));
    return () => { cancel = true; };
  }, [dealId, slackChannelId, isActiveDeal]);

  const slackKpi = (() => {
    if (!slackChannelId) return { label: "Slack Activity", value: "Not linked", caption: "no channel", icon: MessageSquare, tone: undefined };
    if (slackActivity.loading) return { label: "Slack Activity", value: "…", caption: "checking", icon: MessageSquare, tone: undefined };
    if (slackActivity.isInactive) return { label: "Slack Activity", value: "Inactive", caption: `${slackActivity.count} msg / 7d`, icon: AlertTriangle, tone: "warning" as const };
    return { label: "Slack Activity", value: "Active", caption: `${slackActivity.count} msgs / 7d`, icon: MessageSquare, tone: "positive" as const };
  })();

  const mbrKpis = [
    {
      label: "MBR Coverage",
      value: `${doneEntries.length}/${totalMonths || "—"}`,
      caption: "MBRs done",
      icon: CalendarCheck,
    },
    {
      label: "Last Sentiment",
      value: lastDone?.sentiment || "—",
      caption: lastDone ? format(new Date(lastDone.weekStart), "dd MMM") : "no data",
      icon: Smile,
      isSentiment: true,
    },
    {
      label: "MBR Health",
      value: mbrHealth.label,
      caption: `${elapsedMonths}/${totalMonths || "—"} mo elapsed`,
      icon: mbrHealth.tone === "positive" ? TrendingUp : AlertTriangle,
      tone: mbrHealth.tone,
    },
    {
      label: "Overall RGY",
      value: !overallBand || overallBand === "PENDING" || overallBand === "NA"
        ? "—"
        : overallBand === "R" ? "Red" : overallBand === "Y" ? "Yellow" : "Green",
      caption: "weighted rollup",
      icon: Activity,
      tone: overallBand === "R" ? ("warning" as const)
        : overallBand === "G" ? ("positive" as const)
        : undefined,
    },
    slackKpi,
  ];

  return (
    <div className="animate-fade-in space-y-4">
      {/* This-month status banner with one-click record CTA */}
      {(() => {
        const thisMonthEntry = sorted.find(e => e.weekStart.startsWith(currentMonthPrefix));
        const isDone = thisMonthEntry?.status === "Done";
        return (
          <div className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-4 py-3",
            isDone
              ? "border-positive/40 bg-positive/10"
              : "border-warning/40 bg-warning/10"
          )}>
            <div className="flex items-center gap-2">
              <span className={cn(
                "inline-flex h-6 px-2 items-center rounded-full text-xs font-semibold",
                isDone ? "bg-positive/20 text-positive" : "bg-warning/20 text-warning"
              )}>
                {isDone ? "Done" : "Pending"}
              </span>
              <span className="text-sm text-foreground">
                MBR for <span className="font-semibold">{currentMonthLabel}</span>
                {isDone && thisMonthEntry?.scheduledDate
                  ? ` — held on ${thisMonthEntry.scheduledDate}`
                  : ""}
              </span>
            </div>
            <Button
              size="sm"
              variant={isDone ? "outline" : "default"}
              onClick={() => {
                if (isDone && thisMonthEntry) {
                  setEditingEntry(thisMonthEntry);
                  setSelectedWeek(thisMonthEntry.weekStart);
                } else {
                  setEditingEntry(null);
                }
                setDrawerOpen(true);
              }}
              className="text-xs"
            >
              {isDone ? "View / Edit MBR" : `Record MBR for ${currentMonthLabel}`}
            </Button>
          </div>
        );
      })()}

      {/* AI 2-line summary of latest MBR notes */}
      <LatestMBRSummaryCard entries={sorted} />

      {/* Snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {mbrKpis.map(card => {
          const Icon = card.icon;
          const tone = (card as any).tone as "positive" | "warning" | undefined;
          return (
            <div key={card.label} className="rounded-lg border border-border bg-card px-3 py-2.5 flex items-center gap-2.5">
              <div className={cn(
                "h-8 w-8 rounded-md grid place-items-center shrink-0",
                tone === "warning" ? "bg-warning/15" : tone === "positive" ? "bg-positive/15" : "bg-secondary/60"
              )}>
                <Icon className={cn(
                  "h-4 w-4",
                  tone === "warning" ? "text-warning" : tone === "positive" ? "text-positive" : "text-primary"
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">{card.label}</p>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  {(card as any).isSentiment && lastDone?.sentiment ? (
                    <Badge className={cn("text-xs", sentimentColors[lastDone.sentiment] || "")}>{lastDone.sentiment}</Badge>
                  ) : (
                    <span className="text-sm font-semibold text-foreground font-mono tabular-nums truncate">{card.value}</span>
                  )}
                  {card.caption && (
                    <span className="text-[10px] text-muted-foreground truncate">{card.caption}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slack inactivity alert */}
      {isActiveDeal && slackChannelId && slackActivity.isInactive && !slackActivity.loading && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">Slack channel flagged as inactive</span> — only {slackActivity.count} team
            message{slackActivity.count === 1 ? "" : "s"} in the last 7 days (bot messages excluded). The team will be
            notified in the channel.
          </span>
        </div>
      )}

      {/* Missing month warning */}
      {!hasMBRThisMonth && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>No MBR recorded for {currentMonthLabel}</span>
        </div>
      )}

      {/* Next MBR scheduled banner — pick the soonest future scheduled date */}
      {(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const upcoming = sorted
          .map(e => e.scheduledDate)
          .filter((d): d is string => !!d && new Date(d) >= today)
          .sort();
        const next = upcoming[0] || sorted.find(e => e.scheduledDate)?.scheduledDate;
        if (!next) return null;
        return (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-foreground">
            <Calendar className="h-4 w-4 shrink-0 text-primary" />
            <span>Next MBR scheduled: <span className="font-semibold">{format(new Date(next), "dd MMM yyyy")}</span></span>
          </div>
        );
      })()}

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MBR History</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setScheduleEntry(null); setScheduleOpen(true); }}>
            <Calendar className="h-3.5 w-3.5" /> Schedule MBR
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleNewMBR}>
            <Plus className="h-3.5 w-3.5" /> Record MBR
          </Button>
        </div>
      </div>

      {sorted.length > 0 ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/40 border-b border-border">
                {["Week", "Status", "Sentiment", "Mode", "Scheduled Date", "Next MBR", "Fathom Link", "PPT Link", "Notes", ""].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(entry => (
                <tr
                  key={entry.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors group"
                >
                  {/* Week - clickable to open dialog */}
                  <td className="py-2.5 px-3 font-mono text-xs text-foreground cursor-pointer hover:underline" onClick={() => handleRowClick(entry)}>{entry.weekStart}</td>

                  {/* Status dropdown */}
                  <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                    <Select
                      value={entry.status || "_none"}
                      onValueChange={v => {
                        const newVal = v === entry.status ? null : v;
                        quickUpdateMBRField(entry.id, "status", newVal || "Pending");
                      }}
                    >
                      <SelectTrigger className="h-6 text-xs border-none bg-transparent shadow-none px-1 focus:ring-0 w-[100px]">
                        <Badge className={cn("text-xs", statusColors[entry.status] || "")}>{entry.status}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {["Done", "Not Done", "Not Required", "Pending"].map(s => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Sentiment dropdown */}
                  <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                    <Select
                      value={entry.sentiment || "_none"}
                      onValueChange={v => {
                        const newVal = v === "_none" ? null : (v === entry.sentiment ? null : v);
                        quickUpdateMBRField(entry.id, "sentiment", newVal);
                      }}
                    >
                      <SelectTrigger className="h-6 text-xs border-none bg-transparent shadow-none px-1 focus:ring-0 w-[90px]">
                        {entry.sentiment ? (
                          <Badge className={cn("text-xs", sentimentColors[entry.sentiment] || "")}>{entry.sentiment}</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none" className="text-xs text-muted-foreground">— Clear —</SelectItem>
                        {["Green", "Yellow", "Red"].map(s => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Mode dropdown */}
                  <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                    <Select
                      value={entry.mode || "_none"}
                      onValueChange={v => {
                        const newVal = v === "_none" ? null : (v === entry.mode ? null : v);
                        quickUpdateMBRField(entry.id, "mode", newVal);
                      }}
                    >
                      <SelectTrigger className="h-6 text-xs border-none bg-transparent shadow-none px-1 focus:ring-0 w-[90px]">
                        <span className="text-xs">{entry.mode || "—"}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none" className="text-xs text-muted-foreground">— Clear —</SelectItem>
                        {["In-Person", "Virtual", "Hybrid"].map(s => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Scheduled Date picker */}
                  <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                          {entry.scheduledDate ? format(new Date(entry.scheduledDate), "dd MMM yyyy") : "—"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={entry.scheduledDate ? new Date(entry.scheduledDate) : undefined}
                          onSelect={d => {
                            if (d) {
                              const dateStr = format(d, "yyyy-MM-dd");
                              // Deselect if same date clicked
                              if (entry.scheduledDate === dateStr) {
                                quickUpdateMBRField(entry.id, "scheduledDate", null);
                              } else {
                                quickUpdateMBRField(entry.id, "scheduledDate", dateStr);
                              }
                            }
                          }}
                          className={cn("p-3 pointer-events-auto")}
                        />
                        {entry.scheduledDate && (
                          <div className="px-3 pb-2">
                            <button className="text-xs text-destructive hover:underline" onClick={() => quickUpdateMBRField(entry.id, "scheduledDate", null)}>Clear date</button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </td>

                  {/* Next MBR - same as scheduled date display */}
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{entry.scheduledDate ? format(new Date(entry.scheduledDate), "dd MMM yyyy") : "—"}</td>

                  {/* Fathom Link - editable */}
                  <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                    <InlineLinkEditor
                      value={entry.fathomLink}
                      label="Link"
                      onSave={v => quickUpdateMBRField(entry.id, "fathomLink", v)}
                    />
                  </td>

                  {/* PPT Link - editable */}
                  <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                    <InlineLinkEditor
                      value={entry.mbrPptLink}
                      label="PPT"
                      onSave={v => quickUpdateMBRField(entry.id, "mbrPptLink", v)}
                    />
                  </td>

                  {/* Notes - editable */}
                  <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                    <InlineNotesEditor
                      value={entry.notes}
                      onSave={v => quickUpdateMBRField(entry.id, "notes", v)}
                    />
                  </td>

                  <td className="py-2.5 px-3">
                    <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handleEdit(entry, e)} title="Edit" className="p-1 rounded hover:bg-secondary"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(entry.id); }} title="Delete" className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl text-center py-8 px-5">
          <p className="text-muted-foreground mb-3">No MBR entries yet for this deal.</p>
          <Button variant="outline" onClick={handleNewMBR}>
            <Plus className="h-4 w-4 mr-1" /> Record First MBR
          </Button>
        </div>
      )}

      {drawerOpen && (
        <MBRInputDrawer
          open={drawerOpen}
          onClose={() => { setDrawerOpen(false); setEditingEntry(null); }}
          deal={dealForDrawer}
          existingEntry={editingEntry}
          selectedWeek={selectedWeek}
          onSave={handleSave}
        />
      )}

      {viewEntry && (
        <MBRDetailDialog
          open={!!viewEntry}
          onClose={() => setViewEntry(null)}
          deal={dealForDialog}
          entry={viewEntry}
          onSave={async (params) => {
            const weekToUse = viewEntry?.weekStart || selectedWeek;
            await upsertMBREntry(params, weekToUse);
            toast.success("MBR entry updated");
          }}
        />
      )}

      {scheduleOpen && (
        <ScheduleOnlyDialog
          open={scheduleOpen}
          onClose={() => { setScheduleOpen(false); setScheduleEntry(null); }}
          deal={dealForDialog as any}
          entry={scheduleEntry}
          onSave={async (params) => {
            const weekToUse = scheduleEntry?.weekStart || selectedWeek;
            await upsertMBREntry(params, weekToUse);
            toast.success("MBR scheduled");
          }}
        />
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MBR Entry</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this MBR entry? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── RGY Issue Form ──
interface RGYIssueTask {
  dimension: string;
  issueSummary: string;
  urgency: string;
  assignees: string[];
}

interface RGYIssueFormProps {
  dealId: string;
  currentRGY: RGYWeekly;
  assignees: { id: string; name: string }[];
  teamMembers: string[];
  onSaveIssue: (data: {
    issueDate: string;
    issueDetails: string;
    actionPlan: string;
    issueStatus: string;
    assignees: string[];
    dueDate: string;
    subtasks: { title: string }[];
  }) => Promise<void>;
  onCancel: () => void;
}

function RGYIssueForm({ dealId, currentRGY, assignees, teamMembers, onSaveIssue, onCancel }: RGYIssueFormProps) {
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [issueDetails, setIssueDetails] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [issueStatus, setIssueStatus] = useState("Open");
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<{ title: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const nonGreenDims = [
    { key: "customer", label: "Overall Customer", value: currentRGY.customer },
    { key: "internal", label: "Internal", value: currentRGY.internal },
    { key: "content", label: "Content", value: currentRGY.content },
    { key: "seo", label: "SEO", value: currentRGY.seo },
    { key: "supply", label: "Supply", value: currentRGY.supply },
    { key: "copy", label: "Copy", value: currentRGY.copy },
    { key: "design", label: "Design", value: currentRGY.design },
    { key: "video", label: "Video", value: currentRGY.video },
  ].filter(d => d.value === "R" || d.value === "Y");

  const allAssigneeNames = [...new Set([
    ...assignees.map(a => a.name),
    ...teamMembers,
  ])].filter(Boolean);

  const handleSubmit = async () => {
    if (!issueDetails.trim()) {
      toast.error("Please fill in issue details");
      return;
    }
    setSaving(true);
    try {
      await onSaveIssue({
        issueDate: issueDate.toISOString().split("T")[0],
        issueDetails,
        actionPlan,
        issueStatus,
        assignees: taskAssignees,
        dueDate: dueDate?.toISOString().split("T")[0] || "",
        subtasks: subtasks.filter(s => s.title.trim()),
      });
      setIssueDetails("");
      setActionPlan("");
      setTaskAssignees([]);
      setSubtasks([]);
      setDueDate(undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Issue Tracker — Non-Green Dimensions
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Issue Date */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Issue Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left text-sm font-normal h-9")}>
                <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                {format(issueDate, "dd MMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent mode="single" selected={issueDate} onSelect={d => d && setIssueDate(d)} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        {/* Status */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
          <Select value={issueStatus} onValueChange={setIssueStatus}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Issue Details */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Issue Details</label>
        <Textarea value={issueDetails} onChange={e => setIssueDetails(e.target.value)} placeholder="Describe the issue..." className="text-sm min-h-[60px]" />
      </div>

      {/* Action Plan — this becomes the task */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Action Plan</label>
        <Textarea value={actionPlan} onChange={e => setActionPlan(e.target.value)} placeholder="Final action plan..." className="text-sm min-h-[60px]" />
      </div>

      {/* Assignees */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Assignees</label>
        <div className="flex flex-wrap gap-1.5">
          {allAssigneeNames.map(name => {
            const selected = taskAssignees.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => setTaskAssignees(prev => selected ? prev.filter(a => a !== name) : [...prev, name])}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[11px] border transition-colors",
                  selected
                    ? "bg-primary/15 border-primary/40 text-primary font-medium"
                    : "bg-secondary/50 border-border text-muted-foreground hover:bg-secondary"
                )}
              >
                {name}
              </button>
            );
          })}
          {allAssigneeNames.length === 0 && (
            <span className="text-[11px] text-muted-foreground italic">No team members available</span>
          )}
        </div>
      </div>

      {/* Due Date */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left text-sm font-normal h-9", !dueDate && "text-muted-foreground")}>
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              {dueDate ? format(dueDate, "dd MMM yyyy") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent mode="single" selected={dueDate} onSelect={setDueDate} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      {/* Subtasks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground">Subtasks</label>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setSubtasks(prev => [...prev, { title: "" }])}>
            <Plus className="h-3 w-3" /> Add Subtask
          </Button>
        </div>
        <div className="space-y-2">
          {subtasks.map((s, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={s.title}
                onChange={e => setSubtasks(prev => prev.map((x, i) => i === idx ? { title: e.target.value } : x))}
                placeholder="Subtask title..."
                className="h-8 text-sm"
              />
              <button
                type="button"
                onClick={() => setSubtasks(prev => prev.filter((_, i) => i !== idx))}
                className="text-destructive hover:text-destructive/80"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {subtasks.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">No subtasks yet.</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save Issue & Create Task
        </Button>
      </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
// ── Grouped RGY History ──
function GroupedRGYHistory({ rgyWeekly, groupBy = "week" }: { rgyWeekly: RGYWeekly[]; groupBy?: "week" | "month" }) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const map: Record<string, RGYWeekly[]> = {};
    const keyOf = (r: RGYWeekly) => groupBy === "month" ? (r.weekStart || "").slice(0, 7) : r.weekStart;
    rgyWeekly.forEach(r => {
      const k = keyOf(r);
      if (!k) return;
      if (!map[k]) map[k] = [];
      map[k].push(r);
    });
    // Sort each group by createdAt desc so [0] is latest
    Object.values(map).forEach(arr => arr.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [rgyWeekly, groupBy]);

  const formatGroupLabel = (k: string) => {
    if (groupBy !== "month") return k;
    const [y, m] = k.split("-");
    if (!y || !m) return k;
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  };

  const toggleWeek = (week: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week); else next.add(week);
      return next;
    });
  };

  const renderRow = (r: RGYWeekly, label: string, indent = false) => {
    const hasIssue = [r.customer, r.internal, r.content, r.seo, r.supply, r.copy, r.design, r.video].some(v => v === "R" || v === "Y");
    return (
      <tr key={r.id} className={cn("border-b border-border/50 hover:bg-secondary/20 transition-colors", hasIssue && "bg-warning/5")}>
        <td className={cn("py-2 px-3 font-mono text-xs text-foreground", indent && "pl-8")}>
          {label}
          {indent && r.createdAt && (
            <span className="text-muted-foreground ml-1">
              {new Date(r.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </td>
        {[r.customer || "G", r.internal || "G", r.content || "G", r.seo || "G", r.supply || "G", r.copy || "G", r.design || "G", r.video || "G"].map((val, i) => (
          <td key={i} className="py-2 px-2 text-center">
            <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold", rgyColors[val] || "rgy-na")} title={val === "NA" ? "Not Required" : val === "TBU" ? "To Be Updated" : val}>{rgySymbol[val] ?? val}</span>
          </td>
        ))}
        <td className="py-2 px-3 text-xs text-muted-foreground max-w-[120px] truncate">{r.issueDetails || "—"}</td>
        <td className="py-2 px-3 text-xs text-muted-foreground max-w-[120px] truncate">{r.actionPlan || r.planOfAction || "—"}</td>
        <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">{r.resolutionDueDate || "—"}</td>
        <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap max-w-[120px] truncate" title={r.updatedByName || ""}>{r.updatedByName || "—"}</td>
        <td className="py-2 px-2 text-center">
          {r.issueStatus && r.issueStatus !== "Open" ? (
            <Badge variant="outline" className={cn("text-[10px]",
              r.issueStatus === "Resolved" ? "border-positive/40 text-positive" :
              r.issueStatus === "In Progress" ? "border-primary/40 text-primary" : ""
            )}>{r.issueStatus}</Badge>
          ) : hasIssue ? (
            <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">Open</Badge>
          ) : <span className="text-muted-foreground text-[10px]">—</span>}
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary/40 border-b border-border">
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">{groupBy === "month" ? "Month" : "Week"}</th>
            {["Customer", "Internal", "Content", "SEO", "Supply", "Copy", "Design", "Video"].map(d => (
              <th key={d} className="text-center py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">{d}</th>
            ))}
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Issue</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Action Plan</th>
            <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Due</th>
            <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Updated By</th>
            <th className="text-center py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(([weekStart, entries]) => {
            const groupLabel = formatGroupLabel(weekStart);
            if (entries.length === 1) {
              return renderRow(entries[0], groupLabel);
            }
            const isExpanded = expandedWeeks.has(weekStart);
            const latest = entries[0]; // already sorted by created_at desc
            return (
              <React.Fragment key={weekStart}>
                <tr
                  className={cn("border-b border-border/50 hover:bg-secondary/20 transition-colors cursor-pointer",
                    [latest.customer, latest.internal, latest.content, latest.seo, latest.supply, latest.copy, latest.design, latest.video].some(v => v === "R" || v === "Y") && "bg-warning/5"
                  )}
                  onClick={() => toggleWeek(weekStart)}
                >
                  <td className="py-2 px-3 font-mono text-xs text-foreground">
                    <span className="inline-flex items-center gap-1">
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {groupLabel}
                      <Badge variant="outline" className="text-[9px] ml-1">{entries.length} {groupBy === "month" ? "entries" : "changes"}</Badge>
                    </span>
                  </td>
                  {[latest.customer || "G", latest.internal || "G", latest.content || "G", latest.seo || "G", latest.supply || "G", latest.copy || "G", latest.design || "G", latest.video || "G"].map((val, i) => (
                    <td key={i} className="py-2 px-2 text-center">
                      <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold", rgyColors[val] || "rgy-na")} title={val === "NA" ? "Not Required" : val === "TBU" ? "To Be Updated" : val}>{rgySymbol[val] ?? val}</span>
                    </td>
                  ))}
                  <td className="py-2 px-3 text-xs text-muted-foreground max-w-[120px] truncate">{latest.issueDetails || "—"}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground max-w-[120px] truncate">{latest.actionPlan || latest.planOfAction || "—"}</td>
                  <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">{latest.resolutionDueDate || "—"}</td>
                  <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap max-w-[120px] truncate" title={latest.updatedByName || ""}>{latest.updatedByName || "—"}</td>
                  <td className="py-2 px-2 text-center">
                    {latest.issueStatus && latest.issueStatus !== "Open" ? (
                      <Badge variant="outline" className={cn("text-[10px]",
                        latest.issueStatus === "Resolved" ? "border-positive/40 text-positive" :
                        latest.issueStatus === "In Progress" ? "border-primary/40 text-primary" : ""
                      )}>{latest.issueStatus}</Badge>
                    ) : [latest.customer, latest.internal, latest.content, latest.seo, latest.supply, latest.copy, latest.design, latest.video].some(v => v === "R" || v === "Y") ? (
                      <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">Open</Badge>
                    ) : <span className="text-muted-foreground text-[10px]">—</span>}
                  </td>
                </tr>
                {isExpanded && entries.slice(1).map(r => renderRow(r, groupBy === "month" ? (r.weekStart || "") : "", true))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DealDetail() {
  useCurrencyVersion();
  const { dealId } = useParams();
  const [searchParams] = useSearchParams();
  const initialTab = (TABS as readonly string[]).includes(searchParams.get("tab") || "") ? (searchParams.get("tab") as TabKey) : "Overview";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const { deals, people, assignments, loading: staffLoading } = useStaffingQueries();
  const { updateDeal, updatePerson, addAssignment, updateAssignment, deleteAssignment } = useStaffingMutations();
  const { isAdmin, role } = useUserRole();
  const isVsd = role === "member";
  const access = useDealAccess();
  const navigate = useNavigate();
  const canViewThisDeal = !dealId ? false : access.isAdmin || access.canViewDeal(dealId);
  const canEditThisDeal = !dealId ? false : access.isAdmin || access.canEditDeal(dealId);

  useEffect(() => {
    if (access.loading || staffLoading) return;
    if (!dealId) return;
    if (!canViewThisDeal) {
      toast.error("You don't have access to this deal");
      navigate("/clients", { replace: true });
    }
  }, [access.loading, staffLoading, dealId, canViewThisDeal, navigate]);
  const {
    sowItems, rgyWeekly, onboarding, financials, tasks, mbrEntries, loading: detailLoading,
    toggleOnboardingStep, addSoWItem, updateSoWItem, deleteSoWItem,
    addRGYWeek, updateRGYWeek, addFinancial, updateFinancial, deleteFinancial,
    addTask, addTasksBulk, updateTask, deleteTask, seedOnboarding, upsertMBREntry, deleteMBREntry, quickUpdateMBRField,
  } = useDealDetail(dealId);

  const deal = useMemo(() => deals.find(d => d.id === dealId), [deals, dealId]);
  // Default the display currency to the currency the deal was entered in.
  // Runs once per deal id; user (admin) can still toggle it manually.
  const { setCurrency, currency, fxRate } = useCurrency();
  const currencySymbol = CURRENCY_SYMBOL[currency];
  // Deal-resolved display currency: Global geo + Neema's deals → USD;
  // otherwise fall back to the user's global toggle / inputCurrency.
  const dealCurrency = useMemo(
    () => dealDisplayCurrency(deal ?? null, currency),
    [deal, currency],
  );
  useEffect(() => {
    // Only auto-switch the global currency when there's no per-deal override.
    if (!deal?.inputCurrency) return;
    if (dealDisplayCurrency(deal, currency) !== currency && deal?.geo?.toLowerCase() !== "global") {
      // No-op: per-deal formatter will handle it.
    }
    setCurrency(deal.inputCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id, deal?.inputCurrency]);
  const fmtCurrency = useCallback((n: number | undefined) => {
    return formatMoney(Number(n) || 0, dealCurrency, { compact: true }, fxRate);
  }, [dealCurrency, fxRate]);
  const dealAssignments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return assignments.filter(a => a.dealId === dealId && (!a.endDate || a.endDate >= today));
  }, [assignments, dealId]);
  const dealPeople = useMemo(() => {
    const personIds = new Set(dealAssignments.map(a => a.personId));
    return people.filter(p => personIds.has(p.id));
  }, [dealAssignments, people]);

  const onboardingPct = useMemo(() => {
    if (!onboarding.length) return 0;
    return Math.round((onboarding.filter(s => s.completed).length / onboarding.length) * 100);
  }, [onboarding]);

  const handleDealFieldSave = useCallback((field: string, value: string) => {
    if (!dealId) return;
    const numFields = ["mrr", "totalDealValue", "retainerDealValue", "nonRetainerDealValue", "netDealValue"];
    const v = numFields.includes(field) ? Number(value) || undefined : value;
    updateDeal(dealId, { [field]: v });
    toast.success("Updated");
  }, [dealId, updateDeal]);

  // Progress & renewal calculations
  const progressInfo = useMemo(() => {
    if (!deal?.startDate || !deal?.endDate) return null;
    const start = new Date(deal.startDate);
    const end = new Date(deal.endDate);
    const today = new Date();
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const pct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
    const daysRemaining = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    return { pct, daysRemaining, totalDays, startLabel: fmtDate(deal.startDate), endLabel: fmtDate(deal.endDate) };
  }, [deal?.startDate, deal?.endDate]);

  // Current week's RGY for overview
  const currentRGY = useMemo(() => {
    if (rgyWeekly.length > 0) return rgyWeekly[0];
    return null;
  }, [rgyWeekly]);

  // RGY issue form visibility
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [prevRGYSnapshot, setPrevRGYSnapshot] = useState<Record<string, string> | null>(null);

  // Staffing dialog states
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [requestStaffingOpen, setRequestStaffingOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<string | null>(null);
  const [editAllocationValue, setEditAllocationValue] = useState(0);
  const [confirmDeleteAssignment, setConfirmDeleteAssignment] = useState<string | null>(null);

  // Green-gate dialog state
  const [greenGateDialog, setGreenGateDialog] = useState<{
    pendingDims: { key: string; label: string; tasks: any[] }[];
    pendingSave: any[] | null;
  } | null>(null);

  // R → Y optional resolve dialog
  const [showResolveOptional, setShowResolveOptional] = useState(false);

  const dimensionLabels: Record<string, string> = {
    customer: "Overall Customer",
    internal: "Internal",
    content: "Content",
    seo: "SEO",
    supply: "Supply",
    copy: "Copy",
    design: "Design",
    video: "Video",
  };

  const handleRGYSave = useCallback((dims: any[]) => {
    if (!dealId) return;

    const rgyData: Record<string, string> = {};
    const planParts: string[] = [];
    dims.forEach(d => {
      rgyData[d.key] = d.value;
      if (d.planOfAction) planParts.push(`${d.label}: ${d.planOfAction}`);
    });

    // Check green-gate: if any dimension is moving TO Green, check for open tasks
    if (currentRGY) {
      const oldValues: Record<string, string> = {
        customer: currentRGY.customer || "G",
        internal: currentRGY.internal || "G",
        content: currentRGY.content || "G",
        seo: currentRGY.seo || "G",
        supply: currentRGY.supply || "G",
        copy: currentRGY.copy || "G",
        design: currentRGY.design || "G",
        video: currentRGY.video || "G",
      };

      const pendingGreenDims: { key: string; label: string; tasks: any[] }[] = [];
      for (const [key, newVal] of Object.entries(rgyData)) {
        const oldVal = oldValues[key];
        if (newVal === "G" && oldVal !== "G") {
          const label = dimensionLabels[key] || key;
          const openTasks = tasks.filter(
            t => t.title.startsWith("[RGY Health]") &&
              t.title.includes(label) &&
              t.stage !== "Done" && t.stage !== "Dropped"
          );
          if (openTasks.length > 0) {
            pendingGreenDims.push({ key, label, tasks: openTasks });
          }
        }
      }

      if (pendingGreenDims.length > 0) {
        setGreenGateDialog({ pendingDims: pendingGreenDims, pendingSave: dims });
        return;
      }
    }

    // Snapshot current values before saving for potential revert
    if (currentRGY) {
      setPrevRGYSnapshot({
        customer: currentRGY.customer,
        internal: currentRGY.internal,
        content: currentRGY.content,
        seo: currentRGY.seo,
        supply: currentRGY.supply,
        copy: currentRGY.copy,
        design: currentRGY.design,
        video: currentRGY.video,
      });
    }

    // Always insert a new row for full history
    addRGYWeek({
      dealId,
      weekStart: (() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        return monday.toISOString().split("T")[0];
      })(),
      internal: rgyData.internal || "G",
      customer: rgyData.customer || "G",
      delivery: "G",
      consumption: "G",
      content: rgyData.content || "G",
      seo: rgyData.seo || "G",
      supply: rgyData.supply || "G",
      copy: rgyData.copy || "G",
      design: rgyData.design || "G",
      video: rgyData.video || "G",
      accountHealth: rgyData.customer || "G",
      financeBilling: "G",
      capabilitySeo: rgyData.seo || "G",
      capabilityCreative: "G",
      planOfAction: planParts.join("; "),
    });

    // Check if any dimension is Y or R to show issue form
    const hasYorR = Object.values(rgyData).some(v => v === "Y" || v === "R");
    // Detect any improvement (R→Y, R→G, Y→G) so we can offer optional resolution dialog.
    const rank: Record<string, number> = { G: 0, Y: 1, R: 2 };
    let hadImprovement = false;
    if (currentRGY) {
      for (const [k, nv] of Object.entries(rgyData)) {
        const ov = (currentRGY as any)[k];
        if (rank[nv] !== undefined && rank[ov] !== undefined && rank[nv] < rank[ov]) {
          hadImprovement = true;
          break;
        }
      }
    }
    // Open issue form for newly-introduced R/Y (not for pure R→Y downgrades).
    const newlyRorY = currentRGY
      ? Object.entries(rgyData).some(([k, nv]) => (nv === "R" || nv === "Y") && (currentRGY as any)[k] !== nv && (currentRGY as any)[k] !== "R" && (currentRGY as any)[k] !== "Y")
      : hasYorR;
    setShowIssueForm(newlyRorY);
    if (hadImprovement && !newlyRorY) setShowResolveOptional(true);
    if (!newlyRorY) setPrevRGYSnapshot(null);
    toast.success("RGY health saved");
  }, [dealId, currentRGY, addRGYWeek, tasks]);

  const handleForceCloseGreenGate = useCallback(async () => {
    if (!greenGateDialog) return;
    // Mark all pending tasks as Done
    for (const dim of greenGateDialog.pendingDims) {
      for (const task of dim.tasks) {
        await updateTask(task.id, { stage: "Done" });
      }
    }
    toast.success("Tasks force-closed");
    // Now retry the save
    if (greenGateDialog.pendingSave) {
      setGreenGateDialog(null);
      handleRGYSave(greenGateDialog.pendingSave);
    } else {
      setGreenGateDialog(null);
    }
  }, [greenGateDialog, updateTask, handleRGYSave]);

  // SoW add
  const [addingSoW, setAddingSoW] = useState(false);
  const [sowImportOpen, setSowImportOpen] = useState(false);
  const [newSoW, setNewSoW] = useState({ scope: "", revenueShare: 0, teamCapability: "", teams: [] as string[], lineItemValue: 0 });

  if (staffLoading || detailLoading) {
    return <AppLayout><div className="p-8 flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  if (!deal) {
    return <AppLayout><div className="p-8"><Link to="/clients" className="text-primary hover:underline text-sm">← Back to Clients</Link><p className="mt-4 text-muted-foreground">Deal not found.</p></div></AppLayout>;
  }

  const subtitle = [deal.serviceLineTagging || deal.capabilityLine, deal.account].filter(Boolean).join(" · ");

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-6xl">
        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-6">
          <Link to="/clients" className="h-9 w-9 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors mt-1 shrink-0" aria-label="Back to clients">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div className="flex-1 min-w-0">
            {isAdmin ? (
              <div className="text-2xl font-semibold tracking-tight text-foreground leading-tight">
                <EditableCell
                  value={deal.dealName || ""}
                  onSave={(v) => handleDealFieldSave("dealName", v)}
                  placeholder="Deal name"
                />
              </div>
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">{deal.dealName}</h1>
            )}
            <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{subtitle}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="text-xs uppercase tracking-wider">Deal ID:</span>
                {isAdmin ? (
                  <EditableCell
                    value={deal.dealId || ""}
                    onSave={(v) => handleDealFieldSave("dealId", v)}
                    placeholder="—"
                  />
                ) : (
                  <span className="text-foreground font-medium">{deal.dealId || "—"}</span>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            {!canEditThisDeal && canViewThisDeal && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-warning/10 text-warning">
                <Eye className="h-3 w-3" /> View only
              </span>
            )}
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {deal.dealType}
            </span>
            <span className={cn(
              "inline-flex px-3 py-1 rounded-full text-xs font-medium",
              deal.dealStatus === "Active Deal" ? "bg-[hsl(var(--success-bg))] text-positive"
                : deal.dealStatus === "Deal Churned / Lost" ? "bg-destructive/10 text-destructive"
                : deal.dealStatus === "Deal Disputed" ? "bg-warning/10 text-warning"
                : deal.dealStatus === "New Deal in SLA/PO" ? "bg-accent text-accent-foreground"
                : "bg-secondary text-muted-foreground"
            )}>
              {deal.dealStatus}
            </span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="border-b border-border mb-6">
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.filter(tab => {
              if (tab !== "Requests") return true;
              // Requests tab visible to VSDs (member), BOPMs (user) and Admins.
              return role === "admin" || role === "member" || role === "user";
            }).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>{tab}</button>
            ))}
          </div>
        </div>

        {/* ══════════ Overview ══════════ */}
        {activeTab === "Overview" && (
          <div className="space-y-6 animate-fade-in">
            {/* ── Financial Snapshot ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Financial Snapshot</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiTile
                  label="MRR" icon={IndianRupee} tone="primary" sublabel="Monthly recurring"
                  editor={<EditableCell value={String(deal.mrr || "")} onSave={v => handleDealFieldSave("mrr", v)} type="number" prefix={currencySymbol} placeholder="—" size="lg" />}
                />
                <KpiTile
                  label="Total Value" icon={Wallet} tone="positive" sublabel="Contract total"
                  editor={<EditableCell value={String(deal.totalDealValue || "")} onSave={v => handleDealFieldSave("totalDealValue", v)} type="number" prefix={currencySymbol} placeholder="—" size="lg" />}
                />
                <KpiTile
                  label="Retainer Value" icon={Receipt} tone="warning" sublabel="Of total value"
                  editor={<EditableCell value={String(deal.retainerDealValue || "")} onSave={v => handleDealFieldSave("retainerDealValue", v)} type="number" prefix={currencySymbol} placeholder="—" size="lg" />}
                />
                <KpiTile
                  label="Non-Retainer" icon={Receipt} tone="destructive" sublabel="Non-retainer portion"
                  editor={<EditableCell value={String(deal.nonRetainerDealValue || "")} onSave={v => handleDealFieldSave("nonRetainerDealValue", v)} type="number" prefix={currencySymbol} placeholder="—" size="lg" />}
                />
              </div>
            </div>

            {/* ── Aggregated Financial Metrics (from monthly data) ── */}
            {financials.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">YTD Financial Summary</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(() => {
                    const totalConsumed = financials.reduce((s, r) => s + (r.consumption || 0), 0);
                    const totalInvoiced = financials.reduce((s, r) => s + (r.invoiced || 0), 0);
                    const totalReceived = financials.reduce((s, r) => s + (r.received || 0), 0);
                    const outstanding = totalInvoiced - totalReceived;
                    const receivedPct = totalInvoiced > 0 ? (totalReceived / totalInvoiced) * 100 : 0;
                    const outstandingPct = totalInvoiced > 0 ? (outstanding / totalInvoiced) * 100 : 0;
                    return (
                      <>
                        <KpiTile
                          label="Total Consumed" icon={Activity} tone="primary"
                          value={fmtCurrency(totalConsumed)} sublabel="YTD consumption"
                        />
                        <KpiTile
                          label="Total Invoiced" icon={Receipt} tone="neutral"
                          value={fmtCurrency(totalInvoiced)} sublabel="Billed to client"
                        />
                        <KpiTile
                          label="Total Received" icon={BadgeCheck} tone="positive"
                          value={fmtCurrency(totalReceived)}
                          sublabel={totalInvoiced > 0 ? `${receivedPct.toFixed(0)}% of invoiced` : "Payments cleared"}
                          progressPct={totalInvoiced > 0 ? receivedPct : undefined}
                        />
                        <KpiTile
                          label="Outstanding" icon={AlertCircle}
                          tone={outstanding > 0 ? "destructive" : "positive"}
                          value={fmtCurrency(outstanding)}
                          sublabel={outstanding > 0 ? `${outstandingPct.toFixed(0)}% pending` : "All settled"}
                          progressPct={outstanding > 0 ? outstandingPct : undefined}
                        />
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">No financial data yet. Add months in the Financials tab.</p>
              </div>
            )}

            {/* ── Contract Details + Team ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Contract Details */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Contract Details</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Payment Terms</span>
                    <EditableCell value={deal.paymentTerms || ""} onSave={v => handleDealFieldSave("paymentTerms", v)} placeholder="Not set" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Duration</span>
                    <EditableCell value={deal.duration || ""} onSave={v => handleDealFieldSave("duration", v)} placeholder="Not set" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Service Line</span>
                    {(() => {
                      const current = deal.serviceLineTagging || deal.capabilityLine || "";
                      const isLegacy = current && !(SERVICE_LINE_OPTIONS as readonly string[]).includes(current);
                      return (
                        <Select value={current || undefined} onValueChange={(v) => handleDealFieldSave("serviceLineTagging", v)}>
                          <SelectTrigger
                            className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 hover:text-primary text-xs text-foreground gap-1 w-auto max-w-[280px] [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60"
                          >
                            <SelectValue placeholder="Not set">
                              <span className={cn("truncate inline-flex items-center gap-1", !current && "text-muted-foreground")}>
                                {current || "Not set"}
                                {isLegacy && <span className="text-[9px] text-muted-foreground">(legacy)</span>}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-w-[360px]">
                            {SERVICE_LINE_OPTIONS.map(opt => (
                              <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Start Date</span>
                    <EditableCell value={deal.startDate || ""} onSave={v => handleDealFieldSave("startDate", v)} type="date" placeholder="Not set" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">End Date</span>
                    <EditableCell value={deal.endDate || ""} onSave={v => handleDealFieldSave("endDate", v)} type="date" placeholder="Not set" />
                  </div>
                </div>

                {/* Progress bar */}
                {progressInfo && (
                  <div className="mt-5 pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>{progressInfo.startLabel}</span>
                      <span>{progressInfo.endLabel}</span>
                    </div>
                    <Progress value={progressInfo.pct} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {progressInfo.pct}% complete · {progressInfo.daysRemaining} days remaining
                    </p>
                    <div className="mt-3">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-[hsl(38_92%_95%)] text-[hsl(38_80%_35%)]">
                        Renews in {progressInfo.daysRemaining} days
                      </span>
                    </div>
                  </div>
                )}
                {!progressInfo && (
                  <div className="mt-5 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">Set start and end dates to see progress.</p>
                  </div>
                )}
              </div>

              {/* Team */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Team</h3>
                </div>
                {(() => {
                  type Row = {
                    key: string;
                    name: string;
                    role: string;
                    pct: number;
                    pickable?: { roleKey: string; people: typeof people; onPick: (name: string) => void };
                  };
                  // Normalize to canonical rt_* role keys so aliases (bopm, principal_bopm,
                  // group_bopm, senior_bopm, vsd) all collapse to the same bucket and core
                  // rows don't get duplicated as "Other" extras.
                  const coreRoleKeys = ["rt_vsd", "rt_group_bopm", "rt_senior_bopm", "rt_bopm"] as const;
                  const allocFor = (roleKey: string) => {
                    const target = normalizeRoleKey(roleKey);
                    return dealAssignments.find(a => normalizeRoleKey(a.roleKey) === target)?.allocationPct ?? 0;
                  };
                  const makeOnPick = (roleKey: string, field: "vsd" | "principalBopm" | "seniorBopm" | "bopm") => (name: string) => {
                    handleDealFieldSave(field, name);
                    if (!name) {
                      const existing = dealAssignments.find(a => normalizeRoleKey(a.roleKey) === roleKey);
                      if (existing) deleteAssignment(existing.id);
                    } else {
                      const person = people.find(p => p.name === name);
                      if (person) {
                        const existing = dealAssignments.find(a => normalizeRoleKey(a.roleKey) === roleKey);
                        if (existing) updateAssignment(existing.id, { personId: person.id });
                        else addAssignment({ id: uid(), dealId: dealId!, roleKey, personId: person.id, allocationPct: 10 });
                      }
                    }
                  };
                  const coreRows: Row[] = [
                    { key: "VSD", name: deal.vsd || "", role: "VSD", pct: allocFor("vsd") || allocFor("VSD"),
                      pickable: { roleKey: "vsd", people: people.filter(p => (p.roleTitle || "").toLowerCase().includes("vsd")), onPick: makeOnPick("vsd", "vsd") } },
                    { key: "Principal BOPM", name: deal.principalBopm || "", role: "Principal BOPM", pct: allocFor("principal_bopm") || allocFor("Principal BOPM"),
                      pickable: { roleKey: "principal_bopm", people: people.filter(p => (p.roleTitle || "").toLowerCase().includes("principal bopm")), onPick: makeOnPick("principal_bopm", "principalBopm") } },
                    { key: "Senior BOPM", name: deal.seniorBopm || "", role: "Senior BOPM", pct: allocFor("senior_bopm") || allocFor("Senior BOPM"),
                      pickable: { roleKey: "senior_bopm", people: people.filter(p => (p.roleTitle || "").toLowerCase().includes("senior bopm")), onPick: makeOnPick("senior_bopm", "seniorBopm") } },
                    { key: "BOPM", name: deal.bopm || "", role: "BOPM", pct: allocFor("bopm") || allocFor("BOPM"),
                      pickable: { roleKey: "bopm", people: people.filter(p => { const rt = (p.roleTitle || "").toLowerCase(); return rt.includes("bopm") && !rt.includes("senior") && !rt.includes("principal"); }), onPick: makeOnPick("bopm", "bopm") } },
                  ];
                  const coreSet = new Set<string>(coreRoleKeys);
                  const extraRows: Row[] = dealAssignments
                    .filter(a => !coreSet.has(normalizeRoleKey(a.roleKey)))
                    .map(a => {
                      const p = people.find(pp => pp.id === a.personId);
                      return {
                        key: a.id,
                        name: p?.name || "",
                        role: p?.roleCategory || a.roleKey || "Other",
                        pct: a.allocationPct || 0,
                      } as Row;
                    });
                  const rows: Row[] = [...coreRows, ...extraRows];
                  return (
                    <div className="max-h-[360px] overflow-y-auto -mx-1 px-1">
                      <div className="divide-y divide-border">
                        {rows.map(r => <TeamAllocationRow key={r.key} row={r} />)}
                      </div>
                      <div className="pt-3 mt-2 border-t border-border">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full justify-center"
                          onClick={() => (isAdmin ? setAddMemberOpen(true) : setRequestStaffingOpen(true))}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          {isAdmin ? "Add team member" : "Request team member"}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── RGY + SoW ── */}
            <EditableRGY
              dimensions={[
                { key: "customer", label: "Overall Customer", owner: "VSD", value: currentRGY?.customer || "G", planOfAction: "" },
                { key: "internal", label: "Internal", owner: "BOPM", value: currentRGY?.internal || "G", planOfAction: "" },
                { key: "content", label: "Content", owner: "Content", value: currentRGY?.content || "G", planOfAction: "" },
                { key: "seo", label: "SEO", owner: "SEO", value: currentRGY?.seo || "G", planOfAction: "" },
                { key: "supply", label: "Supply", owner: "Supply", value: currentRGY?.supply || "G", planOfAction: "" },
                { key: "copy", label: "Copy", owner: "Copy", value: currentRGY?.copy || "G", planOfAction: "" },
                { key: "design", label: "Design", owner: "Design", value: currentRGY?.design || "G", planOfAction: "" },
                { key: "video", label: "Video", owner: "Video", value: currentRGY?.video || "G", planOfAction: "" },
              ]}
              onSave={handleRGYSave}
            />

            {/* Overview RGY Issue Form */}
            {showIssueForm && currentRGY && (
              <RGYIssueForm
                dealId={dealId!}
                currentRGY={currentRGY!}
                assignees={dealPeople.map(p => ({ id: p.id, name: p.name }))}
                teamMembers={[deal.vsd, deal.principalBopm, deal.seniorBopm, deal.bopm].filter(Boolean)}
                onCancel={() => {
                  setShowIssueForm(false);
                  if (prevRGYSnapshot && currentRGY) {
                    updateRGYWeek(currentRGY.id, {
                      customer: prevRGYSnapshot.customer || "G",
                      internal: prevRGYSnapshot.internal || "G",
                      content: prevRGYSnapshot.content || "G",
                      seo: prevRGYSnapshot.seo || "G",
                      supply: prevRGYSnapshot.supply || "G",
                      copy: prevRGYSnapshot.copy || "G",
                      design: prevRGYSnapshot.design || "G",
                      video: prevRGYSnapshot.video || "G",
                    });
                    toast.info("RGY changes reverted");
                  }
                  setPrevRGYSnapshot(null);
                }}
                onSaveIssue={async (issueData) => {
                  if (currentRGY) {
                    await updateRGYWeek(currentRGY.id, {
                      issueDate: issueData.issueDate,
                      issueDetails: issueData.issueDetails,
                      actionPlan: issueData.actionPlan,
                      resolutionDueDate: issueData.dueDate,
                      issueStatus: issueData.issueStatus,
                    });
                  }
                  if (issueData.assignees.length > 0 || issueData.actionPlan.trim() || issueData.subtasks.length > 0) {
                    await addTask({
                      dealId: dealId!,
                      title: `[RGY Health] ${(issueData.actionPlan || issueData.issueDetails).trim().slice(0, 120)}`,
                      description: `Issue Details: ${issueData.issueDetails}\nAction Plan: ${issueData.actionPlan}`,
                      stage: "To Do",
                      assignee: issueData.assignees[0] || "",
                      assignees: issueData.assignees,
                      urgency: "Medium",
                      loggedHours: 0,
                      sortOrder: 0,
                      startDate: issueData.issueDate,
                      endDate: issueData.dueDate || undefined,
                      subtasks: issueData.subtasks.map((s, i) => ({
                        id: `${Date.now()}-${i}`,
                        title: s.title,
                        completed: false,
                      })),
                    });
                  }
                  setShowIssueForm(false);
                  setPrevRGYSnapshot(null);
                  toast.success("Issue saved & task created");
                }}
              />
            )}

            {/* ── SoW ── */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Scope of Work
              </p>
              {/* Uploaded documents (Contract + SoW file) — synced with Clients page */}
              <div className="bg-card border border-border rounded-xl mb-3 px-5 py-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <DealDocsUpload dealId={dealId!} variant="contract" />
                <DealDocsUpload dealId={dealId!} variant="sow" />
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <h3 className="text-sm font-medium text-foreground">SoW Items</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSowImportOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5" /> Import from Excel
                    </button>
                    <button
                      onClick={() => setAddingSoW(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add item
                    </button>
                  </div>
                </div>
                <SoWImportDialog
                  open={sowImportOpen}
                  onOpenChange={setSowImportOpen}
                  dealId={dealId!}
                  onImport={addSoWItem}
                />

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_120px_200px_80px_32px] items-center px-5 py-2 bg-secondary/40 border-b border-border gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Scope</span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-right">Value ({currencySymbol})</span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Teams</span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Capability</span>
                  <span />
                </div>

                {/* Add row */}
                {addingSoW && (
                  <div className="grid grid-cols-[1fr_120px_200px_80px_32px] items-start gap-2 px-5 py-3 border-b border-border bg-accent/5">
                    <Input value={newSoW.scope} onChange={e => setNewSoW(p => ({ ...p, scope: e.target.value }))} className="h-7 text-sm" placeholder="Scope description" />
                    <Input value={newSoW.lineItemValue || ""} onChange={e => setNewSoW(p => ({ ...p, lineItemValue: Number(e.target.value) || 0 }))} className="h-7 text-sm text-right" type="number" placeholder="0" />
                    <div className="flex flex-wrap gap-1.5 py-1">
                      {["Account Management", "Content", "SEO", "Creative"].map(team => (
                        <label key={team} className="flex items-center gap-1 text-xs cursor-pointer">
                          <Checkbox
                            checked={newSoW.teams.includes(team)}
                            onCheckedChange={(checked) => {
                              setNewSoW(p => ({
                                ...p,
                                teams: checked ? [...p.teams, team] : p.teams.filter(t => t !== team)
                              }));
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-muted-foreground">{team}</span>
                        </label>
                      ))}
                    </div>
                    <Input value={newSoW.teamCapability} onChange={e => setNewSoW(p => ({ ...p, teamCapability: e.target.value }))} className="h-7 text-sm" placeholder="SEO" />
                    <div className="flex gap-1 justify-end pt-1">
                      <button onClick={() => { addSoWItem({ dealId: dealId!, ...newSoW }); setNewSoW({ scope: "", revenueShare: 0, teamCapability: "", teams: [], lineItemValue: 0 }); setAddingSoW(false); }} className="text-primary"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setAddingSoW(false)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}

                {/* Items */}
                {sowItems.map((s, i) => (
                  <div key={s.id} className={cn(
                    "grid grid-cols-[1fr_120px_200px_80px_32px] items-center gap-2 px-5 py-3 group hover:bg-accent/5 transition-colors",
                    i < sowItems.length - 1 && "border-b border-border"
                  )}>
                    <div className="min-w-0">
                      <EditableCell value={s.scope} onSave={v => updateSoWItem(s.id, { scope: v })} />
                    </div>
                    <div className="text-right">
                      <EditableCell value={String(s.lineItemValue || "")} onSave={v => updateSoWItem(s.id, { lineItemValue: Number(v) || 0 })} type="number" prefix={currencySymbol} placeholder="—" />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(s.teams || []).map(team => (
                        <span key={team} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent text-accent-foreground">{team}</span>
                      ))}
                      {(!s.teams || s.teams.length === 0) && <span className="text-[10px] text-muted-foreground">—</span>}
                    </div>
                    <div>
                      <EditableCell value={s.teamCapability} onSave={v => updateSoWItem(s.id, { teamCapability: v })} />
                    </div>
                    <div className="flex justify-end">
                      <button onClick={() => deleteSoWItem(s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Empty state */}
                {sowItems.length === 0 && !addingSoW && (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm text-muted-foreground">No SoW items yet. Click 'Add item' to start.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ Staffing ══════════ */}
        {activeTab === "Staffing" && (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Team Members</h3>
              <Button size="sm" onClick={() => (isAdmin ? setAddMemberOpen(true) : setRequestStaffingOpen(true))}>
                <Plus className="h-3.5 w-3.5 mr-1" /> {isAdmin ? "Add Staffing" : "Request Staffing"}
              </Button>
            </div>

            {dealPeople.length > 0 ? (
              (() => {
                const TEAM_ORDER = ["Operations", "SEO", "Content", "Content Strategy", "Creative Strategy", "Creative Art", "Creative Copy", "Video", "Performance & Growth", "Other"];
                const grouped = TEAM_ORDER
                  .map(cat => ({ category: cat, members: dealPeople.filter(p => p.roleCategory === cat) }))
                  .filter(g => g.members.length > 0);

                let totalCostWeek = 0;
                let totalHrsWeek = 0;
                let totalRevManaged = 0;
                const dealMrr = deal.mrr || 0;

                return (
                  <>
                    {(() => {
                      dealPeople.forEach(p => {
                        const alloc = dealAssignments.find(a => a.personId === p.id);
                        const pct = (alloc?.allocationPct || 0) / 100;
                        const hrs = pct * 40;
                        totalHrsWeek += hrs;
                        totalCostWeek += hrs * (p.hourlyRate || 0);
                        totalRevManaged += dealMrr * pct;
                      });
                      return (
                        <div className={cn("grid grid-cols-2 gap-3", isAdmin ? "md:grid-cols-4" : "md:grid-cols-3") }>
                          <div className="rounded-lg bg-secondary/50 p-4"><p className="metric-label">Team Size</p><p className="text-xl font-semibold text-foreground">{dealPeople.length}</p></div>
                          <div className="rounded-lg bg-secondary/50 p-4"><p className="metric-label">Total Hrs/Week</p><p className="text-xl font-semibold text-foreground">{totalHrsWeek.toFixed(1)}h</p></div>
                          {isAdmin && (
                            <div className="rounded-lg bg-secondary/50 p-4"><p className="metric-label">Cost/Week</p><p className="text-xl font-semibold text-foreground">{fmtCurrency(totalCostWeek)}</p></div>
                          )}
                          <div className="rounded-lg bg-secondary/50 p-4"><p className="metric-label">Revenue Managed</p><p className="text-xl font-semibold text-foreground">{fmtCurrency(totalRevManaged)}</p></div>
                        </div>
                      );
                    })()}

                    {grouped.map(group => (
                      <div key={group.category} className="bg-card border border-border rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-accent/20 border-b border-border flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.category}</span>
                          <span className="text-xs text-muted-foreground">{group.members.length} member{group.members.length > 1 ? "s" : ""}</span>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Name</th>
                              <th className="text-left py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Role</th>
                              <th className="text-left py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Pod</th>
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Allocation</th>
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Hrs/Week</th>
                              {isAdmin && <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Rate/Hr</th>}
                              {isAdmin && <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Cost/Week</th>}
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Rev Managed</th>
                              {isAdmin && <th className="w-16"></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {group.members.map(p => {
                              const alloc = dealAssignments.find(a => a.personId === p.id);
                              const pct = (alloc?.allocationPct || 0) / 100;
                              const hrs = pct * 40;
                              const costWeek = hrs * (p.hourlyRate || 0);
                              const revManaged = (deal.mrr || 0) * pct;
                              const isEditingThis = editingAllocation === alloc?.id;
                              return (
                                <tr key={p.id} className="border-b border-border/50 hover:bg-accent/10">
                                  <td className="py-2.5 px-4 font-medium text-foreground">{p.name}{p.tbh && <span className="ml-1 text-xs text-warning">(TBH)</span>}{p.leaving && <span className="ml-1 text-xs text-destructive">(Leaving)</span>}</td>
                                  <td className="py-2.5 px-4 text-muted-foreground">{p.roleTitle || p.designation}</td>
                                  <td className="py-2.5 px-4 text-muted-foreground">{p.pod}</td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium">
                                    {isEditingThis ? (
                                      <div className="flex items-center justify-end gap-1">
                                        <Input
                                          type="number"
                                          min={0}
                                          max={40}
                                          step="0.5"
                                          value={editAllocationValue}
                                          onChange={e => setEditAllocationValue(Number(e.target.value) || 0)}
                                          className="h-7 w-16 text-sm text-right"
                                          autoFocus
                                          onKeyDown={e => {
                                            if (e.key === "Enter") { updateAssignment(alloc!.id, { allocationPct: Math.round((editAllocationValue / 40) * 100) }); setEditingAllocation(null); toast.success("Hours updated"); }
                                            if (e.key === "Escape") setEditingAllocation(null);
                                          }}
                                        />
                                        <span className="text-xs">h</span>
                                        <button onClick={() => { updateAssignment(alloc!.id, { allocationPct: Math.round((editAllocationValue / 40) * 100) }); setEditingAllocation(null); toast.success("Hours updated"); }} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => setEditingAllocation(null)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                                      </div>
                                    ) : (
                                      <span
                                        className="cursor-pointer hover:underline"
                                        onClick={() => { if (alloc) { setEditingAllocation(alloc.id); setEditAllocationValue(Number(((alloc.allocationPct / 100) * 40).toFixed(1))); } }}
                                      >
                                        {alloc?.allocationPct || 0}%
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted-foreground">{hrs.toFixed(1)}h</td>
                                  {isAdmin && (
                                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                                      <EditableCell value={String(p.hourlyRate || 0)} onSave={v => updatePerson(p.id, { hourlyRate: Number(v) || 0 })} type="number" prefix={currencySymbol} />
                                    </td>
                                  )}
                                  {isAdmin && (
                                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted-foreground">{fmtCurrency(costWeek)}</td>
                                  )}
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted-foreground">{fmtCurrency(revManaged)}</td>
                                  {isAdmin && (
                                    <td className="py-2.5 px-4 text-right">
                                      <button
                                        onClick={() => alloc && setConfirmDeleteAssignment(alloc.id)}
                                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                        title="Remove from deal"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </>
                );
              })()
            ) : (
              <div className="bg-card border border-border rounded-xl text-center py-8 px-5">
                <p className="text-muted-foreground mb-3">No team members assigned to this deal.</p>
                <Button size="sm" onClick={() => (isAdmin ? setAddMemberOpen(true) : setRequestStaffingOpen(true))}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> {isAdmin ? "Add Staffing" : "Request Staffing"}
                </Button>
              </div>
            )}

            {/* Weekly Allocation Grid */}
            {dealPeople.length > 0 && (
              <WeeklyStaffingGrid
                dealId={dealId!}
                dealPeople={dealPeople}
                dealAssignments={dealAssignments}
              />
            )}

            {/* Confirm Delete Assignment */}
            <AlertDialog open={!!confirmDeleteAssignment} onOpenChange={v => { if (!v) setConfirmDeleteAssignment(null); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                  <AlertDialogDescription>This will remove the member's assignment from this deal.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { if (confirmDeleteAssignment) { deleteAssignment(confirmDeleteAssignment); toast.success("Member removed"); setConfirmDeleteAssignment(null); } }}>Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Staffing dialogs (rendered outside tab so Overview's Add/Request buttons also work) */}
        <AddStaffingMemberDialog
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
          people={people}
          assignments={assignments}
          deals={deals}
          dealId={dealId!}
          onAdd={addAssignment}
        />
        <RequestStaffingDialog
          open={requestStaffingOpen}
          onOpenChange={setRequestStaffingOpen}
          dealId={dealId!}
          dealLabel={deal.account || deal.dealName || dealId!}
        />

        {/* ══════════ Financials ══════════ */}
        {activeTab === "Financials" && (
          <FinancialsTab
            rows={financials}
            dealId={dealId!}
            deal={deal ? {
              totalDealValue: deal.totalDealValue,
              mrr: deal.mrr,
              startDate: deal.startDate,
              endDate: deal.endDate,
              geo: deal.geo,
              vsd: deal.vsd,
              principalBopm: deal.principalBopm,
              seniorBopm: deal.seniorBopm,
              bopm: deal.bopm,
              inputCurrency: deal.inputCurrency,
            } : undefined}
            onAdd={addFinancial}
            onUpdate={updateFinancial}
            onDelete={deleteFinancial}
            canEdit={isAdmin}
            canAddMonth={isAdmin || isVsd}
          />
        )}

        {/* ══════════ Tasks ══════════ */}
        {activeTab === "Tasks" && deal && (
          <PhaseTasksView
            tasks={tasks}
            dealId={dealId!}
            deal={deal}
            assignees={(() => {
              const staffedIds = new Set(dealPeople.map(p => p.id));
              const staffed = dealPeople.map(p => ({ id: p.id, name: p.name, staffed: true, designation: (p as any).designation || (p as any).roleTitle || "" }));
              const others = people
                .filter(p => !staffedIds.has(p.id) && !p.tbh)
                .map(p => ({ id: p.id, name: p.name, staffed: false, designation: (p as any).designation || (p as any).roleTitle || "" }));
              return [...staffed, ...others];
            })()}
            onAdd={addTask}
            onAddBulk={addTasksBulk}
            onUpdate={updateTask}
            onDelete={deleteTask}
          />
        )}

        {/* ══════════ RGY Health ══════════ */}
        {activeTab === "RGY Health" && (
          <div className="animate-fade-in space-y-5">
            {/* Overall Health — compact rollup card */}
            {(() => {
              const dimKeys = ["customer","internal","content","seo","supply","copy","design","video"] as const;
              const dims = currentRGY ? Object.fromEntries(dimKeys.map(k => [k, (currentRGY as any)[k]])) : {};
              const score = computeOverallCustomerScore(dims);
              const band = getOverallCustomerRGY(dims);
              const bandLabel = band === "R" ? "Red" : band === "Y" ? "Yellow" : band === "G" ? "Green" : "Pending";
              const bandClass =
                band === "R" ? "bg-destructive/10 text-destructive border-destructive/30"
                : band === "Y" ? "bg-warning/10 text-warning border-warning/30"
                : band === "G" ? "bg-positive/10 text-positive border-positive/30"
                : "bg-muted text-muted-foreground border-border";
              const scoreColor =
                band === "R" ? "text-destructive"
                : band === "Y" ? "text-warning"
                : band === "G" ? "text-positive"
                : "text-foreground";
              let g = 0, y = 0, r = 0;
              dimKeys.forEach(k => {
                const v = (dims as any)[k];
                if (v === "G") g++;
                else if (v === "Y") y++;
                else if (v === "R") r++;
              });
              return (
                <div className="rounded-xl border border-border bg-card px-5 py-4">
                  <div className="flex items-center justify-between gap-6 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Overall Health</p>
                      <div className="flex items-baseline gap-3 mt-1.5">
                        <span className={cn("text-4xl font-medium tabular-nums leading-none", scoreColor)}>
                          {score === null ? "—" : Math.round(score)}
                        </span>
                        <span className="text-sm text-muted-foreground">/100</span>
                        <Badge variant="outline" className={cn("text-xs px-2.5 py-0.5 ml-1", bandClass)}>{bandLabel}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Weighted across 8 dimensions · Customer 50% · Internal 10% · Capability 5% each
                      </p>
                    </div>
                    <div className="flex items-center gap-6 pl-6 border-l border-border">
                      <div className="text-center">
                        <p className="text-2xl font-medium tabular-nums text-positive leading-none">{g}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">Green</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-medium tabular-nums text-warning leading-none">{y}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">Yellow</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-medium tabular-nums text-destructive leading-none">{r}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">Red</p>
                      </div>
                    </div>
                  </div>
                  {!currentRGY && (
                    <p className="text-[11px] text-muted-foreground mt-3">No RGY recorded yet — set status below.</p>
                  )}
                </div>
              );
            })()}

            {/* Current Week RGY Editor */}
            <EditableRGY
              dimensions={[
                { key: "customer", label: "Overall Customer", owner: "VSD", value: currentRGY?.customer || "G" },
                { key: "internal", label: "Internal", owner: "BOPM", value: currentRGY?.internal || "G" },
                { key: "content", label: "Content", owner: "Content", value: currentRGY?.content || "G" },
                { key: "seo", label: "SEO", owner: "SEO", value: currentRGY?.seo || "G" },
                { key: "supply", label: "Supply", owner: "Supply", value: currentRGY?.supply || "G" },
                { key: "copy", label: "Copy", owner: "Copy", value: currentRGY?.copy || "G" },
                { key: "design", label: "Design", owner: "Design", value: currentRGY?.design || "G" },
                { key: "video", label: "Video", owner: "Video", value: currentRGY?.video || "G" },
              ]}
              onSave={handleRGYSave}
              issuesByDim={(() => {
                const labelToKey: Record<string, string> = {
                  "Overall Customer": "customer",
                  "Internal": "internal",
                  "Content": "content",
                  "SEO": "seo",
                  "Supply": "supply",
                  "Copy": "copy",
                  "Design": "design",
                  "Video": "video",
                };
                const map: Record<string, any[]> = {};
                tasks.filter(t => t.title?.startsWith("[RGY Health]")).forEach(t => {
                  // Title format: [RGY Health] {dim} — {summary}
                  const stripped = t.title.replace("[RGY Health]", "").trim();
                  const sepIdx = stripped.indexOf("—");
                  const dimLabel = sepIdx > -1 ? stripped.slice(0, sepIdx).trim() : stripped;
                  const summary = sepIdx > -1 ? stripped.slice(sepIdx + 1).trim() : "";
                  const key = labelToKey[dimLabel];
                  if (!key) return;
                  // Extract action plan from description if present
                  const desc = t.description || "";
                  const apMatch = desc.match(/Action Plan:\s*([^\n]+)/i);
                  const dtMatch = desc.match(/Issue Details:\s*([^\n]+)/i);
                  (map[key] ||= []).push({
                    id: t.id,
                    summary: summary || t.title,
                    details: dtMatch?.[1],
                    actionPlan: apMatch?.[1],
                    dueDate: t.endDate,
                    stage: t.stage,
                    assignee: t.assignee,
                  });
                });
                // Sort: open first, then by due date
                Object.keys(map).forEach(k => {
                  map[k].sort((a, b) => {
                    const ao = a.stage !== "Done" && a.stage !== "Dropped" ? 0 : 1;
                    const bo = b.stage !== "Done" && b.stage !== "Dropped" ? 0 : 1;
                    if (ao !== bo) return ao - bo;
                    return (a.dueDate || "").localeCompare(b.dueDate || "");
                  });
                });
                return map;
              })()}
              onIssueClick={(issue) => {
                setActiveTab("Tasks");
                // Optionally could scroll/open the task
              }}
            />

            {/* RGY Task Summary */}
            {(() => {
              const rgyTasks = tasks.filter(t => t.title.startsWith("[RGY Health]"));
              const toDo = rgyTasks.filter(t => t.stage === "To Do").length;
              const inProgress = rgyTasks.filter(t => t.stage === "In Progress").length;
              const inReview = rgyTasks.filter(t => t.stage === "In Review").length;
              const done = rgyTasks.filter(t => t.stage === "Done").length;
              const dropped = rgyTasks.filter(t => t.stage === "Dropped").length;
              const hasNonGreen = currentRGY && (
                currentRGY.customer !== "G" || currentRGY.internal !== "G" ||
                currentRGY.content !== "G" || currentRGY.seo !== "G" ||
                currentRGY.supply !== "G" || currentRGY.copy !== "G" ||
                currentRGY.design !== "G" || currentRGY.video !== "G"
              );
              const allDone = rgyTasks.length > 0 && rgyTasks.every(t => t.stage === "Done" || t.stage === "Dropped");
              const showWarning = hasNonGreen && allDone;

              if (rgyTasks.length === 0) return null;
              return (
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">RGY Health Tasks Summary</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {toDo > 0 && <Badge variant="outline" className="gap-1">To Do <span className="font-bold">{toDo}</span></Badge>}
                    {inProgress > 0 && <Badge variant="outline" className="gap-1 border-primary/40 text-primary">In Progress <span className="font-bold">{inProgress}</span></Badge>}
                    {inReview > 0 && <Badge variant="outline" className="gap-1 border-blue-400/40 text-blue-600">In Review <span className="font-bold">{inReview}</span></Badge>}
                    {done > 0 && <Badge variant="outline" className="gap-1 border-positive/40 text-positive">Done <span className="font-bold">{done}</span></Badge>}
                    {dropped > 0 && <Badge variant="outline" className="gap-1">Dropped <span className="font-bold">{dropped}</span></Badge>}
                  </div>
                  {showWarning && (
                    <div className="flex items-center gap-2 mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>All RGY tasks are done but status is still Red/Yellow — consider updating RGY status to Green.</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Issue Capture Form — show only when user changes to Y/R */}
            {showIssueForm && currentRGY && (
              <RGYIssueForm
                dealId={dealId!}
                currentRGY={currentRGY!}
                assignees={dealPeople.map(p => ({ id: p.id, name: p.name }))}
                teamMembers={[
                  deal.vsd, deal.principalBopm, deal.seniorBopm, deal.bopm
                ].filter(Boolean)}
                onCancel={() => {
                  setShowIssueForm(false);
                  // Revert RGY to previous values
                  if (prevRGYSnapshot && currentRGY) {
                    updateRGYWeek(currentRGY.id, {
                      customer: prevRGYSnapshot.customer || "G",
                      internal: prevRGYSnapshot.internal || "G",
                      content: prevRGYSnapshot.content || "G",
                      seo: prevRGYSnapshot.seo || "G",
                      supply: prevRGYSnapshot.supply || "G",
                      copy: prevRGYSnapshot.copy || "G",
                      design: prevRGYSnapshot.design || "G",
                      video: prevRGYSnapshot.video || "G",
                    });
                    toast.info("RGY changes reverted");
                  }
                  setPrevRGYSnapshot(null);
                }}
                onSaveIssue={async (issueData) => {
                  if (currentRGY) {
                    await updateRGYWeek(currentRGY.id, {
                      issueDate: issueData.issueDate,
                      issueDetails: issueData.issueDetails,
                      actionPlan: issueData.actionPlan,
                      resolutionDueDate: issueData.dueDate,
                      issueStatus: issueData.issueStatus,
                    });
                  }
                  if (issueData.assignees.length > 0 || issueData.actionPlan.trim() || issueData.subtasks.length > 0) {
                    await addTask({
                      dealId: dealId!,
                      title: `[RGY Health] ${(issueData.actionPlan || issueData.issueDetails).trim().slice(0, 120)}`,
                      description: `Issue Details: ${issueData.issueDetails}\nAction Plan: ${issueData.actionPlan}`,
                      stage: "To Do",
                      assignee: issueData.assignees[0] || "",
                      assignees: issueData.assignees,
                      urgency: "Medium",
                      loggedHours: 0,
                      sortOrder: 0,
                      startDate: issueData.issueDate,
                      endDate: issueData.dueDate || undefined,
                      subtasks: issueData.subtasks.map((s, i) => ({
                        id: `${Date.now()}-${i}`,
                        title: s.title,
                        completed: false,
                      })),
                    });
                  }
                  setShowIssueForm(false);
                  setPrevRGYSnapshot(null);
                  toast.success("Issue saved & task created");
                }}
              />
            )}

            {/* Green-Gate Dialog */}
            {greenGateDialog && (
              <AlertDialog open={!!greenGateDialog} onOpenChange={(open) => { if (!open) setGreenGateDialog(null); }}>
                <AlertDialogContent className="max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      Open Tasks Must Be Completed
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      The following RGY Health tasks are still open. You must complete or force-close them before moving the status to Green.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {greenGateDialog.pendingDims.map(dim => (
                      <div key={dim.key} className="space-y-1.5">
                        <p className="text-xs font-semibold text-foreground">{dim.label}</p>
                        {dim.tasks.map(task => (
                          <div key={task.id} className="flex items-center gap-2 pl-2">
                            <Checkbox
                              checked={task.stage === "Done"}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  updateTask(task.id, { stage: "Done" });
                                  // Update local dialog state
                                  setGreenGateDialog(prev => {
                                    if (!prev) return prev;
                                    return {
                                      ...prev,
                                      pendingDims: prev.pendingDims.map(d => ({
                                        ...d,
                                        tasks: d.tasks.map(t => t.id === task.id ? { ...t, stage: "Done" } : t)
                                      }))
                                    };
                                  });
                                }
                              }}
                            />
                            <span className="text-sm text-foreground">{task.title}</span>
                            <Badge variant="outline" className="text-[10px] ml-auto">{task.stage}</Badge>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button
                      variant="outline"
                      onClick={handleForceCloseGreenGate}
                      className="text-warning border-warning/40"
                    >
                      Force Close All & Save
                    </Button>
                    <AlertDialogAction
                      disabled={greenGateDialog.pendingDims.some(d => d.tasks.some(t => t.stage !== "Done" && t.stage !== "Dropped"))}
                      onClick={() => {
                        const pendingSave = greenGateDialog.pendingSave;
                        setGreenGateDialog(null);
                        if (pendingSave) handleRGYSave(pendingSave);
                      }}
                    >
                      Save as Green
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* R → Y optional resolve dialog */}
            {showResolveOptional && dealId && (
              <ResolveIssuesDialog
                open
                mode="optional"
                dealId={dealId}
                dealName={deal?.dealName}
                onConfirm={() => setShowResolveOptional(false)}
                onCancel={() => setShowResolveOptional(false)}
              />
            )}

            {/* Historic Timeline — Grouped by Week */}
            <div>
              <RGYHistorySection rgyWeekly={rgyWeekly} />
            </div>
          </div>
        )}

        {/* ══════════ MBR ══════════ */}
        {activeTab === "MBR" && (
          <DealMBRTab
            deal={deal}
            dealId={dealId!}
            mbrEntries={mbrEntries}
            currentRGY={currentRGY}
            upsertMBREntry={upsertMBREntry}
            deleteMBREntry={deleteMBREntry}
            quickUpdateMBRField={quickUpdateMBRField}
          />
        )}

        {/* ══════════ Requests ══════════ */}
        {activeTab === "Requests" && (role === "admin" || role === "member" || role === "user") && (
          <DealRequestsTab dealId={dealId!} />
        )}

        {/* ══════════ Org Mapping ══════════ */}
        {activeTab === "Org Mapping" && (
          <OrgMappingTab dealId={dealId!} clientName={deal.account || deal.dealName || ""} />
        )}

      </div>
      {activeTab !== "RGY Health" && greenGateDialog && (
        <AlertDialog open={!!greenGateDialog} onOpenChange={(open) => { if (!open) setGreenGateDialog(null); }}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Open Tasks Must Be Completed
              </AlertDialogTitle>
              <AlertDialogDescription>
                The following RGY Health tasks are still open. You must complete or force-close them before moving the status to Green.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {greenGateDialog.pendingDims.map(dim => (
                <div key={dim.key} className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">{dim.label}</p>
                  {dim.tasks.map(task => (
                    <div key={task.id} className="flex items-center gap-2 pl-2">
                      <Checkbox
                        checked={task.stage === "Done"}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            updateTask(task.id, { stage: "Done" });
                            setGreenGateDialog(prev => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                pendingDims: prev.pendingDims.map(d => ({
                                  ...d,
                                  tasks: d.tasks.map(t => t.id === task.id ? { ...t, stage: "Done" } : t)
                                }))
                              };
                            });
                          }
                        }}
                      />
                      <span className="text-sm text-foreground">{task.title}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">{task.stage}</Badge>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant="outline"
                onClick={handleForceCloseGreenGate}
                className="text-warning border-warning/40"
              >
                Force Close All & Save
              </Button>
              <AlertDialogAction
                disabled={greenGateDialog.pendingDims.some(d => d.tasks.some(t => t.stage !== "Done" && t.stage !== "Dropped"))}
                onClick={() => {
                  const pendingSave = greenGateDialog.pendingSave;
                  setGreenGateDialog(null);
                  if (pendingSave) handleRGYSave(pendingSave);
                }}
              >
                Save as Green
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {activeTab !== "RGY Health" && showResolveOptional && dealId && (
        <ResolveIssuesDialog
          open
          mode="optional"
          dealId={dealId}
          dealName={deal?.dealName}
          onConfirm={() => setShowResolveOptional(false)}
          onCancel={() => setShowResolveOptional(false)}
        />
      )}

      {dealId && deal && <SlackChatBot dealId={dealId} dealName={deal.dealName} />}
    </AppLayout>
  );
}
