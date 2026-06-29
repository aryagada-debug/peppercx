import { ResponseRow, InviteRow } from "./useAnalyticsData";

function computeNps(scores: number[]) {
  if (!scores.length) return null;
  const promoters = scores.filter(n => n >= 9).length;
  const detractors = scores.filter(n => n <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}
function avg(nums: (number | null)[]) {
  const xs = nums.filter((n): n is number => typeof n === "number");
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function AnalyticsKpis({ invites, responses }: { invites: InviteRow[]; responses: ResponseRow[] }) {
  const sent = invites.length;
  const opened = invites.filter(i => i.opened_at).length;
  const completed = invites.filter(i => i.completed_at).length;
  const respRate = sent > 0 ? Math.round((completed / sent) * 100) : 0;
  const nps = computeNps(responses.map(r => r.nps).filter((n): n is number => typeof n === "number"));
  const csat = avg(responses.map(r => r.csat_avg ?? null));
  const ces = avg(responses.map(r => r.ces ?? null));

  const renewMix = mix(responses.map(r => r.renew));
  const churnMix = mix(responses.map(r => r.churn_risk));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
      <Kpi label="Sent" value={sent} />
      <Kpi label="Opened" value={opened} />
      <Kpi label="Completed" value={completed} />
      <Kpi label="Response %" value={`${respRate}%`} />
      <Kpi label="NPS" value={nps == null ? "—" : nps} tone={nps == null ? "neutral" : nps >= 30 ? "good" : nps >= 0 ? "warn" : "bad"} />
      <Kpi label="Avg CSAT" value={csat == null ? "—" : csat.toFixed(2)} />
      <Kpi label="Avg CES" value={ces == null ? "—" : ces.toFixed(2)} />
      <Kpi label="Renewal" value={renewMix} small />
      <Kpi label="Churn risk" value={churnMix} small />
    </div>
  );
}

function Kpi({ label, value, tone = "neutral", small = false }: { label: string; value: any; tone?: "good" | "warn" | "bad" | "neutral"; small?: boolean }) {
  const toneCls =
    tone === "good" ? "text-emerald-600" :
    tone === "warn" ? "text-amber-600" :
    tone === "bad" ? "text-red-600" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 ${small ? "text-xs" : "text-xl"} font-medium ${toneCls}`}>{value}</div>
    </div>
  );
}

function mix(vals: (string | null)[]) {
  const counts: Record<string, number> = {};
  vals.forEach(v => { if (v) counts[v] = (counts[v] || 0) + 1; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return "—";
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k} ${Math.round((v / total) * 100)}%`)
    .join(" · ");
}