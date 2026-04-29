import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/csvTargets";

export interface ScorecardRow {
  id: string;
  deal: string;
  client: string;
  healthScore: number;        // 0..100
  letter: string;
  band: "Healthy" | "Watch" | "Critical";
  progressPct: number;        // 0..100  – delivery vs MRR target
  budgetPct: number;          // 0..100  – consumption vs MRR (over 100 = over budget)
  satisfactionPct: number;    // 0..100  – derived from RGY mix
  daysRemaining: number | null;
  endDate: string | null;
}

type SortKey = "healthScore" | "progressPct" | "budgetPct" | "satisfactionPct" | "daysRemaining";

interface Props {
  rows: ScorecardRow[];
  onRowClick?: (id: string) => void;
}

export function DealScorecardTable({ rows, onRowClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("healthScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc"); // asc = worst first for score

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  if (rows.length === 0) {
    return <p className="text-ui text-muted-foreground">No active deals to score.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-ui">
        <thead>
          <tr className="border-b border-border">
            <Th label="Deal" />
            <Th label="Client" />
            <Th label="Grade" sortable onClick={() => toggleSort("healthScore")} active={sortKey === "healthScore"} dir={sortDir} align="right" />
            <Th label="Progress" sortable onClick={() => toggleSort("progressPct")} active={sortKey === "progressPct"} dir={sortDir} align="right" />
            <Th label="Budget" sortable onClick={() => toggleSort("budgetPct")} active={sortKey === "budgetPct"} dir={sortDir} align="right" />
            <Th label="Satisfaction" sortable onClick={() => toggleSort("satisfactionPct")} active={sortKey === "satisfactionPct"} dir={sortDir} align="right" />
            <Th label="Time Left" sortable onClick={() => toggleSort("daysRemaining")} active={sortKey === "daysRemaining"} dir={sortDir} align="right" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr
              key={r.id}
              className={cn("border-b border-border/50 transition-colors", onRowClick && "cursor-pointer hover:bg-muted/40")}
              onClick={() => onRowClick?.(r.id)}
            >
              <td className="py-2 pr-4 font-medium text-foreground truncate max-w-[220px]">{r.deal}</td>
              <td className="py-2 pr-4 text-muted-foreground truncate max-w-[160px]">{r.client}</td>
              <td className="py-2 pr-4 text-right">
                <GradePill score={r.healthScore} letter={r.letter} band={r.band} />
              </td>
              <td className="py-2 pr-4 text-right">
                <Bar value={r.progressPct} tone={progressTone(r.progressPct)} />
              </td>
              <td className="py-2 pr-4 text-right">
                <Bar value={Math.min(120, r.budgetPct)} tone={budgetTone(r.budgetPct)} suffix={r.budgetPct > 100 ? `${r.budgetPct}%` : undefined} />
              </td>
              <td className="py-2 pr-4 text-right">
                <Bar value={r.satisfactionPct} tone={progressTone(r.satisfactionPct)} />
              </td>
              <td className="py-2 pr-4 text-right font-mono tabular-nums">
                {r.daysRemaining == null ? (
                  <span className="text-muted-foreground">—</span>
                ) : r.daysRemaining < 0 ? (
                  <span className="text-destructive">{r.daysRemaining}d</span>
                ) : (
                  <span className={cn(r.daysRemaining < 30 ? "text-warning" : "text-foreground")}>{r.daysRemaining}d</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ label, sortable, onClick, active, dir, align = "left" }: { label: string; sortable?: boolean; onClick?: () => void; active?: boolean; dir?: "asc" | "desc"; align?: "left" | "right" }) {
  return (
    <th className={cn("py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider", align === "right" ? "text-right" : "text-left")}>
      {sortable ? (
        <button onClick={onClick} className={cn("inline-flex items-center gap-1 hover:text-foreground transition-colors", active && "text-foreground")}>
          {label}
          {active && (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
      ) : label}
    </th>
  );
}

function GradePill({ score, letter, band }: { score: number; letter: string; band: ScorecardRow["band"] }) {
  const tone = band === "Healthy" ? "bg-positive/15 text-positive" : band === "Watch" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive";
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold", tone)}>
      <span className="tabular-nums">{score}</span>
      <span className="opacity-70">·</span>
      <span>{letter}</span>
    </span>
  );
}

function Bar({ value, tone, suffix }: { value: number; tone: "positive" | "warning" | "destructive" | "muted"; suffix?: string }) {
  const v = Math.max(0, Math.min(120, value));
  const toneBg =
    tone === "positive" ? "bg-positive" : tone === "warning" ? "bg-warning" : tone === "destructive" ? "bg-destructive" : "bg-muted-foreground/40";
  return (
    <div className="inline-flex items-center gap-2 min-w-[120px] justify-end">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", toneBg)} style={{ width: `${Math.min(100, v)}%` }} />
      </div>
      <span className="text-xs font-mono tabular-nums text-foreground w-10 text-right">{suffix ?? `${Math.round(value)}%`}</span>
    </div>
  );
}

function progressTone(v: number): "positive" | "warning" | "destructive" {
  if (v >= 80) return "positive";
  if (v >= 50) return "warning";
  return "destructive";
}
function budgetTone(v: number): "positive" | "warning" | "destructive" {
  if (v > 100) return "destructive";
  if (v >= 90) return "warning";
  return "positive";
}

export { formatINR };