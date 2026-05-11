import { useMemo } from "react";
import { Building2, Briefcase, TrendingUp, DollarSign } from "lucide-react";
import { formatINR } from "@/lib/csvTargets";
import { useStaleRgy } from "@/hooks/useStaleRgy";
import { cn } from "@/lib/utils";

interface DealLite {
  id: string;
  account: string;
  dealStatus?: string;
  rag?: string;
  mrr?: number;
  totalDealValue?: number;
}

interface Props {
  deals: DealLite[];
}

const ACTIVE = new Set(["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);

export function BopmClientsHeader({ deals }: Props) {
  const dealIds = useMemo(() => deals.map(d => d.id), [deals]);
  const { staleRgy } = useStaleRgy(dealIds);

  const stats = useMemo(() => {
    const clientSet = new Set<string>();
    let active = 0, mrr = 0, tcv = 0;
    const statusMix: Record<string, number> = {};
    const ragMix = { red: 0, amber: 0, green: 0, none: 0 };
    let stale = 0;
    for (const d of deals) {
      if (d.account) clientSet.add(d.account);
      const st = d.dealStatus || "Active Deal";
      if (ACTIVE.has(st)) active++;
      mrr += d.mrr || 0;
      tcv += d.totalDealValue || 0;
      statusMix[st] = (statusMix[st] || 0) + 1;
      const rag = (d.rag || "").toLowerCase();
      if (rag === "red") ragMix.red++;
      else if (rag === "amber" || rag === "yellow") ragMix.amber++;
      else if (rag === "green") ragMix.green++;
      else ragMix.none++;
      const meta = staleRgy.get(d.id);
      if (meta?.isStale) stale++;
    }
    return { clients: clientSet.size, deals: deals.length, active, mrr, tcv, statusMix, ragMix, stale };
  }, [deals, staleRgy]);

  const total = Math.max(stats.deals, 1);
  const segs = [
    { key: "Active Deal", color: "bg-emerald-500" },
    { key: "New Deal in SLA/PO", color: "bg-sky-500" },
    { key: "Deal Disputed", color: "bg-amber-500" },
    { key: "Deal Completed Successfully", color: "bg-violet-500" },
    { key: "Deal Churned / Lost", color: "bg-rose-500" },
  ];

  return (
    <section className="mb-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-foreground">Your deals</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Live snapshot across the {stats.deals} deal{stats.deals === 1 ? "" : "s"} you own
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RagPill label="R" count={stats.ragMix.red} tone="bg-rose-500/15 text-rose-600" />
          <RagPill label="Y" count={stats.ragMix.amber} tone="bg-amber-500/15 text-amber-600" />
          <RagPill label="G" count={stats.ragMix.green} tone="bg-emerald-500/15 text-emerald-600" />
          {stats.stale > 0 && (
            <RagPill label="Stale RGY" count={stats.stale} tone="bg-amber-500/15 text-amber-700" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4">
        <BigStat icon={<Building2 className="h-3 w-3 text-sky-600" />} label="Clients" value={String(stats.clients)} />
        <BigStat icon={<Briefcase className="h-3 w-3 text-emerald-600" />} label="Active deals" value={`${stats.active} / ${stats.deals}`} />
        <BigStat icon={<TrendingUp className="h-3 w-3 text-amber-600" />} label="Total MRR" value={formatINR(stats.mrr)} mono />
        <BigStat icon={<DollarSign className="h-3 w-3 text-rose-600" />} label="Total TCV" value={formatINR(stats.tcv)} mono />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Deal status mix</span>
          <span className="text-[10px] text-muted-foreground">{stats.deals} total</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
          {segs.map(s => {
            const v = stats.statusMix[s.key] || 0;
            if (!v) return null;
            const w = (v / total) * 100;
            return <div key={s.key} className={cn("h-full", s.color)} style={{ width: `${w}%` }} title={`${s.key}: ${v}`} />;
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
          {segs.map(s => {
            const v = stats.statusMix[s.key] || 0;
            if (!v) return null;
            return (
              <span key={s.key} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
                {s.key.replace(" Deal", "")} · {v}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BigStat({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2.5 py-2 min-w-0">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
        <span className="shrink-0 inline-flex">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("mt-0.5 text-base font-semibold text-foreground truncate", mono && "font-mono tabular-nums")} title={value}>{value}</div>
    </div>
  );
}

function RagPill({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium", tone)}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">{count}</span>
    </span>
  );
}