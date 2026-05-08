import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ONBOARDING_PHASES = [
  { phase: "Sales Handover", tasks: [
    ["Review proposal & signed documents","Review the sales proposal, SOW, contract, and all signed documents for the deal","VSD",["Sales"]],
    ["Setup meeting with Sales","Schedule a handover meeting with the Sales team to discuss deal context and client expectations","VSD",["Sales"]],
    ["Conduct Sales-to-CX handover","Complete the formal handover from Sales to CX team with all relevant documents and context","Senior BOPM",["Operations"]],
  ]},
  { phase: "Scope Definition", tasks: [
    ["Review engagement model, strategy deck & briefs","Thoroughly review the engagement model, strategy deck, creative briefs, and scope documents","BOPM",["Operations"]],
  ]},
  { phase: "Staffing", tasks: [
    ["Initiate staffing request","Raise staffing request based on deal scope and requirements","Senior BOPM",["Operations"]],
    ["Margin & Deal Desk review","Complete margin analysis and Deal Desk review for staffing allocation","Senior BOPM",["Finance"]],
  ]},
  { phase: "Supply Requisition", tasks: [
    ["Supply assessment and finalization","Assess supply needs and finalize freelancer/vendor requirements","BOPM",["Operations"]],
  ]},
  { phase: "Resource Onboarding", tasks: [
    ["Onboard freelancer/resource","Complete onboarding for allocated freelancers or resources","BOPM",["Operations"]],
  ]},
  { phase: "Internal Alignment", tasks: [
    ["Internal Kickoff meeting","Conduct internal kickoff with all stakeholders to align on goals, timelines, and deliverables","Senior BOPM",["Operations"]],
    ["Account staffing review","Review staffing plan with team leads to ensure adequate resourcing","Senior BOPM",["Operations"]],
    ["Immersion session setup","Organize immersion sessions for the team to understand client's business, product, and audience","BOPM",["Operations"]],
    ["Complete immersion sessions","Conduct and complete all planned immersion sessions with the team","BOPM",["Operations"]],
    ["Internal SEO alignment","Align SEO team on client goals, keyword strategy, and technical requirements","SEO Lead",["SEO"]],
  ]},
  { phase: "Client Kick-off", tasks: [
    ["Prepare kickoff deck (SEO)","Create SEO-specific kickoff presentation with strategy, timeline, and deliverables","SEO Lead",["SEO"]],
    ["Prepare kickoff deck (Content)","Create content-specific kickoff presentation with editorial plan and guidelines","Content Lead",["Content"]],
    ["Complete client kickoff call","Conduct the client kickoff meeting presenting strategy, team, and roadmap","VSD",["Operations"]],
    ["Send Minutes of Meeting","Share MoM from kickoff call with all stakeholders including action items","BOPM",["Operations"]],
    ["Finalize communication cadence","Agree on weekly/monthly reporting and communication schedule with client","BOPM",["Operations"]],
  ]},
  { phase: "Project Setup & Planning", tasks: [
    ["Project setup in tools","Set up project in all required tools (PM tool, Slack, Drive, etc.)","BOPM",["Operations"]],
    ["Roadmap creation","Build detailed project roadmap with milestones and timelines","BOPM",["Operations"]],
    ["Assign tasks to team","Break down roadmap into actionable tasks and assign to team members","BOPM",["Operations"]],
    ["Create shared folders & repositories","Set up shared Drive folders, asset repositories, and documentation spaces","BOPM",["Operations"]],
    ["Create tracking sheets & dashboards","Build performance tracking sheets, KPI dashboards, and reporting templates","BOPM",["Operations"]],
  ]},
  { phase: "Keyword Universe", tasks: [
    ["Atlas / tool setup","Set up keyword research tools (Atlas, SEMrush, Ahrefs) for the project","SEO Lead",["SEO"]],
    ["Finalize keyword categories","Define and finalize keyword categories/clusters based on business goals","SEO Lead",["SEO"]],
    ["Extract & compile keywords","Extract comprehensive keyword list and compile into keyword universe","SEO Analyst",["SEO"]],
  ]},
  { phase: "Competitor Research", tasks: [
    ["Review client website","Conduct thorough analysis of client's current website, content, and SEO performance","SEO Analyst",["SEO"]],
    ["Review competitor websites","Analyze top competitors' websites, content strategies, and SEO positioning","SEO Analyst",["SEO"]],
  ]},
  { phase: "Keyword Analysis", tasks: [
    ["Keyword analysis & prioritization","Analyze keyword difficulty, search volume, and business relevance for prioritization","SEO Lead",["SEO"]],
    ["Keyword-to-page mapping","Map prioritized keywords to existing and planned pages on the website","SEO Analyst",["SEO"]],
    ["Identify new page opportunities","Identify gaps and opportunities for new pages based on keyword analysis","SEO Lead",["SEO"]],
    ["Prepare Information Architecture","Create recommended information architecture based on keyword mapping","SEO Lead",["SEO"]],
  ]},
  { phase: "Initial Benchmarking", tasks: [
    ["Pre-SEO ranking report","Generate baseline ranking report before SEO interventions begin","SEO Analyst",["SEO"]],
    ["Monthly topics research","Research and plan content topics for the first 3 months","SEO Lead",["SEO","Content"]],
    ["SEO content outline creation","Create detailed content outlines based on keyword strategy","SEO Lead",["SEO","Content"]],
  ]},
  { phase: "Page Creation", tasks: [
    ["Share content suggestions with client","Present content recommendations and get client buy-in","BOPM",["Content"]],
    ["Crawl website for technical audit","Perform technical site crawl to identify issues and opportunities","SEO Analyst",["SEO"]],
    ["Classify URLs by type & priority","Categorize all URLs by page type, priority, and content status","SEO Analyst",["SEO"]],
  ]},
  { phase: "URL Taxonomy", tasks: [
    ["URL taxonomy classification","Create comprehensive URL taxonomy and classification system","SEO Lead",["SEO"]],
  ]},
  { phase: "Backlinking Audit", tasks: [
    ["Compare off-page parameters","Audit and compare backlink profiles against competitors","SEO Analyst",["SEO"]],
  ]},
  { phase: "Content Team Initiation", tasks: [
    ["Review keyword universe & create content calendar","Content team reviews keyword universe and builds editorial content calendar","Content Lead",["Content"]],
  ]},
  { phase: "Defining Timelines", tasks: [
    ["Calendar sign-off & cadence setup","Get client sign-off on content calendar and set up regular review cadence","BOPM",["Operations","Content"]],
  ]},
  { phase: "Engagement Setup", tasks: [
    ["Prepare project brief for content","Create detailed project brief for content creation team","BOPM",["Content"]],
    ["Share brief for client approval","Submit project brief to client for review and approval","BOPM",["Content"]],
    ["Customize content platform","Configure content platform with brand guidelines, tone of voice, and templates","Content Lead",["Content"]],
    ["Set up content platform for writers","Onboard writers to the platform with access and guidelines","Content Lead",["Content"]],
  ]},
  { phase: "Creator Pool Setup", tasks: [
    ["Initial creator briefing","Brief and onboard the creator pool with brand guidelines, expectations, and workflow","Content Lead",["Content"]],
  ]},
  { phase: "Content Pilot", tasks: [
    ["Editorial briefing & planning","Conduct editorial briefing session for pilot content batch","Content Lead",["Content"]],
    ["Content allotment to writers","Assign pilot content pieces to selected writers","Content Lead",["Content"]],
    ["Edit & review outlines","Review and provide feedback on content outlines before drafting","Content Lead",["Content"]],
    ["Submit first drafts","Writers submit first drafts for review","Content Lead",["Content"]],
    ["Internal quality review","Conduct internal quality review of drafts against guidelines","Content Lead",["Content"]],
    ["Client review — Round 1","Submit drafts to client for first round of feedback","BOPM",["Content"]],
    ["Incorporate feedback — Round 1","Incorporate client feedback and prepare revised drafts","Content Lead",["Content"]],
    ["Client review — Round 2","Submit revised drafts for final client approval","BOPM",["Content"]],
    ["Final approvals & publishing","Get final approvals and publish/upload approved content","BOPM",["Content"]],
    ["Quality escalation handling","Address any quality escalations from pilot batch","Content Lead",["Content"]],
    ["Scale-up preparation","Prepare scale-up plan based on pilot learnings for ongoing content production","Content Lead",["Content"]],
  ]},
];

function resolveAssignee(role, deal) {
  const r = role.toLowerCase();
  if (r === "vsd") return deal.vsd || "";
  if (r === "senior bopm") return deal.senior_bopm || "";
  if (r === "bopm") return deal.bopm || "";
  if (r === "principal bopm") return deal.principal_bopm || "";
  return "";
}

// Get all deals
const allDeals = [];
let from = 0;
while (true) {
  const { data, error } = await supabase
    .from("staffing_deals")
    .select("id, vsd, bopm, senior_bopm, principal_bopm")
    .range(from, from + 999);
  if (error) throw error;
  allDeals.push(...data);
  if (data.length < 1000) break;
  from += 1000;
}
console.log(`Loaded ${allDeals.length} deals`);

// Get deals that already have tasks
const dealsWithTasks = new Set();
let f2 = 0;
while (true) {
  const { data, error } = await supabase.from("deal_tasks").select("deal_id").range(f2, f2 + 999);
  if (error) throw error;
  data.forEach(r => dealsWithTasks.add(r.deal_id));
  if (data.length < 1000) break;
  f2 += 1000;
}
console.log(`${dealsWithTasks.size} deals already have tasks`);

const dealsToSeed = allDeals.filter(d => !dealsWithTasks.has(d.id));
console.log(`Will seed ${dealsToSeed.length} deals`);

// Build task list per deal
let totalInserted = 0;
for (const deal of dealsToSeed) {
  const rows = [];
  let order = 0;
  for (const phase of ONBOARDING_PHASES) {
    for (const [title, description, assigneeRole, tags] of phase.tasks) {
      rows.push({
        deal_id: deal.id,
        title,
        description,
        phase: phase.phase,
        assignee: resolveAssignee(assigneeRole, deal),
        stage: "To Do",
        urgency: "Medium",
        tags,
        sort_order: order++,
      });
    }
  }
  // Insert in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("deal_tasks").insert(chunk);
    if (error) {
      console.error(`Error for deal ${deal.id}:`, error.message);
      break;
    }
    totalInserted += chunk.length;
  }
}
console.log(`Inserted ${totalInserted} tasks across ${dealsToSeed.length} deals`);
