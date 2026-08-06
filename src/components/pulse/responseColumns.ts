// Column registry for the Pulse/NPS analytics "Responses" table.
// Every survey question is exposed as an optional column; the Column Picker
// groups them so users can toggle whole sections on/off.
import {
  pick, toText, toArray, toNum, extractExperienceRatings, EXPERIENCE_ROWS,
} from "./GoogleFormResponseView";
import { npsCategory, RENEWAL_LABELS, EXPANSION_LABELS, MOOD_LABELS } from "@/lib/pulseSurvey";

export type ColGroup =
  | "core" | "scores" | "outcomes" | "experience" | "ahead" | "growth" | "recommend" | "overall";

export const GROUP_LABELS: Record<ColGroup, string> = {
  core: "Core",
  scores: "Scores",
  outcomes: "Outcomes",
  experience: "Experience (ratings)",
  ahead: "Looking ahead",
  growth: "Growth",
  recommend: "Recommendation",
  overall: "Overall",
};

export const GROUP_ORDER: ColGroup[] = [
  "core", "scores", "outcomes", "experience", "ahead", "growth", "recommend", "overall",
];

export type AnyRow = Record<string, any>;

export type QuestionColumn = {
  id: string;
  group: ColGroup;
  label: string;
  align?: "left" | "right";
  /** Raw value used for sorting + CSV. */
  accessor: (row: AnyRow) => string | number | null;
};

function answersOf(row: AnyRow): Record<string, unknown> {
  const p = row?.payload;
  if (!p || typeof p !== "object") return {};
  return (
    (p.answers && typeof p.answers === "object" ? p.answers : null) ||
    (p.raw?.answers && typeof p.raw.answers === "object" ? p.raw.answers : null) ||
    {}
  );
}

const gf = (row: AnyRow, needles: string[]) => toText(pick(answersOf(row), needles));
const gfList = (row: AnyRow, needles: string[]) => toArray(pick(answersOf(row), needles)).join(", ");
const nat = (row: AnyRow) => (row?.payload && typeof row.payload === "object" ? row.payload : {}) as any;

const or = (...vals: (string | number | null | undefined)[]) => {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

// Native (in-app wizard) experience keys mapped onto the Google Form dimension keys.
const NATIVE_EXP_KEY: Record<string, string> = {
  quality: "quality",
  communication: "comms",
  turnaround: "speed",
  collaboration: "ease",
  strategic: "partner",
};

export const QUESTION_COLUMNS: QuestionColumn[] = [
  // --- Outcomes ---
  {
    id: "q_success_metrics", group: "outcomes", label: "What does success look like",
    accessor: (r) => or(gfList(r, ["What does creative success look like for you?", "creative success look like"]),
      (nat(r).capability_deep_dive?.seo?.success_metrics || []).join(", ")),
  },
  {
    id: "q_measurable", group: "outcomes", label: "Measurably moving metrics",
    accessor: (r) => or(gf(r, ["measurably moving"]), nat(r).capability_deep_dive?.seo?.traffic_growth ?? null),
  },
  {
    id: "q_on_brand", group: "outcomes", label: "On-brand / AI visibility",
    accessor: (r) => or(gf(r, ["unmistakably on-brand"]), nat(r).capability_deep_dive?.seo?.ai_citation_visibility ?? null),
  },
  {
    id: "q_pipeline", group: "outcomes", label: "Organic to pipeline",
    accessor: (r) => nat(r).capability_deep_dive?.seo?.organic_to_pipeline ?? null,
  },
  {
    id: "q_craft", group: "outcomes", label: "Craft / content quality",
    accessor: (r) => or(gf(r, ["craft of the creative"]), nat(r).capability_deep_dive?.content?.quality ?? null),
  },
  {
    id: "q_value_money", group: "outcomes", label: "Value for money",
    accessor: (r) => nat(r).value?.value_for_money ?? null,
  },
  {
    id: "q_single_win", group: "outcomes", label: "Single winning outcome",
    accessor: (r) => or(gf(r, ["single creative outcome"]), nat(r).capability_deep_dive?.seo?.win_outcome),
  },

  // --- Experience ratings ---
  ...EXPERIENCE_ROWS.map((row) => ({
    id: `q_exp_${row.key}`,
    group: "experience" as ColGroup,
    label: row.label,
    align: "right" as const,
    accessor: (r: AnyRow) => {
      const gfVal = extractExperienceRatings(answersOf(r), nat(r))[row.key] ?? null;
      if (typeof gfVal === "number") return gfVal;
      const nk = NATIVE_EXP_KEY[row.key];
      const nv = nk ? nat(r).experience?.ratings?.[nk] : null;
      return typeof nv === "number" ? nv : null;
    },
  })),
  {
    id: "q_exp_support", group: "experience", label: "Support & responsiveness", align: "right",
    accessor: (r) => {
      const v = nat(r).experience?.ratings?.support;
      return typeof v === "number" ? v : null;
    },
  },
  {
    id: "q_exp_comment", group: "experience", label: "Experience comment",
    accessor: (r) => or(gf(r, ["got really right"]), nat(r).experience?.comment),
  },

  // --- Looking ahead ---
  {
    id: "q_renewal", group: "ahead", label: "Renewal intent",
    accessor: (r) => or(gf(r, ["renewal", "today"]), RENEWAL_LABELS[nat(r).retention?.renewal_intent] || null),
  },
  {
    id: "q_change_mind", group: "ahead", label: "What would change your mind",
    accessor: (r) => or(gf(r, ["change your mind"]), nat(r).retention?.save_lever),
  },

  // --- Growth ---
  {
    id: "q_growth", group: "growth", label: "Where we could do more",
    accessor: (r) => or(
      gf(r, ["retainer do more", "do more for you"]),
      (nat(r).expansion?.interests || []).map((i: string) => EXPANSION_LABELS[i] || i).join(", "),
    ),
  },

  // --- Recommendation ---
  {
    id: "q_nps_verbatim", group: "recommend", label: "NPS comment",
    accessor: (r) => nat(r).nps?.verbatim || null,
  },
  {
    id: "q_main_reason", group: "recommend", label: "Main reason / what must change",
    accessor: (r) => gf(r, ["main reason"]) || null,
  },
  {
    id: "q_holding_back", group: "recommend", label: "What's holding you back",
    accessor: (r) => gf(r, ["holding you back"]) || null,
  },
  {
    id: "q_value_most", group: "recommend", label: "What you value most",
    accessor: (r) => gf(r, ["value most"]) || null,
  },

  // --- Overall ---
  {
    id: "q_mood", group: "overall", label: "Overall feeling",
    accessor: (r) => or(
      gf(r, ["how do you feel about working"]),
      MOOD_LABELS[nat(r).sentiment?.mood]?.label || null,
    ),
  },
  {
    id: "q_churn_risk", group: "overall", label: "Churn risk",
    accessor: (r) => nat(r).flags?.churn_risk || null,
  },
];

/** Core / score columns rendered by the table itself (toggleable, not payload-derived). */
export const BASE_COLUMNS: { id: string; group: ColGroup; label: string }[] = [
  { id: "deal", group: "core", label: "Deal" },
  { id: "recipient", group: "core", label: "Recipient" },
  { id: "status", group: "core", label: "Status" },
  { id: "sent", group: "core", label: "Sent" },
  { id: "opened", group: "core", label: "Opened" },
  { id: "completed", group: "core", label: "Completed" },
  { id: "respondent", group: "core", label: "Respondent" },
  { id: "campaign", group: "core", label: "Campaign" },
  { id: "source", group: "core", label: "Source" },
  { id: "nps", group: "scores", label: "NPS" },
  { id: "nps_category", group: "scores", label: "NPS category" },
  { id: "csat", group: "scores", label: "CSAT avg" },
];

export const DEFAULT_VISIBLE: string[] = [
  "deal", "recipient", "status", "sent", "opened", "completed",
  "respondent", "campaign", "source", "nps", "csat",
];

export const ALL_COLUMN_IDS: string[] = [
  ...BASE_COLUMNS.map((c) => c.id),
  ...QUESTION_COLUMNS.map((c) => c.id),
];

export const COLUMNS_BY_GROUP: Record<ColGroup, { id: string; label: string }[]> = GROUP_ORDER.reduce(
  (acc, g) => {
    acc[g] = [
      ...BASE_COLUMNS.filter((c) => c.group === g).map((c) => ({ id: c.id, label: c.label })),
      ...QUESTION_COLUMNS.filter((c) => c.group === g).map((c) => ({ id: c.id, label: c.label })),
    ];
    return acc;
  },
  {} as Record<ColGroup, { id: string; label: string }[]>,
);

export const QUESTION_COLUMN_MAP = new Map(QUESTION_COLUMNS.map((c) => [c.id, c]));

export function npsCategoryOf(v: number | null | undefined): string {
  return npsCategory(typeof v === "number" ? v : null) || "";
}

export const COLUMNS_STORAGE_KEY = "pulse-analytics-columns-v1";

export function loadVisibleColumns(): Set<string> {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_VISIBLE);
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return new Set(arr.filter((id: string) => ALL_COLUMN_IDS.includes(id)));
  } catch (_) { /* ignore */ }
  return new Set(DEFAULT_VISIBLE);
}

export function saveVisibleColumns(v: Set<string>) {
  try { localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(Array.from(v))); } catch (_) { /* ignore */ }
}
