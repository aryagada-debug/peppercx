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
}

export const DEPARTMENTS = [
  "Delivery Ops", "Capability - SEO Team", "Capability - Quality Team",
  "Capability - Creative Team", "Creative Strategy Team", "Content Strategy Team",
  "Capability - Video Production Team", "Marketing - Support"
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
}

// ── Hiring Plan ──────────────────────────────────────────────────────────────
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

// ── Revenue Capacity Targets (per designation within department) ──────────
export interface RevenueCapacityTarget {
  department: string;
  designation: string;
  targetDealValuePerPerson: number;
}

export const DEFAULT_REVENUE_TARGETS: RevenueCapacityTarget[] = [
  // Delivery Ops
  { department: "Delivery Ops", designation: "Vertical Service Delivery Leader", targetDealValuePerPerson: 15000000 },
  { department: "Delivery Ops", designation: "Group Account Manager", targetDealValuePerPerson: 8000000 },
  { department: "Delivery Ops", designation: "Principal Account Engagement Lead", targetDealValuePerPerson: 7000000 },
  { department: "Delivery Ops", designation: "Senior BOPM", targetDealValuePerPerson: 4000000 },
  { department: "Delivery Ops", designation: "BOPM", targetDealValuePerPerson: 2500000 },
  { department: "Delivery Ops", designation: "Junior BOPM", targetDealValuePerPerson: 1500000 },
  { department: "Delivery Ops", designation: "Operations Consultant", targetDealValuePerPerson: 1000000 },
  // SEO
  { department: "Capability - SEO Team", designation: "SEO - Practice Head", targetDealValuePerPerson: 10000000 },
  { department: "Capability - SEO Team", designation: "Group Head - SEO", targetDealValuePerPerson: 5000000 },
  { department: "Capability - SEO Team", designation: "Senior SEO Manager", targetDealValuePerPerson: 3000000 },
  { department: "Capability - SEO Team", designation: "SEO Manager", targetDealValuePerPerson: 2000000 },
  { department: "Capability - SEO Team", designation: "Senior SEO Analyst", targetDealValuePerPerson: 1500000 },
  // Content
  { department: "Capability - Quality Team", designation: "Practice Head - Editorial", targetDealValuePerPerson: 10000000 },
  { department: "Capability - Quality Team", designation: "Associate Director - Editorial", targetDealValuePerPerson: 5000000 },
  { department: "Capability - Quality Team", designation: "Senior Content Lead", targetDealValuePerPerson: 2500000 },
  { department: "Capability - Quality Team", designation: "Content Lead", targetDealValuePerPerson: 2000000 },
  // Content Strategy
  { department: "Content Strategy Team", designation: "Director of Content Strategy", targetDealValuePerPerson: 8000000 },
  { department: "Content Strategy Team", designation: "Senior Manager - Content Strategy", targetDealValuePerPerson: 4000000 },
  { department: "Content Strategy Team", designation: "Manager - Content Strategy", targetDealValuePerPerson: 2500000 },
  // Creative
  { department: "Capability - Creative Team", designation: "Senior Creative Director", targetDealValuePerPerson: 8000000 },
  { department: "Capability - Creative Team", designation: "Associate Creative Director", targetDealValuePerPerson: 5000000 },
  { department: "Capability - Creative Team", designation: "Art Director", targetDealValuePerPerson: 3000000 },
  { department: "Capability - Creative Team", designation: "Senior Copywriter", targetDealValuePerPerson: 2000000 },
  { department: "Capability - Creative Team", designation: "Graphic Designer", targetDealValuePerPerson: 1000000 },
  // Creative Strategy
  { department: "Creative Strategy Team", designation: "Creative Director - Strategy and Planning", targetDealValuePerPerson: 8000000 },
  { department: "Creative Strategy Team", designation: "Senior Creative Strategist", targetDealValuePerPerson: 4000000 },
  { department: "Creative Strategy Team", designation: "Creative Lead", targetDealValuePerPerson: 3000000 },
  // Video
  { department: "Capability - Video Production Team", designation: "Executive Producer", targetDealValuePerPerson: 5000000 },
  { department: "Capability - Video Production Team", designation: "Creative Producer", targetDealValuePerPerson: 3000000 },
  { department: "Capability - Video Production Team", designation: "Associate Creative Producer", targetDealValuePerPerson: 2000000 },
];

// ── Role Definitions ─────────────────────────────────────────────────────────
export const ROLE_SLOTS: RoleSlot[] = [
  // Operations
  { roleKey: "vsd", roleLabel: "VSD", category: "Operations" },
  { roleKey: "principal_bopm", roleLabel: "Principal BOPM", category: "Operations" },
  { roleKey: "senior_bopm", roleLabel: "Senior BOPM", category: "Operations" },
  { roleKey: "bopm", roleLabel: "BOPM", category: "Operations" },
  // Content
  { roleKey: "managing_editor", roleLabel: "Managing Editor", category: "Content" },
  { roleKey: "content_lead", roleLabel: "Content Lead", category: "Content" },
  { roleKey: "senior_editor", roleLabel: "Senior Editor", category: "Content" },
  // SEO
  { roleKey: "seo_leader", roleLabel: "SEO Leader", category: "SEO" },
  { roleKey: "seo_group_head", roleLabel: "Group Head", category: "SEO" },
  { roleKey: "sr_seo_manager", roleLabel: "Sr. SEO Manager", category: "SEO" },
  { roleKey: "seo_manager", roleLabel: "SEO Manager", category: "SEO" },
  { roleKey: "sr_seo_analyst", roleLabel: "Sr. SEO Analyst", category: "SEO" },
  { roleKey: "seo_analyst", roleLabel: "SEO Analyst", category: "SEO" },
  // Creative Strategy
  { roleKey: "strategy_cd", roleLabel: "Strategy CD", category: "Creative Strategy" },
  { roleKey: "strategy_acd", roleLabel: "Strategy ACD", category: "Creative Strategy" },
  { roleKey: "strategy_sr", roleLabel: "Sr. Strategist", category: "Creative Strategy" },
  // Creative Copy
  { roleKey: "cd_copy", roleLabel: "CD - Copy", category: "Creative Copy" },
  { roleKey: "acd_copy", roleLabel: "ACD - Copy", category: "Creative Copy" },
  { roleKey: "sr_copywriter", roleLabel: "Sr. Copywriter", category: "Creative Copy" },
  { roleKey: "jr_copywriter", roleLabel: "Jr. Copywriter", category: "Creative Copy" },
  // Creative Art
  { roleKey: "sr_cd_art", roleLabel: "Sr. CD - Art", category: "Creative Art" },
  { roleKey: "acd_art", roleLabel: "ACD - Art", category: "Creative Art" },
  { roleKey: "art_director", roleLabel: "Art Director", category: "Creative Art" },
  { roleKey: "sr_designer", roleLabel: "Sr. Designer", category: "Creative Art" },
  { roleKey: "jr_designer", roleLabel: "Jr. Designer", category: "Creative Art" },
  // Video
  { roleKey: "production_head", roleLabel: "Production Head", category: "Video" },
  { roleKey: "ad_video_pm", roleLabel: "AD - Video PM", category: "Video" },
  { roleKey: "video_pm", roleLabel: "Video PM/ACP", category: "Video" },
  { roleKey: "video_editor_1", roleLabel: "Video Editor 1", category: "Video" },
  { roleKey: "video_editor_2", roleLabel: "Video Editor 2", category: "Video" },
  // Other
  { roleKey: "influencer", roleLabel: "Influencer Team", category: "Other" },
  { roleKey: "perf_growth", roleLabel: "Performance & Growth", category: "Performance & Growth" },
];

export const ROLE_CATEGORIES: RoleCategory[] = [
  "Operations", "Content", "Content Strategy", "SEO", "Creative Strategy", "Creative Copy", "Creative Art", "Video", "Performance & Growth", "Other"
];

// ── Business Unit → Role Category Mapping ────────────────────────────────────
export const BU_ROLE_CATEGORIES: Record<string, RoleCategory[]> = {
  "Pepper Creative": ["Operations", "Creative Strategy", "Creative Copy", "Creative Art", "Video"],
  "Pepper SEO/GEO + Content": ["Operations", "Content", "SEO"],
  "Integrated": ROLE_CATEGORIES, // all categories
  "Content Studios": ["Operations", "Content", "Video"],
  "Others": ROLE_CATEGORIES, // all by default
};

export const getBUCategories = (bu: string): RoleCategory[] => {
  return BU_ROLE_CATEGORIES[bu] || ROLE_CATEGORIES;
};

// ── Role-to-People Filter Mapping ───────────────────────────────────────────
export const ROLE_TO_PEOPLE_FILTER: Record<string, string[]> = {
  vsd: ["VSD"],
  principal_bopm: ["Principal BOPM"],
  senior_bopm: ["Senior BOPM"],
  bopm: ["BOPM"],
  managing_editor: ["Managing Editor"],
  content_lead: ["Content Lead"],
  senior_editor: ["Senior Editor"],
  seo_leader: ["SEO Leader"],
  seo_group_head: ["Group Head"],
  sr_seo_manager: ["Sr. SEO Manager"],
  seo_manager: ["SEO Manager"],
  sr_seo_analyst: ["Sr. SEO Analyst"],
  seo_analyst: ["SEO Analyst"],
  strategy_cd: ["Strategy CD"],
  strategy_acd: ["Strategy ACD"],
  strategy_sr: ["Sr. Strategist"],
  cd_copy: ["CD - Copy"],
  acd_copy: ["ACD - Copy"],
  sr_copywriter: ["Sr. Copywriter"],
  jr_copywriter: ["Jr. Copywriter"],
  sr_cd_art: ["Sr. CD - Art"],
  acd_art: ["ACD - Art"],
  art_director: ["Art Director"],
  sr_designer: ["Sr. Designer"],
  jr_designer: ["Jr. Designer"],
  production_head: ["Production Head"],
  ad_video_pm: ["AD - Video PM"],
  video_pm: ["Video PM/ACP"],
  video_editor_1: ["Video Editor 1"],
  video_editor_2: ["Video Editor 2"],
  influencer: ["Influencer Team"],
  perf_growth: ["Performance & Growth"],
};

// ── Helper ───────────────────────────────────────────────────────────────────
let _uid = 0;
export const uid = () => `id_${++_uid}_${Math.random().toString(36).slice(2, 7)}`;

// ── People Data (from spreadsheet) ───────────────────────────────────────────
export const DEFAULT_PEOPLE: Person[] = [
  // ── Delivery Ops: VSDs (L6-L8) ──
  { id: "p_neema", name: "Neema Jayadas", roleCategory: "Operations", roleTitle: "VSD", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops", designation: "Vertical Service Delivery Leader", reportingManager: "Priya Berde", band: "L8" },
  { id: "p_aamir", name: "Aamir Khan", roleCategory: "Operations", roleTitle: "VSD", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Vertical Service Delivery Leader", reportingManager: "Priya Berde", band: "L7" },
  { id: "p_sumit", name: "Sumit Shekhawat", roleCategory: "Operations", roleTitle: "VSD", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Vertical Service Delivery Leader", reportingManager: "Priya Berde", band: "L6" },
  { id: "p_aditya_shaw", name: "Aditya Shaw", roleCategory: "Operations", roleTitle: "VSD", pod: "Aditya", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Vertical Service Delivery Leader", reportingManager: "Priya Berde", band: "L5" },
  { id: "p_sneha", name: "Sneha Iyer", roleCategory: "Operations", roleTitle: "VSD", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Vertical Service Delivery Leader", reportingManager: "Priya Berde", band: "L5" },

  // ── Delivery Ops: Principal BOPMs / Group Account Managers (L5) ──
  { id: "p_vrusha", name: "Vrusha Mawani", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Group Account Manager", reportingManager: "Sneha Iyer", band: "L5" },
  { id: "p_atharva", name: "Atharva Thorve", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Principal Account Engagement Lead", reportingManager: "Aditya Shaw", band: "L5" },
  { id: "p_anita_bopm", name: "Anita Raghav", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops", designation: "Principal Account Engagement Lead", reportingManager: "Neema Jayadas", band: "L5" },
  { id: "p_tushar", name: "Tushar Walia", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Principal Account Engagement Lead", reportingManager: "Aamir Khan", band: "L5" },
  { id: "p_sumitha", name: "Sumitha Shetty", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Group Account Manager", reportingManager: "Sneha Iyer", band: "L5" },
  { id: "p_rableen", name: "Rableen Kaur", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Group Account Manager", reportingManager: "Sumit Shekhawat", band: "L5" },
  { id: "p_sushmita_b", name: "Sushmita Balasubramanian", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Principal Account Engagement Lead", reportingManager: "Sumit Shekhawat", band: "L5" },
  { id: "p_nishtha_bopm", name: "Nishtha Kanal", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops", designation: "Principal Account Engagement Lead", reportingManager: "Neema Jayadas", band: "L5" },
  { id: "p_paresh", name: "Paresh Patil", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops", designation: "Principal Account Engagement Lead", reportingManager: "Neema Jayadas", band: "L5" },

  // ── Delivery Ops: Senior BOPMs (L3) ──
  { id: "p_karna", name: "Karna Shah", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Sumit Shekhawat", band: "L3" },
  { id: "p_vanshika", name: "Vanshika Khandelia", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Aamir Khan", band: "L3" },
  { id: "p_tiffany", name: "Tiffany Fernandes", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Neema Jayadas", band: "L3" },
  { id: "p_anisha", name: "Anisha Jaisinghani", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Sumit Shekhawat", band: "L3" },
  { id: "p_rishabh", name: "Rishabh Agarwal", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Sumit Shekhawat", band: "L3" },
  { id: "p_rahul_s", name: "Rahul Singh", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Aamir Khan", band: "L3" },
  { id: "p_ketaki", name: "Ketaki Risbud", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Neema Jayadas", band: "L3" },
  { id: "p_rachel", name: "Rachel Chadha", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Neema Jayadas", band: "L3" },
  { id: "p_venkatesh", name: "Venkatesh Durgam", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Neema Jayadas", band: "L3" },
  { id: "p_disha_s", name: "Disha Suratwala", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Aditya Shaw", band: "L3" },
  { id: "p_ayushi", name: "Ayushi Das", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Sumitha", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Sumitha Shetty", band: "L3" },
  { id: "p_maleeha_sr", name: "Maleeha Mukhtar", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Neema Jayadas", band: "L3" },
  { id: "p_shreyank", name: "Shreyank Mishra", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Aamir Khan", band: "L3" },
  { id: "p_yash_chauhan", name: "Yash Chauhan", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Aditya Shaw", band: "L3" },

  // ── Delivery Ops: BOPMs (L2) ──
  { id: "p_vivek_t", name: "Vivek Teotia", roleCategory: "Operations", roleTitle: "BOPM", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops", designation: "BOPM", reportingManager: "Neema Jayadas", band: "L2" },
  { id: "p_janhavi_t", name: "Janhavi Trivedi", roleCategory: "Operations", roleTitle: "BOPM", pod: "Sneha", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "BOPM", reportingManager: "Sneha Iyer", band: "L2" },
  { id: "p_karishma", name: "Karishma Sawlani", roleCategory: "Operations", roleTitle: "BOPM", pod: "Rableen", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "BOPM", reportingManager: "Rableen Kaur", band: "L2" },
  { id: "p_anshika", name: "Anshika Sharma", roleCategory: "Operations", roleTitle: "BOPM", pod: "Tiffany", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Junior BOPM", reportingManager: "Tiffany Fernandes", band: "L2" },
  { id: "p_disha_b", name: "Disha Bhanushali", roleCategory: "Operations", roleTitle: "BOPM", pod: "Vrusha", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "BOPM", reportingManager: "Vrusha Mawani", band: "L2" },
  { id: "p_swati_v", name: "Swati Vishwakarma", roleCategory: "Operations", roleTitle: "BOPM", pod: "Yash Chauhan", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "BOPM", reportingManager: "Yash Chauhan", band: "L2" },
  { id: "p_khushi", name: "Khushi Rajpurohit", roleCategory: "Operations", roleTitle: "BOPM", pod: "Anita", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Junior BOPM", reportingManager: "Anita Raghav", band: "L2" },
  { id: "p_risha", name: "Risha Sinha", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Senior BOPM", reportingManager: "Aditya Shaw", band: "L2" },
  { id: "p_haresh", name: "Haresh Phatak", roleCategory: "Operations", roleTitle: "BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "BOPM", reportingManager: "Sumit Shekhawat", band: "L2" },
  { id: "p_atharva_sawant", name: "Atharva Sawant", roleCategory: "Operations", roleTitle: "BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "BOPM", reportingManager: "Aditya Shaw", band: "L2" },

  // ── Delivery Ops: Junior BOPMs / Operations Consultants (L0-L1) ──
  { id: "p_aditya_shetty", name: "Aditya Shetty", roleCategory: "Operations", roleTitle: "BOPM", pod: "Neema", region: "US", leaving: false, tbh: false, department: "Delivery Ops", designation: "Junior BOPM", reportingManager: "Neema Jayadas", band: "L1" },
  { id: "p_hasan", name: "Hasan Kothawalaa", roleCategory: "Operations", roleTitle: "BOPM", pod: "Tiffany", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Junior BOPM", reportingManager: "Tiffany Fernandes", band: "L1" },
  { id: "p_sahil", name: "Sahil Singla", roleCategory: "Operations", roleTitle: "BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Junior BOPM", reportingManager: "Aamir Khan", band: "L1" },
  { id: "p_mansi", name: "Mansi Velani", roleCategory: "Operations", roleTitle: "BOPM", pod: "Karna", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Junior BOPM", reportingManager: "Karna Shah", band: "L1" },
  { id: "p_chaitanya", name: "Chaitanya Sharma", roleCategory: "Operations", roleTitle: "BOPM", pod: "Shreyank", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Operations Consultant", reportingManager: "Shreyank Mishra", band: "L1" },
  { id: "p_aman", name: "Aman Jain", roleCategory: "Operations", roleTitle: "BOPM", pod: "Vanshika", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Operations Consultant", reportingManager: "Vanshika Khandelia", band: "L1" },
  { id: "p_shourya", name: "Shourya Jain", roleCategory: "Operations", roleTitle: "BOPM", pod: "Yash Chauhan", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Project Management Intern", reportingManager: "Yash Chauhan", band: "L0" },

  // ── Capability - SEO Team ──
  { id: "p_mayur", name: "Mayur Varade", roleCategory: "SEO", roleTitle: "SEO Leader", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO - Practice Head", reportingManager: "Anirudh Singla", band: "L6" },
  { id: "p_amruta", name: "Amruta Khemnar", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Group Head - SEO", reportingManager: "Paresh Patil", band: "L4" },
  { id: "p_sanket", name: "Sanket Mahure", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Group Head - SEO", reportingManager: "Mayur Varade", band: "L4" },
  { id: "p_arvind", name: "Arvind Arivazhagan", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Group Head", reportingManager: "Mayur Varade", band: "L4" },
  { id: "p_rewati", name: "Rewati Khare", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Group Head - SEO", reportingManager: "Sushmita Balasubramanian", band: "L4" },
  { id: "p_siddesh", name: "Siddesh Bobade", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Group Head SEO - Senior Manager", reportingManager: "Sushmita Balasubramanian", band: "L4" },
  { id: "p_raahul", name: "Raahul Mungekar", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "Arvind Arivazhagan", band: "L3" },
  { id: "p_swati", name: "Swati Bhingardeve", roleCategory: "SEO", roleTitle: "Sr. SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Manager", reportingManager: "Paresh Patil", band: "L3" },
  { id: "p_taral", name: "Taral Patel", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "Paresh Patil", band: "L2" },
  { id: "p_pranali", name: "Pranali Kamble", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "Siddesh Bobade", band: "L2" },
  { id: "p_nitish", name: "Nitish Singh", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Analyst", reportingManager: "Amruta Khemnar", band: "L1" },
  { id: "p_karan_seo", name: "Karan Shah", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Analyst", reportingManager: "Rewati Khare", band: "L1" },
  { id: "p_yash_c", name: "Yash Chaudhari", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Analyst", reportingManager: "Swati Bhingardeve", band: "L1" },
  { id: "p_pranay", name: "Pranay Patil", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Analyst", reportingManager: "Amruta Khemnar", band: "L1" },
  { id: "p_sharu", name: "Sharu Paprikar", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Analyst", reportingManager: "Amruta Khemnar", band: "L1" },
  { id: "p_swarupa", name: "Swarupa Panda", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "", band: "L1" },

  // ── Capability - Quality Team (Content) ──
  { id: "p_gaurab", name: "Gaurab Chatterjee", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Practice Head - Editorial", reportingManager: "Priya Berde", band: "L6" },
  { id: "p_pratima", name: "Pratima K", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Associate Director - Editorial", reportingManager: "Gaurab Chatterjee", band: "L5" },
  { id: "p_pathik", name: "Pathik Bhowmik", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Associate Director - Editorial", reportingManager: "Gaurab Chatterjee", band: "L5" },
  { id: "p_greesma", name: "Greeshma A P", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Associate Director - Editorial", reportingManager: "Gaurab Chatterjee", band: "L5" },
  { id: "p_afshaan", name: "Afshaan Khan", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Gaurab Chatterjee", band: "L3" },
  { id: "p_jishana", name: "Jishana Balakrishnan", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Pathik Bhowmik", band: "L3" },
  { id: "p_nikita", name: "Nikita Sharma", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Gaurab Chatterjee", band: "L3" },
  { id: "p_conchita", name: "Conchita Fernandes", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Content Lead", reportingManager: "Gaurab Chatterjee", band: "L2" },
  { id: "p_sujaini", name: "Sujaini Biswas", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Content Lead", reportingManager: "Gaurab Chatterjee", band: "L2" },
  { id: "p_mitchelle", name: "Mitchelle Joseph", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Gaurab Chatterjee", band: "L2" },
  { id: "p_samritha", name: "Samritha Subashraj", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Content Lead", reportingManager: "Gaurab Chatterjee", band: "L2" },
  { id: "p_utsab", name: "Utsab Biswas", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Gaurab Chatterjee", band: "L2" },
  { id: "p_anushri", name: "Anushri Sen", roleCategory: "Content", roleTitle: "Content Lead", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Content Lead", reportingManager: "Pathik Bhowmik", band: "L2" },
  { id: "p_ramol", name: "Ramol Chandrakant Patil", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Editor Consultant", reportingManager: "Greeshma A P", band: "L2" },
  { id: "p_rashmi_s", name: "Rashmi Sharma", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Editor Consultant", reportingManager: "Anita Raghav", band: "L2" },
  { id: "p_varsha", name: "Varsha Madagouni", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Content Editor", reportingManager: "Pratima K", band: "L1" },
  { id: "p_shiny", name: "Shiny Atorthy", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Content Editor", reportingManager: "Gaurab Chatterjee", band: "L1" },
  { id: "p_mamta", name: "Mamta Thatte", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Editor Consultant", reportingManager: "", band: "L1" },
  { id: "p_molly", name: "Molly Olson", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "US", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "US Managing Editor", reportingManager: "", band: "L1" },
  { id: "p_lynne", name: "Lynne Schur", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "US", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "US Managing Editor", reportingManager: "", band: "L1" },
  { id: "p_david", name: "David Dankwa", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "US", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "US Managing Editor", reportingManager: "", band: "L1" },
  { id: "p_nikita_b", name: "Nikita Banerjee", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Quality", region: "India", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Senior Content Lead", reportingManager: "Gaurab Chatterjee", band: "L3" },
  { id: "p_sara", name: "Sara Coleman", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "US", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "US Managing Editor", reportingManager: "", band: "L1" },
  { id: "p_julia", name: "Julia Gerke", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "US", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "US Managing Editor", reportingManager: "", band: "L1" },

  // ── Content Strategy Team ──
  { id: "p_ekta", name: "Ekta Desai", roleCategory: "Content Strategy", roleTitle: "Content Strategy Director", pod: "Content Strategy", region: "India", leaving: false, tbh: false, department: "Content Strategy Team", designation: "Director of Content Strategy", reportingManager: "Paridhi Bhatiya", band: "L6" },
  { id: "p_remya", name: "Remya Scaria", roleCategory: "Content Strategy", roleTitle: "Sr. Content Strategist", pod: "Content Strategy", region: "India", leaving: false, tbh: false, department: "Content Strategy Team", designation: "Senior Manager - Content Strategy", reportingManager: "Ekta Desai", band: "L4" },
  { id: "p_saniya", name: "Saniya Zehra", roleCategory: "Content Strategy", roleTitle: "Sr. Content Strategist", pod: "Content Strategy", region: "India", leaving: false, tbh: false, department: "Content Strategy Team", designation: "Senior Manager - Content Strategy", reportingManager: "Ekta Desai", band: "L3" },
  { id: "p_shreya_shah", name: "Shreya Shah", roleCategory: "Content Strategy", roleTitle: "Content Strategist", pod: "Content Strategy", region: "India", leaving: false, tbh: false, department: "Content Strategy Team", designation: "Manager - Content Strategy", reportingManager: "Ekta Desai", band: "L3" },
  { id: "p_varun", name: "Varun Samarth", roleCategory: "Content Strategy", roleTitle: "Sr. Content Strategist", pod: "Content Strategy", region: "India", leaving: false, tbh: false, department: "Content Strategy Team", designation: "Senior Manager - Content Strategy", reportingManager: "Ekta Desai", band: "L3" },
  { id: "p_alisha", name: "Alisha Bhargavan", roleCategory: "Content Strategy", roleTitle: "Content Strategist", pod: "Content Strategy", region: "India", leaving: false, tbh: false, department: "Content Strategy Team", designation: "Content Strategist", reportingManager: "Ekta Desai", band: "L2" },
  { id: "p_sourabh_s", name: "Sourabh Suryavanshi", roleCategory: "Content Strategy", roleTitle: "Content Strategist", pod: "Content Strategy", region: "India", leaving: false, tbh: false, department: "Content Strategy Team", designation: "Manager Content Strategy", reportingManager: "Ekta Desai", band: "L2" },

  // ── Creative Strategy Team ──
  { id: "p_nikhil", name: "Nikhil Somani", roleCategory: "Creative Strategy", roleTitle: "Strategy CD", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Creative Strategy Team", designation: "Creative Director - Strategy and Planning", reportingManager: "Kishan Panpalia", band: "L5" },
  { id: "p_pratyush", name: "Pratyush Singh", roleCategory: "Creative Strategy", roleTitle: "Sr. Strategist", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Creative Strategy Team", designation: "Senior Creative Strategist", reportingManager: "Nikhil Somani", band: "L3" },
  { id: "p_barbie", name: "Barbie Duggal", roleCategory: "Creative Strategy", roleTitle: "Sr. Strategist", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Creative Strategy Team", designation: "Creative Lead", reportingManager: "Nikhil Somani", band: "L3" },
  { id: "p_ansh", name: "Ansh Bhansali", roleCategory: "Creative Strategy", roleTitle: "Strategy ACD", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Creative Strategy Team", designation: "Content Strategist", reportingManager: "Nikhil Somani", band: "L2" },
  { id: "p_zigyasa", name: "Zigyasa Tryoon", roleCategory: "Creative Strategy", roleTitle: "Sr. Strategist", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Creative Strategy Team", designation: "Creative Lead", reportingManager: "Nikhil Somani", band: "L2" },
  { id: "p_ruchika", name: "Ruchika Sharma", roleCategory: "Creative Strategy", roleTitle: "Strategy ACD", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Creative Strategy Team", designation: "Creative Strategist", reportingManager: "Nikhil Somani", band: "L2" },
  { id: "p_shreyas_j", name: "Shreyas Joshi", roleCategory: "Creative Strategy", roleTitle: "Strategy ACD", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Creative Strategy Team", designation: "Creative Strategist", reportingManager: "Nikhil Somani", band: "L2" },
  { id: "p_hasti", name: "Hasti Vora", roleCategory: "Creative Strategy", roleTitle: "Strategy ACD", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Creative Strategy Team", designation: "Marketing Consultant", reportingManager: "Shabin George", band: "L1" },
  { id: "p_mahek", name: "Mahek Shah", roleCategory: "Creative Strategy", roleTitle: "Strategy ACD", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Creative Strategy Team", designation: "Marketing Consultant", reportingManager: "Shabin George", band: "L1" },

  // ── Capability - Creative Team (Art + Copy) ──
  { id: "p_viraj", name: "Viraj Ghodgaonkar", roleCategory: "Creative Art", roleTitle: "Sr. CD - Art", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Senior Creative Director", reportingManager: "Paridhi Bhatiya", band: "L6" },
  { id: "p_avantika", name: "Avantika Jain", roleCategory: "Creative Art", roleTitle: "ACD - Art", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Associate Creative Director", reportingManager: "Paridhi Bhatiya", band: "L5" },
  { id: "p_nayan", name: "Nayan Khanore", roleCategory: "Creative Art", roleTitle: "Art Director", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Art Director", reportingManager: "Archan Basu", band: "L5" },
  { id: "p_aditya_pathak", name: "Aditya Pathak", roleCategory: "Creative Copy", roleTitle: "Sr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Senior Copywriter", reportingManager: "Avantika Jain", band: "L2" },
  { id: "p_dhruti", name: "Dhruti Lalan", roleCategory: "Creative Copy", roleTitle: "Sr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Senior Copywriter", reportingManager: "Avantika Jain", band: "L2" },
  { id: "p_aniket", name: "Aniket More", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Graphic Designer", reportingManager: "Nikhil Somani", band: "L0" },
  { id: "p_janhavi_d", name: "Janhavi Dave", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Graphic Designer", reportingManager: "Ahmed Chabaria", band: "L0" },
  { id: "p_krisha", name: "Krisha Mehta", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Graphic Designer", reportingManager: "Shashwat Sood", band: "L0" },
  { id: "p_kannan", name: "Kannan S", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Graphic Designer", reportingManager: "Karan Mishra", band: "L1" },
  { id: "p_pal", name: "Pal Jain", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Graphic Designer", reportingManager: "Shabin George", band: "L0" },

  // ── Capability - Video Production Team ──
  { id: "p_jyotirmoyee", name: "Jyotirmoyee Ghosh", roleCategory: "Video", roleTitle: "AD - Video PM", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Executive Producer", reportingManager: "Sneha Iyer", band: "L3" },
  { id: "p_akshat", name: "Akshat Bhardwaj", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Associate Creative Producer", reportingManager: "Jyotirmoyee Ghosh", band: "L2" },
  { id: "p_sohini", name: "Sohini Mukherjee", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Creative Producer", reportingManager: "Sneha Iyer", band: "L2" },
  { id: "p_geet", name: "Geet Gangwani", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Creative Producer", reportingManager: "Jyotirmoyee Ghosh", band: "L2" },
  { id: "p_akshay_g", name: "Akshay Gupta", roleCategory: "Video", roleTitle: "Video Editor 1", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Copywriter", reportingManager: "Avantika Jain", band: "L1" },
  { id: "p_jigar", name: "Jigar Somani", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Associate Creative Producer", reportingManager: "Jyotirmoyee Ghosh", band: "L1" },
  { id: "p_samruddha", name: "Samruddha Kulkarni", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Associate Creative Producer", reportingManager: "Jyotirmoyee Ghosh", band: "L1" },

  // ── Other / Consultants ──
  { id: "p_ekta_h", name: "Ekta Handa", roleCategory: "Other", roleTitle: "Consultant", pod: "—", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Consultant", reportingManager: "", band: "L1" },
  { id: "p_parth", name: "Parth Pratim Bhagowati", roleCategory: "Other", roleTitle: "Consultant", pod: "—", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Consultant", reportingManager: "", band: "L1" },
  { id: "p_dhrishti", name: "Dhrishti Desai", roleCategory: "Other", roleTitle: "Marketing Support", pod: "—", region: "India", leaving: false, tbh: false, department: "Marketing - Support", designation: "Marketing Support", reportingManager: "Ahmed Chabaria", band: "L0" },

  // ── Legacy IDs for assignment compatibility ──
  { id: "p_ajitesh", name: "Ajitesh Pandey", roleCategory: "SEO", roleTitle: "SEO Leader", pod: "SEO", region: "US", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Leader", reportingManager: "", band: "L4" },
  { id: "p_vedanga", name: "Vedanga Bandyopadhyay", roleCategory: "SEO", roleTitle: "SEO Leader", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Leader", reportingManager: "", band: "L4" },
  { id: "p_prithvi", name: "Prithvi Pujari", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "US", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Group Head - SEO", reportingManager: "", band: "L4" },
  { id: "p_karthik", name: "Karthik Nair", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "US", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Group Head - SEO", reportingManager: "", band: "L4" },
  { id: "p_sushmita", name: "Sushmita B.", roleCategory: "SEO", roleTitle: "Group Head", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Group Head - SEO", reportingManager: "", band: "L4" },
  { id: "p_saurabh", name: "Saurabh Shinde", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "US", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "", band: "L2" },
  { id: "p_prashant", name: "Prashant Singh", roleCategory: "SEO", roleTitle: "Sr. SEO Manager", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Manager", reportingManager: "", band: "L3" },
  { id: "p_rashmi_o", name: "Rashmi Oza", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "US", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "", band: "L2" },
  { id: "p_yash", name: "Yash Chaudhari", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "US", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "", band: "L2" },
  { id: "p_karan", name: "Karan Shah", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Analyst", reportingManager: "", band: "L1" },
  { id: "p_prashant_r", name: "Prashant Singh Rawat", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Analyst", reportingManager: "", band: "L1" },
  { id: "p_dharmik", name: "Dharmik", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "Senior SEO Analyst", reportingManager: "", band: "L1" },
  { id: "p_mit", name: "Mit Thakkar", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "SEO", region: "India", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Analyst", reportingManager: "", band: "L1" },
  { id: "p_onkar", name: "Onkar Gumdel", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "US", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "", band: "L2" },
  { id: "p_justin", name: "Justin Creado", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "SEO", region: "US", leaving: false, tbh: false, department: "Capability - SEO Team", designation: "SEO Manager", reportingManager: "", band: "L2" },
  { id: "p_nishtha", name: "Nishtha Kanal", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "US", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Managing Editor", reportingManager: "", band: "L5" },
  { id: "p_anita", name: "Anita Raghav", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "US", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Managing Editor", reportingManager: "", band: "L5" },
  { id: "p_maleeha", name: "Maleeha Mukhtar", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Quality", region: "US", leaving: false, tbh: false, department: "Capability - Quality Team", designation: "Managing Editor", reportingManager: "", band: "L3" },
  { id: "p_aditya_s", name: "Aditya Satarkar", roleCategory: "Creative Copy", roleTitle: "CD - Copy", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Creative Director - Copy", reportingManager: "", band: "L5" },
  { id: "p_viwanshu", name: "Viwanshu Vaibhaw", roleCategory: "Creative Copy", roleTitle: "ACD - Copy", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "ACD - Copy", reportingManager: "", band: "L4" },
  { id: "p_stefan", name: "Stefan Amanna", roleCategory: "Creative Copy", roleTitle: "Sr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Senior Copywriter", reportingManager: "", band: "L3" },
  { id: "p_vedaant", name: "Vedaant Dutt", roleCategory: "Creative Copy", roleTitle: "Sr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Senior Copywriter", reportingManager: "", band: "L3" },
  { id: "p_aditya_p", name: "Aditya Pathak", roleCategory: "Creative Copy", roleTitle: "Jr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Junior Copywriter", reportingManager: "", band: "L2" },
  { id: "p_janhavi", name: "Janhavi Dave", roleCategory: "Creative Art", roleTitle: "Sr. CD - Art", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Senior Creative Director - Art", reportingManager: "", band: "L5" },
  { id: "p_mukul", name: "Mukul Bhatkhande", roleCategory: "Creative Art", roleTitle: "Art Director", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Art Director", reportingManager: "", band: "L4" },
  { id: "p_nishant", name: "Nishant Dhuriya", roleCategory: "Creative Art", roleTitle: "Art Director", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Art Director", reportingManager: "", band: "L4" },
  { id: "p_ashlesh", name: "Ashlesh Patil", roleCategory: "Creative Art", roleTitle: "Sr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Senior Designer", reportingManager: "", band: "L3" },
  { id: "p_neha", name: "Neha Patel", roleCategory: "Creative Art", roleTitle: "Sr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Senior Designer", reportingManager: "", band: "L3" },
  { id: "p_siddharth", name: "Siddharth Kedar", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Creative Team", designation: "Junior Designer", reportingManager: "", band: "L1" },
  { id: "p_divya", name: "Divya Ganpathy", roleCategory: "Video", roleTitle: "Production Head", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Production Head", reportingManager: "", band: "L5" },
  { id: "p_shubham", name: "Shubham Hadkar", roleCategory: "Video", roleTitle: "Video Editor 1", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Video Editor", reportingManager: "", band: "L2" },
  { id: "p_vedanti", name: "Vedanti Ghuikhedkar", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Video PM", reportingManager: "", band: "L2" },
  { id: "p_shanmathy", name: "Shanmathy Chackravarthi", roleCategory: "Video", roleTitle: "Video Editor 2", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Video Editor", reportingManager: "", band: "L1" },
  { id: "p_vinaya", name: "Vinaya C", roleCategory: "Video", roleTitle: "Video Editor 2", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Video Editor", reportingManager: "", band: "L1" },
  { id: "p_rahul_r", name: "Rahul Rajeev", roleCategory: "Video", roleTitle: "Video Editor 1", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Capability - Video Production Team", designation: "Video Editor", reportingManager: "", band: "L2" },
  { id: "p_snigdha", name: "Snigdha Parasrampuria", roleCategory: "Other", roleTitle: "Influencer Team", pod: "Creative", region: "India", leaving: false, tbh: false, department: "Creative Strategy Team", designation: "Influencer Team", reportingManager: "", band: "L2" },
  { id: "p_sanchit", name: "Sanchit Arora", roleCategory: "Performance & Growth", roleTitle: "Performance & Growth", pod: "Growth", region: "India", leaving: false, tbh: false, department: "Delivery Ops", designation: "Performance & Growth", reportingManager: "", band: "L3" },

  // TBH
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
