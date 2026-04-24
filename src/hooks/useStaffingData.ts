import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_DEALS, DEFAULT_PEOPLE, DEFAULT_ASSIGNMENTS, DEFAULT_HIRING_NEEDS, DEFAULT_REVENUE_TARGETS,
  type Deal, type Person, type StaffingAssignment, type HiringNeed, type RevenueCapacityTarget, type BWRule, uid
} from "@/data/staffingData";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ── Mappers ──────────────────────────────────────────────────────────────────
function dbToPerson(row: any): Person {
  return {
    id: row.id, name: row.name, roleCategory: row.role_category, roleTitle: row.role_title,
    pod: row.pod, region: row.region, leaving: row.leaving, tbh: row.tbh,
    department: row.department || "", designation: row.designation || "",
    reportingManager: row.reporting_manager || "", band: row.band || "",
    hourlyRate: row.hourly_rate ? Number(row.hourly_rate) : 0,
  };
}

function personToDb(p: Person): TablesInsert<"staffing_people"> {
  return {
    id: p.id, name: p.name, role_category: p.roleCategory, role_title: p.roleTitle,
    pod: p.pod, region: p.region, leaving: p.leaving, tbh: p.tbh,
    department: p.department || "", designation: p.designation || "",
    reporting_manager: p.reportingManager || "", band: p.band || "",
    hourly_rate: p.hourlyRate || 0,
  };
}

function dbToDeal(row: any): Deal {
  return {
    id: row.id, pcCode: row.pc_code, dealId: row.deal_id, businessUnit: row.business_unit,
    capabilityLine: row.capability_line, account: row.account, dealName: row.deal_name,
    dealType: row.deal_type, dealStatus: row.deal_status, staffingStatus: row.staffing_status,
    validation: row.validation, dealStatusCx: row.deal_status_cx, vsd: row.vsd,
    seoStaffing: row.seo_staffing, creativeStaffing: row.creative_staffing,
    mrr: row.mrr ? Number(row.mrr) : undefined, duration: row.duration || undefined,
    retainerDealValue: row.retainer_deal_value ? Number(row.retainer_deal_value) : undefined,
    nonRetainerDealValue: row.non_retainer_deal_value ? Number(row.non_retainer_deal_value) : undefined,
    totalDealValue: row.total_deal_value ? Number(row.total_deal_value) : undefined,
    principalBopm: row.principal_bopm || '', seniorBopm: row.senior_bopm || '',
    bopm: row.bopm || '', customerStatus: row.customer_status || '',
    customerType: row.customer_type || '', serviceLineTagging: row.service_line_tagging || '',
    dealValueLost: row.deal_value_lost ? Number(row.deal_value_lost) : undefined,
    netDealValue: row.net_deal_value ? Number(row.net_deal_value) : undefined,
    rag: row.rag || 'green',
    pod: row.pod || '',
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    paymentTerms: row.payment_terms || '',
    pepperBusinessUnit: row.pepper_business_unit || '',
    projectedOutcomes: row.projected_outcomes || [],
    successMetrics: row.success_metrics || [],
    baselineMetrics: row.baseline_metrics || '',
    clientId: row.client_id || undefined,
    newDealIdFormulated: row.new_deal_id_formulated || '',
    newDealIdTemp: row.new_deal_id_temp || '',
    validationCentralCx: row.validation_central_cx || '',
    monthClosedWon: row.month_closed_won || '',
    dealTargetStatus: row.deal_target_status || '',
    totalMisRecognition: row.total_mis_recognition ? Number(row.total_mis_recognition) : 0,
    totalPendingRecognition: row.total_pending_recognition ? Number(row.total_pending_recognition) : 0,
    consumptionValue: row.consumption_value ? Number(row.consumption_value) : 0,
    misVsConsumption: row.mis_vs_consumption ? Number(row.mis_vs_consumption) : 0,
    invoicedDealValue: row.invoiced_deal_value ? Number(row.invoiced_deal_value) : 0,
    undeliveredFunnel: row.undelivered_funnel ? Number(row.undelivered_funnel) : 0,
    tcvUsd: row.tcv_usd ? Number(row.tcv_usd) : 0,
    strategyBandwidthRequired: row.strategy_bandwidth_required || '',
    pepperBuL2: row.pepper_bu_l2 || '',
  };
}

function dealToDb(d: Deal): TablesInsert<"staffing_deals"> {
  return {
    id: d.id, pc_code: d.pcCode, deal_id: d.dealId, business_unit: d.businessUnit,
    capability_line: d.capabilityLine, account: d.account, deal_name: d.dealName,
    deal_type: d.dealType, deal_status: d.dealStatus, staffing_status: d.staffingStatus,
    validation: d.validation, deal_status_cx: d.dealStatusCx, vsd: d.vsd,
    seo_staffing: d.seoStaffing, creative_staffing: d.creativeStaffing,
    mrr: d.mrr ?? null, duration: d.duration ?? null,
    retainer_deal_value: d.retainerDealValue ?? null,
    non_retainer_deal_value: d.nonRetainerDealValue ?? null,
    total_deal_value: d.totalDealValue ?? null,
    principal_bopm: d.principalBopm ?? '', senior_bopm: d.seniorBopm ?? '',
    bopm: d.bopm ?? '', customer_status: d.customerStatus ?? '',
    customer_type: d.customerType ?? '', service_line_tagging: d.serviceLineTagging ?? '',
    deal_value_lost: d.dealValueLost ?? null, net_deal_value: d.netDealValue ?? null,
  };
}

function dbToAssignment(row: any): StaffingAssignment {
  return { id: row.id, dealId: row.deal_id, roleKey: row.role_key, personId: row.person_id, allocationPct: Number(row.allocation_pct) };
}

function assignmentToDb(a: StaffingAssignment): TablesInsert<"staffing_assignments"> {
  return { id: a.id, deal_id: a.dealId, role_key: a.roleKey, person_id: a.personId, allocation_pct: a.allocationPct };
}

function dbToHiring(row: any): HiringNeed {
  return { id: row.id, role: row.role, roleCategory: row.role_category, pod: row.pod, priority: row.priority, targetDate: row.target_date, rationale: row.rationale, status: row.status };
}

function hiringToDb(h: HiringNeed): TablesInsert<"staffing_hiring_needs"> {
  return { id: h.id, role: h.role, role_category: h.roleCategory, pod: h.pod, priority: h.priority, target_date: h.targetDate, rationale: h.rationale, status: h.status };
}

function dbToRevTarget(row: any): RevenueCapacityTarget {
  return { department: row.department, designation: row.designation, targetDealValuePerPerson: Number(row.target_deal_value_per_person) };
}

function dbToBWRule(row: any): BWRule {
  return {
    id: row.id, capability: row.capability, region: row.region,
    mrrTierLabel: row.mrr_tier_label, mrrMin: Number(row.mrr_min), mrrMax: Number(row.mrr_max),
    roleKey: row.role_key, recommendedPct: Number(row.recommended_pct),
  };
}

function bwRuleToDb(r: BWRule) {
  return {
    id: r.id, capability: r.capability, region: r.region,
    mrr_tier_label: r.mrrTierLabel, mrr_min: r.mrrMin, mrr_max: r.mrrMax,
    role_key: r.roleKey, recommended_pct: r.recommendedPct,
  };
}

// ── Batch insert helper ───────────
async function batchUpsert<T extends Record<string, unknown>>(table: string, rows: T[], batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await (supabase.from(table as any) as any).upsert(batch, { onConflict: "id" });
    if (error) console.error(`Seed error ${table} batch ${i}:`, error);
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useStaffingData() {
  const [people, setPeople] = useState<Person[]>(DEFAULT_PEOPLE);
  const [deals, setDeals] = useState<Deal[]>(DEFAULT_DEALS);
  const [assignments, setAssignments] = useState<StaffingAssignment[]>(DEFAULT_ASSIGNMENTS);
  const [hiringNeeds, setHiringNeeds] = useState<HiringNeed[]>(DEFAULT_HIRING_NEEDS);
  const [revenueTargets, setRevenueTargets] = useState<RevenueCapacityTarget[]>(DEFAULT_REVENUE_TARGETS);
  const [bwRules, setBwRules] = useState<BWRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const seedingRef = useRef(false);

  useEffect(() => {
    loadAll();

    // Realtime subscriptions so changes sync across pages
    const channel = supabase
      .channel("staffing-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "staffing_assignments" }, () => {
        supabase.from("staffing_assignments").select("*").then(({ data }) => {
          if (data) setAssignments(data.map(dbToAssignment));
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "staffing_people" }, () => {
        supabase.from("staffing_people").select("*").then(({ data }) => {
          if (data) setPeople(data.map(dbToPerson));
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "staffing_deals" }, () => {
        supabase.from("staffing_deals").select("*").then(({ data }) => {
          if (data) setDeals(data.map(dbToDeal));
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const { count } = await supabase.from("staffing_people").select("id", { count: "exact", head: true });
      
      // Force re-seed if count doesn't match expected (v2: 207 people = 185 sheet + 21 legacy + 2 TBH)
      const EXPECTED_MIN = 200;
      if (!count || count < EXPECTED_MIN) {
        if (seedingRef.current) return;
        seedingRef.current = true;
        // Clear old data first
        if (count && count > 0) {
          await supabase.from("staffing_assignments").delete().neq("id", "");
          await supabase.from("staffing_people").delete().neq("id", "");
        }
        await seedDatabase();
        setSeeded(true);
        setLoading(false);
        return;
      }

      const [pRes, dRes, aRes, hRes, rRes, bRes] = await Promise.all([
        supabase.from("staffing_people").select("*"),
        supabase.from("staffing_deals").select("*"),
        supabase.from("staffing_assignments").select("*"),
        supabase.from("staffing_hiring_needs").select("*"),
        supabase.from("staffing_revenue_targets").select("*"),
        supabase.from("staffing_bw_rules").select("*"),
      ]);

      if (pRes.data) setPeople(pRes.data.map(dbToPerson));
      if (dRes.data) setDeals(dRes.data.map(dbToDeal));
      if (aRes.data) setAssignments(aRes.data.map(dbToAssignment));
      if (hRes.data) setHiringNeeds(hRes.data.map(dbToHiring));
      if (rRes.data) setRevenueTargets(rRes.data.map(dbToRevTarget));
      if (bRes.data) setBwRules(bRes.data.map(dbToBWRule));
    } catch (err) {
      console.error("Failed to load staffing data:", err);
    }
    setLoading(false);
  }

  async function seedDatabase() {
    console.log("Seeding staffing database...");
    await batchUpsert("staffing_people", DEFAULT_PEOPLE.map(personToDb));
    await batchUpsert("staffing_deals", DEFAULT_DEALS.map(dealToDb));
    
    const validPersonIds = new Set(DEFAULT_PEOPLE.map(p => p.id));
    const validDealIds = new Set(DEFAULT_DEALS.map(d => d.id));
    const validAssignments = DEFAULT_ASSIGNMENTS.filter(a => validPersonIds.has(a.personId) && validDealIds.has(a.dealId));
    await batchUpsert("staffing_assignments", validAssignments.map(assignmentToDb));
    await batchUpsert("staffing_hiring_needs", DEFAULT_HIRING_NEEDS.map(hiringToDb));
    
    for (const rt of DEFAULT_REVENUE_TARGETS) {
      await (supabase.from("staffing_revenue_targets") as any).upsert({
        department: rt.department,
        designation: rt.designation,
        target_deal_value_per_person: rt.targetDealValuePerPerson,
      }, { onConflict: "department,designation" });
    }
    
    console.log("Seeding complete!");
  }

  // ── CRUD: People ──
  const addPerson = useCallback(async (person: Person) => {
    setPeople(prev => [...prev, person]);
    await supabase.from("staffing_people").insert(personToDb(person));
  }, []);

  const updatePerson = useCallback(async (personId: string, updates: Partial<Person>) => {
    setPeople(prev => prev.map(p => p.id === personId ? { ...p, ...updates } : p));
    const dbUpdates: TablesUpdate<"staffing_people"> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.roleCategory !== undefined) dbUpdates.role_category = updates.roleCategory;
    if (updates.roleTitle !== undefined) dbUpdates.role_title = updates.roleTitle;
    if (updates.pod !== undefined) dbUpdates.pod = updates.pod;
    if (updates.region !== undefined) dbUpdates.region = updates.region;
    if (updates.leaving !== undefined) dbUpdates.leaving = updates.leaving;
    if (updates.tbh !== undefined) dbUpdates.tbh = updates.tbh;
    if (updates.department !== undefined) dbUpdates.department = updates.department;
    if (updates.designation !== undefined) dbUpdates.designation = updates.designation;
    if (updates.reportingManager !== undefined) dbUpdates.reporting_manager = updates.reportingManager;
    if (updates.band !== undefined) dbUpdates.band = updates.band;
    if (updates.hourlyRate !== undefined) dbUpdates.hourly_rate = updates.hourlyRate;
    await supabase.from("staffing_people").update(dbUpdates).eq("id", personId);
  }, []);

  const deletePerson = useCallback(async (personId: string) => {
    setPeople(prev => prev.filter(p => p.id !== personId));
    setAssignments(prev => prev.filter(a => a.personId !== personId));
    await supabase.from("staffing_people").delete().eq("id", personId);
  }, []);

  const bulkUpdatePeople = useCallback(async (personIds: string[], field: keyof Person, value: string) => {
    setPeople(prev => prev.map(p => personIds.includes(p.id) ? { ...p, [field]: value } : p));
    const dbField = field === "roleCategory" ? "role_category" : field === "roleTitle" ? "role_title"
      : field === "reportingManager" ? "reporting_manager" : field;
    const updateObj: TablesUpdate<"staffing_people"> = { [dbField]: value };
    await supabase.from("staffing_people").update(updateObj).in("id", personIds);
  }, []);

  // ── CRUD: Assignments ──
  const addAssignment = useCallback(async (assignment: StaffingAssignment) => {
    setAssignments(prev => [...prev, assignment]);
    await supabase.from("staffing_assignments").insert(assignmentToDb(assignment));
  }, []);

  const updateAssignment = useCallback(async (id: string, updates: Partial<StaffingAssignment>) => {
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    const dbUpdates: TablesUpdate<"staffing_assignments"> = {};
    if (updates.personId !== undefined) dbUpdates.person_id = updates.personId;
    if (updates.allocationPct !== undefined) dbUpdates.allocation_pct = updates.allocationPct;
    if (updates.roleKey !== undefined) dbUpdates.role_key = updates.roleKey;
    if (updates.dealId !== undefined) dbUpdates.deal_id = updates.dealId;
    await supabase.from("staffing_assignments").update(dbUpdates).eq("id", id);
  }, []);

  const deleteAssignment = useCallback(async (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
    await supabase.from("staffing_assignments").delete().eq("id", id);
  }, []);

  // ── CRUD: Deals ──
  const updateDeal = useCallback(async (dealId: string, updates: Partial<Deal>) => {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, ...updates } : d));
    const dbUpdates: TablesUpdate<"staffing_deals"> = {};
    Object.entries(updates).forEach(([k, v]) => {
      const snakeKey = k.replace(/([A-Z])/g, "_$1").toLowerCase();
      (dbUpdates as any)[snakeKey] = v;
    });
    await supabase.from("staffing_deals").update(dbUpdates).eq("id", dealId);
  }, []);

  // ── CRUD: Hiring Needs ──
  const setHiringNeedsAndSync = useCallback(async (newNeeds: HiringNeed[]) => {
    setHiringNeeds(newNeeds);
    await supabase.from("staffing_hiring_needs").delete().neq("id", "");
    if (newNeeds.length > 0) {
      await batchUpsert("staffing_hiring_needs", newNeeds.map(hiringToDb));
    }
  }, []);

  // ── CRUD: Revenue Targets ──
  const setRevenueTargetsAndSync = useCallback(async (newTargets: RevenueCapacityTarget[]) => {
    setRevenueTargets(newTargets);
    await supabase.from("staffing_revenue_targets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    for (const rt of newTargets) {
      await (supabase.from("staffing_revenue_targets") as any).upsert({
        department: rt.department,
        designation: rt.designation,
        target_deal_value_per_person: rt.targetDealValuePerPerson,
      }, { onConflict: "department,designation" });
    }
  }, []);

  // ── CRUD: BW Rules ──
  const updateBWRule = useCallback(async (ruleId: string, updates: Partial<BWRule>) => {
    setBwRules(prev => prev.map(r => r.id === ruleId ? { ...r, ...updates } : r));
    const dbUpdates: Record<string, any> = {};
    if (updates.recommendedPct !== undefined) dbUpdates.recommended_pct = updates.recommendedPct;
    if (updates.capability !== undefined) dbUpdates.capability = updates.capability;
    if (updates.region !== undefined) dbUpdates.region = updates.region;
    if (updates.roleKey !== undefined) dbUpdates.role_key = updates.roleKey;
    await (supabase.from("staffing_bw_rules") as any).update(dbUpdates).eq("id", ruleId);
  }, []);

  const addBWRule = useCallback(async (rule: BWRule) => {
    setBwRules(prev => [...prev, rule]);
    await (supabase.from("staffing_bw_rules") as any).insert(bwRuleToDb(rule));
  }, []);

  const deleteBWRule = useCallback(async (ruleId: string) => {
    setBwRules(prev => prev.filter(r => r.id !== ruleId));
    await (supabase.from("staffing_bw_rules") as any).delete().eq("id", ruleId);
  }, []);

  return {
    people, deals, assignments, hiringNeeds, revenueTargets, bwRules, loading,
    addPerson, updatePerson, deletePerson, bulkUpdatePeople, setPeople,
    addAssignment, updateAssignment, deleteAssignment, setAssignments,
    updateDeal, setDeals,
    setHiringNeeds: setHiringNeedsAndSync, setRevenueTargets: setRevenueTargetsAndSync,
    updateBWRule, addBWRule, deleteBWRule, setBwRules,
    refresh: loadAll,
  };
}