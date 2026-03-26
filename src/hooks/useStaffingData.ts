import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_DEALS, DEFAULT_PEOPLE, DEFAULT_ASSIGNMENTS, DEFAULT_HIRING_NEEDS, DEFAULT_REVENUE_TARGETS,
  type Deal, type Person, type StaffingAssignment, type HiringNeed, type RevenueCapacityTarget, uid
} from "@/data/staffingData";

// ── Mappers ──────────────────────────────────────────────────────────────────
function dbToPerson(row: any): Person {
  return {
    id: row.id, name: row.name, roleCategory: row.role_category, roleTitle: row.role_title,
    pod: row.pod, region: row.region, leaving: row.leaving, tbh: row.tbh,
    department: row.department || "", designation: row.designation || "",
    reportingManager: row.reporting_manager || "", band: row.band || "",
  };
}

function personToDb(p: Person) {
  return {
    id: p.id, name: p.name, role_category: p.roleCategory, role_title: p.roleTitle,
    pod: p.pod, region: p.region, leaving: p.leaving, tbh: p.tbh,
    department: p.department || "", designation: p.designation || "",
    reporting_manager: p.reportingManager || "", band: p.band || "",
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
  };
}

function dealToDb(d: Deal) {
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
  };
}

function dbToAssignment(row: any): StaffingAssignment {
  return { id: row.id, dealId: row.deal_id, roleKey: row.role_key, personId: row.person_id, allocationPct: Number(row.allocation_pct) };
}

function assignmentToDb(a: StaffingAssignment) {
  return { id: a.id, deal_id: a.dealId, role_key: a.roleKey, person_id: a.personId, allocation_pct: a.allocationPct };
}

function dbToHiring(row: any): HiringNeed {
  return { id: row.id, role: row.role, roleCategory: row.role_category, pod: row.pod, priority: row.priority, targetDate: row.target_date, rationale: row.rationale, status: row.status };
}

function hiringToDb(h: HiringNeed) {
  return { id: h.id, role: h.role, role_category: h.roleCategory, pod: h.pod, priority: h.priority, target_date: h.targetDate, rationale: h.rationale, status: h.status };
}

function dbToRevTarget(row: any): RevenueCapacityTarget {
  return { department: row.department, designation: row.designation, targetDealValuePerPerson: Number(row.target_deal_value_per_person) };
}

// ── Batch insert helper (Supabase limit ~1000 rows per insert) ───────────
async function batchUpsert(table: "staffing_people" | "staffing_deals" | "staffing_assignments" | "staffing_hiring_needs" | "staffing_revenue_targets", rows: Record<string, any>[], batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(table) as any).upsert(batch, { onConflict: "id" });
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
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const seedingRef = useRef(false);

  // Load from DB on mount
  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      // Check if data exists
      const { count } = await supabase.from("staffing_people").select("id", { count: "exact", head: true });
      
      if (!count || count === 0) {
        // Seed the database
        if (seedingRef.current) return;
        seedingRef.current = true;
        await seedDatabase();
        setSeeded(true);
        setLoading(false);
        return;
      }

      // Load all data in parallel
      const [pRes, dRes, aRes, hRes, rRes] = await Promise.all([
        supabase.from("staffing_people").select("*"),
        supabase.from("staffing_deals").select("*"),
        supabase.from("staffing_assignments").select("*"),
        supabase.from("staffing_hiring_needs").select("*"),
        supabase.from("staffing_revenue_targets").select("*"),
      ]);

      if (pRes.data) setPeople(pRes.data.map(dbToPerson));
      if (dRes.data) setDeals(dRes.data.map(dbToDeal));
      if (aRes.data) setAssignments(aRes.data.map(dbToAssignment));
      if (hRes.data) setHiringNeeds(hRes.data.map(dbToHiring));
      if (rRes.data) setRevenueTargets(rRes.data.map(dbToRevTarget));
    } catch (err) {
      console.error("Failed to load staffing data:", err);
    }
    setLoading(false);
  }

  async function seedDatabase() {
    console.log("Seeding staffing database...");
    
    // Seed people first (assignments reference them)
    await batchUpsert("staffing_people", DEFAULT_PEOPLE.map(personToDb));
    
    // Seed deals
    await batchUpsert("staffing_deals", DEFAULT_DEALS.map(dealToDb));
    
    // Seed assignments - filter out invalid person/deal references
    const validPersonIds = new Set(DEFAULT_PEOPLE.map(p => p.id));
    const validDealIds = new Set(DEFAULT_DEALS.map(d => d.id));
    const validAssignments = DEFAULT_ASSIGNMENTS.filter(a => validPersonIds.has(a.personId) && validDealIds.has(a.dealId));
    await batchUpsert("staffing_assignments", validAssignments.map(assignmentToDb));
    
    // Seed hiring needs
    await batchUpsert("staffing_hiring_needs", DEFAULT_HIRING_NEEDS.map(hiringToDb));
    
    // Seed revenue targets (use department+designation as composite key)
    const rtRows = DEFAULT_REVENUE_TARGETS.map(rt => ({
      id: `${rt.department}__${rt.designation}`.replace(/\s+/g, "_").toLowerCase(),
      department: rt.department,
      designation: rt.designation,
      target_deal_value_per_person: rt.targetDealValuePerPerson,
    }));
    // Revenue targets table uses UUID, so insert differently
    for (const rt of DEFAULT_REVENUE_TARGETS) {
      await supabase.from("staffing_revenue_targets").upsert({
        department: rt.department,
        designation: rt.designation,
        target_deal_value_per_person: rt.targetDealValuePerPerson,
      } as any, { onConflict: "department,designation" });
    }
    
    console.log("Seeding complete!");
    // State already has defaults, no need to re-fetch
  }

  // ── CRUD: People ──
  const addPerson = useCallback(async (person: Person) => {
    setPeople(prev => [...prev, person]);
    await supabase.from("staffing_people").insert(personToDb(person) as any);
  }, []);

  const updatePerson = useCallback(async (personId: string, updates: Partial<Person>) => {
    setPeople(prev => prev.map(p => p.id === personId ? { ...p, ...updates } : p));
    const dbUpdates: Record<string, any> = {};
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
    await supabase.from("staffing_people").update(dbUpdates).eq("id", personId);
  }, []);

  const deletePerson = useCallback(async (personId: string) => {
    setPeople(prev => prev.filter(p => p.id !== personId));
    setAssignments(prev => prev.filter(a => a.personId !== personId));
    // DB cascade handles assignment cleanup
    await supabase.from("staffing_people").delete().eq("id", personId);
  }, []);

  const bulkUpdatePeople = useCallback(async (personIds: string[], field: keyof Person, value: string) => {
    setPeople(prev => prev.map(p => personIds.includes(p.id) ? { ...p, [field]: value } : p));
    const dbField = field === "roleCategory" ? "role_category" : field === "roleTitle" ? "role_title"
      : field === "reportingManager" ? "reporting_manager" : field;
    await supabase.from("staffing_people").update({ [dbField]: value }).in("id", personIds);
  }, []);

  // ── CRUD: Assignments ──
  const addAssignment = useCallback(async (assignment: StaffingAssignment) => {
    setAssignments(prev => [...prev, assignment]);
    await supabase.from("staffing_assignments").insert(assignmentToDb(assignment) as any);
  }, []);

  const updateAssignment = useCallback(async (id: string, updates: Partial<StaffingAssignment>) => {
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    const dbUpdates: Record<string, any> = {};
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
    const dbUpdates: Record<string, any> = {};
    Object.entries(updates).forEach(([k, v]) => {
      const snakeKey = k.replace(/([A-Z])/g, "_$1").toLowerCase();
      dbUpdates[snakeKey] = v;
    });
    await supabase.from("staffing_deals").update(dbUpdates).eq("id", dealId);
  }, []);

  // ── CRUD: Hiring Needs ──
  const setHiringNeedsAndSync = useCallback(async (newNeeds: HiringNeed[]) => {
    setHiringNeeds(newNeeds);
    // Full replace: delete all then insert
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
      await supabase.from("staffing_revenue_targets").upsert({
        department: rt.department,
        designation: rt.designation,
        target_deal_value_per_person: rt.targetDealValuePerPerson,
      } as any, { onConflict: "department,designation" });
    }
  }, []);

  return {
    people, deals, assignments, hiringNeeds, revenueTargets, loading,
    // People
    addPerson, updatePerson, deletePerson, bulkUpdatePeople, setPeople,
    // Assignments
    addAssignment, updateAssignment, deleteAssignment, setAssignments,
    // Deals
    updateDeal, setDeals,
    // Hiring & Revenue
    setHiringNeeds: setHiringNeedsAndSync, setRevenueTargets: setRevenueTargetsAndSync,
    // Refresh
    refresh: loadAll,
  };
}
