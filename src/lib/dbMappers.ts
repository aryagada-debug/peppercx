/**
 * Single source of truth for `dbToX` / `xToDb` mappers used by the
 * React Query data hooks. Behavior is identical to the previously-inline
 * versions in `useStaffingData.ts`, `useDealDetail.ts`, etc. — defaults,
 * coercions, and field names match exactly.
 *
 * When in doubt: diff the output of the new mapper against the row data
 * the old hook produced. Do not "clean up" any default values; downstream
 * code depends on them.
 */
import type {
  Deal,
  Person,
  StaffingAssignment,
  HiringNeed,
  RevenueCapacityTarget,
  BWRule,
} from "@/data/staffingData";
import { normalizeRoleKey } from "@/data/staffingData";
import type { TablesInsert } from "@/integrations/supabase/types";

// ─────────────────────────────────────────────────────────────────────────────
// Select-column constants — keep in lock-step with the mappers below so a
// new column on a Person also lands in STAFFING_PEOPLE_SELECT.

export const STAFFING_PEOPLE_SELECT =
  "id,name,role_category,role_title,pod,region,leaving,tbh,department,designation,reporting_manager,band,hourly_rate,email,slack_user_id,sub_team,revenue_target_per_person,revenue_target_currency,department_id,role_type_id";

export const STAFFING_DEALS_SELECT =
  "id,pc_code,business_unit,capability_line,account,deal_name,deal_type,deal_status,staffing_status,validation,deal_status_cx,vsd,seo_staffing,creative_staffing,mrr,duration,retainer_deal_value,non_retainer_deal_value,total_deal_value,principal_bopm,senior_bopm,bopm,customer_status,customer_type,service_line_tagging,deal_value_lost,net_deal_value,rag,pod,start_date,end_date,payment_terms,pepper_business_unit,projected_outcomes,success_metrics,baseline_metrics,client_id,new_deal_id_formulated,new_deal_id_temp,validation_central_cx,month_closed_won,deal_target_status,total_mis_recognition,total_pending_recognition,consumption_value,mis_vs_consumption,invoiced_deal_value,undelivered_funnel,tcv_usd,strategy_bandwidth_required,pepper_bu_l2,input_currency,geo,staffing_locked_at,staffing_locked_by,staffing_locked_by_name";

export const STAFFING_ASSIGNMENTS_SELECT =
  "id,staffing_deal_id,role_key,person_id,allocation_pct,start_date,end_date";

// ─────────────────────────────────────────────────────────────────────────────
// People

export function dbToPerson(row: any): Person {
  return {
    id: row.id,
    name: row.name,
    roleCategory: row.role_category,
    roleTitle: row.role_title,
    pod: row.pod,
    region: row.region,
    leaving: row.leaving,
    tbh: row.tbh,
    department: row.department || "",
    designation: row.designation || "",
    reportingManager: row.reporting_manager || "",
    band: row.band || "",
    hourlyRate: row.hourly_rate ? Number(row.hourly_rate) : 0,
    email: row.email || "",
    slackUserId: row.slack_user_id || "",
    subTeam: row.sub_team || "",
    revenueTargetPerPerson: row.revenue_target_per_person ? Number(row.revenue_target_per_person) : 0,
    revenueTargetCurrency: (row.revenue_target_currency as "INR" | "USD") || "INR",
    departmentId: row.department_id ?? null,
    roleTypeId: row.role_type_id ?? null,
  };
}

export function personToDb(p: Person): TablesInsert<"staffing_people"> {
  return {
    id: p.id,
    name: p.name,
    role_category: p.roleCategory,
    role_title: p.roleTitle,
    pod: p.pod,
    region: p.region,
    leaving: p.leaving,
    tbh: p.tbh,
    department: p.department || "",
    designation: p.designation || "",
    reporting_manager: p.reportingManager || "",
    band: p.band || "",
    hourly_rate: p.hourlyRate || 0,
    email: p.email || "",
    slack_user_id: p.slackUserId || "",
    sub_team: p.subTeam || "",
    revenue_target_per_person: p.revenueTargetPerPerson || 0,
    revenue_target_currency: p.revenueTargetCurrency || "INR",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deals

export function dbToDeal(row: any): Deal {
  return {
    id: row.id,
    pcCode: row.pc_code,
    dealId: typeof row.id === "string" && row.id.startsWith("d_") ? row.id.slice(2) : (row.id || ""),
    businessUnit: row.business_unit,
    capabilityLine: row.capability_line,
    account: row.account,
    dealName: row.deal_name,
    dealType: row.deal_type,
    dealStatus: row.deal_status,
    staffingStatus: row.staffing_status,
    validation: row.validation,
    dealStatusCx: row.deal_status_cx,
    vsd: row.vsd,
    seoStaffing: row.seo_staffing,
    creativeStaffing: row.creative_staffing,
    mrr: row.mrr ? Number(row.mrr) : undefined,
    duration: row.duration || undefined,
    retainerDealValue: row.retainer_deal_value ? Number(row.retainer_deal_value) : undefined,
    nonRetainerDealValue: row.non_retainer_deal_value ? Number(row.non_retainer_deal_value) : undefined,
    totalDealValue: row.total_deal_value ? Number(row.total_deal_value) : undefined,
    principalBopm: row.principal_bopm || "",
    seniorBopm: row.senior_bopm || "",
    bopm: row.bopm || "",
    customerStatus: row.customer_status || "",
    customerType: row.customer_type || "",
    serviceLineTagging: row.service_line_tagging || "",
    dealValueLost: row.deal_value_lost ? Number(row.deal_value_lost) : undefined,
    netDealValue: row.net_deal_value ? Number(row.net_deal_value) : undefined,
    rag: row.rag || "green",
    pod: row.pod || "",
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    paymentTerms: row.payment_terms || "",
    pepperBusinessUnit: row.pepper_business_unit || "",
    projectedOutcomes: row.projected_outcomes || [],
    successMetrics: row.success_metrics || [],
    baselineMetrics: row.baseline_metrics || "",
    clientId: row.client_id || undefined,
    newDealIdFormulated: row.new_deal_id_formulated || "",
    newDealIdTemp: row.new_deal_id_temp || "",
    validationCentralCx: row.validation_central_cx || "",
    monthClosedWon: row.month_closed_won || "",
    dealTargetStatus: row.deal_target_status || "",
    totalMisRecognition: row.total_mis_recognition ? Number(row.total_mis_recognition) : 0,
    totalPendingRecognition: row.total_pending_recognition ? Number(row.total_pending_recognition) : 0,
    consumptionValue: row.consumption_value ? Number(row.consumption_value) : 0,
    misVsConsumption: row.mis_vs_consumption ? Number(row.mis_vs_consumption) : 0,
    invoicedDealValue: row.invoiced_deal_value ? Number(row.invoiced_deal_value) : 0,
    undeliveredFunnel: row.undelivered_funnel ? Number(row.undelivered_funnel) : 0,
    tcvUsd: row.tcv_usd ? Number(row.tcv_usd) : 0,
    strategyBandwidthRequired: row.strategy_bandwidth_required || "",
    pepperBuL2: row.pepper_bu_l2 || "",
    inputCurrency: (row.input_currency === "USD" ? "USD" : "INR") as "INR" | "USD",
    geo: row.geo || "",
    staffingLockedAt: row.staffing_locked_at ?? null,
    staffingLockedBy: row.staffing_locked_by ?? null,
    staffingLockedByName: row.staffing_locked_by_name || "",
  };
}

export function dealToDb(d: Deal): TablesInsert<"staffing_deals"> {
  return {
    id: d.id,
    pc_code: d.pcCode,
    business_unit: d.businessUnit,
    capability_line: d.capabilityLine,
    account: d.account,
    deal_name: d.dealName,
    deal_type: d.dealType,
    deal_status: d.dealStatus,
    staffing_status: d.staffingStatus,
    validation: d.validation,
    deal_status_cx: d.dealStatusCx,
    vsd: d.vsd,
    seo_staffing: d.seoStaffing,
    creative_staffing: d.creativeStaffing,
    mrr: d.mrr ?? null,
    duration: d.duration ?? null,
    retainer_deal_value: d.retainerDealValue ?? null,
    non_retainer_deal_value: d.nonRetainerDealValue ?? null,
    total_deal_value: d.totalDealValue ?? null,
    principal_bopm: d.principalBopm ?? "",
    senior_bopm: d.seniorBopm ?? "",
    bopm: d.bopm ?? "",
    customer_status: d.customerStatus ?? "",
    customer_type: d.customerType ?? "",
    service_line_tagging: d.serviceLineTagging ?? "",
    deal_value_lost: d.dealValueLost ?? null,
    net_deal_value: d.netDealValue ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignments

export function dbToAssignment(row: any): StaffingAssignment {
  return {
    id: row.id,
    dealId: row.staffing_deal_id,
    roleKey: normalizeRoleKey(row.role_key),
    personId: row.person_id,
    allocationPct: Number(row.allocation_pct),
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
  };
}

export function assignmentToDb(a: StaffingAssignment): TablesInsert<"staffing_assignments"> {
  return {
    id: a.id,
    staffing_deal_id: a.dealId,
    role_key: normalizeRoleKey(a.roleKey),
    person_id: a.personId,
    allocation_pct: a.allocationPct,
    start_date: a.startDate || null,
    end_date: a.endDate || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hiring needs

export function dbToHiring(row: any): HiringNeed {
  return {
    id: row.id,
    role: row.role,
    roleCategory: row.role_category,
    pod: row.pod,
    priority: row.priority,
    targetDate: row.target_date,
    rationale: row.rationale,
    status: row.status,
  };
}

export function hiringToDb(h: HiringNeed): TablesInsert<"staffing_hiring_needs"> {
  return {
    id: h.id,
    role: h.role,
    role_category: h.roleCategory,
    pod: h.pod,
    priority: h.priority,
    target_date: h.targetDate,
    rationale: h.rationale,
    status: h.status,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue targets

export function dbToRevTarget(row: any): RevenueCapacityTarget {
  return {
    department: row.department,
    designation: row.designation,
    targetDealValuePerPerson: Number(row.target_deal_value_per_person),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BW rules

export function dbToBWRule(row: any): BWRule {
  return {
    id: row.id,
    capability: row.capability,
    region: row.region,
    mrrTierLabel: row.mrr_tier_label,
    mrrMin: Number(row.mrr_min),
    mrrMax: Number(row.mrr_max),
    roleKey: row.role_key,
    recommendedPct: Number(row.recommended_pct),
  };
}

export function bwRuleToDb(r: BWRule) {
  return {
    id: r.id,
    capability: r.capability,
    region: r.region,
    mrr_tier_label: r.mrrTierLabel,
    mrr_min: r.mrrMin,
    mrr_max: r.mrrMax,
    role_key: r.roleKey,
    recommended_pct: r.recommendedPct,
  };
}