import { forwardRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { npsCategory } from "@/lib/pulseSurvey";

// ---- Small UI primitives (kept local to avoid coupling to SurveyResponseView) ----
function Section({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      {eyebrow && <div className="text-[10px] font-medium tracking-[0.12em] uppercase text-primary mb-1.5">{eyebrow}</div>}
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
const QA = forwardRef<HTMLDivElement, { q: string; children: React.ReactNode }>(({ q, children }, ref) => {
  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-2 md:gap-4 text-xs">
      <div className="text-muted-foreground">{q}</div>
      <div className="text-foreground font-medium break-words">{children}</div>
    </div>
  );
});
QA.displayName = "QA";
function Empty() { return <span className="text-muted-foreground italic font-normal">—</span>; }
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
  return <blockquote className="mt-1 text-xs italic text-foreground border-l-2 border-primary/40 pl-3 py-1">"{text}"</blockquote>;
}
function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground text-xs">N/A</span>;
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="text-amber-500">{"★".repeat(value)}</span>
      <span className="text-muted-foreground">{"★".repeat(Math.max(0, 5 - value))}</span>
      <span className="text-muted-foreground tabular-nums ml-1">{value}/5</span>
    </span>
  );
}

// ---- Helpers ----
export function firstVal(v: unknown): unknown { return Array.isArray(v) ? v[0] : v; }
export function toText(v: unknown): string {
  const f = firstVal(v);
  return f == null ? "" : String(f).trim();
}
export function toArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
}
export function toNum(v: unknown, min: number, max: number): number | null {
  const raw = toText(v);
  if (!raw || /^n\/?a$/i.test(raw)) return null;
  const n = typeof v === "number" ? v : Number(raw.match(/-?\d+(?:\.\d+)?/)?.[0] ?? NaN);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < min || r > max) return null;
  return r;
}

// Find a key in answers by trying exact match, then case-insensitive contains-all-of tokens.
export function findKey(answers: Record<string, unknown>, needles: string[]): string | null {
  const keys = Object.keys(answers || {});
  for (const n of needles) if (n in answers) return n;
  const lowerKeys = keys.map((k) => [k, k.toLowerCase()] as const);
  for (const n of needles) {
    const nl = n.toLowerCase();
    const hit = lowerKeys.find(([, lk]) => lk === nl);
    if (hit) return hit[0];
  }
  for (const n of needles) {
    const tokens = n.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3);
    if (!tokens.length) continue;
    const hit = lowerKeys.find(([, lk]) => tokens.every((t) => lk.includes(t)));
    if (hit) return hit[0];
  }
  return null;
}
export function pick(answers: Record<string, unknown>, needles: string[]): unknown {
  const k = findKey(answers, needles);
  return k ? answers[k] : null;
}

// Experience grid rows to extract from the "How are we doing on each of these?" block.
export const EXPERIENCE_ROWS: { key: string; label: string; tokens: string[] }[] = [
  { key: "quality", label: "Quality of the creative output", tokens: ["quality", "creative", "output"] },
  { key: "briefing", label: "Briefing & kickoff process", tokens: ["briefing", "kickoff"] },
  { key: "revisions", label: "Revisions & feedback handling", tokens: ["revision", "feedback"] },
  { key: "turnaround", label: "Turnaround & delivery", tokens: ["turnaround", "delivery"] },
  { key: "communication", label: "Communication & updates", tokens: ["communication", "updates"] },
  { key: "collaboration", label: "Ease of day-to-day collaboration", tokens: ["collaboration", "day"] },
  { key: "strategic", label: "Feeling like a strategic partner", tokens: ["strategic", "partner"] },
];

const EXPERIENCE_GRID_QUESTIONS = [
  "How are we doing on each of these?",
  "How are we doing on each of these",
  "Rate how we're doing where it counts. Mark N/A for anything that doesn't apply to you.",
  "Rate how we’re doing where it counts. Mark N/A for anything that doesn’t apply to you.",
];

function emptyExperienceRatings(): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  EXPERIENCE_ROWS.forEach((row) => { out[row.key] = null; });
  return out;
}

function mapExperienceObject(obj: Record<string, unknown>): Record<string, number | null> {
  const out = emptyExperienceRatings();
  for (const row of EXPERIENCE_ROWS) {
    const labelMatch = obj[row.label];
    if (labelMatch !== undefined) {
      out[row.key] = toNum(labelMatch, 1, 5);
      continue;
    }
    const k = Object.keys(obj).find((kk) => {
      const lk = kk.toLowerCase();
      return row.tokens.every((t) => lk.includes(t));
    });
    out[row.key] = k ? toNum(obj[k], 1, 5) : null;
  }
  return out;
}

function parseExperienceBundle(v: unknown): Record<string, number | null> | null {
  let cur = v;
  while (Array.isArray(cur) && cur.length === 1 && Array.isArray(cur[0])) {
    cur = cur[0];
  }

  if (Array.isArray(cur)) {
    const out = emptyExperienceRatings();
    EXPERIENCE_ROWS.forEach((row, index) => {
      out[row.key] = toNum(cur[index], 1, 5);
    });
    return out;
  }

  if (cur && typeof cur === "object") {
    const obj = cur as Record<string, unknown>;
    const numericKeys = EXPERIENCE_ROWS.every((_, index) => String(index) in obj);
    if (numericKeys) {
      const out = emptyExperienceRatings();
      EXPERIENCE_ROWS.forEach((row, index) => {
        out[row.key] = toNum(obj[String(index)], 1, 5);
      });
      return out;
    }
    return mapExperienceObject(obj);
  }

  if (typeof cur === "string") {
    const raw = cur.trim();
    if (!raw) return emptyExperienceRatings();

    if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        const parsed = JSON.parse(raw);
        const parsedBundle = parseExperienceBundle(parsed);
        if (parsedBundle) return parsedBundle;
      } catch (_) {
        // Fall back to delimiter parsing below.
      }
    }

    const slots = /[,;\n|]/.test(raw)
      ? raw.split(/[,;\n|]+/).map((s) => s.trim())
      : [raw];
    const out = emptyExperienceRatings();
    EXPERIENCE_ROWS.forEach((row, index) => {
      out[row.key] = toNum(slots[index], 1, 5);
    });
    return out;
  }

  return null;
}

function hasAnyExperienceValue(ratings: Record<string, number | null>): boolean {
  return Object.values(ratings).some((value) => typeof value === "number");
}

export function extractExperienceRatings(answers: Record<string, unknown>, payload?: any): Record<string, number | null> {
  const storedDimensions = payload?.csat_dimensions ?? payload?.raw?.csat_dimensions;
  const stored = parseExperienceBundle(storedDimensions);
  if (stored && hasAnyExperienceValue(stored)) return stored;

  // Case A: nested object under a single key.
  const bundleKey = findKey(answers, EXPERIENCE_GRID_QUESTIONS);
  const bundle = bundleKey ? answers[bundleKey] : null;
  const parsedBundle = parseExperienceBundle(bundle);
  if (parsedBundle && hasAnyExperienceValue(parsedBundle)) return parsedBundle;

  // Case B: separate keys like "How are we doing... [Quality of the creative output — ...]"
  const keys = Object.keys(answers || {});
  const out = emptyExperienceRatings();
  for (const row of EXPERIENCE_ROWS) {
    const hit = keys.find((k) => {
      const lk = k.toLowerCase();
      return lk.includes("how are we doing") && row.tokens.every((t) => lk.includes(t));
    }) || keys.find((k) => {
      const lk = k.toLowerCase();
      return row.tokens.every((t) => lk.includes(t));
    });
    out[row.key] = hit ? toNum(answers[hit], 1, 5) : null;
  }
  return out;
}

// Keys we render explicitly — used to compute "unmapped" leftovers.
const HANDLED_TOKEN_GROUPS: string[][] = [
  ["which company"], ["which best describes your role"], ["email"],
  ["creative success look like"], ["measurably moving"], ["unmistakably on-brand"], ["craft of the creative"], ["single creative outcome"],
  ["how are we doing on each"], ["got really right"],
  ["renewal", "today"], ["change your mind"], ["retainer do more"],
  ["recommend pepper"], ["main reason"], ["holding you back"], ["value most"], ["how do you feel about working"],
];
function isHandled(key: string): boolean {
  const lk = key.toLowerCase();
  return HANDLED_TOKEN_GROUPS.some((tokens) => tokens.every((t) => lk.includes(t)));
}

export function GoogleFormResponseView({
  payload,
  nps: npsFallback,
  csat: csatFallback,
}: {
  payload: any;
  nps?: number | null;
  csat?: number | null;
}) {
  const [showRaw, setShowRaw] = useState(false);

  if (!payload || typeof payload !== "object") {
    return <div className="text-sm text-muted-foreground">No response payload captured.</div>;
  }

  const answers: Record<string, unknown> =
    (payload.answers && typeof payload.answers === "object" ? payload.answers : null) ||
    (payload.raw?.answers && typeof payload.raw.answers === "object" ? payload.raw.answers : null) ||
    {};

  const company = toText(pick(answers, ["Which company are you with?"]));
  const role = toText(pick(answers, ["Which best describes your role on this retainer?"]));
  const email = toText(pick(answers, ["Email"]));

  const successMetrics = toArray(pick(answers, ["What does creative success look like for you?"]));
  const measurable = toText(pick(answers, ["Is the creative work measurably moving your marketing metrics?"]));
  const onBrand = toText(pick(answers, ["how consistently does the work feel unmistakably on-brand"]));
  const craft = toText(pick(answers, ["How would you rate the craft of the creative work we deliver?"]));
  const singleWin = toText(pick(answers, ["The single creative outcome that would make this retainer an undeniable win?"]));

  const expRatings = extractExperienceRatings(answers, payload);
  const expComment = toText(pick(answers, ["Anything specific we got really right, or could do better?"]));

  const renewal = toText(pick(answers, ["If the retainer renewal were today, how likely are you to continue with Pepper?"]));
  const changeMind = toText(pick(answers, ["What's the one thing that would change your mind?", "What\u2019s the one thing that would change your mind?"]));
  const growth = toText(pick(answers, ["Where could this retainer do more for you?"]));

  const npsRaw = pick(answers, ["How likely are you to recommend Pepper?"]);
  const npsScore = toNum(npsRaw, 0, 10) ?? (npsFallback ?? null);
  const npsCat = npsCategory(npsScore);

  const mainReason = toText(pick(answers, ["What is the main reason, and what would need to change?"]));
  const holdingBack = toText(pick(answers, ["What is holding you back from a wholehearted yes?"]));
  const valueMost = toText(pick(answers, ["Thank you. What do you value most, and may we quote you on it?"]));
  const overallFeel = toText(pick(answers, ["Overall, how do you feel about working with Pepper?"]));

  const expAvg = (() => {
    const vals = Object.values(expRatings).filter((v): v is number => typeof v === "number");
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  })();
  const csatAvg = expAvg ?? (csatFallback ?? null);

  const npsTone = npsScore == null ? "muted" : npsScore >= 9 ? "good" : npsScore >= 7 ? "warn" : "bad";

  const unmapped = Object.entries(answers).filter(([k]) => !isHandled(k));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] font-medium tracking-[0.12em] uppercase text-primary mb-1">Pepper · Creative Pulse (Google Form)</div>
            <h2 className="text-base font-semibold text-foreground">
              {company || "Anonymous respondent"}
              {role ? <span className="text-muted-foreground font-normal"> · {role}</span> : null}
            </h2>
            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
              {email && <span>{email}</span>}
              {payload.submitted_at && <span>{new Date(payload.submitted_at).toLocaleString()}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Pill tone={npsTone as any}>NPS {npsScore ?? "—"}{npsCat ? ` · ${npsCat}` : ""}</Pill>
            <Pill tone="brand">Experience {csatAvg != null ? csatAvg.toFixed(1) : "—"}/5</Pill>
          </div>
        </div>
      </div>

      <Section eyebrow="Section 2" title="Outcomes">
        <QA q="What does creative success look like for you?">
          {successMetrics.length ? (
            <div className="flex flex-wrap gap-1">{successMetrics.map((m) => <Pill key={m}>{m}</Pill>)}</div>
          ) : <Empty />}
        </QA>
        <QA q="Is the creative work measurably moving your marketing metrics?">
          {measurable ? <span>{measurable}</span> : <Empty />}
        </QA>
        <QA q="How consistently does the work feel unmistakably on-brand?">
          {onBrand ? <span>{onBrand}</span> : <Empty />}
        </QA>
        <QA q="How would you rate the craft of the creative work we deliver?">
          {craft ? <span>{craft}</span> : <Empty />}
        </QA>
        <QA q="The single creative outcome that would make this retainer an undeniable win?">
          {singleWin ? <Quote text={singleWin} /> : <Empty />}
        </QA>
      </Section>

      <Section eyebrow="Section 3" title="Your experience">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {EXPERIENCE_ROWS.map((row) => (
            <div key={row.key} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs">
              <span className="text-muted-foreground">{row.label}</span>
              <Stars value={expRatings[row.key] ?? null} />
            </div>
          ))}
        </div>
        {expComment && <Quote text={expComment} />}
      </Section>

      <Section eyebrow="Section 4" title="Looking ahead">
        <QA q="If the retainer renewal were today, how likely are you to continue with Pepper?">
          {renewal ? <Pill tone="brand">{renewal}</Pill> : <Empty />}
        </QA>
        {changeMind && (
          <QA q="What's the one thing that would change your mind?">
            <Quote text={changeMind} />
          </QA>
        )}
      </Section>

      <Section eyebrow="Section 6" title="Growth">
        <QA q="Where could this retainer do more for you?">
          {growth ? <span>{growth}</span> : <Empty />}
        </QA>
      </Section>

      <Section eyebrow="Section 7" title="Recommendation">
        <QA q="How likely are you to recommend Pepper? (0–10)">
          {npsScore == null ? <Empty /> : (
            <span className="inline-flex items-center gap-2">
              <span className="tabular-nums text-base">{npsScore}</span>
              {npsCat && <Pill tone={npsTone as any}>{npsCat}</Pill>}
            </span>
          )}
        </QA>
        {mainReason && <QA q="Main reason, and what would need to change?"><Quote text={mainReason} /></QA>}
        {holdingBack && <QA q="What is holding you back from a wholehearted yes?"><Quote text={holdingBack} /></QA>}
        {valueMost && <QA q="What do you value most (and may we quote you on it)?"><Quote text={valueMost} /></QA>}
      </Section>

      <Section eyebrow="Section 11" title="Overall feeling">
        <QA q="Overall, how do you feel about working with Pepper?">
          {overallFeel ? <span>{overallFeel}</span> : <Empty />}
        </QA>
      </Section>

      {unmapped.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowRaw((s) => !s)}
          >
            {showRaw ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Other answers ({unmapped.length})
          </button>
          {showRaw && (
            <div className="px-4 pb-4 space-y-2">
              {unmapped.map(([k, v]) => (
                <div key={k} className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-1 md:gap-4 text-xs">
                  <div className="text-muted-foreground">{k}</div>
                  <div className="text-foreground font-medium break-words whitespace-pre-wrap">
                    {Array.isArray(v) ? v.join(", ") : (v == null || v === "" ? <Empty /> : String(v))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}