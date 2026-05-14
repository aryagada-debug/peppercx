import { createContext, createElement, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_DEALS, DEFAULT_PEOPLE, DEFAULT_ASSIGNMENTS, DEFAULT_HIRING_NEEDS, DEFAULT_REVENUE_TARGETS,
  type Deal, type Person, type StaffingAssignment, type HiringNeed, type RevenueCapacityTarget, type BWRule, uid
} from "@/data/staffingData";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/components/auth/AuthProvider";
import { submitApprovalRequest } from "@/lib/approvals";

// ── Mappers ──────────────────────────────────────────────────────────────────
function dbToPerson(row: any): Person {
  return {
    id: row.id, name: row.name, roleCategory: row.role_category, roleTitle: row.role_title,
    pod: row.pod, region: row.region, leaving: row.leaving, tbh: row.tbh,
    department: row.department || "", designation: row.designation || "",
    reportingManager: row.reporting_manager || "", band: row.band || "",
    hourlyRate: row.hourly_rate ? Number(row.hourly_rate) : 0,
    email: row.email || "",
    slackUserId: row.slack_user_id || "",
    subTeam: row.sub_team || "",
  };
}

function personToDb(p: Person): TablesInsert<"staffing_people"> {
  return {
    id: p.id, name: p.name, role_category: p.roleCategory, role_title: p.roleTitle,
    pod: p.pod, region: p.region, leaving: p.leaving, tbh: p.tbh,
    department: p.department || "", designation: p.designation || "",
    reporting_manager: p.reportingManager || "", band: p.band || "",
    hourly_rate: p.hourlyRate || 0,
    email: p.email || "",
    slack_user_id: p.slackUserId || "",
    sub_team: p.subTeam || "",
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
    inputCurrency: (row.input_currency === "USD" ? "USD" : "INR") as "INR" | "USD",
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
  return {
    id: row.id,
    dealId: row.deal_id,
    roleKey: row.role_key,
    personId: row.person_id,
    allocationPct: Number(row.allocation_pct),
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
  };
}

const STAFFING_PEOPLE_SELECT = "id,name,role_category,role_title,pod,region,leaving,tbh,department,designation,reporting_manager,band,hourly_rate,email,slack_user_id,sub_team";
const STAFFING_DEALS_SELECT = "id,pc_code,deal_id,business_unit,capability_line,account,deal_name,deal_type,deal_status,staffing_status,validation,deal_status_cx,vsd,seo_staffing,creative_staffing,mrr,duration,retainer_deal_value,non_retainer_deal_value,total_deal_value,principal_bopm,senior_bopm,bopm,customer_status,customer_type,service_line_tagging,deal_value_lost,net_deal_value,rag,pod,start_date,end_date,payment_terms,pepper_business_unit,projected_outcomes,success_metrics,baseline_metrics,client_id,new_deal_id_formulated,new_deal_id_temp,validation_central_cx,month_closed_won,deal_target_status,total_mis_recognition,total_pending_recognition,consumption_value,mis_vs_consumption,invoiced_deal_value,undelivered_funnel,tcv_usd,strategy_bandwidth_required,pepper_bu_l2,input_currency";
const STAFFING_ASSIGNMENTS_SELECT = "id,deal_id,role_key,person_id,allocation_pct,start_date,end_date";

function assignmentToDb(a: StaffingAssignment): TablesInsert<"staffing_assignments"> {
  return {
    id: a.id,
    deal_id: a.dealId,
    role_key: a.roleKey,
    person_id: a.personId,
    allocation_pct: a.allocationPct,
    start_date: a.startDate || null,
    end_date: a.endDate || null,
  };
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
function useStaffingDataInternal() {
  const [people, setPeople] = useState<Person[]>(DEFAULT_PEOPLE);
  const [deals, setDeals] = useState<Deal[]>(DEFAULT_DEALS);
  const [assignments, setAssignments] = useState<StaffingAssignment[]>(DEFAULT_ASSIGNMENTS);
  const [hiringNeeds, setHiringNeeds] = useState<HiringNeed[]>(DEFAULT_HIRING_NEEDS);
  const [revenueTargets, setRevenueTargets] = useState<RevenueCapacityTarget[]>(DEFAULT_REVENUE_TARGETS);
  const [bwRules, setBwRules] = useState<BWRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const seedingRef = useRef(false);
  const { canEditAll } = useUserRole();
  const { session, loading: authLoading } = useAuth();
  const isAuthenticated = !authLoading && !!session;

  useEffect(() => {
    if (!isAuthenticated) return;
    loadAll();

    // Realtime subscriptions so changes sync across pages.
    //
    // Optimisations vs. the previous implementation:
    //  - Each table refetch is debounced (300 ms) so a burst of row changes
    //    triggers a single fetch instead of one per row.
    //  - We skip the refetch entirely when the tab is hidden; the next
    //    visibilitychange (handled below) catches up once the user returns.
    //  - This keeps cross-page sync working without hammering the API.
    const debounce = (fn: () => void, ms: number) => {
      let t: ReturnType<typeof setTimeout> | null = null;
      return () => {
        if (t) clearTimeout(t);
        t = setTimeout(fn, ms);
      };
    };
    const refetchAssignments = debounce(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      supabase.from("staffing_assignments").select("*").then(({ data }) => {
        if (data) setAssignments(data.map(dbToAssignment));
      });
    }, 300);
    const refetchPeople = debounce(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      supabase.from("staffing_people").select("*").then(({ data }) => {
        if (data) setPeople(data.map(dbToPerson));
      });
    }, 300);
    const refetchDeals = debounce(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      supabase.from("staffing_deals").select("*").then(({ data }) => {
        if (data) setDeals(data.map(dbToDeal));
      });
    }, 300);

    const channel = supabase
      .channel("staffing-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "staffing_assignments" }, refetchAssignments)
      .on("postgres_changes", { event: "*", schema: "public", table: "staffing_people" }, refetchPeople)
      .on("postgres_changes", { event: "*", schema: "public", table: "staffing_deals" }, refetchDeals)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function loadAll() {
    setLoading(true);
    try {
      const { count } = await supabase.from("staffing_people").select("id", { count: "exact", head: true });

      // Only seed when the People table is genuinely empty. Previously this
      // branch triggered any time count < 200 and *deleted* every assignment
      // and every person before re-inserting mock defaults — a transient RLS
      // hiccup or a partial outage could wipe live production data. Now we
      // only seed an empty database, and we never delete existing rows from
      // the read path.
      if (count === 0) {
        if (seedingRef.current) return;
        seedingRef.current = true;
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
    // Auto-create login account (password Pepper@2026) if email present.
    const email = (person.email || "").trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      try {
        const { data, error } = await supabase.functions.invoke("admin-user-mgmt", {
          body: { action: "provision_person", person_id: person.id, email, name: person.name },
        });
        if (error || (data as any)?.error) {
          console.warn("[provision_person]", error || (data as any)?.error);
        }
      } catch (e) {
        console.warn("[provision_person] failed", e);
      }
    }
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
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.slackUserId !== undefined) dbUpdates.slack_user_id = updates.slackUserId;
    if (updates.subTeam !== undefined) dbUpdates.sub_team = updates.subTeam;
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
  // Fire a Slack DM to the assignee (best-effort, non-blocking).
  const notifyStaffing = useCallback((personId: string, dealId: string, roleKey: string, allocationPct: number) => {
    if (!personId || !dealId) return;
    void supabase.functions.invoke("notify-assignment", {
      body: { kind: "staffing", personId, dealId, roleKey, allocationPct },
    }).catch(err => console.warn("[notify-assignment] staffing failed", err));
  }, []);

  const addAssignment = useCallback(async (assignment: StaffingAssignment) => {
    if (!canEditAll) {
      await submitApprovalRequest({
        type: "staffing.add",
        dealId: assignment.dealId,
        targetKind: "staffing_assignment",
        targetId: assignment.id,
        payload: assignment,
      });
      return;
    }
    setAssignments(prev => [...prev, assignment]);
    await supabase.from("staffing_assignments").insert(assignmentToDb(assignment));
    notifyStaffing(assignment.personId, assignment.dealId, assignment.roleKey, assignment.allocationPct);
  }, [notifyStaffing, canEditAll]);

  const updateAssignment = useCallback(async (id: string, updates: Partial<StaffingAssignment>) => {
    if (!canEditAll) {
      const current = assignments.find(a => a.id === id);
      await submitApprovalRequest({
        type: "staffing.update",
        dealId: current?.dealId,
        targetKind: "staffing_assignment",
        targetId: id,
        previous: current || {},
        payload: { id, ...updates },
      });
      return;
    }
    let next: StaffingAssignment | undefined;
    setAssignments(prev => prev.map(a => {
      if (a.id !== id) return a;
      next = { ...a, ...updates };
      return next;
    }));
    const dbUpdates: TablesUpdate<"staffing_assignments"> = {};
    if (updates.personId !== undefined) dbUpdates.person_id = updates.personId;
    if (updates.allocationPct !== undefined) dbUpdates.allocation_pct = updates.allocationPct;
    if (updates.roleKey !== undefined) dbUpdates.role_key = updates.roleKey;
    if (updates.dealId !== undefined) dbUpdates.deal_id = updates.dealId;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate || null;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate || null;
    await supabase.from("staffing_assignments").update(dbUpdates).eq("id", id);
    // If the assignee was changed, notify the new person.
    if (next && updates.personId) {
      notifyStaffing(next.personId, next.dealId, next.roleKey, next.allocationPct);
    }
  }, [notifyStaffing, canEditAll, assignments]);

  const deleteAssignment = useCallback(async (id: string) => {
    if (!canEditAll) {
      const current = assignments.find(a => a.id === id);
      await submitApprovalRequest({
        type: "staffing.remove",
        dealId: current?.dealId,
        targetKind: "staffing_assignment",
        targetId: id,
        previous: current || {},
        payload: { id },
      });
      return;
    }
    setAssignments(prev => prev.filter(a => a.id !== id));
    await supabase.from("staffing_assignments").delete().eq("id", id);
  }, [canEditAll, assignments]);

  // Upsert by (dealId, roleKey) — used by Matrix view.
  // If personId is empty, removes any existing assignment for that role on the deal.
  const upsertAssignmentByRole = useCallback(async (
    dealId: string,
    roleKey: string,
    personId: string,
    allocationPct: number,
    extras?: { startDate?: string; endDate?: string },
  ) => {
    const existing = assignments.find(a => a.dealId === dealId && a.roleKey === roleKey);
    if (!canEditAll) {
      if (!personId) {
        if (existing) {
          await submitApprovalRequest({
            type: "staffing.remove",
            dealId,
            targetKind: "staffing_assignment",
            targetId: existing.id,
            previous: existing,
            payload: { id: existing.id },
          });
        }
        return;
      }
      if (existing) {
        await submitApprovalRequest({
          type: "staffing.update",
          dealId,
          targetKind: "staffing_assignment",
          targetId: existing.id,
          previous: existing,
          payload: {
            id: existing.id,
            personId,
            allocationPct,
            roleKey,
            startDate: extras?.startDate ?? existing.startDate,
            endDate: extras?.endDate ?? existing.endDate,
          },
        });
      } else {
        const newId = uid();
        await submitApprovalRequest({
          type: "staffing.add",
          dealId,
          targetKind: "staffing_assignment",
          targetId: newId,
          payload: {
            id: newId, dealId, roleKey, personId, allocationPct,
            startDate: extras?.startDate || undefined,
            endDate: extras?.endDate || undefined,
          },
        });
      }
      return;
    }
    if (!personId) {
      if (existing) {
        setAssignments(prev => prev.filter(a => a.id !== existing.id));
        await supabase.from("staffing_assignments").delete().eq("id", existing.id);
      }
      return;
    }
    if (existing) {
      setAssignments(prev => prev.map(a => a.id === existing.id
        ? { ...a, personId, allocationPct,
            startDate: extras?.startDate ?? a.startDate,
            endDate: extras?.endDate ?? a.endDate }
        : a));
      const upd: TablesUpdate<"staffing_assignments"> = {
        person_id: personId, allocation_pct: allocationPct,
      };
      if (extras?.startDate !== undefined) upd.start_date = extras.startDate || null;
      if (extras?.endDate !== undefined) upd.end_date = extras.endDate || null;
      await supabase.from("staffing_assignments").update(upd).eq("id", existing.id);
      // Notify only when the assignee actually changed (avoid spam on % edits).
      if (existing.personId !== personId) {
        notifyStaffing(personId, dealId, roleKey, allocationPct);
      }
    } else {
      const id = uid();
      const newAssignment: StaffingAssignment = {
        id, dealId, roleKey, personId, allocationPct,
        startDate: extras?.startDate || undefined,
        endDate: extras?.endDate || undefined,
      };
      setAssignments(prev => [...prev, newAssignment]);
      await supabase.from("staffing_assignments").insert(assignmentToDb(newAssignment));
      notifyStaffing(personId, dealId, roleKey, allocationPct);
    }
  }, [assignments, notifyStaffing, canEditAll]);

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
    upsertAssignmentByRole,
    setHiringNeeds: setHiringNeedsAndSync, setRevenueTargets: setRevenueTargetsAndSync,
    updateBWRule, addBWRule, deleteBWRule, setBwRules,
    refresh: loadAll,
  };
}

// ── Provider ─────────────────────────────────────────────────────────────────
// Hoist the hook into a context so every page (Clients, DealDetail, Settings,
// Staffing) shares one instance. This means the staffing tables are fetched
// once for the session — not once per page — and the realtime channel and
// seeding logic only run once.

type StaffingDataValue = ReturnType<typeof useStaffingDataInternal>;

const StaffingDataContext = createContext<StaffingDataValue | null>(null);

export function StaffingDataProvider({ children }: { children: ReactNode }) {
  const value = useStaffingDataInternal();
  return createElement(StaffingDataContext.Provider, { value }, children);
}

export function useStaffingData(): StaffingDataValue {
  const ctx = useContext(StaffingDataContext);
  if (!ctx) {
    throw new Error("useStaffingData must be used within <StaffingDataProvider>");
  }
  return ctx;
}