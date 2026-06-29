import { useEffect, useMemo, useState } from "react";
import {
  PulseAnswers, PulseConfig, defaultConfig, initialAnswers,
  buildPayload, npsCategory, experienceAvg,
} from "@/lib/pulseSurvey";

type StepKey =
  | "role" | "capabilities" | "nps" | "value" | "deep_dive"
  | "experience" | "effort" | "retention" | "expansion" | "wrap";

const STEP_ORDER: { key: StepKey; name: string }[] = [
  { key: "role", name: "Your role" },
  { key: "capabilities", name: "What you use" },
  { key: "nps", name: "The big one" },
  { key: "value", name: "Value & ROI" },
  { key: "deep_dive", name: "Outcomes" },
  { key: "experience", name: "Experience" },
  { key: "effort", name: "Effort" },
  { key: "retention", name: "Renewal" },
  { key: "expansion", name: "Growth" },
  { key: "wrap", name: "Wrap-up" },
];

interface Props {
  config?: PulseConfig;
  initial?: Partial<PulseAnswers>;
  preview?: boolean;
  onSubmit?: (payload: ReturnType<typeof buildPayload>) => Promise<{ ok: boolean; error?: string } | void>;
  headerSubtitle?: string;
}

const CARD_STYLE: React.CSSProperties = {
  background: "var(--card,#fff)",
  borderRadius: 16,
  boxShadow: "0 10px 40px rgba(38,28,80,.10)",
  padding: 32,
  border: "1px solid var(--line,#e7e4ef)",
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-block", background: "var(--brand-soft,#efeaff)",
      color: "var(--brand,#5b3df5)", padding: "4px 12px", borderRadius: 999,
      fontSize: 12, fontWeight: 500, marginBottom: 10,
    }}>{children}</span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <div style={{ textTransform: "uppercase", letterSpacing: 1.2, fontSize: 11, fontWeight: 500, color: "var(--brand,#5b3df5)", marginBottom: 8 }}>{children}</div>;
}

function H1({ children }: { children: React.ReactNode }) {
  return <h1 style={{ fontSize: 25, lineHeight: 1.25, color: "var(--ink,#15131f)", margin: "0 0 8px", fontWeight: 600 }}>{children}</h1>;
}

function Lede({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "var(--muted,#6b6878)", margin: "0 0 20px", fontSize: 15 }}>{children}</p>;
}

function ErrorMsg({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <div style={{ color: "var(--bad,#d8413c)", fontSize: 13, marginTop: 10 }}>{children}</div>;
}

function NavRow({ onBack, onNext, canBack, nextLabel = "Continue" }: { onBack: () => void; onNext: () => void; canBack: boolean; nextLabel?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
      <button
        onClick={onBack}
        disabled={!canBack}
        style={{ background: "transparent", border: "none", color: canBack ? "var(--muted,#6b6878)" : "transparent", cursor: canBack ? "pointer" : "default", fontSize: 14, padding: "10px 8px" }}
      >← Back</button>
      <button
        onClick={onNext}
        style={{
          background: "linear-gradient(135deg,var(--brand,#5b3df5),var(--brand-2,#8b6cff))",
          color: "white", border: "none", padding: "12px 28px", borderRadius: 12,
          fontSize: 15, fontWeight: 500, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(91,61,245,.3)",
        }}
      >{nextLabel} →</button>
    </div>
  );
}

function Scale({ value, onChange, min = 1, max = 5, end, compact }: { value: number | null; onChange: (n: number) => void; min?: number; max?: number; end?: [string, string]; compact?: boolean }) {
  const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: compact ? "nowrap" : "wrap" }}>
        {nums.map((n) => {
          const selected = value === n;
          return (
            <button key={n} onClick={() => onChange(n)} style={{
              flex: compact ? 1 : "0 0 auto",
              minWidth: 44, height: 44, borderRadius: 10,
              border: selected ? "1px solid var(--brand,#5b3df5)" : "1px solid var(--line,#e7e4ef)",
              background: selected ? "var(--brand,#5b3df5)" : "var(--card)",
              color: selected ? "white" : "var(--ink,#15131f)",
              fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}>{n}</button>
          );
        })}
      </div>
      {end && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted,#6b6878)", marginTop: 6 }}>
          <span>{end[0]}</span><span>{end[1]}</span>
        </div>
      )}
    </div>
  );
}

function LabelScale({ value, onChange, labels }: { value: number | null; onChange: (n: number) => void; labels: string[] }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {labels.map((label, i) => {
        const n = i + 1;
        const selected = value === n;
        return (
          <button key={n} onClick={() => onChange(n)} style={{
            flex: "1 1 120px", minHeight: 48, padding: "8px 12px", borderRadius: 10,
            border: selected ? "1px solid var(--brand,#5b3df5)" : "1px solid var(--line,#e7e4ef)",
            background: selected ? "var(--brand-soft,#efeaff)" : "var(--card)",
            color: "var(--ink,#15131f)", fontSize: 13, fontWeight: selected ? 500 : 400, cursor: "pointer",
            textAlign: "center",
          }}>{label}</button>
        );
      })}
    </div>
  );
}

function NPSScale({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  const colorFor = (n: number) => n <= 6 ? "var(--bad,#d8413c)" : n <= 8 ? "var(--warn,#e0922f)" : "var(--good,#1d9d6c)";
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 6 }}>
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const selected = value === n;
          const color = colorFor(n);
          return (
            <button key={n} onClick={() => onChange(n)} style={{
              height: 48, borderRadius: 10,
              border: selected ? `1px solid ${color}` : "1px solid var(--line,#e7e4ef)",
              background: selected ? color : "var(--card)",
              color: selected ? "white" : "var(--ink,#15131f)",
              fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}>{n}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted,#6b6878)", marginTop: 6 }}>
        <span>Not likely</span><span>Extremely likely</span>
      </div>
    </div>
  );
}

function ChoiceCard({ selected, onClick, icon, title, desc }: { selected: boolean; onClick: () => void; icon?: string; title: string; desc?: string }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", gap: 14, alignItems: "flex-start", width: "100%", textAlign: "left",
      padding: 16, borderRadius: 12,
      border: selected ? "2px solid var(--brand,#5b3df5)" : "1px solid var(--line,#e7e4ef)",
      background: selected ? "var(--brand-soft,#efeaff)" : "var(--card)",
      cursor: "pointer", marginBottom: 10,
    }}>
      {icon && <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>}
      <span style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 15, color: "var(--ink,#15131f)" }}>{title}</div>
        {desc && <div style={{ fontSize: 13, color: "var(--muted,#6b6878)", marginTop: 2 }}>{desc}</div>}
      </span>
      <span style={{
        width: 18, height: 18, borderRadius: 999, marginTop: 4,
        border: selected ? "5px solid var(--brand,#5b3df5)" : "1.5px solid var(--line,#e7e4ef)",
        background: "var(--card)",
      }} />
    </button>
  );
}

function MultiChip({ selected, onClick, icon, title, desc }: { selected: boolean; onClick: () => void; icon?: string; title: string; desc?: string }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", gap: 14, alignItems: "flex-start", width: "100%", textAlign: "left",
      padding: 14, borderRadius: 12,
      border: selected ? "2px solid var(--brand,#5b3df5)" : "1px solid var(--line,#e7e4ef)",
      background: selected ? "var(--brand-soft,#efeaff)" : "var(--card)",
      cursor: "pointer", marginBottom: 8,
    }}>
      {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
      <span style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color: "var(--ink,#15131f)" }}>{title}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--muted,#6b6878)", marginTop: 2 }}>{desc}</div>}
      </span>
      <span style={{
        width: 18, height: 18, borderRadius: 4, marginTop: 2,
        border: selected ? "2px solid var(--brand,#5b3df5)" : "1.5px solid var(--line,#e7e4ef)",
        background: selected ? "var(--brand,#5b3df5)" : "var(--card)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white", fontSize: 12,
      }}>{selected ? "✓" : ""}</span>
    </button>
  );
}

function Stars({ value, onChange, na, onNa }: { value: number | null; onChange: (n: number) => void; na: boolean; onNa: (b: boolean) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => { onNa(false); onChange(n); }} style={{
          background: "transparent", border: "none", cursor: "pointer", fontSize: 22, padding: 2,
          color: !na && value !== null && n <= value ? "#f5b400" : "#d8d4e0",
        }}>★</button>
      ))}
      <label style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: 8, fontSize: 12, color: "var(--muted,#6b6878)", cursor: "pointer" }}>
        <input type="checkbox" checked={na} onChange={(e) => { onNa(e.target.checked); if (e.target.checked) onChange(0); }} /> N/A
      </label>
    </div>
  );
}

function Textarea600({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div>
      <textarea
        value={value} rows={rows} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.slice(0, 600))}
        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--line,#e7e4ef)", fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none" }}
        onFocus={(e) => (e.target.style.borderColor = "var(--brand,#5b3df5)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--line,#e7e4ef)")}
      />
      <div style={{ textAlign: "right", fontSize: 11, color: "var(--muted,#6b6878)", marginTop: 4 }}>{value.length} / 600</div>
    </div>
  );
}

function Reveal({ when, children }: { when: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      maxHeight: when ? 800 : 0, opacity: when ? 1 : 0, overflow: "hidden",
      transition: "max-height .3s ease, opacity .25s ease",
      marginTop: when ? 16 : 0,
    }}>{children}</div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink,#15131f)", marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

export default function SurveyWizard({ config = defaultConfig, initial, preview, onSubmit, headerSubtitle }: Props) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<PulseAnswers>(() => ({ ...initialAnswers(), ...(initial as any) }));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { ok: boolean; payload: any; serverError?: string }>(null);

  const isBuyer = a.respondent.role === "buyer" || a.respondent.role === "both";
  const isUser = a.respondent.role === "user" || a.respondent.role === "both";

  // Build visible steps (skip deep-dive when no capability uses it — still show but with placeholder if none)
  const visibleSteps = STEP_ORDER;
  const total = visibleSteps.length;
  const current = visibleSteps[step];
  const progress = ((step + 1) / total) * 100;

  const updateA = (patch: Partial<PulseAnswers> | ((prev: PulseAnswers) => PulseAnswers)) => {
    setA((prev) => typeof patch === "function" ? (patch as any)(prev) : { ...prev, ...patch });
    setError(null);
  };

  function validate(k: StepKey): string | null {
    switch (k) {
      case "role": return a.respondent.role ? null : "Pick the option that fits best — we'll tailor the next questions.";
      case "capabilities": return a.respondent.capabilities.length ? null : "Pick at least one — even if it's just the main thing you use.";
      case "nps": return a.nps.score !== null ? null : "Slide a number — even a tough one is useful.";
      case "value":
        if (a.value.value_for_money === null || a.value.goal_attainment === null) return "Both scales, please — they go together.";
        return null;
      case "deep_dive": {
        const d = a.capability_deep_dive;
        if (a.respondent.capabilities.includes("content") && d.content?.drives_outcome == null) return "Tell us how content is performing for you.";
        if (a.respondent.capabilities.includes("seo")) {
          if (!d.seo?.success_metrics?.length) return "Pick at least one SEO success metric.";
          if (d.seo?.traffic_growth == null) return "Rate the organic growth you're seeing.";
          if (d.seo?.ai_citation_visibility == null) return "Rate AI Search / GEO visibility.";
        }
        if (a.respondent.capabilities.includes("creative") && d.creative?.performance == null) return "Rate how creative is performing.";
        if (a.respondent.capabilities.includes("studios") && d.studios?.talent_fit == null) return "Rate the talent fit.";
        return null;
      }
      case "experience": {
        const any = Object.values(a.experience.ratings).some((v) => typeof v === "number" && v > 0);
        return any ? null : "Rate at least one — even just the one that stands out.";
      }
      case "effort": return a.effort.ces !== null ? null : "One quick scale, then we're nearly done.";
      case "retention": return a.retention.renewal_intent ? null : "Where's your head, honestly?";
      case "expansion": return a.expansion.interests.length ? null : "Pick anything — or \"happy as-is\" works too.";
      case "wrap": return a.sentiment.mood ? null : "One last vibe-check, then we're out.";
    }
  }

  async function handleNext() {
    const err = validate(current.key);
    if (err) { setError(err); return; }
    if (step < total - 1) { setStep(step + 1); setError(null); return; }
    // Submit
    const payload = buildPayload(a);
    if (preview) { setDone({ ok: true, payload }); return; }
    setSubmitting(true);
    try {
      const result = await onSubmit?.(payload);
      const ok = !result || (result as any).ok !== false;
      setDone({ ok: !!ok, payload, serverError: ok ? undefined : (result as any)?.error });
    } catch (e: any) {
      setDone({ ok: false, payload, serverError: e?.message || "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  // -------- Render each step --------
  const c = config.steps;

  function RoleStep() {
    return (
      <>
        <Pill>{c.role.pill}</Pill>
        <H1>{c.role.h1}</H1>
        <Lede>{c.role.lede}</Lede>
        {c.role.options.map((opt) => (
          <ChoiceCard key={opt.value} selected={a.respondent.role === opt.value} icon={opt.icon} title={opt.title} desc={opt.desc}
            onClick={() => updateA((p) => ({ ...p, respondent: { ...p.respondent, role: opt.value as any } }))} />
        ))}
      </>
    );
  }

  function CapStep() {
    return (
      <>
        <Eyebrow>{c.capabilities.eyebrow}</Eyebrow>
        <H1>{c.capabilities.h1}</H1>
        <Lede>{c.capabilities.lede}</Lede>
        {c.capabilities.options.map((opt) => {
          const selected = a.respondent.capabilities.includes(opt.value as any);
          return (
            <MultiChip key={opt.value} selected={selected} icon={opt.icon} title={opt.title} desc={opt.desc}
              onClick={() => updateA((p) => {
                const set = new Set(p.respondent.capabilities);
                if (set.has(opt.value as any)) set.delete(opt.value as any); else set.add(opt.value as any);
                return { ...p, respondent: { ...p.respondent, capabilities: Array.from(set) as any } };
              })} />
          );
        })}
      </>
    );
  }

  function NpsStep() {
    const score = a.nps.score;
    const followupKey: "low" | "mid" | "high" | null = score === null ? null : score <= 6 ? "low" : score <= 8 ? "mid" : "high";
    return (
      <>
        <Eyebrow>{c.nps.eyebrow}</Eyebrow>
        <H1>{c.nps.h1}</H1>
        <Lede>{c.nps.lede}</Lede>
        <NPSScale value={score} onChange={(n) => updateA((p) => ({ ...p, nps: { ...p.nps, score: n } }))} />
        <Reveal when={followupKey !== null}>
          <FieldRow label={followupKey ? c.nps.followups[followupKey] : ""}>
            <Textarea600 value={a.nps.verbatim} onChange={(v) => updateA((p) => ({ ...p, nps: { ...p.nps, verbatim: v } }))} placeholder="Take your time…" />
          </FieldRow>
        </Reveal>
      </>
    );
  }

  function ValueStep() {
    return (
      <>
        <Eyebrow>{c.value.eyebrow}</Eyebrow>
        <H1>{c.value.h1}</H1>
        <Lede>{c.value.lede}</Lede>
        <FieldRow label={c.value.value_for_money.q}>
          <LabelScale value={a.value.value_for_money} labels={c.value.value_for_money.labels}
            onChange={(n) => updateA((p) => ({ ...p, value: { ...p.value, value_for_money: n } }))} />
        </FieldRow>
        <FieldRow label={c.value.goal_attainment.q}>
          <LabelScale value={a.value.goal_attainment} labels={c.value.goal_attainment.labels}
            onChange={(n) => updateA((p) => ({ ...p, value: { ...p.value, goal_attainment: n } }))} />
        </FieldRow>
        <Reveal when={isBuyer}>
          <FieldRow label={c.value.buyer_outcome.q}>
            <input type="text" placeholder={c.value.buyer_outcome.hint} value={a.value.target_outcome}
              onChange={(e) => updateA((p) => ({ ...p, value: { ...p.value, target_outcome: e.target.value } }))}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--line,#e7e4ef)", fontSize: 14, outline: "none" }} />
          </FieldRow>
        </Reveal>
      </>
    );
  }

  function DeepDiveStep() {
    const caps = a.respondent.capabilities;
    if (caps.length === 0) {
      return <><Eyebrow>{c.deep_dive.eyebrow}</Eyebrow><H1>Nothing to dive into.</H1><Lede>Pick a capability on the earlier step to unlock this.</Lede></>;
    }
    const dd = a.capability_deep_dive;
    const setDD = (patch: any) => updateA((p) => ({ ...p, capability_deep_dive: { ...p.capability_deep_dive, ...patch } }));
    return (
      <>
        <Eyebrow>{c.deep_dive.eyebrow}</Eyebrow>
        <H1>{c.deep_dive.h1}</H1>
        <Lede>{c.deep_dive.lede}</Lede>

        {caps.includes("content") && (
          <div style={{ borderTop: "1px solid var(--line,#e7e4ef)", paddingTop: 18, marginTop: 12 }}>
            <div style={{ fontWeight: 500, marginBottom: 14, color: "var(--brand,#5b3df5)" }}>📝 Pepper Content</div>
            <FieldRow label={c.deep_dive.content.drives_outcome.q}>
              <Scale value={dd.content?.drives_outcome ?? null} max={5} end={c.deep_dive.content.drives_outcome.end as any}
                onChange={(n) => setDD({ content: { ...(dd.content || { needed_outcomes: [], on_brief: null }), drives_outcome: n } })} />
            </FieldRow>
            <FieldRow label={c.deep_dive.content.needed_outcomes.q}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {c.deep_dive.content.needed_outcomes.options.map((opt) => {
                  const sel = dd.content?.needed_outcomes?.includes(opt);
                  return (
                    <button key={opt} onClick={() => {
                      const cur = new Set(dd.content?.needed_outcomes || []);
                      if (cur.has(opt)) cur.delete(opt); else cur.add(opt);
                      setDD({ content: { ...(dd.content || { drives_outcome: null, on_brief: null }), needed_outcomes: Array.from(cur) } });
                    }} style={{
                      padding: "8px 14px", borderRadius: 999, fontSize: 13,
                      border: sel ? "1px solid var(--brand,#5b3df5)" : "1px solid var(--line,#e7e4ef)",
                      background: sel ? "var(--brand-soft,#efeaff)" : "var(--card)", cursor: "pointer", color: "var(--ink,#15131f)",
                    }}>{opt}</button>
                  );
                })}
              </div>
            </FieldRow>
            <FieldRow label={c.deep_dive.content.on_brief.q}>
              <LabelScale value={dd.content?.on_brief ?? null} labels={c.deep_dive.content.on_brief.labels}
                onChange={(n) => setDD({ content: { ...(dd.content || { drives_outcome: null, needed_outcomes: [] }), on_brief: n } })} />
            </FieldRow>
          </div>
        )}

        {caps.includes("seo") && (
          <div style={{ borderTop: "1px solid var(--line,#e7e4ef)", paddingTop: 18, marginTop: 12 }}>
            <div style={{ fontWeight: 500, marginBottom: 14, color: "var(--brand,#5b3df5)" }}>🔍 SEO / GEO</div>
            <FieldRow label={c.deep_dive.seo.success_metrics.q}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {c.deep_dive.seo.success_metrics.options.map((opt) => {
                  const sel = dd.seo?.success_metrics?.includes(opt);
                  return (
                    <button key={opt} onClick={() => {
                      const cur = new Set(dd.seo?.success_metrics || []);
                      if (cur.has(opt)) cur.delete(opt); else cur.add(opt);
                      setDD({ seo: { ...(dd.seo || { traffic_growth: null, ai_citation_visibility: null, organic_to_pipeline: null, win_outcome: "" }), success_metrics: Array.from(cur) } });
                    }} style={{
                      padding: "8px 14px", borderRadius: 999, fontSize: 13,
                      border: sel ? "1px solid var(--brand,#5b3df5)" : "1px solid var(--line,#e7e4ef)",
                      background: sel ? "var(--brand-soft,#efeaff)" : "var(--card)", cursor: "pointer", color: "var(--ink,#15131f)",
                    }}>{opt}</button>
                  );
                })}
              </div>
            </FieldRow>
            <FieldRow label={c.deep_dive.seo.traffic_growth.q}>
              <Scale value={dd.seo?.traffic_growth ?? null} max={5} end={c.deep_dive.seo.traffic_growth.end as any}
                onChange={(n) => setDD({ seo: { ...(dd.seo || { success_metrics: [], ai_citation_visibility: null, organic_to_pipeline: null, win_outcome: "" }), traffic_growth: n } })} />
            </FieldRow>
            <div style={{ background: "var(--brand-soft,#efeaff)", padding: 16, borderRadius: 12, marginBottom: 20 }}>
              <FieldRow label={c.deep_dive.seo.ai_citation_visibility.q}>
                <Scale compact value={dd.seo?.ai_citation_visibility ?? null} max={5} end={c.deep_dive.seo.ai_citation_visibility.end as any}
                  onChange={(n) => setDD({ seo: { ...(dd.seo || { success_metrics: [], traffic_growth: null, organic_to_pipeline: null, win_outcome: "" }), ai_citation_visibility: n } })} />
              </FieldRow>
            </div>
            <FieldRow label={c.deep_dive.seo.organic_to_pipeline.q}>
              <Scale value={dd.seo?.organic_to_pipeline ?? null} max={5} end={c.deep_dive.seo.organic_to_pipeline.end as any}
                onChange={(n) => setDD({ seo: { ...(dd.seo || { success_metrics: [], traffic_growth: null, ai_citation_visibility: null, win_outcome: "" }), organic_to_pipeline: n } })} />
            </FieldRow>
            <FieldRow label={c.deep_dive.seo.win_outcome.q}>
              <Textarea600 value={dd.seo?.win_outcome || ""} onChange={(v) => setDD({ seo: { ...(dd.seo || { success_metrics: [], traffic_growth: null, ai_citation_visibility: null, organic_to_pipeline: null }), win_outcome: v } })} />
            </FieldRow>
          </div>
        )}

        {caps.includes("creative") && (
          <div style={{ borderTop: "1px solid var(--line,#e7e4ef)", paddingTop: 18, marginTop: 12 }}>
            <div style={{ fontWeight: 500, marginBottom: 14, color: "var(--brand,#5b3df5)" }}>🎨 Creative</div>
            {(["quality", "performance", "speed"] as const).map((k) => (
              <FieldRow key={k} label={(c.deep_dive.creative as any)[k].q}>
                <Scale value={(dd.creative as any)?.[k] ?? null} max={5} end={(c.deep_dive.creative as any)[k].end}
                  onChange={(n) => setDD({ creative: { ...(dd.creative || { quality: null, performance: null, speed: null }), [k]: n } })} />
              </FieldRow>
            ))}
          </div>
        )}

        {caps.includes("studios") && (
          <div style={{ borderTop: "1px solid var(--line,#e7e4ef)", paddingTop: 18, marginTop: 12 }}>
            <div style={{ fontWeight: 500, marginBottom: 14, color: "var(--brand,#5b3df5)" }}>🧩 Studios</div>
            {(["talent_fit", "integration", "autonomy"] as const).map((k) => (
              <FieldRow key={k} label={(c.deep_dive.studios as any)[k].q}>
                <Scale value={(dd.studios as any)?.[k] ?? null} max={5} end={(c.deep_dive.studios as any)[k].end}
                  onChange={(n) => setDD({ studios: { ...(dd.studios || { talent_fit: null, integration: null, autonomy: null }), [k]: n } })} />
              </FieldRow>
            ))}
          </div>
        )}
      </>
    );
  }

  function ExperienceStep() {
    const rows: { key: string; label: string }[] = [
      { key: "quality", label: c.experience.rows.quality },
      { key: "support", label: c.experience.rows.support },
      { key: "communication", label: c.experience.rows.communication },
      { key: "speed", label: c.experience.rows.speed },
      ...(isUser ? [{ key: "ease", label: c.experience.rows.ease_user }] : []),
      ...(isBuyer ? [{ key: "partner", label: c.experience.rows.partner_buyer }] : []),
    ];
    const any = rows.some((r) => typeof a.experience.ratings[r.key] === "number" && a.experience.ratings[r.key]! > 0);
    const low = rows.some((r) => typeof a.experience.ratings[r.key] === "number" && a.experience.ratings[r.key]! > 0 && a.experience.ratings[r.key]! <= 3);
    return (
      <>
        <Eyebrow>{c.experience.eyebrow}</Eyebrow>
        <H1>{c.experience.h1}</H1>
        <Lede>{c.experience.lede}</Lede>
        {rows.map((r) => {
          const v = a.experience.ratings[r.key] ?? null;
          const na = a.experience.ratings[r.key] === 0;
          return (
            <div key={r.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line,#e7e4ef)" }}>
              <div style={{ fontSize: 14, color: "var(--ink,#15131f)" }}>{r.label}</div>
              <Stars value={v} na={na}
                onChange={(n) => updateA((p) => ({ ...p, experience: { ...p.experience, ratings: { ...p.experience.ratings, [r.key]: n } } }))}
                onNa={(b) => updateA((p) => ({ ...p, experience: { ...p.experience, ratings: { ...p.experience.ratings, [r.key]: b ? 0 : null } } }))} />
            </div>
          );
        })}
        <Reveal when={any}>
          <FieldRow label={low ? c.experience.followup_low : c.experience.followup_ok}>
            <Textarea600 value={a.experience.comment} onChange={(v) => updateA((p) => ({ ...p, experience: { ...p.experience, comment: v } }))} />
          </FieldRow>
        </Reveal>
      </>
    );
  }

  function EffortStep() {
    return (
      <>
        <Eyebrow>{c.effort.eyebrow}</Eyebrow>
        <H1>{c.effort.h1}</H1>
        <Lede>{c.effort.lede}</Lede>
        <Scale value={a.effort.ces} max={5} end={c.effort.end as any}
          onChange={(n) => updateA((p) => ({ ...p, effort: { ...p.effort, ces: n } }))} />
        <FieldRow label={c.effort.friction_q}>
          <Textarea600 value={a.effort.friction} onChange={(v) => updateA((p) => ({ ...p, effort: { ...p.effort, friction: v } }))} />
        </FieldRow>
      </>
    );
  }

  function RetentionStep() {
    const intent = a.retention.renewal_intent;
    const showSave = ["unsure", "risk", "gone"].includes(intent);
    return (
      <>
        <Eyebrow>{c.retention.eyebrow}</Eyebrow>
        <H1>{c.retention.h1}</H1>
        {c.retention.options.map((opt) => (
          <ChoiceCard key={opt.value} selected={intent === opt.value} title={opt.label}
            onClick={() => updateA((p) => ({ ...p, retention: { ...p.retention, renewal_intent: opt.value as any } }))} />
        ))}
        <Reveal when={showSave}>
          <FieldRow label={c.retention.save_q}>
            <Textarea600 value={a.retention.save_lever} onChange={(v) => updateA((p) => ({ ...p, retention: { ...p.retention, save_lever: v } }))} />
          </FieldRow>
        </Reveal>
      </>
    );
  }

  function ExpansionStep() {
    const interests = a.expansion.interests;
    const showWho = (a.expansion.referral_openness ?? 0) >= 4;
    return (
      <>
        <Eyebrow>{c.expansion.eyebrow}</Eyebrow>
        <H1>{c.expansion.h1}</H1>
        <Lede>{c.expansion.lede}</Lede>
        {c.expansion.options.map((opt) => {
          const selected = interests.includes(opt.value);
          return (
            <MultiChip key={opt.value} selected={selected} title={opt.label}
              onClick={() => updateA((p) => {
                let next: string[];
                if (opt.value === "none") {
                  next = selected ? [] : ["none"];
                } else {
                  const set = new Set(p.expansion.interests.filter((i) => i !== "none"));
                  if (set.has(opt.value)) set.delete(opt.value); else set.add(opt.value);
                  next = Array.from(set);
                }
                return { ...p, expansion: { ...p.expansion, interests: next } };
              })} />
          );
        })}
        <FieldRow label={c.expansion.referral.q}>
          <Scale value={a.expansion.referral_openness} max={5} end={c.expansion.referral.end as any}
            onChange={(n) => updateA((p) => ({ ...p, expansion: { ...p.expansion, referral_openness: n } }))} />
        </FieldRow>
        <Reveal when={showWho}>
          <input type="text" placeholder={c.expansion.referral_who} value={a.expansion.referral_lead}
            onChange={(e) => updateA((p) => ({ ...p, expansion: { ...p.expansion, referral_lead: e.target.value } }))}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--line,#e7e4ef)", fontSize: 14, outline: "none" }} />
        </Reveal>
      </>
    );
  }

  function WrapStep() {
    return (
      <>
        <Eyebrow>{c.wrap.eyebrow}</Eyebrow>
        <H1>{c.wrap.h1}</H1>
        <Lede>{c.wrap.lede}</Lede>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 20 }}>
          {c.wrap.moods.map((m) => {
            const sel = a.sentiment.mood === m.value;
            return (
              <button key={m.value} onClick={() => updateA((p) => ({ ...p, sentiment: { ...p.sentiment, mood: m.value as any } }))} style={{
                padding: 14, borderRadius: 12, fontSize: 13,
                border: sel ? "2px solid var(--brand,#5b3df5)" : "1px solid var(--line,#e7e4ef)",
                background: sel ? "var(--brand-soft,#efeaff)" : "var(--card)", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              }}>
                <span style={{ fontSize: 24 }}>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
          <input placeholder="Name (optional)" value={a.respondent.name}
            onChange={(e) => updateA((p) => ({ ...p, respondent: { ...p.respondent, name: e.target.value } }))}
            style={{ padding: 12, borderRadius: 10, border: "1px solid var(--line,#e7e4ef)", fontSize: 14, outline: "none" }} />
          <input placeholder="Work email (optional)" value={a.respondent.email}
            onChange={(e) => updateA((p) => ({ ...p, respondent: { ...p.respondent, email: e.target.value } }))}
            style={{ padding: 12, borderRadius: 10, border: "1px solid var(--line,#e7e4ef)", fontSize: 14, outline: "none" }} />
          <input placeholder="Company / account (optional)" value={a.respondent.company}
            onChange={(e) => updateA((p) => ({ ...p, respondent: { ...p.respondent, company: e.target.value } }))}
            style={{ padding: 12, borderRadius: 10, border: "1px solid var(--line,#e7e4ef)", fontSize: 14, outline: "none" }} />
        </div>
        <FieldRow label={c.wrap.followup_q}>
          <div style={{ display: "flex", gap: 8 }}>
            {["yes", "maybe", "no"].map((v) => {
              const sel = a.respondent.wants_followup === v;
              return (
                <button key={v} onClick={() => updateA((p) => ({ ...p, respondent: { ...p.respondent, wants_followup: v as any } }))} style={{
                  flex: 1, padding: 12, borderRadius: 10, textTransform: "capitalize",
                  border: sel ? "1px solid var(--brand,#5b3df5)" : "1px solid var(--line,#e7e4ef)",
                  background: sel ? "var(--brand,#5b3df5)" : "var(--card)", color: sel ? "white" : "var(--ink,#15131f)",
                  cursor: "pointer", fontSize: 14,
                }}>{v}</button>
              );
            })}
          </div>
        </FieldRow>
      </>
    );
  }

  const renderStep = () => {
    switch (current.key) {
      case "role": return <RoleStep />;
      case "capabilities": return <CapStep />;
      case "nps": return <NpsStep />;
      case "value": return <ValueStep />;
      case "deep_dive": return <DeepDiveStep />;
      case "experience": return <ExperienceStep />;
      case "effort": return <EffortStep />;
      case "retention": return <RetentionStep />;
      case "expansion": return <ExpansionStep />;
      case "wrap": return <WrapStep />;
    }
  };

  // Thank-you screen
  if (done) {
    const p = done.payload;
    const moodIcon = c.wrap.moods.find((m) => m.value === p.sentiment.mood)?.icon || "🙂";
    const jsonStr = JSON.stringify(p, null, 2);
    return (
      <PulseFrame headerSubtitle={headerSubtitle} progress={100}>
        <div style={CARD_STYLE}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <H1>Thank you — truly.</H1>
            <Lede>Your response went straight to the CS team.</Lede>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, margin: "20px 0" }}>
            <ScoreCard label="NPS" value={`${p.nps.score ?? "–"}`} sub={p.nps.category} />
            <ScoreCard label="Experience" value={`${p.experience.avg ? p.experience.avg.toFixed(1) : "–"} / 5`} sub="avg" />
            <ScoreCard label="Mood" value={moodIcon} sub="" />
          </div>
          {done.serverError && (
            <div style={{ background: "var(--brand-soft)", border: "1px solid var(--line)", padding: 12, borderRadius: 10, fontSize: 13, color: "var(--bad,#d8413c)", marginBottom: 12 }}>
              Couldn't save online ({done.serverError}). Copy or download your response so we don't lose it.
            </div>
          )}
          <details>
            <summary style={{ cursor: "pointer", color: "var(--muted,#6b6878)", fontSize: 13, marginBottom: 8 }}>Show raw response</summary>
            <pre style={{ background: "var(--brand-soft)", padding: 12, borderRadius: 10, overflow: "auto", fontSize: 11, maxHeight: 300 }}>{jsonStr}</pre>
          </details>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => navigator.clipboard?.writeText(jsonStr)} style={ghostBtn}>Copy JSON</button>
            <button onClick={() => downloadJson(jsonStr)} style={ghostBtn}>Download .json</button>
            {preview && <button onClick={() => { setDone(null); setStep(0); setA(initialAnswers()); }} style={ghostBtn}>New response</button>}
          </div>
        </div>
      </PulseFrame>
    );
  }

  return (
    <PulseFrame headerSubtitle={headerSubtitle} progress={progress}>
      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted,#6b6878)", fontSize: 12, margin: "12px 4px 16px" }}>
        <span>{current.name}</span>
        <span>Step {step + 1} of {total}</span>
      </div>
      <div style={{ ...CARD_STYLE, animation: "pulseRise .3s ease both" }}>
        {renderStep()}
        <ErrorMsg>{error}</ErrorMsg>
        <NavRow canBack={step > 0} onBack={() => { setStep(Math.max(0, step - 1)); setError(null); }}
          onNext={handleNext}
          nextLabel={submitting ? "Submitting…" : step === total - 1 ? "Submit feedback" : "Continue"} />
      </div>
    </PulseFrame>
  );
}

function ScoreCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: "var(--brand-soft,#efeaff)", padding: 14, borderRadius: 12, textAlign: "center" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--brand,#5b3df5)", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: "var(--ink,#15131f)", margin: "4px 0" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted,#6b6878)" }}>{sub}</div>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line,#e7e4ef)",
  background: "var(--card)", color: "var(--ink,#15131f)", fontSize: 13, cursor: "pointer",
};

function downloadJson(s: string) {
  const blob = new Blob([s], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "pepper-pulse-response.json"; a.click();
  URL.revokeObjectURL(url);
}

function PulseFrame({ children, progress, headerSubtitle }: { children: React.ReactNode; progress: number; headerSubtitle?: string }) {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  const vars: Record<string, string> = isDark
    ? {
        "--ink": "#f1eef9",
        "--muted": "#a09cb3",
        "--line": "#2c2740",
        "--bg": "#15131f",
        "--card": "#1c1930",
        "--brand": "#8b6cff",
        "--brand-2": "#a78bff",
        "--brand-soft": "#2a2247",
        "--good": "#34c98a",
        "--warn": "#f0a755",
        "--bad": "#ef5a55",
      }
    : {
        "--ink": "#15131f",
        "--muted": "#6b6878",
        "--line": "#e7e4ef",
        "--bg": "#faf9fc",
        "--card": "#fff",
        "--brand": "#5b3df5",
        "--brand-2": "#8b6cff",
        "--brand-soft": "#efeaff",
        "--good": "#1d9d6c",
        "--warn": "#e0922f",
        "--bad": "#d8413c",
      };
  return (
    <div style={{
      ...vars,
      minHeight: "100vh",
      background: isDark
        ? "linear-gradient(180deg,#1a1730 0%,#15131f 280px)"
        : "linear-gradient(180deg,#f4f1fc 0%,#faf9fc 280px)",
      color: "var(--ink)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: "32px 16px 64px",
    } as React.CSSProperties}>
      <style>{`@keyframes pulseRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }`}</style>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg,#5b3df5,#8b6cff)",
            color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
          }}>P</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, color: "var(--ink,#15131f)" }}>Pepper Customer Pulse</div>
            {headerSubtitle && <div style={{ fontSize: 12, color: "var(--muted,#6b6878)" }}>{headerSubtitle}</div>}
          </div>
        </header>
        <div style={{ height: 4, background: "var(--line,#e7e4ef)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#5b3df5,#8b6cff)", transition: "width .3s ease" }} />
        </div>
        {children}
      </div>
    </div>
  );
}