// Pepper Customer Pulse — shared types, defaults, scoring.
// Rewritten to match the new 5-step "Customer Pulse" form.

export type Role = "buyer" | "user" | "both";
export type Capability = "content" | "seo";
export type Renewal = "def" | "prob" | "unsure" | "risk" | "gone";
export type Mood = "love" | "glad" | "neutral" | "frustrated" | "done";

export interface PulseAnswers {
  respondent: {
    role: Role | "";
    name: string;
    email: string;
    company: string;
    capabilities: Capability[];
  };
  nps: { score: number | null; verbatim: string };
  value: { value_for_money: number | null };
  capability_deep_dive: {
    content?: { quality: number | null };
    seo?: {
      success_metrics: string[];
      traffic_growth: number | null;
      ai_citation_visibility: number | null;
      organic_to_pipeline: number | null;
      win_outcome: string;
    };
  };
  experience: { ratings: Record<string, number | null>; comment: string };
  retention: { renewal_intent: Renewal | ""; save_lever: string };
  expansion: { interests: string[] };
  sentiment: { mood: Mood | "" };
}

export const initialAnswers = (): PulseAnswers => ({
  respondent: { role: "", name: "", email: "", company: "", capabilities: ["seo", "content"] },
  nps: { score: null, verbatim: "" },
  value: { value_for_money: null },
  capability_deep_dive: { content: { quality: null }, seo: { success_metrics: [], traffic_growth: null, ai_citation_visibility: null, organic_to_pipeline: null, win_outcome: "" } },
  experience: { ratings: {}, comment: "" },
  retention: { renewal_intent: "", save_lever: "" },
  expansion: { interests: [] },
  sentiment: { mood: "" },
});

export const defaultConfig = {
  steps: {
    about: {
      eyebrow: "",
      pill: "We actually read every response",
      h1: "Tell us how it's really going.",
      lede: "A few honest minutes shapes what we build, fix, and prioritise next. No fluff, just the real picture.",
      company_q: "Which company / account are you with?",
      role_q: "Which best describes your role with Pepper?",
      options: [
        { value: "buyer", icon: "🧭", title: "Decision-maker / sponsor", desc: "I own the budget, contract or the call to renew" },
        { value: "user", icon: "⚙️", title: "Day-to-day user", desc: "I work hands-on with Pepper or the deliverables" },
        { value: "both", icon: "🎯", title: "A bit of both", desc: "I use it and I influence the renewal" },
      ],
    },
    outcomes: {
      eyebrow: "Where it really matters",
      h1: "Let's get specific about outcomes.",
      lede: "The real signal lives here.",
      value: {
        header: "💰 Value for money",
        q: "How much value are you getting, relative to what you pay?",
        labels: ["Far less", "Less", "Fair", "More", "Far more"],
      },
      seo: {
        header: "🔍 Pepper SEO / GEO outcomes",
        success_metrics: {
          q: "What does SEO/GEO success look like for you? (pick what matters)",
          options: [
            { value: "traffic", label: "Organic traffic growth" },
            { value: "pipeline", label: "Leads / pipeline from organic" },
            { value: "geo", label: "AI Search visibility (ChatGPT, Perplexity, AI Overviews)" },
            { value: "rankings", label: "Keyword rankings" },
            { value: "sov", label: "Share of voice vs competitors" },
          ],
        },
        traffic_growth: {
          q: "Are you seeing measurable organic growth with us?",
          labels: ["Declining", "Flat", "Slight lift", "Solid growth", "Strong, compounding"],
        },
        ai_visibility: {
          q: "When buyers ask AI tools (ChatGPT, Perplexity, AI Overviews) about your space, how often does your brand show up?",
          labels: ["Never", "Rarely", "Sometimes", "Often", "Consistently cited"],
          eyebrow: "GEO · AI Search",
        },
        organic_to_pipeline: {
          q: "Is organic translating into pipeline / revenue, not just traffic?",
          labels: ["Not at all", "A little", "Somewhat", "Clearly", "It's a primary channel"],
        },
        win_outcome: { q: "The single SEO/GEO outcome that would make this an undeniable win?", hint: "e.g. \"cited by ChatGPT for our buying queries\", \"30% of pipeline from organic\"" },
      },
      content: {
        header: "📝 Content quality",
        q: "How would you rate the quality of the content we deliver?",
        labels: ["Poor", "Below par", "Solid", "Strong", "Excellent"],
      },
    },
    experience: {
      eyebrow: "Your experience",
      h1: "Rate how we're doing where it counts.",
      lede: "Tap the stars. Skip anything that doesn't apply.",
      rows: {
        quality: { label: "Quality of the work / deliverables", hint: "Does the output meet your bar?" },
        support: { label: "Support & responsiveness", hint: "How we show up when you need us" },
        comms: { label: "Communication & updates", hint: "Do you always know where things stand?" },
        speed: { label: "Speed & turnaround", hint: "Do things move at the pace you need?" },
        ease: { label: "Ease of working with the platform/team", hint: "How smooth is the day-to-day?" },
        partner: { label: "Feeling like a strategic partner", hint: "Are we proactive, not just reactive?" },
      },
      followup_low: "You rated something a little lower. What happened there?",
      followup_ok: "Anything specific we got really right, or could do better?",
    },
    retention_growth: {
      eyebrow: "Looking ahead",
      h1: "Staying, growing, spreading the word.",
      renewal_q: "If renewal were today, how likely are you to continue with Pepper?",
      renewal_options: [
        { value: "def", label: "Definitely staying" },
        { value: "prob", label: "Probably staying" },
        { value: "unsure", label: "On the fence" },
        { value: "risk", label: "Leaning towards leaving" },
        { value: "gone", label: "Likely leaving" },
      ],
      save_q: "What's the one thing that would change your mind?",
      expansion_q: "Where could Pepper do more for you?",
      expansion_options: [
        { value: "volume", label: "More number / volume of deliverables & assets" },
        { value: "platforms", label: "Diversified platform focus (Reddit, YouTube, Digital PR, LinkedIn)" },
        { value: "geo", label: "Deeper strategic guidance on GEO" },
        { value: "outcomes", label: "Stronger focus on outcomes" },
        { value: "none", label: "Happy as-is for now" },
      ],
    },
    recommend: {
      eyebrow: "Recommendation",
      h1: "How likely are you to recommend Pepper?",
      lede: "Your honest answer here matters most to us.",
      options: [
        { score: 10, title: "Absolutely, I already do", desc: "I actively put Pepper forward to others" },
        { score: 9, title: "Very likely", desc: "I would happily recommend Pepper" },
        { score: 7, title: "Possibly", desc: "I would need to think about it" },
        { score: 4, title: "Unlikely", desc: "Not as things stand today" },
        { score: 1, title: "Not at this stage", desc: "I would not recommend Pepper in its current form" },
      ],
      followups: {
        low: "What is the main reason, and what would need to change?",
        mid: "What is holding you back from a wholehearted yes?",
        high: "Thank you. What do you value most, and may we quote you on it?",
      },
      mood_q: "Overall, how do you feel about working with Pepper?",
      moods: [
        { value: "love", label: "Very positive, it is a strong partnership", icon: "😍" },
        { value: "glad", label: "Positive, glad we work together", icon: "🙂" },
        { value: "neutral", label: "Neutral, it is fine", icon: "😐" },
        { value: "frustrated", label: "Somewhat frustrated", icon: "😕" },
        { value: "done", label: "Frustrated, it needs to improve", icon: "😤" },
      ],
    },
  },
};

export type PulseConfig = typeof defaultConfig;

export function npsCategory(score: number | null): "Detractor" | "Passive" | "Promoter" | "" {
  if (score === null) return "";
  if (score <= 6) return "Detractor";
  if (score <= 8) return "Passive";
  return "Promoter";
}

export function experienceAvg(ratings: Record<string, number | null>): number {
  const vals = Object.values(ratings).filter((v): v is number => typeof v === "number" && v > 0);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function computeChurnRisk(a: PulseAnswers): { level: "LOW" | "MEDIUM" | "HIGH"; reasons: string[]; score: number } {
  const reasons: string[] = [];
  let score = 0;
  const add = (n: number, r: string) => { score += n; reasons.push(r); };

  if (a.nps.score !== null && a.nps.score <= 6) add(2, "Detractor NPS");
  if (["unsure", "risk", "gone"].includes(a.retention.renewal_intent)) add(3, "Renewal at risk");
  if (a.value.value_for_money !== null && a.value.value_for_money <= 2) add(2, "Low value-for-money");
  if (["frustrated", "done"].includes(a.sentiment.mood)) add(2, "Negative sentiment");

  const seo = a.capability_deep_dive.seo;
  if (seo) {
    if (seo.traffic_growth !== null && seo.traffic_growth <= 2) add(2, "SEO: no organic growth");
    if (seo.organic_to_pipeline !== null && seo.organic_to_pipeline <= 2) add(2, "SEO: not converting to pipeline");
    if (seo.ai_citation_visibility !== null && seo.ai_citation_visibility <= 2) add(1, "GEO: low AI Search visibility");
  }
  const content = a.capability_deep_dive.content;
  if (content && content.quality !== null && content.quality <= 2) add(1, "Content quality below bar");

  const level: "LOW" | "MEDIUM" | "HIGH" = score >= 5 ? "HIGH" : score >= 2 ? "MEDIUM" : "LOW";
  return { level, reasons, score };
}

export function expansionReady(a: PulseAnswers): boolean {
  const hasInterest = a.expansion.interests.some((i) => i !== "none");
  return hasInterest && ["def", "prob"].includes(a.retention.renewal_intent);
}

export function buildPayload(a: PulseAnswers) {
  const cat = npsCategory(a.nps.score);
  const avg = experienceAvg(a.experience.ratings);
  const risk = computeChurnRisk(a);
  const expReady = expansionReady(a);
  return {
    submitted_at: new Date().toISOString(),
    respondent: { ...a.respondent },
    nps: { score: a.nps.score, category: cat, verbatim: a.nps.verbatim },
    value: { ...a.value },
    capability_deep_dive: a.capability_deep_dive,
    experience: { ratings: a.experience.ratings, avg, comment: a.experience.comment },
    retention: { ...a.retention },
    expansion: { ...a.expansion },
    sentiment: { ...a.sentiment },
    flags: { churn_risk: risk.level, reasons: risk.reasons, expansion_ready: expReady },
  };
}

// Human labels for storing / rendering elsewhere.
export const MOOD_LABELS: Record<string, { label: string; icon: string }> = {
  love: { label: "Very positive", icon: "😍" },
  glad: { label: "Positive", icon: "🙂" },
  neutral: { label: "Neutral", icon: "😐" },
  frustrated: { label: "Frustrated", icon: "😕" },
  done: { label: "Needs to improve", icon: "😤" },
  // legacy alias
  fine: { label: "Neutral", icon: "😐" },
};

export const RENEWAL_LABELS: Record<string, string> = {
  def: "Definitely staying",
  prob: "Probably staying",
  unsure: "On the fence",
  risk: "Leaning towards leaving",
  gone: "Likely leaving",
};

export const EXPANSION_LABELS: Record<string, string> = {
  volume: "More volume of deliverables",
  platforms: "Diversified platforms",
  geo: "Deeper GEO guidance",
  outcomes: "Stronger focus on outcomes",
  none: "Happy as-is",
  // legacy
  services: "New services",
  seats: "More seats",
  strategy: "Deeper strategy",
};

export const ROLE_LABELS: Record<string, string> = {
  buyer: "Decision-maker / sponsor",
  user: "Day-to-day user",
  both: "A bit of both",
};

export const CAPABILITY_META: Record<string, { title: string; icon: string }> = {
  content: { title: "Pepper Content", icon: "📝" },
  seo: { title: "Pepper SEO / GEO", icon: "🔍" },
};