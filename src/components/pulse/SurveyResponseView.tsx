import { defaultConfig, npsCategory, experienceAvg, computeChurnRisk } from "@/lib/pulseSurvey";

const c = defaultConfig.steps;

const RENEW_LABELS: Record<string, string> = Object.fromEntries(
  c.retention.options.map((o) => [o.value, o.label]),
);
const MOOD_LABELS: Record<string, { label: string; icon: string }> = Object.fromEntries(
  c.wrap.moods.map((m) => [m.value, { label: m.label, icon: m.icon }]),
);
const EXPANSION_LABELS: Record<string, string> = Object.fromEntries(
  c.expansion.options.map((o) => [o.value, o.label]),
);
const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  c.role.options.map((o) => [o.value, o.title]),
);
const CAP_META: Record<string, { title: string; icon: string }> = Object.fromEntries(
  c.capabilities.options.map((o) => [o.value, { title: o.title, icon: o.icon }]),
);

function Section({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      {eyebrow && (
        <div className="text-[10px] font-medium tracking-[0.12em] uppercase text-primary mb-1.5">
          {eyebrow}
        </div>
      )}
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

function Empty() {
  return <span className="text-muted-foreground italic font-normal">—</span>;
}

function ScaleBar({ value, max = 5, color = "primary" }: { value: number | null; max?: number; color?: string }) {
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
  return (
    <blockquote className="mt-2 text-xs italic text-foreground border-l-2 border-primary/40 pl-3 py-1">
      "{text}"
    </blockquote>
  );
}

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
  const eff = payload.effort || {};
  const ret = payload.retention || {};
  const expn = payload.expansion || {};
  const sent = payload.sentiment || {};
  const flags = payload.flags || {};
  const risk: string = (flags.churn_risk || "").toUpperCase();

  const npsTone = nps.score == null ? "muted" : nps.score >= 9 ? "good" : nps.score >= 7 ? "warn" : "bad";
  const riskTone = risk === "HIGH" ? "bad" : risk === "MEDIUM" ? "warn" : risk ? "good" : "muted";

  const moodMeta = sent.mood ? MOOD_LABELS[sent.mood] : null;
  const caps: string[] = Array.isArray(r.capabilities) ? r.capabilities : [];

  return (
    <div className="space-y-4">
      {/* Header / summary */}
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
            {typeof eff.ces === "number" && <Pill tone="brand">CES {eff.ces}/5</Pill>}
            {moodMeta && <Pill>{moodMeta.icon} {moodMeta.label}</Pill>}
            {risk && <Pill tone={riskTone as any}>Churn risk: {risk}</Pill>}
            {flags.expansion_ready && <Pill tone="good">Expansion ready</Pill>}
          </div>
        </div>
        {caps.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {caps.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-border bg-secondary">
                <span>{CAP_META[k]?.icon || "•"}</span>
                {CAP_META[k]?.title || k}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* NPS */}
      <Section eyebrow={c.nps.eyebrow} title={c.nps.h1}>
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

      {/* Value */}
      <Section eyebrow={c.value.eyebrow} title={c.value.h1}>
        <QA q={c.value.value_for_money.q}>
          {value.value_for_money == null ? <Empty /> :
            <span>{c.value.value_for_money.labels[value.value_for_money - 1]} <span className="text-muted-foreground">({value.value_for_money}/5)</span></span>}
        </QA>
        <QA q={c.value.goal_attainment.q}>
          {value.goal_attainment == null ? <Empty /> :
            <span>{c.value.goal_attainment.labels[value.goal_attainment - 1]} <span className="text-muted-foreground">({value.goal_attainment}/5)</span></span>}
        </QA>
        {value.target_outcome && <QA q={c.value.buyer_outcome.q}><Quote text={value.target_outcome} /></QA>}
      </Section>

      {/* Deep dives per capability */}
      {(dd.content || dd.seo || dd.creative || dd.studios) && (
        <Section eyebrow={c.deep_dive.eyebrow} title={c.deep_dive.h1}>
          {dd.content && (
            <div className="space-y-2 border-l-2 border-primary/30 pl-3">
              <div className="text-xs font-medium text-foreground">📝 Pepper Content</div>
              <QA q={c.deep_dive.content.drives_outcome.q}><ScaleBar value={dd.content.drives_outcome} /></QA>
              {dd.content.needed_outcomes?.length > 0 && (
                <QA q={c.deep_dive.content.needed_outcomes.q}>
                  <div className="flex flex-wrap gap-1">{dd.content.needed_outcomes.map((x: string) => <Pill key={x}>{x}</Pill>)}</div>
                </QA>
              )}
              {dd.content.on_brief != null && (
                <QA q={c.deep_dive.content.on_brief.q}>{c.deep_dive.content.on_brief.labels[dd.content.on_brief - 1]}</QA>
              )}
            </div>
          )}
          {dd.seo && (
            <div className="space-y-2 border-l-2 border-primary/30 pl-3">
              <div className="text-xs font-medium text-foreground">🔍 Pepper SEO / GEO</div>
              {dd.seo.success_metrics?.length > 0 && (
                <QA q={c.deep_dive.seo.success_metrics.q}>
                  <div className="flex flex-wrap gap-1">{dd.seo.success_metrics.map((x: string) => <Pill key={x}>{x}</Pill>)}</div>
                </QA>
              )}
              <QA q={c.deep_dive.seo.traffic_growth.q}><ScaleBar value={dd.seo.traffic_growth} /></QA>
              <QA q={c.deep_dive.seo.ai_citation_visibility.q}><ScaleBar value={dd.seo.ai_citation_visibility} /></QA>
              {dd.seo.organic_to_pipeline != null && (
                <QA q={c.deep_dive.seo.organic_to_pipeline.q}><ScaleBar value={dd.seo.organic_to_pipeline} /></QA>
              )}
              {dd.seo.win_outcome && <QA q={c.deep_dive.seo.win_outcome.q}><Quote text={dd.seo.win_outcome} /></QA>}
            </div>
          )}
          {dd.creative && (
            <div className="space-y-2 border-l-2 border-primary/30 pl-3">
              <div className="text-xs font-medium text-foreground">🎨 Pepper Creative</div>
              <QA q={c.deep_dive.creative.quality.q}><ScaleBar value={dd.creative.quality} /></QA>
              <QA q={c.deep_dive.creative.performance.q}><ScaleBar value={dd.creative.performance} /></QA>
              <QA q={c.deep_dive.creative.speed.q}><ScaleBar value={dd.creative.speed} /></QA>
            </div>
          )}
          {dd.studios && (
            <div className="space-y-2 border-l-2 border-primary/30 pl-3">
              <div className="text-xs font-medium text-foreground">🧩 Content Studios</div>
              <QA q={c.deep_dive.studios.talent_fit.q}><ScaleBar value={dd.studios.talent_fit} /></QA>
              <QA q={c.deep_dive.studios.integration.q}><ScaleBar value={dd.studios.integration} /></QA>
              <QA q={c.deep_dive.studios.autonomy.q}><ScaleBar value={dd.studios.autonomy} /></QA>
            </div>
          )}
        </Section>
      )}

      {/* Experience */}
      <Section eyebrow={c.experience.eyebrow} title={c.experience.h1}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {Object.entries(c.experience.rows).map(([key, label]) => {
            const v = (exp.ratings || {})[key];
            return (
              <div key={key} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs">
                <span className="text-muted-foreground">{label}</span>
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

      {/* Effort */}
      <Section eyebrow={c.effort.eyebrow} title={c.effort.h1}>
        <QA q="Agreement"><ScaleBar value={eff.ces} /></QA>
        {eff.friction && <QA q={c.effort.friction_q}><Quote text={eff.friction} /></QA>}
      </Section>

      {/* Retention */}
      <Section eyebrow={c.retention.eyebrow} title={c.retention.h1}>
        <QA q="Renewal intent">
          {ret.renewal_intent ? (
            <Pill tone={["def","prob"].includes(ret.renewal_intent) ? "good" : ret.renewal_intent === "unsure" ? "warn" : "bad"}>
              {RENEW_LABELS[ret.renewal_intent] || ret.renewal_intent}
            </Pill>
          ) : <Empty />}
        </QA>
        {ret.save_lever && <QA q={c.retention.save_q}><Quote text={ret.save_lever} /></QA>}
      </Section>

      {/* Expansion */}
      <Section eyebrow={c.expansion.eyebrow} title={c.expansion.h1}>
        <QA q="Areas of interest">
          {expn.interests?.length ? (
            <div className="flex flex-wrap gap-1">
              {expn.interests.map((k: string) => <Pill key={k} tone="brand">{EXPANSION_LABELS[k] || k}</Pill>)}
            </div>
          ) : <Empty />}
        </QA>
        <QA q={c.expansion.referral.q}><ScaleBar value={expn.referral_openness} /></QA>
        {expn.referral_lead && <QA q={c.expansion.referral_who}>{expn.referral_lead}</QA>}
      </Section>

      {/* Wrap */}
      <Section eyebrow={c.wrap.eyebrow} title={c.wrap.h1}>
        <QA q="Mood">
          {moodMeta ? <span className="inline-flex items-center gap-2"><span className="text-lg">{moodMeta.icon}</span>{moodMeta.label}</span> : <Empty />}
        </QA>
        {sent.one_change && <QA q="One change you'd make"><Quote text={sent.one_change} /></QA>}
        {sent.fan_for_life && <QA q="What would make you a fan for life?"><Quote text={sent.fan_for_life} /></QA>}
        {r.wants_followup && <QA q={c.wrap.followup_q}>{r.wants_followup}</QA>}
      </Section>

      {/* Risk reasons */}
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