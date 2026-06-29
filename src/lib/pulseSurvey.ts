// Pepper Customer Pulse — shared types, defaults, scoring.

export type Role = "buyer" | "user" | "both";
export type Capability = "content" | "seo" | "creative" | "studios";
export type Renewal = "def" | "prob" | "unsure" | "risk" | "gone";
export type Mood = "love" | "glad" | "fine" | "frustrated" | "done";

export interface PulseAnswers {
  respondent: {
    role: Role | "";
    name: string;
    email: string;
    company: string;
    capabilities: Capability[];
    wants_followup: "yes" | "maybe" | "no" | "";
  };
  nps: { score: number | null; verbatim: string };
  value: { value_for_money: number | null; goal_attainment: number | null; target_outcome: string };
  capability_deep_dive: {
    content?: { drives_outcome: number | null; needed_outcomes: string[]; on_brief: number | null };
    seo?: { success_metrics: string[]; traffic_growth: number | null; ai_citation_visibility: number | null; organic_to_pipeline: number | null; win_outcome: string };
    creative?: { quality: number | null; performance: number | null; speed: number | null };
    studios?: { talent_fit: number | null; integration: number | null; autonomy: number | null };
  };
  experience: { ratings: Record<string, number | null>; comment: string };
  effort: { ces: number | null; friction: string };
  retention: { renewal_intent: Renewal | ""; save_lever: string };
  expansion: { interests: string[]; referral_openness: number | null; referral_lead: string };
  sentiment: { mood: Mood | ""; one_change: string; fan_for_life: string };
}

export const initialAnswers = (): PulseAnswers => ({
  respondent: { role: "", name: "", email: "", company: "", capabilities: [], wants_followup: "" },
  nps: { score: null, verbatim: "" },
  value: { value_for_money: null, goal_attainment: null, target_outcome: "" },
  capability_deep_dive: {},
  experience: { ratings: {}, comment: "" },
  effort: { ces: null, friction: "" },
  retention: { renewal_intent: "", save_lever: "" },
  expansion: { interests: [], referral_openness: null, referral_lead: "" },
  sentiment: { mood: "", one_change: "", fan_for_life: "" },
});

export const defaultConfig = {
  steps: {
    role: {
      eyebrow: "",
      pill: "We actually read every response",
      h1: "Tell us how it's really going.",
      lede: "First, a quick one so we can ask the right questions.",
      options: [
        { value: "buyer", icon: "🧭", title: "Decision-maker / sponsor", desc: "I own the budget, contract or the call to renew" },
        { value: "user", icon: "⚙️", title: "Day-to-day user", desc: "I work hands-on with Pepper or the deliverables" },
        { value: "both", icon: "🎯", title: "A bit of both", desc: "I use it and I influence the renewal" },
      ],
    },
    capabilities: {
      eyebrow: "What you use",
      h1: "Which Pepper capabilities do you work with?",
      lede: "Pick all that apply — we'll tailor the next questions to what you actually use.",
      options: [
        { value: "content", icon: "📝", title: "Pepper Content", desc: "Articles, blogs, website & B2B full-funnel content, localisation, CRM / lifecycle" },
        { value: "seo", icon: "🔍", title: "Pepper SEO / GEO", desc: "SEO + content retainers, AI Search (GEO) visibility, content + SEO hubs" },
        { value: "creative", icon: "🎨", title: "Pepper Creative", desc: "Social, video, influencer campaigns, design & campaign assets" },
        { value: "studios", icon: "🧩", title: "Content Studios", desc: "Embedded talent, onsite or virtual, working inside your team" },
      ],
    },
    nps: {
      eyebrow: "The big one",
      h1: "How likely are you to recommend Pepper to a peer or colleague?",
      lede: "0 = not a chance · 10 = already have",
      followups: {
        low: "What's the main reason for that score — what would need to change?",
        mid: "What's holding you back from a 9 or 10?",
        high: "Brilliant. What do you love most — and would you say it in a quote we could use?",
      },
    },
    value: {
      eyebrow: "Value & ROI",
      h1: "Are you getting what you came for?",
      lede: "Two quick scales, one honest line.",
      value_for_money: { q: "How much value are you getting from Pepper today, relative to what you pay?", labels: ["Far less than I pay", "Less", "Fair", "More", "Far more value than I pay"] },
      goal_attainment: { q: "Is Pepper helping you hit the goals you signed up for?", labels: ["Not at all", "Slightly", "Somewhat", "Mostly", "Completely"] },
      buyer_outcome: { q: "In one line — what business outcome are you hoping Pepper drives this year?", hint: "e.g. \"pipeline from organic\", \"content cost down 30%\", \"rank for AI search\"" },
    },
    deep_dive: {
      eyebrow: "Outcomes",
      h1: "Let's get specific about outcomes.",
      lede: "Only the capabilities you actually use.",
      content: {
        drives_outcome: { q: "Is the content actually driving the outcomes you publish it for?", end: ["Not at all", "Absolutely"] },
        needed_outcomes: {
          q: "What do you most need this content to do? (pick up to 2-3)",
          options: ["Build authority", "Grow organic traffic", "Generate leads / pipeline", "Enable sales / nurture", "Rank & support SEO", "Scale output reliably"],
        },
        on_brief: { q: "How consistently does the work land on-brief and publish-ready the first time?", labels: ["Rarely", "Sometimes", "Almost always"] },
      },
      seo: {
        success_metrics: { q: "What does SEO/GEO success look like for you?", options: ["Organic traffic growth", "Leads / pipeline from organic", "AI Search visibility", "Keyword rankings", "Share of voice"] },
        traffic_growth: { q: "Are you seeing measurable organic growth with us?", end: ["Declining", "Strong, compounding"] },
        ai_citation_visibility: { q: "When buyers ask AI tools (ChatGPT, Perplexity, AI Overviews) about your space, how often does your brand show up?", end: ["Never", "Consistently cited"] },
        organic_to_pipeline: { q: "Is organic translating into pipeline / revenue, not just traffic?", end: ["Not at all", "It's a primary channel"] },
        win_outcome: { q: "The single SEO/GEO outcome that would make this an undeniable win?" },
      },
      creative: {
        quality: { q: "Is the creative on-brand and high quality?", end: ["Rarely", "Always"] },
        performance: { q: "Is the work actually performing (engagement, conversions, results)?", end: ["Not at all", "Outperforming"] },
        speed: { q: "How is turnaround speed?", end: ["Too slow", "Right on time"] },
      },
      studios: {
        talent_fit: { q: "Is the embedded talent the right fit for your team?", end: ["Wrong fit", "Perfect fit"] },
        integration: { q: "How well does the talent integrate with your team?", end: ["Siloed", "Fully integrated"] },
        autonomy: { q: "How self-driven is the talent?", end: ["Constant oversight", "Fully self-driven"] },
      },
    },
    experience: {
      eyebrow: "Experience",
      h1: "Rate how we're doing where it counts.",
      lede: "Stars for each — tap N/A if it doesn't apply.",
      rows: {
        quality: "Quality of work",
        support: "Support & responsiveness",
        communication: "Communication & updates",
        speed: "Speed & turnaround",
        ease_user: "Ease of working", // user only
        partner_buyer: "Feeling like a strategic partner", // buyer only
      },
      followup_low: "You rated something a little lower — what happened there?",
      followup_ok: "Anything specific we got really right, or could do better?",
    },
    effort: {
      eyebrow: "Effort",
      h1: "\"Pepper makes it easy to get what I need.\"",
      lede: "One scale, one optional line.",
      end: ["Strongly disagree", "Strongly agree"],
      friction_q: "Where do you lose the most time or friction with us, if anywhere?",
    },
    retention: {
      eyebrow: "Renewal",
      h1: "If renewal were today, where's your head?",
      options: [
        { value: "def", label: "Definitely staying" },
        { value: "prob", label: "Probably staying" },
        { value: "unsure", label: "On the fence" },
        { value: "risk", label: "Leaning towards leaving" },
        { value: "gone", label: "Likely leaving" },
      ],
      save_q: "What's the one thing that would change your mind?",
    },
    expansion: {
      eyebrow: "Growth",
      h1: "Where could Pepper do more for you?",
      lede: "Pick anything that sparks something.",
      options: [
        { value: "volume", label: "More volume" },
        { value: "services", label: "New services" },
        { value: "seats", label: "More seats" },
        { value: "strategy", label: "Deeper strategy" },
        { value: "geo", label: "AI Search / GEO" },
        { value: "none", label: "Happy as-is" },
      ],
      referral: { q: "How open are you to introducing us to another team or company?", end: ["Not open", "Happy to"] },
      referral_who: "Who comes to mind? (optional, name or company)",
    },
    wrap: {
      eyebrow: "Last bit",
      h1: "Last bit.",
      lede: "Pick a vibe and we're done.",
      moods: [
        { value: "love", label: "Genuinely love it", icon: "😍" },
        { value: "glad", label: "Glad we work together", icon: "🙂" },
        { value: "fine", label: "It's fine", icon: "😐" },
        { value: "frustrated", label: "A bit frustrated", icon: "😕" },
        { value: "done", label: "Pretty fed up", icon: "😤" },
      ],
      followup_q: "Would you be open to a 15-min call?",
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
  if (a.value.goal_attainment !== null && a.value.goal_attainment <= 2) add(2, "Goals not met");
  if (["frustrated", "done"].includes(a.sentiment.mood)) add(2, "Negative sentiment");
  if (a.effort.ces !== null && a.effort.ces <= 2) add(1, "High effort");

  const seo = a.capability_deep_dive.seo;
  if (seo) {
    if (seo.traffic_growth !== null && seo.traffic_growth <= 2) add(2, "SEO: no organic growth");
    if (seo.organic_to_pipeline !== null && seo.organic_to_pipeline <= 2) add(2, "SEO: not converting to pipeline");
    if (seo.ai_citation_visibility !== null && seo.ai_citation_visibility <= 2) add(1, "GEO: low AI Search visibility");
  }
  const content = a.capability_deep_dive.content;
  if (content && content.drives_outcome !== null && content.drives_outcome <= 2) add(1, "Content not driving outcomes");

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
    effort: { ...a.effort },
    retention: { ...a.retention },
    expansion: { ...a.expansion },
    sentiment: { ...a.sentiment },
    flags: { churn_risk: risk.level, reasons: risk.reasons, expansion_ready: expReady },
  };
}