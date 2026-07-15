import { useState } from "react";
import {
  PulseAnswers, PulseConfig, defaultConfig, initialAnswers,
  buildPayload, MOOD_LABELS, normalizePulseConfig,
} from "@/lib/pulseSurvey";

type StepKey = "about" | "outcomes" | "experience" | "retention_growth" | "recommend";

const STEP_ORDER: { key: StepKey; name: string }[] = [
  { key: "about", name: "About you" },
  { key: "outcomes", name: "Outcomes" },
  { key: "experience", name: "Experience" },
  { key: "retention_growth", name: "Loyalty & growth" },
  { key: "recommend", name: "Recommend us" },
];

interface Props {
  config?: PulseConfig;
  initial?: Partial<PulseAnswers>;
  preview?: boolean;
  onSubmit?: (payload: ReturnType<typeof buildPayload>) => Promise<{ ok: boolean; error?: string } | void>;
  headerSubtitle?: string;
}

const CARD_STYLE: React.CSSProperties = {
  background: "var(--card,#fff)", borderRadius: 14,
  boxShadow: "var(--shadow-pulse, 0 10px 40px rgba(38,28,80,.10))",
  padding: 32, border: "1px solid var(--line,#c9c5d6)",
};
const INPUT_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: 10,
  border: "1px solid var(--line,#c9c5d6)", background: "var(--field,var(--card))",
  color: "var(--ink,#15131f)", caretColor: "var(--brand,#5b3df5)",
  fontSize: 14, fontFamily: "inherit", outline: "none",
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
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink,#15131f)", marginBottom: 10 }}>{children}{required && <span style={{ color: "var(--bad,#d8413c)", marginLeft: 3 }}>*</span>}</div>;
}
function FieldHint({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <div style={{ color: "var(--muted,#6b6878)", fontSize: 12.5, margin: "-6px 0 10px" }}>{children}</div>;
}
function SectionHeader({ title }: { title: string }) {
  return <div style={{ borderTop: "1px solid var(--line,#c9c5d6)", paddingTop: 18, marginTop: 20, marginBottom: 14, fontWeight: 500, color: "var(--brand,#5b3df5)" }}>{title}</div>;
}
function NavRow({ onBack, onNext, canBack, nextLabel = "Continue" }: { onBack: () => void; onNext: () => void; canBack: boolean; nextLabel?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
      <button onClick={onBack} disabled={!canBack} style={{ background: "transparent", border: "none", color: canBack ? "var(--muted,#6b6878)" : "transparent", cursor: canBack ? "pointer" : "default", fontSize: 14, padding: "10px 8px" }}>← Back</button>
      <button onClick={onNext} style={{
        background: "linear-gradient(135deg,var(--brand,#5b3df5),var(--brand-2,#8b6cff))",
        color: "white", border: "none", padding: "12px 28px", borderRadius: 12,
        fontSize: 15, fontWeight: 500, cursor: "pointer", boxShadow: "0 4px 16px rgba(91,61,245,.3)",
      }}>{nextLabel} →</button>
    </div>
  );
}

function LabelScale({ value, onChange, labels, compact }: { value: number | null; onChange: (n: number) => void; labels: string[]; compact?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {labels.map((label, i) => {
        const n = i + 1;
        const selected = value === n;
        return (
          <button key={n} onClick={() => onChange(n)} style={{
            flex: 1, minWidth: 0, minHeight: 46, padding: "8px 12px", borderRadius: 10,
            border: selected ? "2px solid var(--brand,#5b3df5)" : "2px solid var(--line,#c9c5d6)",
            background: selected ? "var(--brand,#5b3df5)" : "var(--card)",
            color: selected ? "white" : "var(--ink,#15131f)",
            fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "center",
          }}>{label}</button>
        );
      })}
    </div>
  );
}

function LabelScaleWithNa({ value, onChange, labels }: { value: number | null; onChange: (n: number) => void; labels: string[] }) {
  const isNa = value === 0;
  return (
    <div>
      <LabelScale value={isNa ? null : value} labels={labels} onChange={onChange} />
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "var(--muted,#6b6878)", cursor: "pointer" }}>
        <input type="checkbox" checked={isNa} onChange={(e) => onChange(e.target.checked ? 0 : (null as unknown as number))} />
        Not applicable (N/A)
      </label>
    </div>
  );
}

function ChoiceCard({ selected, onClick, icon, title, desc }: { selected: boolean; onClick: () => void; icon?: string; title: string; desc?: string }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", gap: 14, alignItems: "flex-start", width: "100%", textAlign: "left",
      padding: 16, borderRadius: 12,
      border: selected ? "2px solid var(--brand,#5b3df5)" : "2px solid var(--line,#c9c5d6)",
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
        border: selected ? "5px solid var(--brand,#5b3df5)" : "1.5px solid var(--line,#c9c5d6)",
        background: "var(--card)",
      }} />
    </button>
  );
}

function MultiChip({ selected, onClick, title }: { selected: boolean; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", gap: 10, alignItems: "center", width: "100%", textAlign: "left",
      padding: 12, borderRadius: 11,
      border: selected ? "2px solid var(--brand,#5b3df5)" : "2px solid var(--line,#c9c5d6)",
      background: selected ? "var(--brand-soft,#efeaff)" : "var(--card)",
      cursor: "pointer", marginBottom: 8, fontSize: 14, color: "var(--ink,#15131f)",
    }}>
      <span style={{
        width: 17, height: 17, borderRadius: 4, flexShrink: 0,
        border: selected ? "2px solid var(--brand,#5b3df5)" : "2px solid var(--line,#c9c5d6)",
        background: selected ? "var(--brand,#5b3df5)" : "var(--card)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11,
      }}>{selected ? "✓" : ""}</span>
      <span>{title}</span>
    </button>
  );
}

function Stars({ value, onChange, na, onNa }: { value: number | null; onChange: (n: number) => void; na: boolean; onNa: (b: boolean) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => { onNa(false); onChange(n); }} style={{
          background: "transparent", border: "none", cursor: "pointer", fontSize: 22, padding: 2,
          color: !na && value !== null && n <= value ? "#f5b400" : "#e4e0ec",
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
      <textarea value={value} rows={rows} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.slice(0, 600))}
        style={{ ...INPUT_STYLE, padding: 12, resize: "vertical" }} />
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

export default function SurveyWizard({ config = defaultConfig, initial, preview, onSubmit, headerSubtitle }: Props) {
  const safeConfig = normalizePulseConfig(config);
  const [step, setStep] = useState(0);
  const [a, setA] = useState<PulseAnswers>(() => ({ ...initialAnswers(), ...(initial as any) }));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { ok: boolean; payload: any; serverError?: string }>(null);

  const isBuyer = a.respondent.role === "buyer" || a.respondent.role === "both";
  const isUser = a.respondent.role === "user" || a.respondent.role === "both";

  const total = STEP_ORDER.length;
  const current = STEP_ORDER[step];
  const progress = ((step + 1) / total) * 100;

  const updateA = (patch: (prev: PulseAnswers) => PulseAnswers) => {
    setA(patch);
    setError(null);
  };

  function validate(k: StepKey): string | null {
    switch (k) {
      case "about":
        if (!a.respondent.company.trim()) return "Add your company / account name.";
        if (!a.respondent.role) return "Pick the role that fits you best.";
        return null;
      case "outcomes": {
        if (a.value.value_for_money == null) return "Pick a point on the value scale.";
        const seo = a.capability_deep_dive.seo;
        if (!seo?.success_metrics?.length) return "Tell us which SEO/GEO outcomes matter most.";
        if (seo.traffic_growth == null) return "Let us know if you're seeing organic growth.";
        if (seo.ai_citation_visibility == null) return "Tell us how visible you are in AI Search answers.";
        if (seo.organic_to_pipeline == null) return "Rate whether organic translates into pipeline.";
        if (a.capability_deep_dive.content?.quality == null) return "Rate the quality of the content we deliver.";
        return null;
      }
      case "experience": {
        const rows: string[] = ["quality", "support", "comms", "speed",
          ...(isUser ? ["ease"] : []),
          ...(isBuyer ? ["partner"] : [])];
        for (const r of rows) {
          const v = a.experience.ratings[r];
          if (v == null) return "Rate every area (or mark N/A).";
        }
        return null;
      }
      case "retention_growth":
        if (!a.retention.renewal_intent) return "Pick how likely you are to renew.";
        if (!a.expansion.interests.length) return "Tick at least one growth option ('Happy as-is' counts).";
        return null;
      case "recommend":
        if (a.nps.score == null) return "Pick how likely you are to recommend us.";
        if (!a.sentiment.mood) return "One tap on how you feel and you're done.";
        return null;
    }
  }

  async function handleNext() {
    const err = validate(current.key);
    if (err) { setError(err); return; }
    if (step < total - 1) { setStep(step + 1); setError(null); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
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

  const c = safeConfig.steps;

  function AboutStep() {
    const s = c.about;
    return (
      <>
        <Pill>{s.pill}</Pill>
        <H1>{s.h1}</H1>
        <Lede>{s.lede}</Lede>
        <FieldLabel required>{s.company_q}</FieldLabel>
        <input type="text" value={a.respondent.company}
          onChange={(e) => updateA((p) => ({ ...p, respondent: { ...p.respondent, company: e.target.value } }))}
          style={{ ...INPUT_STYLE, marginBottom: 22 }} />
        <FieldLabel required>{s.role_q}</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
          {s.options.map((opt) => (
            <ChoiceCard key={opt.value} selected={a.respondent.role === opt.value} icon={opt.icon} title={opt.title} desc={opt.desc}
              onClick={() => updateA((p) => ({ ...p, respondent: { ...p.respondent, role: opt.value as any } }))} />
          ))}
        </div>
      </>
    );
  }

  function OutcomesStep() {
    const s = c.outcomes;
    const seo = a.capability_deep_dive.seo || { success_metrics: [], traffic_growth: null, ai_citation_visibility: null, organic_to_pipeline: null, win_outcome: "" };
    const content = a.capability_deep_dive.content || { quality: null };
    const setSEO = (patch: Partial<typeof seo>) =>
      updateA((p) => ({ ...p, capability_deep_dive: { ...p.capability_deep_dive, seo: { ...seo, ...patch } } }));
    const setContent = (patch: Partial<typeof content>) =>
      updateA((p) => ({ ...p, capability_deep_dive: { ...p.capability_deep_dive, content: { ...content, ...patch } } }));

    return (
      <>
        <Eyebrow>{s.eyebrow}</Eyebrow>
        <H1>{s.h1}</H1>
        <Lede>{s.lede}</Lede>

        <SectionHeader title={s.value.header} />
        <FieldLabel required>{s.value.q}</FieldLabel>
        <LabelScale value={a.value.value_for_money} labels={s.value.labels}
          onChange={(n) => updateA((p) => ({ ...p, value: { value_for_money: n } }))} />

        <SectionHeader title={s.seo.header} />
        <FieldLabel required>{s.seo.success_metrics.q}</FieldLabel>
        {s.seo.success_metrics.options.map((opt) => {
          const on = seo.success_metrics.includes(opt.value);
          return (
            <MultiChip key={opt.value} selected={on} title={opt.label}
              onClick={() => setSEO({ success_metrics: on ? seo.success_metrics.filter((x) => x !== opt.value) : [...seo.success_metrics, opt.value] })} />
          );
        })}

        <div style={{ marginTop: 16 }} />
        <FieldLabel required>{s.seo.traffic_growth.q}</FieldLabel>
        <LabelScaleWithNa value={seo.traffic_growth} labels={s.seo.traffic_growth.labels} onChange={(n) => setSEO({ traffic_growth: n })} />

        <div style={{ background: "var(--brand-soft,#efeaff)", padding: 16, borderRadius: 12, margin: "16px 0" }}>
          <Eyebrow>{s.seo.ai_visibility.eyebrow}</Eyebrow>
          <FieldLabel required>{s.seo.ai_visibility.q}</FieldLabel>
          <LabelScaleWithNa value={seo.ai_citation_visibility} labels={s.seo.ai_visibility.labels} onChange={(n) => setSEO({ ai_citation_visibility: n })} />
        </div>

        <FieldLabel required>{s.seo.organic_to_pipeline.q}</FieldLabel>
        <LabelScaleWithNa value={seo.organic_to_pipeline} labels={s.seo.organic_to_pipeline.labels} onChange={(n) => setSEO({ organic_to_pipeline: n })} />

        <SectionHeader title={s.content.header} />
        <FieldLabel required>{s.content.q}</FieldLabel>
        <LabelScaleWithNa value={content.quality} labels={s.content.labels} onChange={(n) => setContent({ quality: n })} />

        <div style={{ marginTop: 24 }}>
          <FieldLabel>{s.seo.win_outcome.q}</FieldLabel>
          <FieldHint>{s.seo.win_outcome.hint}</FieldHint>
          <Textarea600 value={seo.win_outcome} onChange={(v) => setSEO({ win_outcome: v })} />
        </div>
      </>
    );
  }

  function ExperienceStep() {
    const s = c.experience;
    const rows: { key: string; label: string; hint: string }[] = [
      { key: "quality", ...s.rows.quality },
      { key: "support", ...s.rows.support },
      { key: "comms", ...s.rows.comms },
      { key: "speed", ...s.rows.speed },
      ...(isUser ? [{ key: "ease", ...s.rows.ease }] : []),
      ...(isBuyer ? [{ key: "partner", ...s.rows.partner }] : []),
    ];
    const ratings = a.experience.ratings;
    const rated = Object.entries(ratings).filter(([, v]) => typeof v === "number" && v > 0);
    const low = rated.some(([, v]) => (v as number) <= 3);
    const any = rated.length > 0;
    return (
      <>
        <Eyebrow>{s.eyebrow}</Eyebrow>
        <H1>{s.h1}</H1>
        <Lede>{s.lede}</Lede>
        <div style={{ border: "1px solid var(--line,#c9c5d6)", borderRadius: 12, overflow: "hidden" }}>
          {rows.map((r, i) => {
            const v = ratings[r.key] ?? null;
            const na = ratings[r.key] === 0;
            return (
              <div key={r.key} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                padding: "13px 15px",
                borderTop: i === 0 ? "none" : "1px solid var(--line,#c9c5d6)",
              }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink,#15131f)" }}>
                  {r.label}
                  <div style={{ fontSize: 12, fontWeight: 400, color: "var(--muted,#6b6878)" }}>{r.hint}</div>
                </div>
                <Stars value={v} na={na}
                  onChange={(n) => updateA((p) => ({ ...p, experience: { ...p.experience, ratings: { ...p.experience.ratings, [r.key]: n } } }))}
                  onNa={(b) => updateA((p) => ({ ...p, experience: { ...p.experience, ratings: { ...p.experience.ratings, [r.key]: b ? 0 : null } } }))} />
              </div>
            );
          })}
        </div>
        <Reveal when={any}>
          <FieldLabel>{low ? s.followup_low : s.followup_ok}</FieldLabel>
          <Textarea600 value={a.experience.comment} onChange={(v) => updateA((p) => ({ ...p, experience: { ...p.experience, comment: v } }))} />
        </Reveal>
      </>
    );
  }

  function RetentionGrowthStep() {
    const s = c.retention_growth;
    const atRisk = ["unsure", "risk", "gone"].includes(a.retention.renewal_intent);
    return (
      <>
        <Eyebrow>{s.eyebrow}</Eyebrow>
        <H1>{s.h1}</H1>
        <FieldLabel required>{s.renewal_q}</FieldLabel>
        {s.renewal_options.map((opt) => (
          <ChoiceCard key={opt.value} selected={a.retention.renewal_intent === opt.value} title={opt.label}
            onClick={() => updateA((p) => ({ ...p, retention: { ...p.retention, renewal_intent: opt.value as any } }))} />
        ))}
        <Reveal when={atRisk}>
          <FieldLabel>{s.save_q}</FieldLabel>
          <Textarea600 value={a.retention.save_lever} onChange={(v) => updateA((p) => ({ ...p, retention: { ...p.retention, save_lever: v } }))} />
        </Reveal>
        <div style={{ marginTop: 26 }}>
          <FieldLabel required>{s.expansion_q}</FieldLabel>
          {s.expansion_options.map((opt) => {
            const on = a.expansion.interests.includes(opt.value);
            return (
              <MultiChip key={opt.value} selected={on} title={opt.label}
                onClick={() => updateA((p) => {
                  const cur = p.expansion.interests;
                  let next: string[];
                  if (opt.value === "none") next = on ? [] : ["none"];
                  else {
                    const set = new Set(cur.filter((x) => x !== "none"));
                    if (set.has(opt.value)) set.delete(opt.value); else set.add(opt.value);
                    next = Array.from(set);
                  }
                  return { ...p, expansion: { interests: next } };
                })} />
            );
          })}
        </div>
      </>
    );
  }

  function RecommendStep() {
    const s = c.recommend;
    const score = a.nps.score;
    const bucket: "low" | "mid" | "high" | null = score == null ? null : score <= 6 ? "low" : score <= 8 ? "mid" : "high";
    return (
      <>
        <Eyebrow>{s.eyebrow}</Eyebrow>
        <H1>{s.h1}</H1>
        <Lede>{s.lede}</Lede>
        {s.options.map((opt) => (
          <ChoiceCard key={opt.score} selected={score === opt.score} title={opt.title} desc={opt.desc}
            onClick={() => updateA((p) => ({ ...p, nps: { ...p.nps, score: opt.score } }))} />
        ))}
        <Reveal when={bucket !== null}>
          <FieldLabel>{bucket ? s.followups[bucket] : ""}</FieldLabel>
          <Textarea600 value={a.nps.verbatim} onChange={(v) => updateA((p) => ({ ...p, nps: { ...p.nps, verbatim: v } }))} />
        </Reveal>
        <div style={{ marginTop: 26 }}>
          <FieldLabel required>{s.mood_q}</FieldLabel>
          {s.moods.map((m) => (
            <ChoiceCard key={m.value} selected={a.sentiment.mood === m.value} icon={m.icon} title={m.label}
              onClick={() => updateA((p) => ({ ...p, sentiment: { mood: m.value as any } }))} />
          ))}
        </div>
      </>
    );
  }

  const renderStep = () => {
    switch (current.key) {
      case "about": return AboutStep();
      case "outcomes": return OutcomesStep();
      case "experience": return ExperienceStep();
      case "retention_growth": return RetentionGrowthStep();
      case "recommend": return RecommendStep();
    }
  };

  if (done) {
    return (
      <PulseFrame headerSubtitle={headerSubtitle} progress={100}>
        <div style={CARD_STYLE}>
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <H1>Thank you, truly. Your response has been recorded</H1>
          </div>
          {done.serverError && (
            <div style={{ background: "var(--brand-soft)", border: "1px solid var(--line)", padding: 12, borderRadius: 10, fontSize: 13, color: "var(--bad,#d8413c)", marginBottom: 12 }}>
              Couldn't save online ({done.serverError}).
            </div>
          )}
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
        <NavRow canBack={step > 0} onBack={() => { setStep(Math.max(0, step - 1)); setError(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
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

function PulseFrame({ children, progress, headerSubtitle }: { children: React.ReactNode; progress: number; headerSubtitle?: string }) {
  const vars: Record<string, string> = {
    "--ink": "#15131f", "--muted": "#6b6878", "--line": "#c9c5d6",
    "--bg": "#faf9fc", "--card": "#fff", "--field": "#fff",
    "--brand": "#5b3df5", "--brand-2": "#8b6cff", "--brand-soft": "#efeaff",
    "--placeholder": "#a19caf", "--shadow-pulse": "0 10px 40px rgba(38,28,80,.10)",
    "--good": "#1d9d6c", "--warn": "#e0922f", "--bad": "#d8413c",
  };
  return (
    <div style={{
      ...vars, minHeight: "100vh",
      background: "linear-gradient(180deg,#f4f1fc 0%,#faf9fc 280px)",
      color: "var(--ink)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: "32px 16px 64px",
    } as React.CSSProperties}>
      <style>{`
        @keyframes pulseRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .pepper-pulse-shell input, .pepper-pulse-shell textarea {
          background: var(--field) !important; color: var(--ink) !important; border-color: var(--line) !important;
        }
        .pepper-pulse-shell input::placeholder, .pepper-pulse-shell textarea::placeholder { color: var(--placeholder); opacity: 1; }
        .pepper-pulse-shell input:focus, .pepper-pulse-shell textarea:focus { border-color: var(--brand) !important; }
      `}</style>
      <div className="pepper-pulse-shell" style={{ maxWidth: 960, margin: "0 auto" }}>
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
        <div style={{ height: 4, background: "var(--line,#c9c5d6)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#5b3df5,#8b6cff)", transition: "width .3s ease" }} />
        </div>
        {children}
      </div>
    </div>
  );
}