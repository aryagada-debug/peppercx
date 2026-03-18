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
}

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

// ── Role-to-People Filter Mapping ───────────────────────────────────────────
// Maps each roleKey to the compatible roleTitle values for dropdown filtering
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
  // ── Operations: VSDs ──
  { id: "p_aamir", name: "Aamir Khan", roleCategory: "Operations", roleTitle: "VSD", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_aditya_shaw", name: "Aditya Shaw", roleCategory: "Operations", roleTitle: "VSD", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_neema", name: "Neema Jayadas", roleCategory: "Operations", roleTitle: "VSD", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_sneha", name: "Sneha Iyer", roleCategory: "Operations", roleTitle: "VSD", pod: "Sneha", region: "India", leaving: false, tbh: false },
  { id: "p_sumit", name: "Sumit Shekhawat", roleCategory: "Operations", roleTitle: "VSD", pod: "Sumit", region: "India", leaving: false, tbh: false },
  // ── Operations: Principal BOPMs ──
  { id: "p_anita_bopm", name: "Anita Raghav", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_atharva", name: "Atharva Thorve", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_rableen", name: "Rableen Kaur", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_harpreet", name: "Harpreet Kapoor", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_sumitha", name: "Sumitha Shetty", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_sushmita_b", name: "Sushmita B.", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_tushar", name: "Tushar Walia", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_nishtha_bopm", name: "Nishtha Kanal", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_ritu", name: "Ritu Shinde", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_romario", name: "Romario Fernandes", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_vrusha", name: "Vrusha Mawani", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_shreshtha", name: "Shreshtha Phatak", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_devanshi", name: "Devanshi Panibhate", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_eshika_bopm", name: "Eshika Joshi", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_ajitesh_bopm", name: "Ajitesh Pandey", roleCategory: "Operations", roleTitle: "Principal BOPM", pod: "Neema", region: "US", leaving: false, tbh: false },
  // ── Operations: Senior BOPMs ──
  { id: "p_anisha", name: "Anisha Jaisinghani", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_ayushi", name: "Ayushi Das", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_disha_s", name: "Disha Suratwala", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_janhavi_t", name: "Janhavi Trivedi", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_karna", name: "Karna Shah", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_maleeha_sr", name: "Maleeha Mukhtar", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_rahul_s", name: "Rahul Singh", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_rishabh", name: "Rishabh Agarwal", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_tiffany", name: "Tiffany Fernandes", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_vanshika", name: "Vanshika Khandelia", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_venkatesh", name: "Venkatesh Durgam", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_vivek_t", name: "Vivek Teotia", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_mitchelle_sr", name: "Mitchelle", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_sanchit_sr", name: "Sanchit Arora", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_nivedita", name: "Nivedita Shetty", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_preet", name: "Preet Desai", roleCategory: "Operations", roleTitle: "Senior BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false },
  // ── Operations: BOPMs ──
  { id: "p_aman", name: "Aman Jain", roleCategory: "Operations", roleTitle: "BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_anshika", name: "Anshika Sharma", roleCategory: "Operations", roleTitle: "BOPM", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_chaitanya", name: "Chaitanya Sharma", roleCategory: "Operations", roleTitle: "BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_disha_b", name: "Disha Bhanushali", roleCategory: "Operations", roleTitle: "BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_eshika_b", name: "Eshika Joshi", roleCategory: "Operations", roleTitle: "BOPM", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_hasan", name: "Hasan Kothawalaa", roleCategory: "Operations", roleTitle: "BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_jeneel", name: "Jeneel Narodia", roleCategory: "Operations", roleTitle: "BOPM", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_karishma", name: "Karishma Sawlani", roleCategory: "Operations", roleTitle: "BOPM", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_khushi", name: "Khushi Rajpurohit", roleCategory: "Operations", roleTitle: "BOPM", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_mansi", name: "Mansi Velani", roleCategory: "Operations", roleTitle: "BOPM", pod: "Aamir", region: "India", leaving: false, tbh: false },
  // ── Content ──
  { id: "p_pratima", name: "Pratima K", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_greesma", name: "Greesma A P", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_pathik", name: "Pathik Bhowmik", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_gaurab", name: "Gaurab Chatterjee", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_maleeha", name: "Maleeha Mukhtar", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_nishtha", name: "Nishtha Kanal", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_anita", name: "Anita Raghav", roleCategory: "Content", roleTitle: "Managing Editor", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_conchita", name: "Conchita Fernandes", roleCategory: "Content", roleTitle: "Content Lead", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_samritha", name: "Samritha Subashraj", roleCategory: "Content", roleTitle: "Content Lead", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_jishana", name: "Jishana Balakrishnan", roleCategory: "Content", roleTitle: "Content Lead", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_afshaan", name: "Afshaan Khan", roleCategory: "Content", roleTitle: "Content Lead", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_mitchelle", name: "Mitchelle Joseph", roleCategory: "Content", roleTitle: "Content Lead", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_varsha", name: "Varsha Madagouni", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_mamta", name: "Mamta Thatte", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_rashmi_s", name: "Rashmi Sharma", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_nikita", name: "Nikita Banerjee", roleCategory: "Content", roleTitle: "Senior Editor", pod: "Aditya", region: "India", leaving: false, tbh: false },
  // SEO
  { id: "p_ajitesh", name: "Ajitesh Pandey", roleCategory: "SEO", roleTitle: "SEO Leader", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_vedanga", name: "Vedanga Bandyopadhyay", roleCategory: "SEO", roleTitle: "SEO Leader", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_mayur", name: "Mayur Varade", roleCategory: "SEO", roleTitle: "SEO Leader", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_prithvi", name: "Prithvi Pujari", roleCategory: "SEO", roleTitle: "Group Head", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_karthik", name: "Karthik Nair", roleCategory: "SEO", roleTitle: "Group Head", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_sushmita", name: "Sushmita Balasubramanian", roleCategory: "SEO", roleTitle: "Group Head", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_rewati", name: "Rewati Khare", roleCategory: "SEO", roleTitle: "Group Head", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_amruta", name: "Amruta Khemnar", roleCategory: "SEO", roleTitle: "Group Head", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_swati", name: "Swati Bhingardeve", roleCategory: "SEO", roleTitle: "Sr. SEO Manager", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_prashant", name: "Prashant Singh", roleCategory: "SEO", roleTitle: "Sr. SEO Manager", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_taral", name: "Taral Patel", roleCategory: "SEO", roleTitle: "Sr. SEO Manager", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_rashmi_o", name: "Rashmi Oza", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_yash", name: "Yash Chaudhari", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_saurabh", name: "Saurabh Shinde", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_karan", name: "Karan Shah", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_prashant_r", name: "Prashant Singh Rawat", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_dharmik", name: "Dharmik", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_mit", name: "Mit Thakkar", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_onkar", name: "Onkar Gumdel", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_justin", name: "Justin Creado", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "Neema", region: "US", leaving: false, tbh: false },
  // Creative Strategy
  { id: "p_nikhil", name: "Nikhil Somani", roleCategory: "Creative Strategy", roleTitle: "Strategy CD", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_avantika", name: "Avantika Jain", roleCategory: "Creative Strategy", roleTitle: "Strategy ACD", pod: "Creative", region: "India", leaving: false, tbh: false },
  // Creative Copy
  { id: "p_aditya_s", name: "Aditya Satarkar", roleCategory: "Creative Copy", roleTitle: "CD - Copy", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_viwanshu", name: "Viwanshu Vaibhaw", roleCategory: "Creative Copy", roleTitle: "ACD - Copy", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_stefan", name: "Stefan Amanna", roleCategory: "Creative Copy", roleTitle: "Sr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_vedaant", name: "Vedaant Dutt", roleCategory: "Creative Copy", roleTitle: "Sr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_aditya_p", name: "Aditya Pathak", roleCategory: "Creative Copy", roleTitle: "Jr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false },
  // Creative Art
  { id: "p_janhavi", name: "Janhavi Dave", roleCategory: "Creative Art", roleTitle: "Sr. CD - Art", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_viraj", name: "Viraj Ghodgaonkar", roleCategory: "Creative Art", roleTitle: "ACD - Art", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_mukul", name: "Mukul Bhatkhande", roleCategory: "Creative Art", roleTitle: "Art Director", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_nishant", name: "Nishant Dhuriya", roleCategory: "Creative Art", roleTitle: "Art Director", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_ashlesh", name: "Ashlesh Patil", roleCategory: "Creative Art", roleTitle: "Sr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_neha", name: "Neha Patel", roleCategory: "Creative Art", roleTitle: "Sr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_seanna", name: "Seanna Dsouza", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_aniket", name: "Aniket More", roleCategory: "Creative Art", roleTitle: "Sr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_siddharth", name: "Siddharth Kedar", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  // Video
  { id: "p_divya", name: "Divya Ganpathy", roleCategory: "Video", roleTitle: "Production Head", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_jyotirmoyee", name: "Jyotirmoyee Ghosh", roleCategory: "Video", roleTitle: "AD - Video PM", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_geet", name: "Geet Gangwani", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_shubham", name: "Shubham Hadkar", roleCategory: "Video", roleTitle: "Video Editor 1", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_vedanti", name: "Vedanti Ghuikhedkar", roleCategory: "Video", roleTitle: "Video PM/ACP", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_krisha", name: "Krisha Mehta", roleCategory: "Video", roleTitle: "Video Editor 1", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_vinaya", name: "Vinaya C", roleCategory: "Video", roleTitle: "Video Editor 2", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_rahul_r", name: "Rahul Rajeev", roleCategory: "Video", roleTitle: "Video Editor 1", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_shanmathy", name: "Shanmathy Chackravarthi", roleCategory: "Video", roleTitle: "Video Editor 2", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_samruddha", name: "Samruddha Kulkarni", roleCategory: "Video", roleTitle: "Video Editor 2", pod: "Creative", region: "India", leaving: false, tbh: false },
  // Performance & Growth
  { id: "p_sanchit", name: "Sanchit Arora", roleCategory: "Performance & Growth", roleTitle: "Performance & Growth", pod: "Growth", region: "India", leaving: false, tbh: false },
  { id: "p_snigdha", name: "Snigdha Parasrampuria", roleCategory: "Other", roleTitle: "Influencer Team", pod: "Creative", region: "India", leaving: false, tbh: false },
  // ── Additional SEO people ──
  { id: "p_vaibhav_s", name: "Vaibhav Sawant", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_manav", name: "Manav Shah", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_sanket", name: "Sanket Mahure", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_vivek_c", name: "Vivek Chaudhary", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "Aamir", region: "India", leaving: false, tbh: false },
  { id: "p_shahid", name: "Shahid Anwar", roleCategory: "SEO", roleTitle: "Sr. SEO Manager", pod: "Neema", region: "US", leaving: false, tbh: false },
  { id: "p_nitish", name: "Nitish Singh", roleCategory: "SEO", roleTitle: "SEO Manager", pod: "Sumit", region: "India", leaving: false, tbh: false },
  { id: "p_pranav", name: "Pranav Jha", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "Aditya", region: "India", leaving: false, tbh: false },
  { id: "p_crasto", name: "Crasto Leo Raymant", roleCategory: "SEO", roleTitle: "Sr. SEO Analyst", pod: "Neema", region: "US", leaving: false, tbh: false },
  // ── Additional Creative people ──
  { id: "p_zigyasa", name: "Zigyasa Tryoon", roleCategory: "Creative Strategy", roleTitle: "Sr. Strategist", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_ansh", name: "Ansh Bhansali", roleCategory: "Creative Copy", roleTitle: "Jr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_barbie", name: "Barbie Duggal", roleCategory: "Creative Copy", roleTitle: "Sr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_pratyush", name: "Pratyush Singh", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_antara", name: "Antara Joshi", roleCategory: "Creative Art", roleTitle: "Sr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_dhruti", name: "Dhruti Lalan", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_preksha", name: "Preksha Tamra", roleCategory: "Creative Art", roleTitle: "Art Director", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_ria", name: "Ria Itagi", roleCategory: "Creative Art", roleTitle: "Sr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_ananya", name: "Ananya Goradia", roleCategory: "Creative Copy", roleTitle: "Jr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_dhwanai", name: "Dhwanai Lath", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_vinaya_c", name: "Vinaya Chindarkar", roleCategory: "Creative Art", roleTitle: "Sr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_anjali", name: "Anjali Goel", roleCategory: "Creative Copy", roleTitle: "Sr. Copywriter", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_kashish", name: "Kashish Jain", roleCategory: "Creative Art", roleTitle: "Art Director", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_nihar", name: "Nihar A Patade", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_jigar", name: "Jigar Somani", roleCategory: "Creative Art", roleTitle: "Sr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_prasad", name: "Prasad Thete", roleCategory: "Creative Art", roleTitle: "Art Director", pod: "Creative", region: "India", leaving: false, tbh: false },
  { id: "p_avnish", name: "Avnish Khandelwal", roleCategory: "Creative Art", roleTitle: "Jr. Designer", pod: "Creative", region: "India", leaving: false, tbh: false },
  // TBH
  { id: "tbh_editor", name: "TBH - Senior Editor", roleCategory: "Content", roleTitle: "Senior Editor", pod: "—", region: "—", leaving: false, tbh: true },
  { id: "tbh_seo_analyst", name: "TBH - SEO Analyst", roleCategory: "SEO", roleTitle: "SEO Analyst", pod: "—", region: "—", leaving: false, tbh: true },
];

// ── Deals Data (all deals from spreadsheet) ──────────────────────────────
import { ALL_DEALS } from "./allDeals";
export const DEFAULT_DEALS: Deal[] = ALL_DEALS;

// ── Staffing Assignments (from spreadsheet) ─────────────────────────────────
export const DEFAULT_ASSIGNMENTS: StaffingAssignment[] = [
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
