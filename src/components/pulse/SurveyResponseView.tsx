import { defaultConfig, npsCategory, experienceAvg, MOOD_LABELS, RENEWAL_LABELS, EXPANSION_LABELS, ROLE_LABELS, CAPABILITY_META } from "@/lib/pulseSurvey";

const c = defaultConfig.steps;

function Section({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      {eyebrow && <div className="text-[10px] font-medium tracking-[0.12em] uppercase text-primary mb-1.5">{eyebrow}</div>}
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function QA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-2 md:gap-4 text-xs">
      <div className="text-muted-foreground">{q}</div>
      <div className="text-foreground font-medium break-words">{children}</div>
    </div>
  );
}
function Empty() { return <span className="text-muted-foreground italic font-normal">—</span>; }
function ScaleBar({ value, max = 5 }: { value: number | null; max?: number }) {
  if (value == null) return <Empty />;
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden max-w-[180px]">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-foreground tabular-nums">{value}<span className="text-muted-foreground">/{max}</span></span>
    </div>
  );
}
function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "good" | "warn" | "bad" | "brand" }) {
  const cls =
    tone === "good" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" :
    tone === "warn" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" :
    tone === "bad" ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20" :
    tone === "brand" ? "bg-primary/10 text-primary border-primary/20" :
    "bg-secondary text-foreground border-border";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${cls}`}>{children}</span>;
}
function Quote({ text }: { text?: string | null }) {
  if (!text) return null;
  return <blockquote className="mt-2 text-xs italic text-foreground border-l-2 border-primary/40 pl-3 py-1">"{text}"</blockquote>;
}

const SEO_METRIC_LABELS: Record<string, string> = {
  traffic: "Organic traffic growth",
  pipeline: "Leads / pipeline from organic",
  geo: "AI Search visibility",
  rankings: "Keyword rankings",
  sov: "Share of voice",
};

export function SurveyResponseView({ payload }: { payload: any }) {
  if (!payload || typeof payload !== "object") {
    return <div className="text-sm text-muted-foreground">No response payload captured.</div>;
  }

  const r = payload.respondent || {};
  const nps = payload.nps || {};
  const npsCat = nps.category || npsCategory(nps.score ?? null);
  const value = payload.value || {};
  const dd = payload.capability_deep_dive || {};
  const exp = payload.experience || {};
  const expAvg = typeof exp.avg === "number" ? exp.avg : experienceAvg(exp.ratings || {});
  const ret = payload.retention || {};
  const expn = payload.expansion || {};
  const sent = payload.sentiment || {};
  const flags = payload.flags || {};
  const risk: string = (flags.churn_risk || "").toUpperCase();

  const npsTone = nps.score == null ? "muted" : nps.score >= 9 ? "good" : nps.score >= 7 ? "warn" : "bad";
  const riskTone = risk === "HIGH" ? "bad" : risk === "MEDIUM" ? "warn" : risk ? "good" : "muted";
  const moodMeta = sent.mood ? MOOD_LABELS[sent.mood] : null;
  const caps: string[] = Array.isArray(r.capabilities) ? r.capabilities : [];

  const s = c;
  const valueLabels = s.outcomes.value.labels;
  const trafficLabels = s.outcomes.seo.traffic_growth.labels;
  const aiLabels = s.outcomes.seo.ai_visibility.labels;
  const pipelineLabels = s.outcomes.seo.organic_to_pipeline.labels;
  const contentLabels = s.outcomes.content.labels;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] font-medium tracking-[0.12em] uppercase text-primary mb-1">Pepper Customer Pulse</div>
            <h2 className="text-base font-semibold text-foreground">
              {r.name || "Anonymous respondent"}
              {r.company ? <span className="text-muted-foreground font-normal"> · {r.company}</span> : null}
            </h2>
            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
              {r.email && <span>{r.email}</span>}
              {r.role && <span>{ROLE_LABELS[r.role] || r.role}</span>}
              {payload.submitted_at && <span>{new Date(payload.submitted_at).toLocaleString()}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Pill tone={npsTone as any}>NPS {nps.score ?? "—"} {npsCat && `· ${npsCat}`}</Pill>
            <Pill tone="brand">Experience {expAvg ? expAvg.toFixed(1) : "—"}/5</Pill>
            {moodMeta && <Pill>{moodMeta.icon} {moodMeta.label}</Pill>}
            {risk && <Pill tone={riskTone as any}>Churn risk: {risk}</Pill>}
            {flags.expansion_ready && <Pill tone="good">Expansion ready</Pill>}
          </div>
        </div>
        {caps.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {caps.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-border bg-secondary">
                <span>{CAPABILITY_META[k]?.icon || "•"}</span>
                {CAPABILITY_META[k]?.title || k}
              </span>
            ))}
          </div>
        )}
      </div>

      <Section eyebrow={s.recommend.eyebrow} title={s.recommend.h1}>
        <QA q="Score (0–10)">
          {nps.score == null ? <Empty /> : (
            <span className="inline-flex items-center gap-2">
              <span className="tabular-nums text-base">{nps.score}</span>
              <Pill tone={npsTone as any}>{npsCat}</Pill>
            </span>
          )}
        </QA>
        {nps.verbatim && <Quote text={nps.verbatim} />}
      </Section>

      <Section eyebrow={s.outcomes.eyebrow} title={s.outcomes.h1}>
        <QA q={s.outcomes.value.q}>
          {value.value_for_money == null ? <Empty /> :
            <span>{valueLabels[value.value_for_money - 1]} <span className="text-muted-foreground">({value.value_for_money}/5)</span></span>}
        </QA>

        {dd.seo && (
          <div className="space-y-2 border-l-2 border-primary/30 pl-3">
            <div className="text-xs font-medium text-foreground">🔍 Pepper SEO / GEO</div>
            {dd.seo.success_metrics?.length > 0 && (
              <QA q={s.outcomes.seo.success_metrics.q}>
                <div className="flex flex-wrap gap-1">
                  {dd.seo.success_metrics.map((x: string) => <Pill key={x}>{SEO_METRIC_LABELS[x] || x}</Pill>)}
                </div>
              </QA>
            )}
            {dd.seo.traffic_growth != null && (
              <QA q={s.outcomes.seo.traffic_growth.q}>
                <span>{trafficLabels[dd.seo.traffic_growth - 1]} <span className="text-muted-foreground">({dd.seo.traffic_growth}/5)</span></span>
              </QA>
            )}
            {dd.seo.ai_citation_visibility != null && (
              <QA q={s.outcomes.seo.ai_visibility.q}>
                <span>{aiLabels[dd.seo.ai_citation_visibility - 1]} <span className="text-muted-foreground">({dd.seo.ai_citation_visibility}/5)</span></span>
              </QA>
            )}
            {dd.seo.organic_to_pipeline != null && (
              <QA q={s.outcomes.seo.organic_to_pipeline.q}>
                <span>{pipelineLabels[dd.seo.organic_to_pipeline - 1]} <span className="text-muted-foreground">({dd.seo.organic_to_pipeline}/5)</span></span>
              </QA>
            )}
            {dd.seo.win_outcome && <QA q={s.outcomes.seo.win_outcome.q}><Quote text={dd.seo.win_outcome} /></QA>}
          </div>
        )}

        {dd.content && dd.content.quality != null && (
          <div className="space-y-2 border-l-2 border-primary/30 pl-3">
            <div className="text-xs font-medium text-foreground">📝 Content quality</div>
            <QA q={s.outcomes.content.q}>
              <span>{contentLabels[dd.content.quality - 1]} <span className="text-muted-foreground">({dd.content.quality}/5)</span></span>
            </QA>
          </div>
        )}
      </Section>

      <Section eyebrow={s.experience.eyebrow} title={s.experience.h1}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {Object.entries(s.experience.rows).map(([key, meta]) => {
            const v = (exp.ratings || {})[key];
            return (
              <div key={key} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs">
                <span className="text-muted-foreground">{(meta as any).label}</span>
                <span className="flex items-center gap-1">
                  {v == null || v === 0 ? <span className="text-muted-foreground">N/A</span> : (
                    <>
                      <span className="text-amber-500">{"★".repeat(v)}</span>
                      <span className="text-muted-foreground">{"★".repeat(5 - v)}</span>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {exp.comment && <Quote text={exp.comment} />}
      </Section>

      <Section eyebrow={s.retention_growth.eyebrow} title={s.retention_growth.h1}>
        <QA q="Renewal intent">
          {ret.renewal_intent ? (
            <Pill tone={["def","prob"].includes(ret.renewal_intent) ? "good" : ret.renewal_intent === "unsure" ? "warn" : "bad"}>
              {RENEWAL_LABELS[ret.renewal_intent] || ret.renewal_intent}
            </Pill>
          ) : <Empty />}
        </QA>
        {ret.save_lever && <QA q={s.retention_growth.save_q}><Quote text={ret.save_lever} /></QA>}
        <QA q={s.retention_growth.expansion_q}>
          {expn.interests?.length ? (
            <div className="flex flex-wrap gap-1">
              {expn.interests.map((k: string) => <Pill key={k} tone="brand">{EXPANSION_LABELS[k] || k}</Pill>)}
            </div>
          ) : <Empty />}
        </QA>
      </Section>

      <Section eyebrow="" title="Sentiment">
        <QA q={s.recommend.mood_q}>
          {moodMeta ? <span className="inline-flex items-center gap-2"><span className="text-lg">{moodMeta.icon}</span>{moodMeta.label}</span> : <Empty />}
        </QA>
      </Section>

      {Array.isArray(flags.reasons) && flags.reasons.length > 0 && (
        <Section title="Risk signals">
          <div className="flex flex-wrap gap-1.5">
            {flags.reasons.map((reason: string) => <Pill key={reason} tone={riskTone as any}>{reason}</Pill>)}
          </div>
        </Section>
      )}
    </div>
  );
}