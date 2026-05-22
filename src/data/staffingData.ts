// ── Types ─────────────────────────────────────────────────────────────────────
export interface Person {
  id: string;
  name: string;
  roleCategory: RoleCategory;
  roleTitle: string;
  pod: string;
  region: string;
  leaving: boolean;
  tbh: boolean;
  department?: string;
  designation?: string;
  reportingManager?: string;
  band?: string;
  hourlyRate?: number;
  email?: string;
  slackUserId?: string;
  subTeam?: string;
}

export const DEPARTMENTS = [
  "Capability - Creative Team", "Capability - Digital Strategy", "Capability - Quality Team",
  "Capability - SEO Team", "Capability - Video Production Team", "Central COE & Planning",
  "Delivery Ops and CS", "Engineering", "Finance, Legal and Admin", "HR & TA",
  "Leadership", "Marketing and Demand Generation", "Product - Design, Management",
  "Revenue - NN India Sales", "Revenue - NN India Demand Gen",
  "Revenue - NN US Sales", "Revenue - NN US Demand Gen",
  "Supply Acquisition and Operations",
] as const;

export const BANDS = ["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"] as const;

export type RoleCategory =
  | "Operations"
  | "Content"
  | "Content Strategy"
  | "SEO"
  | "Creative Strategy"
  | "Creative Copy"
  | "Creative Art"
  | "Video"
  | "Performance & Growth"
  | "Other";

// Department → RoleCategory mapping
export function departmentToRoleCategory(dept: string): RoleCategory {
  const map: Record<string, RoleCategory> = {
    "Capability - Creative Team": "Creative Art",
    "Capability - Digital Strategy": "Content Strategy",
    "Capability - Quality Team": "Content",
    "Capability - SEO Team": "SEO",
    "Capability - Video Production Team": "Video",
    "Delivery Ops and CS": "Operations",
  };
  return map[dept] || "Other";
}

export interface RoleSlot {
  roleKey: string;
  roleLabel: string;
  category: RoleCategory;
}

export interface StaffingAssignment {
  id: string;
  dealId: string;
  roleKey: string;
  personId: string;
  allocationPct: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Returns true when a staffing assignment has an end_date in the past
 * (i.e. the person is no longer actively staffed on this deal).
 * Active totals/capacity should exclude these; UI keeps them visible
 * but ghosted so VSDs/BOPMs can see historical staffing if a deal is later extended.
 */
export function isAssignmentExpired(a: { endDate?: string | null } | null | undefined): boolean {
  if (!a || !a.endDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(a.endDate);
  if (isNaN(end.getTime())) return false;
  return end < today;
}

export interface Deal {
  id: string;
  pcCode: string;
  dealId: string;
  businessUnit: string;
  capabilityLine: string;
  account: string;
  dealName: string;
  dealType: "Retainer" | "Non-Retainer" | "Pilot";
  dealStatus: string;
  staffingStatus: string;
  validation: string;
  dealStatusCx: string;
  vsd: string;
  seoStaffing: boolean;
  creativeStaffing: boolean;
  mrr?: number;
  duration?: string;
  retainerDealValue?: number;
  nonRetainerDealValue?: number;
  totalDealValue?: number;
  principalBopm?: string;
  seniorBopm?: string;
  bopm?: string;
  customerStatus?: string;
  customerType?: string;
  serviceLineTagging?: string;
  dealValueLost?: number;
  netDealValue?: number;
  rag?: string;
  pod?: string;
  startDate?: string;
  endDate?: string;
  paymentTerms?: string;
  pepperBusinessUnit?: string;
  projectedOutcomes?: any[];
  successMetrics?: any[];
  baselineMetrics?: string;
  clientId?: string;
  // Matrix-only fields
  newDealIdFormulated?: string;
  newDealIdTemp?: string;
  validationCentralCx?: string;
  monthClosedWon?: string;
  dealTargetStatus?: string;
  totalMisRecognition?: number;
  totalPendingRecognition?: number;
  consumptionValue?: number;
  misVsConsumption?: number;
  invoicedDealValue?: number;
  undeliveredFunnel?: number;
  tcvUsd?: number;
  strategyBandwidthRequired?: string;
  pepperBuL2?: string;
  inputCurrency?: "INR" | "USD";
  geo?: string;
}

export interface BWRule {
  id: string;
  capability: string;
  region: string;
  mrrTierLabel: string;
  mrrMin: number;
  mrrMax: number;
  roleKey: string;
  recommendedPct: number;
}

export interface HiringNeed {
  id: string;
  role: string;
  roleCategory: RoleCategory;
  pod: string;
  priority: "Critical" | "High" | "Medium";
  targetDate: string;
  rationale: string;
  status: "Open" | "In Progress" | "Filled";
}

export const DEFAULT_HIRING_NEEDS: HiringNeed[] = [
  { id: "h1", role: "Senior BOPM", roleCategory: "Operations", pod: "Neema", priority: "Critical", targetDate: "2026-04-15", rationale: "US pod understaffed - 3 accounts without BOPM", status: "Open" },
  { id: "h2", role: "SEO Manager", roleCategory: "SEO", pod: "SEO", priority: "High", targetDate: "2026-05-01", rationale: "Growing US account load needs additional SEO manager", status: "In Progress" },
  { id: "h3", role: "Content Lead", roleCategory: "Content", pod: "Quality", priority: "High", targetDate: "2026-04-30", rationale: "Expanding India content operations", status: "Open" },
  { id: "h4", role: "Jr. Designer", roleCategory: "Creative Art", pod: "Creative", priority: "Medium", targetDate: "2026-06-01", rationale: "Support growing creative workload", status: "Open" },
  { id: "h5", role: "BOPM", roleCategory: "Operations", pod: "Sumit", priority: "Critical", targetDate: "2026-04-01", rationale: "Backfill for leaving team member", status: "In Progress" },
];

export interface RevenueCapacityTarget {
  department: string;
  designation: string;
  targetDealValuePerPerson: number;
}

export const DEFAULT_REVENUE_TARGETS: RevenueCapacityTarget[] = [
  { department: "Delivery Ops and CS", designation: "Vertical Service Delivery Leader", targetDealValuePerPerson: 15000000 },
  { department: "Delivery Ops and CS", designation: "Group Account Manager", targetDealValuePerPerson: 8000000 },
  { department: "Delivery Ops and CS", designation: "Principal Account Engagement Lead", targetDealValuePerPerson: 7000000 },
  { department: "Delivery Ops and CS", designation: "Senior BOPM", targetDealValuePerPerson: 4000000 },
  { department: "Delivery Ops and CS", designation: "BOPM", targetDealValuePerPerson: 2500000 },
  { department: "Delivery Ops and CS", designation: "Junior BOPM", targetDealValuePerPerson: 1500000 },
  { department: "Capability - SEO Team", designation: "SEO - Practice Head", targetDealValuePerPerson: 10000000 },
  { department: "Capability - SEO Team", designation: "Group Head - SEO", targetDealValuePerPerson: 5000000 },
  { department: "Capability - SEO Team", designation: "Senior SEO Manager", targetDealValuePerPerson: 3000000 },
  { department: "Capability - SEO Team", designation: "SEO Manager", targetDealValuePerPerson: 2000000 },
  { department: "Capability - SEO Team", designation: "Senior SEO Analyst", targetDealValuePerPerson: 1500000 },
  { department: "Capability - Quality Team", designation: "Practice Head - Editorial", targetDealValuePerPerson: 10000000 },
  { department: "Capability - Quality Team", designation: "Associate Director - Content", targetDealValuePerPerson: 5000000 },
  { department: "Capability - Quality Team", designation: "Senior Content Lead", targetDealValuePerPerson: 2500000 },
  { department: "Capability - Quality Team", designation: "Content Lead", targetDealValuePerPerson: 2000000 },
  { department: "Capability - Creative Team", designation: "Senior Creative Director", targetDealValuePerPerson: 8000000 },
  { department: "Capability - Creative Team", designation: "Associate Creative Director", targetDealValuePerPerson: 5000000 },
  { department: "Capability - Creative Team", designation: "Art Director", targetDealValuePerPerson: 3000000 },
  { department: "Capability - Video Production Team", designation: "Executive Producer", targetDealValuePerPerson: 5000000 },
  { department: "Capability - Video Production Team", designation: "Creative Producer", targetDealValuePerPerson: 3000000 },
];

export const ROLE_SLOTS: RoleSlot[] = [
  { roleKey: "vsd", roleLabel: "VSD", category: "Operations" },
  { roleKey: "principal_bopm", roleLabel: "Principal BOPM", category: "Operations" },
  { roleKey: "senior_bopm", roleLabel: "Senior BOPM", category: "Operations" },
  { roleKey: "bopm", roleLabel: "BOPM", category: "Operations" },
  { roleKey: "managing_editor", roleLabel: "Managing Editor", category: "Content" },
  { roleKey: "content_lead", roleLabel: "Content Lead", category: "Content" },
  { roleKey: "senior_editor", roleLabel: "Senior Editor", category: "Content" },
  { roleKey: "seo_leader", roleLabel: "SEO Leader", category: "SEO" },
  { roleKey: "seo_group_head", roleLabel: "Group Head", category: "SEO" },
  { roleKey: "sr_seo_manager", roleLabel: "Sr. SEO Manager", category: "SEO" },
  { roleKey: "seo_manager", roleLabel: "SEO Manager", category: "SEO" },
  { roleKey: "sr_seo_analyst", roleLabel: "Sr. SEO Analyst", category: "SEO" },
  { roleKey: "seo_analyst", roleLabel: "SEO Analyst", category: "SEO" },
  { roleKey: "strategy_cd", roleLabel: "Strategy CD", category: "Creative Strategy" },
  { roleKey: "strategy_acd", roleLabel: "Strategy ACD", category: "Creative Strategy" },
  { roleKey: "strategy_sr", roleLabel: "Sr. Strategist", category: "Creative Strategy" },
  { roleKey: "cd_copy", roleLabel: "CD - Copy", category: "Creative Copy" },
  { roleKey: "acd_copy", roleLabel: "ACD - Copy", category: "Creative Copy" },
  { roleKey: "sr_copywriter", roleLabel: "Sr. Copywriter", category: "Creative Copy" },
  { roleKey: "jr_copywriter", roleLabel: "Jr. Copywriter", category: "Creative Copy" },
  { roleKey: "sr_cd_art", roleLabel: "Sr. CD - Art", category: "Creative Art" },
  { roleKey: "acd_art", roleLabel: "ACD - Art", category: "Creative Art" },
  { roleKey: "art_director", roleLabel: "Art Director", category: "Creative Art" },
  { roleKey: "sr_designer", roleLabel: "Sr. Designer", category: "Creative Art" },
  { roleKey: "jr_designer", roleLabel: "Jr. Designer", category: "Creative Art" },
  { roleKey: "production_head", roleLabel: "Production Head", category: "Video" },
  { roleKey: "ad_video_pm", roleLabel: "AD - Video PM", category: "Video" },
  { roleKey: "video_pm", roleLabel: "Video PM/ACP", category: "Video" },
  { roleKey: "video_editor_1", roleLabel: "Video Editor 1", category: "Video" },
  { roleKey: "video_editor_2", roleLabel: "Video Editor 2", category: "Video" },
  { roleKey: "influencer", roleLabel: "Influencer Team", category: "Other" },
  { roleKey: "perf_growth", roleLabel: "Performance & Growth", category: "Performance & Growth" },
];

export const ROLE_CATEGORIES: RoleCategory[] = [
  "Operations", "Content", "Content Strategy", "SEO", "Creative Strategy", "Creative Copy", "Creative Art", "Video", "Performance & Growth", "Other"
];

export const BU_ROLE_CATEGORIES: Record<string, RoleCategory[]> = {
  "Pepper Creative": ["Operations", "Creative Strategy", "Creative Copy", "Creative Art", "Video"],
  "Pepper SEO/GEO + Content": ["Operations", "Content", "SEO"],
  "Integrated": ROLE_CATEGORIES,
  "Content Studios": ["Operations", "Content", "Video"],
  "Others": ROLE_CATEGORIES,
};

export const getBUCategories = (bu: string): RoleCategory[] => {
  return BU_ROLE_CATEGORIES[bu] || ROLE_CATEGORIES;
};

export const ROLE_TO_PEOPLE_FILTER: Record<string, string[]> = {
  vsd: ["VSD"], principal_bopm: ["Principal BOPM"], senior_bopm: ["Senior BOPM"], bopm: ["BOPM"],
  managing_editor: ["Managing Editor"], content_lead: ["Content Lead"], senior_editor: ["Senior Editor"],
  seo_leader: ["SEO Leader"], seo_group_head: ["Group Head"], sr_seo_manager: ["Sr. SEO Manager"],
  seo_manager: ["SEO Manager"], sr_seo_analyst: ["Sr. SEO Analyst"], seo_analyst: ["SEO Analyst"],
  strategy_cd: ["Strategy CD"], strategy_acd: ["Strategy ACD"], strategy_sr: ["Sr. Strategist"],
  cd_copy: ["CD - Copy"], acd_copy: ["ACD - Copy"], sr_copywriter: ["Sr. Copywriter"], jr_copywriter: ["Jr. Copywriter"],
  sr_cd_art: ["Sr. CD - Art"], acd_art: ["ACD - Art"], art_director: ["Art Director"],
  sr_designer: ["Sr. Designer"], jr_designer: ["Jr. Designer"],
  production_head: ["Production Head"], ad_video_pm: ["AD - Video PM"], video_pm: ["Video PM/ACP"],
  video_editor_1: ["Video Editor 1"], video_editor_2: ["Video Editor 2"],
  influencer: ["Influencer Team"], perf_growth: ["Performance & Growth"],
};

/**
 * For each role slot, lists the role keys whose currently-staffed people on a
 * deal define the "in-scope subtree" for the dropdown. If anyone of these
 * parent roles is already staffed on the deal, the picker for this role-slot
 * is restricted to descendants (transitive direct reports) of those people.
 * Top-of-tree roles (vsd, principal_bopm, seo_leader, etc.) have no parents.
 */
export const ROLE_SENIORITY_PARENTS: Record<string, string[]> = {
  // Operations
  bopm: ["senior_bopm", "principal_bopm", "vsd"],
  senior_bopm: ["principal_bopm", "vsd"],
  principal_bopm: ["vsd"],
  // Content
  content_lead: ["managing_editor"],
  senior_editor: ["content_lead", "managing_editor"],
  // SEO
  seo_group_head: ["seo_leader"],
  sr_seo_manager: ["seo_group_head", "seo_leader"],
  seo_manager: ["sr_seo_manager", "seo_group_head", "seo_leader"],
  sr_seo_analyst: ["seo_manager", "sr_seo_manager", "seo_group_head", "seo_leader"],
  seo_analyst: ["seo_manager", "sr_seo_manager", "seo_group_head", "seo_leader"],
  // Creative Strategy
  strategy_acd: ["strategy_cd"],
  strategy_sr: ["strategy_acd", "strategy_cd"],
  // Creative Copy
  acd_copy: ["cd_copy"],
  sr_copywriter: ["acd_copy", "cd_copy"],
  jr_copywriter: ["sr_copywriter", "acd_copy", "cd_copy"],
  // Creative Art
  acd_art: ["sr_cd_art"],
  art_director: ["acd_art", "sr_cd_art"],
  sr_designer: ["art_director", "acd_art", "sr_cd_art"],
  jr_designer: ["sr_designer", "art_director", "acd_art", "sr_cd_art"],
  // Video
  ad_video_pm: ["production_head"],
  video_pm: ["ad_video_pm", "production_head"],
  video_editor_1: ["video_pm", "ad_video_pm", "production_head"],
  video_editor_2: ["video_pm", "ad_video_pm", "production_head"],
};

/**
 * BFS down the reportingManager graph (free-text name match, case-insensitive).
 * Returns the set of person ids that report (transitively) to any of the
 * provided root names. Roots themselves are NOT included.
 */
export function getDescendantPersonIds(rootNames: string[], allPeople: Person[]): Set<string> {
  const out = new Set<string>();
  if (!rootNames.length) return out;
  const norm = (s: string) => (s || "").trim().toLowerCase();
  // Group people by their (lowercased) reportingManager name for O(1) lookup.
  const byManager = new Map<string, Person[]>();
  for (const p of allPeople) {
    const k = norm(p.reportingManager || "");
    if (!k) continue;
    const arr = byManager.get(k);
    if (arr) arr.push(p); else byManager.set(k, [p]);
  }
  const queue: string[] = rootNames.map(norm).filter(Boolean);
  const visited = new Set<string>(queue);
  while (queue.length) {
    const mgr = queue.shift()!;
    const reports = byManager.get(mgr) || [];
    for (const r of reports) {
      if (out.has(r.id)) continue;
      out.add(r.id);
      const rn = norm(r.name);
      if (rn && !visited.has(rn)) { visited.add(rn); queue.push(rn); }
    }
  }
  return out;
}

let _uid = 0;
export const uid = () => `id_${++_uid}_${Math.random().toString(36).slice(2, 7)}`;

// ── People Data (from Google Sheet — 185 employees) ───────────────────────
export const DEFAULT_PEOPLE: Person[] = [
  // ── Capability - Creative Team ──
  { id: "P394", name: "Nikhil Somani", roleCategory: "Creative Art", roleTitle: "Strategy CD", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Creative Director - Strategy and Planning", reportingManager: "Sneha Iyer" },
  { id: "P397", name: "Pratyush Singh", roleCategory: "Creative Art", roleTitle: "Sr. Strategist", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Associate Group Head - Strategy", reportingManager: "Barbie Duggal" },
  { id: "P452", name: "Ansh Bhansali", roleCategory: "Creative Art", roleTitle: "Sr. Strategist", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Associate Group Head - Strategy", reportingManager: "Nikhil Somani" },
  { id: "P458", name: "Avantika Jain", roleCategory: "Creative Art", roleTitle: "Strategy ACD", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Associate Creative Director - Strategy", reportingManager: "Sneha Iyer" },
  { id: "P479", name: "Barbie Duggal", roleCategory: "Creative Copy", roleTitle: "ACD - Copy", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "ACD - Copy", reportingManager: "Nikhil Somani" },
  { id: "P512", name: "Viraj Ghodgaonkar", roleCategory: "Creative Art", roleTitle: "Sr. CD - Art", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Senior Creative Director", reportingManager: "Sneha Iyer" },
  { id: "P520", name: "Zigyasa Tryoon", roleCategory: "Creative Art", roleTitle: "Sr. Strategist", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Group Head - Strategy", reportingManager: "Nikhil Somani" },
  { id: "P524", name: "Ashlesh Patil", roleCategory: "Creative Art", roleTitle: "ACD - Art", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Associate Creative Director - Design", reportingManager: "Viraj Ghodgaonkar" },
  { id: "P527", name: "Nishant Dhuriya", roleCategory: "Creative Art", roleTitle: "ACD - Art", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Associate Creative Director - Design", reportingManager: "Viraj Ghodgaonkar" },
  { id: "P548", name: "Snigdha Parasrampuria", roleCategory: "Other", roleTitle: "Influencer Team", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Manager - Influencer Marketing", reportingManager: "Sneha Iyer" },
  { id: "P555", name: "Viwanshu Vaibhaw", roleCategory: "Creative Copy", roleTitle: "ACD - Copy", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Group Head Copy", reportingManager: "Nikhil Somani" },
  { id: "P568", name: "Stefan Amanna", roleCategory: "Creative Art", roleTitle: "Strategy CD", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Creative Director", reportingManager: "Sneha Iyer" },

  // ── Capability - Digital Strategy ──
  { id: "P376", name: "Remya Scaria", roleCategory: "Content Strategy", roleTitle: "Sr. Content Strategist", pod: "Content Strategy", region: "India", leaving: false, tbh: false, department: "Capability - Digital Strategy", designation: "Associate Director - Digital Strategy", reportingManager: "Ekta Desai" },
  { id: "P385", name: "Shreya Shah", roleCategory: "Content Strategy", roleTitle: "Content Strategist", pod: "Content Strategy", region: "India", leaving: false, tbh: false, department: "Capability - Digital Strategy", designation: "Manager - Content Strategy", reportingManager: "Ekta Desai" },
  { id: "P468", name: "Ekta Desai", roleCategory: "Content Strategy", roleTitle: "Content Strategy Director", pod: "Content Strategy", region: "India", leaving: false, tbh: false, department: "Capability - Digital Strategy", designation: "Director - Digital Strategy", reportingManager: "Kishan Panpalia" },
  { id: "P498", name: "Alisha Bhargavan", roleCategory: "Content Strategy", roleTitle: "Content Strategist", pod: "Content Strategy", region: "India", leaving: false, tbh: false, department: "Capability - Digital Strategy", designation: "Senior Associate - Digital Strategy", reportingManager: "Shreya Shah" },
  { id: "P526", name: "Irfan Pasha I", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - Digital Strategy", designation: "SEO Group Head", reportingManager: "Ekta Desai" },
  { id: "P532", name: "Arindam Sinha", roleCategory: "Content Strategy", roleTitle: "Sr. Content Strategist", pod: "Content Strategy", region: "India", leaving: false, tbh: false, department: "Capability - Digital Strategy", designation: "Senior Manager - Digital Strategy", reportingManager: "Ekta Desai" },

  // ── Capability - Quality Team (Content) ──
  { id: "P028", name: "Gaurab Chatterjee", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Director - Content", reportingManager: "Anirudh Singla" },
  { id: "P111", name: "Pratima K", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Associate Director - Content", reportingManager: "Gaurab Chatterjee" },
  { id: "P122", name: "Pathik Bhowmik", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Associate Director - Content", reportingManager: "Gaurab Chatterjee" },
  { id: "P285", name: "Conchita Fernandes", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Pratima" },
  { id: "P364", name: "Afshaan Khan", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Pathik Bhowmik" },
  { id: "P365", name: "Jishana Balakrishnan", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Pathik Bhowmik" },
  { id: "P366", name: "Greeshma A P", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Associate Director - Content", reportingManager: "Gaurab Chatterjee" },
  { id: "P400", name: "Mitchelle Joseph", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Quality Success Manager (BFSI)", reportingManager: "Aditya Shaw" },
  { id: "P464", name: "Anita Raghav", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Associate Director - Content", reportingManager: "Gaurab Chatterjee" },
  { id: "P496", name: "Utsab Biswas", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Pathik Bhowmik" },
  { id: "P503", name: "Nishtha Kanal", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Pathik Bhowmik" },
  { id: "P508", name: "Maleeha Mukhtar", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Gaurab Chatterjee" },
  { id: "P513", name: "Samritha Subashraj", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Pratima" },

  // ── Capability - SEO Team ──
  { id: "P150", name: "Nitish Singh", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "Ajitesh Pandey" },
  { id: "P476", name: "Sanket Mahure", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Growth Lead", reportingManager: "Vaibhav Sawant" },
  { id: "P484", name: "Mayur Varade", roleCategory: "SEO", roleTitle: "SEO Leader", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Director-SEO Growth", reportingManager: "Anirudh Singla" },
  { id: "P493", name: "Sushmita Balasubramanian", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Growth Lead", reportingManager: "Vedanga Bandyopadhyay" },
  { id: "P507", name: "Karan Shah", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Assistant Manager-SEO", reportingManager: "Sushmita Balasubramanian" },
  { id: "P510", name: "Rewati Khare", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Growth Lead", reportingManager: "Vedanga Bandyopadhyay" },
  { id: "P515", name: "Swati Bhingardeve", roleCategory: "SEO", roleTitle: "Sr. SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Manager", reportingManager: "Rewati Khare" },
  { id: "P516", name: "Yash Chaudhari", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Assistant Manager SEO", reportingManager: "Anirudh Takkar" },
  { id: "P523", name: "Prashant Singh Rawat", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Assistant Manager-SEO", reportingManager: "Rewati Khare" },
  { id: "P528", name: "Onkar Gumdel", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "Prithvi Pujari" },
  { id: "P530", name: "Shahid Anwar", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "Sanket Mahure" },
  { id: "P534", name: "Ajitesh Pandey", roleCategory: "SEO", roleTitle: "SEO Leader", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior Director SEO", reportingManager: "Anirudh Singla" },
  { id: "P539", name: "Prashant Singh", roleCategory: "SEO", roleTitle: "Sr. SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Manager", reportingManager: "Sushmita Balasubramanian" },
  { id: "P542", name: "Vedanga Bandyopadhyay", roleCategory: "SEO", roleTitle: "SEO Leader", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "AVP - SEO Growth", reportingManager: "Anirudh Singla" },
  { id: "P545", name: "Prithvi Pujari", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Growth Lead", reportingManager: "Ajitesh Pandey" },
  { id: "P546", name: "Saurabh Shinde", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Assistant Manager SEO", reportingManager: "Prithvi Pujari" },
  { id: "P550", name: "Rashmi Oza", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "Prithvi Pujari" },
  { id: "P559", name: "Krishma Shah", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Business Manager", reportingManager: "Irfan Pasha I" },
  { id: "P563", name: "Manav Shah", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Business Manager", reportingManager: "Vaibhav Sawant" },
  { id: "P567", name: "Karthik Nair", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Group Head SEO", reportingManager: "Mayur Varade" },
  { id: "P569", name: "Vivek Chaudhary", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Business Manager", reportingManager: "Rewati Khare" },
  { id: "P570", name: "Vaibhav Sawant", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Associate Director-SEO", reportingManager: "Vedanga Bandyopadhyay" },
  { id: "P572", name: "Crasto Leo Raymant", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Group Head - SEO", reportingManager: "Ajitesh Pandey" },
  { id: "P574", name: "Avinash Choudhary", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Business Manager", reportingManager: "Irfan Pasha I" },
  { id: "P584", name: "Siddhesh Sawant", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Business Manager", reportingManager: "Vaibhav Sawant" },
  { id: "P585", name: "Pranav Jha", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Analyst", reportingManager: "Crasto Leo Raymant" },
  { id: "P588", name: "Ankit Singh", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Business Manager", reportingManager: "Rewati Khare" },
  { id: "P589", name: "Samiran Dev", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Business Manager", reportingManager: "Mayur Varade" },
  { id: "P591", name: "Anirudh Takkar", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Group Head - SEO", reportingManager: "Mayur Varade" },
  { id: "P592", name: "Krunal Ambre", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "Vaibhav Sawant" },
  { id: "P593", name: "Shaunli Mukherjee", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Business Manager", reportingManager: "Mayur Varade" },
  { id: "P594", name: "Sahil Khan", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "Mayur Varade" },
  { id: "P596", name: "Dharmik Bhanushali", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Analyst", reportingManager: "Rewati Khare" },
  { id: "P598", name: "Aman Jain", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Analyst", reportingManager: "Vaibhav Sawant" },

  // ── Capability - Video Production Team ──
  { id: "P399", name: "Jyotirmoyee Ghosh", roleCategory: "Video", roleTitle: "AD - Video PM", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Associate Director - Video", reportingManager: "Divya Ganapathy" },
  { id: "P486", name: "Sohini Mukherjee", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Creative Producer", reportingManager: "Divya Ganapathy" },
  { id: "P504", name: "Geet Gangwani", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Creative Producer", reportingManager: "Divya Ganapathy" },
  { id: "P533", name: "Divya Ganapathy", roleCategory: "Video", roleTitle: "Production Head", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Director of Capability - Video Production", reportingManager: "Sneha Iyer" },
  { id: "P564", name: "Shanmathy Chackravarthi", roleCategory: "Video", roleTitle: "AD - Video PM", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "AD - Creative Producer", reportingManager: "Divya Ganapathy" },
  { id: "P586", name: "Jigar Somani", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Junior Producer", reportingManager: "Jyotirmoyee Ghosh" },

  // ── Central COE & Planning ──
  { id: "P571", name: "Arya Gada", roleCategory: "Other", roleTitle: "Manager - COE", pod: "COE", region: "India", leaving: false, tbh: false, department: "Central COE & Planning", designation: "Manager - COE", reportingManager: "Shashwat Sood" },

  // ── Delivery Ops and CS ──
  { id: "P112", name: "Aamir Khan", roleCategory: "Operations", roleTitle: "VSD", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior Director - Vertical Service Delivery", reportingManager: "Anirudh Singla" },
  { id: "P116", name: "Karna Shah", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior BOPM", reportingManager: "Sumit Shekhawat" },
  { id: "P127", name: "Vanshika Khandelia", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior BOPM", reportingManager: "Aamir Khan" },
  { id: "P148", name: "Tiffany Fernandes", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior BOPM", reportingManager: "Neema Jayadas" },
  { id: "P178", name: "Anisha Jaisinghani", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior BOPM", reportingManager: "Sumit Shekhawat" },
  { id: "P290", name: "Rishabh Agarwal", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior BOPM", reportingManager: "Neema Jayadas" },
  { id: "P308", name: "Sumit Shekhawat", roleCategory: "Operations", roleTitle: "VSD", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Director - Vertical Service Delivery", reportingManager: "Anirudh Singla" },
  { id: "P363", name: "Rahul Singh", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior BOPM", reportingManager: "Aamir Khan" },
  { id: "P369", name: "Vrusha Mawani", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Group BOPM", reportingManager: "Sneha Iyer" },
  { id: "P373", name: "Janhavi Trivedi", roleCategory: "Operations", roleTitle: "BOPM", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "BOPM", reportingManager: "Sumitha Shetty" },
  { id: "P378", name: "Neema Jayadas", roleCategory: "Operations", roleTitle: "VSD", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "AVP - Vertical Service Delivery", reportingManager: "Anirudh Singla" },
  { id: "P413", name: "Venkatesh Durgam", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior BOPM", reportingManager: "Neema Jayadas" },
  { id: "P414", name: "Sahil Singla", roleCategory: "Operations", roleTitle: "BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Junior BOPM", reportingManager: "Vanshika Khandelia" },
  { id: "P415", name: "Mansi Velani", roleCategory: "Operations", roleTitle: "BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Junior BOPM", reportingManager: "Karna Shah" },
  { id: "P427", name: "Vivek Teotia", roleCategory: "Operations", roleTitle: "BOPM", pod: "Neema", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "BOPM", reportingManager: "Neema Jayadas" },
  { id: "P435", name: "Karishma Sawlani", roleCategory: "Operations", roleTitle: "BOPM", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "BOPM", reportingManager: "Vrusha Mawani" },
  { id: "P437", name: "Aditya Shaw", roleCategory: "Operations", roleTitle: "VSD", pod: "Aditya", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Director - Vertical Service Delivery", reportingManager: "Anirudh Singla" },
  { id: "P465", name: "Anshika Sharma", roleCategory: "Operations", roleTitle: "BOPM", pod: "Neema", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Associate Project Manager", reportingManager: "Neema Jayadas" },
  { id: "P467", name: "Disha Bhanushali", roleCategory: "Operations", roleTitle: "BOPM", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "BOPM", reportingManager: "Vrusha Mawani" },
  { id: "P472", name: "Khushi Rajpurohit", roleCategory: "Operations", roleTitle: "BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "BOPM", reportingManager: "Sumit Shekhawat" },
  { id: "P475", name: "Risha Sinha", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Operations", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Sr. BOPM", reportingManager: "Ritu Shinde" },
  { id: "P478", name: "Disha Suratwala", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Operations", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior BOPM", reportingManager: "Ritu Shinde" },
  { id: "P482", name: "Tushar Walia", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Principle Account Engagement Lead", reportingManager: "Aamir Khan" },
  { id: "P487", name: "Ayushi Das", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior BOPM", reportingManager: "Tushar Walia" },
  { id: "P488", name: "Sumitha Shetty", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Group BOPM", reportingManager: "Sneha Iyer" },
  { id: "P492", name: "Rableen Kaur", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Group BOPM", reportingManager: "Sneha Iyer" },
  { id: "P501", name: "Romario Fernandes", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Group Account Manager", reportingManager: "Sneha Iyer" },
  { id: "P522", name: "Devanshi Panibhate", roleCategory: "Operations", roleTitle: "BOPM", pod: "Operations", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "BOPM", reportingManager: "Ritu Shinde" },
  { id: "P538", name: "Eshika Joshi", roleCategory: "Operations", roleTitle: "BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "BOPM", reportingManager: "Shreshtha Pathak" },
  { id: "P543", name: "Shreshtha Pathak", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Principal Account Engagement Lead", reportingManager: "Aditya Shaw" },
  { id: "P551", name: "Sanchit Arora", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Sr. BOPM", reportingManager: "Tushar Walia" },
  { id: "P562", name: "Ritika Shetty", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Sr. BOPM", reportingManager: "Sumitha Shetty" },
  { id: "P565", name: "Preet Desai", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Sr. BOPM", reportingManager: "Shreshtha Pathak" },
  { id: "P577", name: "Nivedita Shetty", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior BOPM", reportingManager: "Neema Jayadas" },
  { id: "P579", name: "Ritu Priya", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior BOPM", reportingManager: "Neema Jayadas" },
  { id: "P583", name: "Priyanshi Agrawal", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Senior BOPM", reportingManager: "Aamir Khan" },
  { id: "P595", name: "Chaitanya Sharma", roleCategory: "Operations", roleTitle: "BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Junior BOPM", reportingManager: "Rahul Singh" },
  { id: "P600", name: "Unnati Thakkar", roleCategory: "Operations", roleTitle: "BOPM", pod: "Neema", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Business Operations Project Manager", reportingManager: "Rishabh Agarwal" },
  { id: "P601", name: "Dwayne Fernandes", roleCategory: "Operations", roleTitle: "BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops and CS", designation: "Junior Business Operations Project Manager", reportingManager: "Anisha Jaisinghania" },

  // ── Engineering ──
  { id: "P012", name: "Aashay Shah", roleCategory: "Other", roleTitle: "Principal Engineer", pod: "Engineering", region: "India", leaving: false, tbh: false, department: "Engineering", designation: "Principal Engineer", reportingManager: "Anirudh Singla" },
  { id: "P017", name: "Jibin Thomas", roleCategory: "Other", roleTitle: "Tech Lead - Full-Stack", pod: "Engineering", region: "India", leaving: false, tbh: false, department: "Engineering", designation: "Tech Lead - Full-Stack", reportingManager: "Aashay Shah" },
  { id: "P082", name: "Noopur Gundawar", roleCategory: "Other", roleTitle: "Lead QA", pod: "Engineering", region: "India", leaving: false, tbh: false, department: "Engineering", designation: "Lead QA", reportingManager: "Aashay Shah" },
  { id: "P262", name: "Varun Dedhiya", roleCategory: "Other", roleTitle: "Senior QA - Engineer", pod: "Engineering", region: "India", leaving: false, tbh: false, department: "Engineering", designation: "Senior QA - Engineer", reportingManager: "Aashay Shah" },
  { id: "P314", name: "Karan Sheth", roleCategory: "Other", roleTitle: "Lead Product Designer", pod: "Engineering", region: "India", leaving: false, tbh: false, department: "Engineering", designation: "Lead Product Designer", reportingManager: "Aashay Shah" },
  { id: "P347", name: "Shreyas Singh", roleCategory: "Other", roleTitle: "SDE - 2 - Back-End", pod: "Engineering", region: "India", leaving: false, tbh: false, department: "Engineering", designation: "SDE - 2 - Back-End", reportingManager: "Aashay Shah" },
  { id: "P424", name: "Aniket Singh", roleCategory: "Other", roleTitle: "AI Engineer 2", pod: "Engineering", region: "India", leaving: false, tbh: false, department: "Engineering", designation: "AI Engineer 2", reportingManager: "Aashay Shah" },
  { id: "P431", name: "Diparth Shah", roleCategory: "Other", roleTitle: "Tech Lead - Back-End", pod: "Engineering", region: "India", leaving: false, tbh: false, department: "Engineering", designation: "Tech Lead - Back-End", reportingManager: "Aashay Shah" },
  { id: "P446", name: "Harsh Vijay Mali", roleCategory: "Other", roleTitle: "Devops Engineer", pod: "Engineering", region: "India", leaving: false, tbh: false, department: "Engineering", designation: "Devops Engineer", reportingManager: "Aashay Shah" },
  { id: "P525", name: "Mit Vasani", roleCategory: "Other", roleTitle: "SDE - 2 - Front-End", pod: "Engineering", region: "India", leaving: false, tbh: false, department: "Engineering", designation: "SDE - 2 - Front-End", reportingManager: "Aashay Shah" },

  // ── Finance, Legal and Admin ──
  { id: "P218", name: "Dhruv Kotak", roleCategory: "Other", roleTitle: "Associate Director-Finance", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Associate Director-Finance", reportingManager: "Apurva Dalmia" },
  { id: "P284", name: "Rashi Musaddi", roleCategory: "Other", roleTitle: "Associate Director-Finance", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Associate Director-Finance", reportingManager: "Apurva Dalmia" },
  { id: "P286", name: "Simran Tibrewal", roleCategory: "Other", roleTitle: "Associate Director-Legal", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Associate Director-Legal", reportingManager: "Apurva Dalmia" },
  { id: "P387", name: "Sudhanshu Sikhwal", roleCategory: "Other", roleTitle: "Associate-Finance", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Associate-Finance", reportingManager: "Rashi Musaddi" },
  { id: "P401", name: "Priyanka Sharma", roleCategory: "Other", roleTitle: "Assistant Manager - Finance", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Assistant Manager - Finance", reportingManager: "Rashi Musaddi" },
  { id: "P449", name: "Niraj Pednekar", roleCategory: "Other", roleTitle: "Manager-IT & Admin", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Manager-IT & Admin", reportingManager: "Apurva Dalmia" },
  { id: "P489", name: "Vrutik Damnania", roleCategory: "Other", roleTitle: "Associate-Finance", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Associate-Finance", reportingManager: "Rashi Musaddi" },
  { id: "P517", name: "Gautami Kalekar", roleCategory: "Other", roleTitle: "Associate-Finance", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Associate-Finance", reportingManager: "Dhruv Kotak" },
  { id: "P521", name: "Rutuja Pawar", roleCategory: "Other", roleTitle: "Associate - Legal", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Associate - Legal", reportingManager: "Simran Tibrewal" },
  { id: "P536", name: "Shraddha Biyani", roleCategory: "Other", roleTitle: "Assistant Manager - Finance", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Assistant Manager - Finance", reportingManager: "Apurva Dalmia" },
  { id: "P557", name: "Divya Ranganathan", roleCategory: "Other", roleTitle: "Assistant Manager - Finance", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Assistant Manager - Finance", reportingManager: "Apurva Dalmia" },
  { id: "P566", name: "Subrat Jain", roleCategory: "Other", roleTitle: "Junior Associate - Legal", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Junior Associate - Legal", reportingManager: "Simran Tibrewal" },
  { id: "P590", name: "Gunjan Dialani", roleCategory: "Other", roleTitle: "Associate -Business Finance Analyst", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Associate -Business Finance Analyst", reportingManager: "Dhruv Kotak" },
  { id: "P597", name: "Prince Pansuriya", roleCategory: "Other", roleTitle: "Finance Associate", pod: "Finance", region: "India", leaving: false, tbh: false, department: "Finance, Legal and Admin", designation: "Finance Associate", reportingManager: "Rashi Musaddi" },

  // ── HR & TA ──
  { id: "P213", name: "Vasudha Sharma", roleCategory: "Other", roleTitle: "Senior Manager - Talent Acquisition", pod: "HR", region: "India", leaving: false, tbh: false, department: "HR & TA", designation: "Senior Manager - Talent Acquisition", reportingManager: "Sonam Saraf" },
  { id: "P343", name: "Ankita Naik", roleCategory: "Other", roleTitle: "Manager - HR Operations", pod: "HR", region: "India", leaving: false, tbh: false, department: "HR & TA", designation: "Manager - HR Operations", reportingManager: "Sonam Saraf" },
  { id: "P439", name: "Sanskruti Shinde", roleCategory: "Other", roleTitle: "Talent Acquisition Associate", pod: "HR", region: "India", leaving: false, tbh: false, department: "HR & TA", designation: "Talent Acquisition Associate", reportingManager: "Vasudha Sharma" },
  { id: "P535", name: "Sonam Saraf", roleCategory: "Other", roleTitle: "Associate Director - HR", pod: "HR", region: "India", leaving: false, tbh: false, department: "HR & TA", designation: "Associate Director - HR", reportingManager: "Rishabh Shekhar" },

  // ── Leadership ──
  { id: "P001", name: "Rishabh Shekhar", roleCategory: "Other", roleTitle: "COO", pod: "Leadership", region: "India", leaving: false, tbh: false, department: "Leadership", designation: "COO", reportingManager: "" },
  { id: "P002", name: "Anirudh Singla", roleCategory: "Other", roleTitle: "CEO", pod: "Leadership", region: "India", leaving: false, tbh: false, department: "Leadership", designation: "CEO", reportingManager: "" },
  { id: "P064", name: "Sneha Iyer", roleCategory: "Operations", roleTitle: "VSD", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Leadership", designation: "VP - Enterprise Business", reportingManager: "Anirudh Singla" },
  { id: "P141", name: "Apurva Dalmia", roleCategory: "Other", roleTitle: "VP Finance", pod: "Leadership", region: "India", leaving: false, tbh: false, department: "Leadership", designation: "VP Finance", reportingManager: "Anirudh Singla" },

  // ── Marketing and Demand Generation ──
  { id: "P270", name: "Shabin George", roleCategory: "Other", roleTitle: "Associate Director - Revenue Strategy and Operations", pod: "Marketing", region: "India", leaving: false, tbh: false, department: "Marketing and Demand Generation", designation: "Associate Director - Revenue Strategy and Operations", reportingManager: "Anirudh Singla" },
  { id: "P497", name: "Rohan Pal", roleCategory: "Other", roleTitle: "Revenue Operations Associate", pod: "Marketing", region: "India", leaving: false, tbh: false, department: "Marketing and Demand Generation", designation: "Revenue Operations Associate", reportingManager: "Shabin George" },
  { id: "P511", name: "Deepika Muchhala", roleCategory: "Other", roleTitle: "Program Manager - Revenue Strategy and Operations", pod: "Marketing", region: "India", leaving: false, tbh: false, department: "Marketing and Demand Generation", designation: "Program Manager - Revenue Strategy and Operations", reportingManager: "Shabin George" },

  // ── Product - Design, Management ──
  { id: "P182", name: "Kunal Bajpai", roleCategory: "Other", roleTitle: "Product Manager", pod: "Product", region: "India", leaving: false, tbh: false, department: "Product - Design, Management", designation: "Product Manager", reportingManager: "Anirudh Singla" },
  { id: "P272", name: "Meghana D", roleCategory: "Other", roleTitle: "Senior Director - AI", pod: "Product", region: "India", leaving: false, tbh: false, department: "Product - Design, Management", designation: "Senior Director - AI", reportingManager: "Anirudh Singla" },
  { id: "P433", name: "Naomi Silveira", roleCategory: "Other", roleTitle: "Manager - Gen AI Content Programs", pod: "Product", region: "India", leaving: false, tbh: false, department: "Product - Design, Management", designation: "Manager - Gen AI Content Programs", reportingManager: "Meghana D" },
  { id: "P544", name: "Ashish Sinha", roleCategory: "Other", roleTitle: "Senior Product Manager", pod: "Product", region: "India", leaving: false, tbh: false, department: "Product - Design, Management", designation: "Senior Product Manager", reportingManager: "Anirudh Singla" },

  // ── Revenue - NN India ──
  { id: "P561", name: "Ilaya Raja", roleCategory: "Other", roleTitle: "Sales Manager - Enterprise Accounts", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Demand Gen", designation: "Sales Manager - Enterprise Accounts", reportingManager: "Tushar Singh" },
  { id: "P014", name: "Aditya Joshi", roleCategory: "Other", roleTitle: "Associate Director - Sales", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Associate Director - Sales", reportingManager: "Sneha Iyer" },
  { id: "P101", name: "Rahul Dhamnani", roleCategory: "Other", roleTitle: "Associate Director - Sales", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Associate Director - Sales", reportingManager: "Rishabh Shekhar" },
  { id: "P113", name: "Tushar Singh", roleCategory: "Other", roleTitle: "Senior Director - Enterprise Sales", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Senior Director - Enterprise Sales", reportingManager: "Rishabh Shekhar" },
  { id: "P306", name: "Hitesh Kumar Malviya", roleCategory: "Other", roleTitle: "Manager - Sales", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Manager - Sales", reportingManager: "Nakul Jambotkar" },
  { id: "P372", name: "Debdeep Banerjee", roleCategory: "Other", roleTitle: "Director of Enterprise Sales", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Director of Enterprise Sales", reportingManager: "Sneha Iyer" },
  { id: "P393", name: "Foram Desai", roleCategory: "Other", roleTitle: "Junior AE", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Junior AE", reportingManager: "Tushar Singh" },
  { id: "P406", name: "Rashmi Kularia", roleCategory: "Other", roleTitle: "Junior AE", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Junior AE", reportingManager: "Sneha Iyer" },
  { id: "P411", name: "Priyanka Jaiswal", roleCategory: "Other", roleTitle: "Associate Director - Sales", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Associate Director - Sales", reportingManager: "Sneha Iyer" },
  { id: "P416", name: "Nakul Jambotkar", roleCategory: "Other", roleTitle: "Associate Director - Enterprise Sales", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Associate Director - Enterprise Sales", reportingManager: "Rishabh Shekhar" },
  { id: "P451", name: "Hitansh Momaya", roleCategory: "Other", roleTitle: "Account Executive", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Account Executive", reportingManager: "Nakul Jambotkar" },
  { id: "P529", name: "Mohini D", roleCategory: "Other", roleTitle: "Manager - Enterprise Sales", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Manager - Enterprise Sales", reportingManager: "Debdeep Banerjee" },
  { id: "P547", name: "Angad Yadav", roleCategory: "Other", roleTitle: "Sales Development Representative", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Sales Development Representative", reportingManager: "Tushar Singh" },
  { id: "P556", name: "Hardik Sampat", roleCategory: "Other", roleTitle: "Sales Manager - Enterprise Accounts", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Sales Manager - Enterprise Accounts", reportingManager: "Rahul Dhamnani" },
  { id: "P558", name: "Prashant Suresh Avhad", roleCategory: "Other", roleTitle: "Sales Development Representative", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Sales Development Representative", reportingManager: "Tushar Singh" },
  { id: "P578", name: "Eshan Kalia", roleCategory: "Other", roleTitle: "Sales Development Representative", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Sales Development Representative", reportingManager: "Tushar singh" },
  { id: "P581", name: "Shubham Talekar", roleCategory: "Other", roleTitle: "Sales Development Representative", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Sales Development Representative", reportingManager: "Tushar Singh" },
  { id: "P587", name: "Krishna Jain", roleCategory: "Other", roleTitle: "Sales Development Representative", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Sales Development Representative", reportingManager: "Tushar Singh" },
  { id: "P599", name: "Madhav Sharma", roleCategory: "Other", roleTitle: "Sales Development Representative", pod: "India Sales", region: "India", leaving: false, tbh: false, department: "Revenue - NN India Sales", designation: "Sales Development Representative", reportingManager: "Tushar Singh" },

  // ── Revenue - NN US ──
  { id: "P456", name: "Manjunath NS", roleCategory: "Other", roleTitle: "BDR - US", pod: "US Sales", region: "US", leaving: false, tbh: false, department: "Revenue - NN US Demand Gen", designation: "BDR - US", reportingManager: "Kishan Panpalia" },
  { id: "P494", name: "Snehil Saurabh", roleCategory: "Other", roleTitle: "Sales Development Representative - US", pod: "US Sales", region: "US", leaving: false, tbh: false, department: "Revenue - NN US Demand Gen", designation: "Sales Development Representative - US", reportingManager: "Kishan Panpalia" },
  { id: "P499", name: "Janvi Rohra", roleCategory: "Other", roleTitle: "Senior Associate - GTM", pod: "US Sales", region: "US", leaving: false, tbh: false, department: "Revenue - NN US Demand Gen", designation: "Senior Associate - GTM", reportingManager: "Kishan Panpalia" },
  { id: "P514", name: "Diya Pansari", roleCategory: "Other", roleTitle: "Senior Associate - GTM", pod: "US Sales", region: "US", leaving: false, tbh: false, department: "Revenue - NN US Demand Gen", designation: "Senior Associate - GTM", reportingManager: "Kishan Panpalia" },
  { id: "P021", name: "Kishan Panpalia", roleCategory: "Other", roleTitle: "VP - US Business", pod: "US Sales", region: "US", leaving: false, tbh: false, department: "Revenue - NN US Sales", designation: "VP - US Business", reportingManager: "Anirudh Singla" },
  { id: "P425", name: "Shreenath Bhat", roleCategory: "Other", roleTitle: "Account Executive-US", pod: "US Sales", region: "US", leaving: false, tbh: false, department: "Revenue - NN US Sales", designation: "Account Executive-US", reportingManager: "Kishan Panpalia" },
  { id: "P470", name: "Mariana Cornejo", roleCategory: "Other", roleTitle: "VP - Enterprise Business", pod: "US Sales", region: "US", leaving: false, tbh: false, department: "Revenue - NN US Sales", designation: "VP - Enterprise Business", reportingManager: "Kishan Panpalia" },
  { id: "P573", name: "Harsh Doshi", roleCategory: "Other", roleTitle: "SDR Manager", pod: "US Sales", region: "US", leaving: false, tbh: false, department: "Revenue - NN US Sales", designation: "SDR Manager", reportingManager: "Kishan Panpalia" },
  { id: "P580", name: "Saswat Brahma", roleCategory: "Other", roleTitle: "SDR US", pod: "US Sales", region: "US", leaving: false, tbh: false, department: "Revenue - NN US Sales", designation: "SDR US", reportingManager: "Harsh Doshi" },
  { id: "P582", name: "Samarth Mishra", roleCategory: "Other", roleTitle: "SDR US", pod: "US Sales", region: "US", leaving: false, tbh: false, department: "Revenue - NN US Sales", designation: "SDR US", reportingManager: "Harsh Doshi" },

  // ── Supply Acquisition and Operations ──
  { id: "P260", name: "Shashwat Sood", roleCategory: "Other", roleTitle: "Director - Supply Acquisition and Operations", pod: "Supply", region: "India", leaving: false, tbh: false, department: "Supply Acquisition and Operations", designation: "Director - Supply Acquisition and Operations", reportingManager: "Anirudh Singla" },
  { id: "P390", name: "Sushmita Giri", roleCategory: "Other", roleTitle: "Manager - Supply Acquisition and Operations", pod: "Supply", region: "India", leaving: false, tbh: false, department: "Supply Acquisition and Operations", designation: "Manager - Supply Acquisition and Operations", reportingManager: "Shashwat Sood" },
  { id: "P412", name: "Mahak Garg", roleCategory: "Other", roleTitle: "Assistant Manager - Supply Acquisition and Operations", pod: "Supply", region: "India", leaving: false, tbh: false, department: "Supply Acquisition and Operations", designation: "Assistant Manager - Supply Acquisition and Operations", reportingManager: "Shashwat Sood" },
  { id: "P436", name: "Ankita Thakur", roleCategory: "Other", roleTitle: "Manager - Supply Acquisition and Operations", pod: "Supply", region: "India", leaving: false, tbh: false, department: "Supply Acquisition and Operations", designation: "Manager - Supply Acquisition and Operations", reportingManager: "Shashwat Sood" },
  { id: "P461", name: "Saparya Chakraborty", roleCategory: "Other", roleTitle: "Assistant Manager- Creative Talent Acquisition", pod: "Supply", region: "India", leaving: false, tbh: false, department: "Supply Acquisition and Operations", designation: "Assistant Manager- Creative Talent Acquisition", reportingManager: "Shashwat Sood" },

  // ── Legacy people (referenced by manual assignments but not in current sheet) ──
  { id: "p_varsha", name: "Varsha Madagouni", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Content Editor", reportingManager: "Pratima K" },
  { id: "p_aditya_s", name: "Aditya Satarkar", roleCategory: "Creative Copy", roleTitle: "CD - Copy", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Creative Director - Copy", reportingManager: "" },
  { id: "p_aditya_p", name: "Aditya Pathak", roleCategory: "Creative Copy", roleTitle: "Jr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Junior Copywriter", reportingManager: "" },
  { id: "p_janhavi", name: "Janhavi Dave", roleCategory: "Creative Art", roleTitle: "Sr. CD - Art", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Senior Creative Director - Art", reportingManager: "" },
  { id: "p_neha", name: "Neha Patel", roleCategory: "Creative Art", roleTitle: "Sr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Senior Designer", reportingManager: "" },
  { id: "p_vedanti", name: "Vedanti Ghuikhedkar", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Video PM", reportingManager: "" },
  { id: "p_shubham", name: "Shubham Hadkar", roleCategory: "Video", roleTitle: "Video Editor 1", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Video Editor", reportingManager: "" },
  { id: "p_mamta", name: "Mamta Thatte", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Editor Consultant", reportingManager: "" },
  { id: "p_rashmi_s", name: "Rashmi Sharma", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Editor Consultant", reportingManager: "" },
  { id: "p_mit", name: "Mit Thakkar", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Analyst", reportingManager: "" },
  { id: "p_nikita", name: "Nikita Sharma", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Gaurab Chatterjee" },
  { id: "p_mukul", name: "Mukul Bhatkhande", roleCategory: "Creative Art", roleTitle: "Art Director", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Art Director", reportingManager: "" },
  { id: "p_rahul_r", name: "Rahul Rajeev", roleCategory: "Video", roleTitle: "Video Editor 1", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Video Editor", reportingManager: "" },
  { id: "p_amruta", name: "Amruta Khemnar", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Group Head - SEO", reportingManager: "" },
  { id: "p_taral", name: "Taral Patel", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "" },
  { id: "p_vedaant", name: "Vedaant Dutt", roleCategory: "Creative Copy", roleTitle: "Sr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Senior Copywriter", reportingManager: "" },
  { id: "p_vinaya", name: "Vinaya C", roleCategory: "Video", roleTitle: "Video Editor 2", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Video Editor", reportingManager: "" },
  { id: "p_samruddha", name: "Samruddha Kulkarni", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Associate Creative Producer", reportingManager: "" },
  { id: "p_siddharth", name: "Siddharth Kedar", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Junior Designer", reportingManager: "" },
  { id: "p_krisha", name: "Krisha Mehta", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Graphic Designer", reportingManager: "" },
  { id: "p_aniket", name: "Aniket More", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Graphic Designer", reportingManager: "" },

  // ── TBH placeholders ──
  { id: "tbh_editor", name: "TBH - Senior Editor", roleCategory: "Content", roleTitle: "Senior Editor", pod: "—", region: "—", leaving: false, tbh: true },
  { id: "tbh_seo_analyst", name: "TBH - SEO Analyst", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "—", region: "—", leaving: false, tbh: true },
];

// ── Deals Data (all deals from spreadsheet) ──────────────────────────────
import { ALL_DEALS } from "./allDeals";
export const DEFAULT_DEALS: Deal[] = ALL_DEALS;

// ── Auto-assignment: match deal.vsd to person by name ─────────────────────
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function findPersonByName(name: string, people: Person[]): Person | undefined {
  const norm = normalizeName(name);
  // Exact match
  let match = people.find(p => normalizeName(p.name) === norm);
  if (match) return match;
  // Last name + first name partial
  match = people.find(p => {
    const pn = normalizeName(p.name);
    return pn.includes(norm) || norm.includes(pn);
  });
  if (match) return match;
  // First name match (at least 4 chars)
  if (norm.length >= 4) {
    const firstName = norm.split(" ")[0];
    const matches = people.filter(p => normalizeName(p.name).split(" ")[0] === firstName);
    if (matches.length === 1) return matches[0];
  }
  return undefined;
}

// Determine best role key for a person based on their roleTitle
function getRoleKeyForPerson(person: Person): string {
  const titleToRole: Record<string, string> = {
    "VSD": "vsd",
    "Principal BOPM": "principal_bopm",
    "Senior BOPM": "senior_bopm",
    "BOPM": "bopm",
    "Managing Editor": "managing_editor",
    "Content Lead": "content_lead",
    "Senior Editor": "senior_editor",
    "SEO Leader": "seo_leader",
    "Group Head": "seo_group_head",
    "Sr. SEO Manager": "sr_seo_manager",
    "SEO Manager": "seo_manager",
    "Sr. SEO Analyst": "sr_seo_analyst",
    "SEO Analyst": "seo_analyst",
    "Strategy CD": "strategy_cd",
    "Strategy ACD": "strategy_acd",
    "Sr. Strategist": "strategy_sr",
    "Content Strategy Director": "strategy_sr",
    "Sr. Content Strategist": "strategy_sr",
    "Content Strategist": "strategy_sr",
    "CD - Copy": "cd_copy",
    "ACD - Copy": "acd_copy",
    "Sr. Copywriter": "sr_copywriter",
    "Jr. Copywriter": "jr_copywriter",
    "Sr. CD - Art": "sr_cd_art",
    "ACD - Art": "acd_art",
    "Art Director": "art_director",
    "Sr. Designer": "sr_designer",
    "Jr. Designer": "jr_designer",
    "Production Head": "production_head",
    "AD - Video PM": "ad_video_pm",
    "Video PM/ACP": "video_pm",
    "Video Editor 1": "video_editor_1",
    "Video Editor 2": "video_editor_2",
    "Influencer Team": "influencer",
    "Performance & Growth": "perf_growth",
  };
  return titleToRole[person.roleTitle] || "bopm";
}

function generateAutoAssignments(deals: Deal[], people: Person[]): StaffingAssignment[] {
  const assignments: StaffingAssignment[] = [];
  const existingDealIds = new Set(MANUAL_ASSIGNMENTS.map(a => a.dealId));

  deals.forEach(deal => {
    // Skip deals that already have manual assignments
    if (existingDealIds.has(deal.id)) return;
    if (!deal.vsd || deal.vsd.trim() === "") return;

    // Match VSD name to a person
    const vsdPerson = findPersonByName(deal.vsd, people);
    if (vsdPerson) {
      const roleKey = getRoleKeyForPerson(vsdPerson);
      assignments.push({
        id: uid(),
        dealId: deal.id,
        roleKey,
        personId: vsdPerson.id,
        allocationPct: 0,
      });
    }
  });

  return assignments;
}

// ── Manual Staffing Assignments (from spreadsheet) ──────────────────────────
const MANUAL_ASSIGNMENTS: StaffingAssignment[] = [
  // d1 - ITC Nepal
  { id: uid(), dealId: "d1", roleKey: "managing_editor", personId: "p_pratima", allocationPct: 2.5 },
  { id: uid(), dealId: "d1", roleKey: "senior_editor", personId: "p_varsha", allocationPct: 25.0 },
  { id: uid(), dealId: "d1", roleKey: "strategy_cd", personId: "p_nikhil", allocationPct: 2.0 },
  { id: uid(), dealId: "d1", roleKey: "strategy_acd", personId: "p_avantika", allocationPct: 10.0 },
  { id: uid(), dealId: "d1", roleKey: "cd_copy", personId: "p_aditya_s", allocationPct: 10.0 },
  { id: uid(), dealId: "d1", roleKey: "acd_copy", personId: "p_viwanshu", allocationPct: 15.0 },
  { id: uid(), dealId: "d1", roleKey: "jr_copywriter", personId: "p_aditya_p", allocationPct: 20.0 },
  { id: uid(), dealId: "d1", roleKey: "sr_cd_art", personId: "p_janhavi", allocationPct: 10.0 },
  { id: uid(), dealId: "d1", roleKey: "acd_art", personId: "p_viraj", allocationPct: 12.5 },
  { id: uid(), dealId: "d1", roleKey: "sr_designer", personId: "p_ashlesh", allocationPct: 12.5 },
  { id: uid(), dealId: "d1", roleKey: "sr_designer", personId: "p_neha", allocationPct: 62.5 },
  { id: uid(), dealId: "d1", roleKey: "jr_designer", personId: "p_vedanti", allocationPct: 62.5 },
  { id: uid(), dealId: "d1", roleKey: "production_head", personId: "p_divya", allocationPct: 37.5 },
  { id: uid(), dealId: "d1", roleKey: "video_editor_1", personId: "p_shubham", allocationPct: 50.0 },
  { id: uid(), dealId: "d1", roleKey: "influencer", personId: "p_snigdha", allocationPct: 10.0 },
  { id: uid(), dealId: "d1", roleKey: "perf_growth", personId: "p_sanchit", allocationPct: 75.0 },
  // d2 - Acceldata
  { id: uid(), dealId: "d2", roleKey: "managing_editor", personId: "p_greesma", allocationPct: 10.0 },
  { id: uid(), dealId: "d2", roleKey: "senior_editor", personId: "p_mamta", allocationPct: 62.5 },
  { id: uid(), dealId: "d2", roleKey: "seo_leader", personId: "p_ajitesh", allocationPct: 8.0 },
  { id: uid(), dealId: "d2", roleKey: "seo_group_head", personId: "p_prithvi", allocationPct: 15.0 },
  { id: uid(), dealId: "d2", roleKey: "seo_manager", personId: "p_rashmi_o", allocationPct: 35.0 },
  { id: uid(), dealId: "d2", roleKey: "sr_seo_analyst", personId: "p_saurabh", allocationPct: 15.0 },
  // d3 - Earnin
  { id: uid(), dealId: "d3", roleKey: "managing_editor", personId: "p_anita", allocationPct: 75.0 },
  { id: uid(), dealId: "d3", roleKey: "senior_editor", personId: "p_rashmi_s", allocationPct: 0.0 },
  { id: uid(), dealId: "d3", roleKey: "seo_leader", personId: "p_mayur", allocationPct: 15.0 },
  { id: uid(), dealId: "d3", roleKey: "seo_group_head", personId: "p_karthik", allocationPct: 20.0 },
  { id: uid(), dealId: "d3", roleKey: "sr_seo_manager", personId: "p_swati", allocationPct: 50.0 },
  { id: uid(), dealId: "d3", roleKey: "seo_manager", personId: "p_yash", allocationPct: 40.0 },
  // d4 - Pepperfry
  { id: uid(), dealId: "d4", roleKey: "managing_editor", personId: "p_pathik", allocationPct: 7.5 },
  { id: uid(), dealId: "d4", roleKey: "content_lead", personId: "p_jishana", allocationPct: 30.0 },
  { id: uid(), dealId: "d4", roleKey: "seo_leader", personId: "p_vedanga", allocationPct: 5.0 },
  { id: uid(), dealId: "d4", roleKey: "seo_group_head", personId: "p_sushmita", allocationPct: 15.0 },
  { id: uid(), dealId: "d4", roleKey: "sr_seo_manager", personId: "p_prashant", allocationPct: 50.0 },
  { id: uid(), dealId: "d4", roleKey: "sr_seo_analyst", personId: "p_karan", allocationPct: 20.0 },
  { id: uid(), dealId: "d4", roleKey: "seo_analyst", personId: "p_mit", allocationPct: 10.0 },
  // d5 - JSW
  { id: uid(), dealId: "d5", roleKey: "managing_editor", personId: "p_pathik", allocationPct: 2.5 },
  { id: uid(), dealId: "d5", roleKey: "content_lead", personId: "p_afshaan", allocationPct: 10.0 },
  { id: uid(), dealId: "d5", roleKey: "seo_leader", personId: "p_vedanga", allocationPct: 5.0 },
  { id: uid(), dealId: "d5", roleKey: "seo_group_head", personId: "p_rewati", allocationPct: 15.0 },
  { id: uid(), dealId: "d5", roleKey: "sr_seo_analyst", personId: "p_prashant_r", allocationPct: 30.0 },
  { id: uid(), dealId: "d5", roleKey: "seo_analyst", personId: "p_dharmik", allocationPct: 25.0 },
  // d6 - HDFC Bank Content
  { id: uid(), dealId: "d6", roleKey: "managing_editor", personId: "p_gaurab", allocationPct: 0.0 },
  { id: uid(), dealId: "d6", roleKey: "content_lead", personId: "p_samritha", allocationPct: 2.5 },
  { id: uid(), dealId: "d6", roleKey: "senior_editor", personId: "p_nikita", allocationPct: 12.5 },
  { id: uid(), dealId: "d6", roleKey: "cd_copy", personId: "p_aditya_s", allocationPct: 0.0 },
  { id: uid(), dealId: "d6", roleKey: "art_director", personId: "p_mukul", allocationPct: 1.25 },
  { id: uid(), dealId: "d6", roleKey: "art_director", personId: "p_nishant", allocationPct: 1.25 },
  { id: uid(), dealId: "d6", roleKey: "video_editor_1", personId: "p_rahul_r", allocationPct: 5.0 },
  // d7 - Bhanzu
  { id: uid(), dealId: "d7", roleKey: "managing_editor", personId: "p_pathik", allocationPct: 7.5 },
  { id: uid(), dealId: "d7", roleKey: "content_lead", personId: "p_jishana", allocationPct: 37.5 },
  { id: uid(), dealId: "d7", roleKey: "seo_leader", personId: "p_vedanga", allocationPct: 5.0 },
  { id: uid(), dealId: "d7", roleKey: "seo_group_head", personId: "p_rewati", allocationPct: 15.0 },
  { id: uid(), dealId: "d7", roleKey: "sr_seo_analyst", personId: "p_prashant_r", allocationPct: 20.0 },
  { id: uid(), dealId: "d7", roleKey: "seo_analyst", personId: "p_dharmik", allocationPct: 40.0 },
  // d8 - HDFC MME
  { id: uid(), dealId: "d8", roleKey: "managing_editor", personId: "p_gaurab", allocationPct: 0.0 },
  { id: uid(), dealId: "d8", roleKey: "content_lead", personId: "p_samritha", allocationPct: 5.0 },
  { id: uid(), dealId: "d8", roleKey: "senior_editor", personId: "p_nikita", allocationPct: 10.0 },
  { id: uid(), dealId: "d8", roleKey: "cd_copy", personId: "p_aditya_s", allocationPct: 0.0 },
  { id: uid(), dealId: "d8", roleKey: "art_director", personId: "p_mukul", allocationPct: 1.25 },
  { id: uid(), dealId: "d8", roleKey: "art_director", personId: "p_nishant", allocationPct: 1.25 },
  { id: uid(), dealId: "d8", roleKey: "video_editor_1", personId: "p_rahul_r", allocationPct: 10.0 },
  { id: uid(), dealId: "d8", roleKey: "production_head", personId: "p_divya", allocationPct: 1.25 },
  { id: uid(), dealId: "d8", roleKey: "ad_video_pm", personId: "p_shanmathy", allocationPct: 6.25 },
  { id: uid(), dealId: "d8", roleKey: "video_pm", personId: "p_samruddha", allocationPct: 6.25 },
  // d9 - TVS Eurogrip
  { id: uid(), dealId: "d9", roleKey: "managing_editor", personId: "p_pathik", allocationPct: 7.5 },
  { id: uid(), dealId: "d9", roleKey: "seo_leader", personId: "p_vedanga", allocationPct: 5.0 },
  { id: uid(), dealId: "d9", roleKey: "seo_group_head", personId: "p_sushmita", allocationPct: 15.0 },
  { id: uid(), dealId: "d9", roleKey: "sr_seo_manager", personId: "p_prashant", allocationPct: 15.0 },
  { id: uid(), dealId: "d9", roleKey: "sr_seo_analyst", personId: "p_karan", allocationPct: 20.0 },
  { id: uid(), dealId: "d9", roleKey: "seo_analyst", personId: "p_mit", allocationPct: 20.0 },
  // d10 - Compare Remit
  { id: uid(), dealId: "d10", roleKey: "managing_editor", personId: "p_nishtha", allocationPct: 0.0 },
  { id: uid(), dealId: "d10", roleKey: "senior_editor", personId: "p_mamta", allocationPct: 10.0 },
  { id: uid(), dealId: "d10", roleKey: "seo_leader", personId: "p_ajitesh", allocationPct: 15.0 },
  { id: uid(), dealId: "d10", roleKey: "seo_group_head", personId: "p_amruta", allocationPct: 20.0 },
  { id: uid(), dealId: "d10", roleKey: "sr_seo_analyst", personId: "p_saurabh", allocationPct: 50.0 },
  // d11 - Akeyless
  { id: uid(), dealId: "d11", roleKey: "managing_editor", personId: "p_maleeha", allocationPct: 0.0 },
  { id: uid(), dealId: "d11", roleKey: "senior_editor", personId: "tbh_editor", allocationPct: 0.0 },
  { id: uid(), dealId: "d11", roleKey: "seo_leader", personId: "p_mayur", allocationPct: 10.0 },
  { id: uid(), dealId: "d11", roleKey: "seo_group_head", personId: "p_karthik", allocationPct: 15.0 },
  { id: uid(), dealId: "d11", roleKey: "sr_seo_manager", personId: "p_swati", allocationPct: 20.0 },
  { id: uid(), dealId: "d11", roleKey: "seo_manager", personId: "p_yash", allocationPct: 25.0 },
  // d12 - UseMultiplier
  { id: uid(), dealId: "d12", roleKey: "managing_editor", personId: "p_anita", allocationPct: 50.0 },
  { id: uid(), dealId: "d12", roleKey: "senior_editor", personId: "p_rashmi_s", allocationPct: 100.0 },
  { id: uid(), dealId: "d12", roleKey: "seo_leader", personId: "p_mayur", allocationPct: 15.0 },
  { id: uid(), dealId: "d12", roleKey: "seo_group_head", personId: "p_karthik", allocationPct: 15.0 },
  { id: uid(), dealId: "d12", roleKey: "sr_seo_manager", personId: "p_taral", allocationPct: 30.0 },
  // d13 - SalesHood
  { id: uid(), dealId: "d13", roleKey: "managing_editor", personId: "p_maleeha", allocationPct: 0.0 },
  { id: uid(), dealId: "d13", roleKey: "senior_editor", personId: "tbh_editor", allocationPct: 0.0 },
  { id: uid(), dealId: "d13", roleKey: "seo_leader", personId: "p_ajitesh", allocationPct: 5.0 },
  { id: uid(), dealId: "d13", roleKey: "seo_group_head", personId: "p_prithvi", allocationPct: 15.0 },
  { id: uid(), dealId: "d13", roleKey: "seo_manager", personId: "p_onkar", allocationPct: 40.0 },
  { id: uid(), dealId: "d13", roleKey: "sr_seo_analyst", personId: "p_saurabh", allocationPct: 40.0 },
  // d14 - Air India
  { id: uid(), dealId: "d14", roleKey: "managing_editor", personId: "p_pratima", allocationPct: 0.0 },
  { id: uid(), dealId: "d14", roleKey: "content_lead", personId: "p_conchita", allocationPct: 0.0 },
  { id: uid(), dealId: "d14", roleKey: "production_head", personId: "p_divya", allocationPct: 0.0 },
  { id: uid(), dealId: "d14", roleKey: "ad_video_pm", personId: "p_jyotirmoyee", allocationPct: 12.5 },
  // d15 - Justworks
  { id: uid(), dealId: "d15", roleKey: "managing_editor", personId: "p_greesma", allocationPct: 0.0 },
  { id: uid(), dealId: "d15", roleKey: "senior_editor", personId: "p_rashmi_s", allocationPct: 0.0 },
  { id: uid(), dealId: "d15", roleKey: "seo_leader", personId: "p_ajitesh", allocationPct: 3.0 },
  { id: uid(), dealId: "d15", roleKey: "seo_group_head", personId: "p_prithvi", allocationPct: 2.0 },
  { id: uid(), dealId: "d15", roleKey: "seo_manager", personId: "p_rashmi_o", allocationPct: 10.0 },
  // d16 - HUL Indulekha
  { id: uid(), dealId: "d16", roleKey: "cd_copy", personId: "p_aditya_s", allocationPct: 0.0 },
  { id: uid(), dealId: "d16", roleKey: "sr_copywriter", personId: "p_stefan", allocationPct: 5.0 },
  { id: uid(), dealId: "d16", roleKey: "sr_copywriter", personId: "p_vedaant", allocationPct: 10.0 },
  { id: uid(), dealId: "d16", roleKey: "sr_cd_art", personId: "p_janhavi", allocationPct: 7.5 },
  { id: uid(), dealId: "d16", roleKey: "acd_art", personId: "p_viraj", allocationPct: 5.0 },
  { id: uid(), dealId: "d16", roleKey: "sr_designer", personId: "p_ashlesh", allocationPct: 12.5 },
  { id: uid(), dealId: "d16", roleKey: "sr_designer", personId: "p_aniket", allocationPct: 12.5 },
  { id: uid(), dealId: "d16", roleKey: "video_editor_2", personId: "p_vinaya", allocationPct: 2.0 },
  // d17 - Persistent Podcasts
  { id: uid(), dealId: "d17", roleKey: "ad_video_pm", personId: "p_jyotirmoyee", allocationPct: 0.0 },
  { id: uid(), dealId: "d17", roleKey: "video_pm", personId: "p_geet", allocationPct: 6.25 },
  // d18 - Youlry
  { id: uid(), dealId: "d18", roleKey: "strategy_acd", personId: "p_avantika", allocationPct: 5.0 },
  { id: uid(), dealId: "d18", roleKey: "cd_copy", personId: "p_aditya_s", allocationPct: 0.0 },
  { id: uid(), dealId: "d18", roleKey: "acd_copy", personId: "p_viwanshu", allocationPct: 0.0 },
  { id: uid(), dealId: "d18", roleKey: "sr_cd_art", personId: "p_janhavi", allocationPct: 0.0 },
  { id: uid(), dealId: "d18", roleKey: "art_director", personId: "p_mukul", allocationPct: 6.25 },
  { id: uid(), dealId: "d18", roleKey: "art_director", personId: "p_nishant", allocationPct: 25.0 },
  { id: uid(), dealId: "d18", roleKey: "video_editor_1", personId: "p_krisha", allocationPct: 75.0 },
  // d19 - Observe.ai
  { id: uid(), dealId: "d19", roleKey: "managing_editor", personId: "p_maleeha", allocationPct: 0.0 },
  { id: uid(), dealId: "d19", roleKey: "senior_editor", personId: "tbh_editor", allocationPct: 0.0 },
  // d20 - PhonePe Share.Market
  { id: uid(), dealId: "d20", roleKey: "art_director", personId: "p_mukul", allocationPct: 1.25 },
  { id: uid(), dealId: "d20", roleKey: "art_director", personId: "p_nishant", allocationPct: 1.25 },
  { id: uid(), dealId: "d20", roleKey: "jr_designer", personId: "p_siddharth", allocationPct: 6.25 },
];

// Generate auto-assignments for all deals without manual assignments
const autoAssignments = generateAutoAssignments(ALL_DEALS, DEFAULT_PEOPLE);
export const DEFAULT_ASSIGNMENTS: StaffingAssignment[] = [...MANUAL_ASSIGNMENTS, ...autoAssignments];
