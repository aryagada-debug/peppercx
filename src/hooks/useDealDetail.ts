import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { FinancialRow } from "@/components/deals/FinancialsTab";
import type { DealTask } from "@/components/deals/TaskKanban";
import type { MBREntry, ActionItem } from "@/hooks/useMBRData";

export interface SoWItem {
  id: string;
  dealId: string;
  scope: string;
  revenueShare: number;
  teamCapability: string;
  teams: string[];
  lineItemValue: number;
}

export interface RevenueMonthly {
  id: string;
  dealId: string;
  month: string;
  mrr: number;
  contraction: number;
  delivered: number;
  invoiced: number;
  actuals: number;
}

export interface TargetMonthly {
  id: string;
  dealId: string;
  month: string;
  contractionTarget: number;
  deliveryTarget: number;
  invoicingTarget: number;
}

export interface RGYWeekly {
  id: string;
  dealId: string;
  weekStart: string;
  internal: string;
  customer: string;
  delivery: string;
  consumption: string;
  notes?: string;
  accountHealth?: string;
  financeBilling?: string;
  capabilitySeo?: string;
  capabilityCreative?: string;
  content?: string;
  seo?: string;
  supply?: string;
  copy?: string;
  design?: string;
  video?: string;
  planOfAction?: string;
  issueDate?: string;
  issueDetails?: string;
  discussedActionPlan?: string;
  actionPlan?: string;
  resolutionDueDate?: string;
  issueStatus?: string;
  createdAt?: string;
}

export interface OnboardingStep {
  id: string;
  dealId: string;
  stepName: string;
  category: string;
  owner: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  sortOrder: number;
}

export function useDealDetail(dealId: string | undefined) {
  const [sowItems, setSowItems] = useState<SoWItem[]>([]);
  const [revenue, setRevenue] = useState<RevenueMonthly[]>([]);
  const [targets, setTargets] = useState<TargetMonthly[]>([]);
  const [rgyWeekly, setRgyWeekly] = useState<RGYWeekly[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingStep[]>([]);
  const [financials, setFinancials] = useState<FinancialRow[]>([]);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [mbrEntries, setMbrEntries] = useState<MBREntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) return;
    loadAll();

    // Realtime sync for MBR entries
    const channel = supabase
      .channel(`mbr-deal-${dealId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mbr_entries", filter: `deal_id=eq.${dealId}` }, async () => {
        const { data } = await supabase.from("mbr_entries").select("*").eq("deal_id", dealId).order("week_start", { ascending: false });
        if (data) setMbrEntries(data.map((e: any) => ({
          id: e.id, dealId: e.deal_id, weekStart: e.week_start, status: e.status, mode: e.mode,
          notes: e.notes, updatedBy: e.updated_by, sentiment: e.sentiment || null,
          fathomLink: e.fathom_link || null, transcript: e.transcript || null,
          aiSummary: e.ai_summary || null, actionItems: Array.isArray(e.action_items) ? e.action_items : [],
          scheduledDate: e.scheduled_date || null, anirudhAdded: !!e.anirudh_added,
          anirudhJoining: !!e.anirudh_joining, inputRecordedAt: e.input_recorded_at || null,
          mbrPptLink: e.mbr_ppt_link || null,
        })));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dealId]);

  async function loadAll() {
    if (!dealId) return;
    setLoading(true);
    const [sow, rev, tgt, rgy, onb, fin, tsk, mbr] = await Promise.all([
      supabase.from("deal_sow_items").select("*").eq("deal_id", dealId),
      supabase.from("deal_revenue_monthly").select("*").eq("deal_id", dealId).order("month"),
      supabase.from("deal_targets_monthly").select("*").eq("deal_id", dealId).order("month"),
      supabase.from("deal_rgy_weekly").select("*").eq("deal_id", dealId).order("created_at", { ascending: false }),
      supabase.from("deal_onboarding_steps").select("*").eq("deal_id", dealId).order("sort_order"),
      supabase.from("deal_financials").select("*").eq("deal_id", dealId).order("month"),
      supabase.from("deal_tasks").select("*").eq("deal_id", dealId).order("sort_order"),
      supabase.from("mbr_entries").select("*").eq("deal_id", dealId).order("week_start", { ascending: false }),
    ]);
    if (sow.data) setSowItems(sow.data.map((r: any) => ({ id: r.id, dealId: r.deal_id, scope: r.scope, revenueShare: Number(r.revenue_share), teamCapability: r.team_capability, teams: Array.isArray(r.teams) ? r.teams : [], lineItemValue: Number(r.line_item_value || 0) })));
    if (rev.data) setRevenue(rev.data.map((r: any) => ({ id: r.id, dealId: r.deal_id, month: r.month, mrr: Number(r.mrr), contraction: Number(r.contraction), delivered: Number(r.delivered), invoiced: Number(r.invoiced), actuals: Number(r.actuals) })));
    if (tgt.data) setTargets(tgt.data.map((r: any) => ({ id: r.id, dealId: r.deal_id, month: r.month, contractionTarget: Number(r.contraction_target), deliveryTarget: Number(r.delivery_target), invoicingTarget: Number(r.invoicing_target) })));
    if (rgy.data) setRgyWeekly(rgy.data.map((r: any) => ({
      id: r.id, dealId: r.deal_id, weekStart: r.week_start, internal: r.internal, customer: r.customer,
      delivery: r.delivery, consumption: r.consumption, notes: r.notes,
      accountHealth: r.account_health || "G", financeBilling: r.finance_billing || "G",
      capabilitySeo: r.capability_seo || "G", capabilityCreative: r.capability_creative || "G",
      content: r.content || "G", seo: r.seo || "G", supply: r.supply || "G",
      copy: r.copy || "G", design: r.design || "G", video: r.video || "G",
      planOfAction: r.plan_of_action || "",
      issueDate: r.issue_date || undefined, issueDetails: r.issue_details || "",
      discussedActionPlan: r.discussed_action_plan || "", actionPlan: r.action_plan || "",
      resolutionDueDate: r.resolution_due_date || undefined, issueStatus: r.issue_status || "Open",
      createdAt: r.created_at,
    })));
    if (onb.data) setOnboarding(onb.data.map((r: any) => ({ id: r.id, dealId: r.deal_id, stepName: r.step_name, category: r.category, owner: r.owner, dueDate: r.due_date, completed: r.completed, completedAt: r.completed_at, sortOrder: r.sort_order })));
    if (fin.data) setFinancials(fin.data.map((r: any) => ({
      id: r.id, dealId: r.deal_id, month: r.month,
      contracted: Number(r.contracted), consumption: Number(r.consumption),
      plannedGmPct: Number(r.planned_gm_pct), actualGmPct: Number(r.actual_gm_pct),
      invoiced: Number(r.invoiced), received: Number(r.received), outstanding: Number(r.outstanding),
      invoiceDate: r.invoice_date, receivedDate: r.received_date, outstandingDate: r.outstanding_date,
    })));
    if (tsk.data) setTasks(tsk.data.map((r: any) => ({
      id: r.id, dealId: r.deal_id, title: r.title, description: r.description || "",
      stage: r.stage, assignee: r.assignee || "", startDate: r.start_date || undefined,
      endDate: r.end_date || undefined, urgency: r.urgency, loggedHours: Number(r.logged_hours),
      sortOrder: r.sort_order, estimatedHours: Number(r.estimated_hours || 0),
      subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
      phase: r.phase || "", tags: Array.isArray(r.tags) ? r.tags : [],
      autoRegen: !!r.auto_regen,
    })));
    if (mbr.data) setMbrEntries(mbr.data.map((e: any) => ({
      id: e.id,
      dealId: e.deal_id,
      weekStart: e.week_start,
      status: e.status,
      mode: e.mode,
      notes: e.notes,
      updatedBy: e.updated_by,
      sentiment: e.sentiment || null,
      fathomLink: e.fathom_link || null,
      transcript: e.transcript || null,
      aiSummary: e.ai_summary || null,
      actionItems: Array.isArray(e.action_items) ? e.action_items : [],
      scheduledDate: e.scheduled_date || null,
      anirudhAdded: !!e.anirudh_added,
      anirudhJoining: !!e.anirudh_joining,
      inputRecordedAt: e.input_recorded_at || null,
      mbrPptLink: e.mbr_ppt_link || null,
    })));
    setLoading(false);
  }

  // ── MBR upsert ──
  const upsertMBREntry = useCallback(async (params: {
    dealId: string;
    status: string;
    mode: string | null;
    notes: string | null;
    updatedBy: string;
    sentiment?: string | null;
    fathomLink?: string | null;
    transcript?: string | null;
    aiSummary?: string | null;
    actionItems?: ActionItem[];
    scheduledDate?: string | null;
    anirudhAdded?: boolean;
    mbrPptLink?: string | null;
  }, weekStart: string) => {
    const row: any = {
      deal_id: params.dealId,
      week_start: weekStart,
      status: params.status,
      mode: params.mode,
      notes: params.notes,
      updated_by: params.updatedBy,
    };
    if (params.sentiment !== undefined) row.sentiment = params.sentiment;
    if (params.fathomLink !== undefined) row.fathom_link = params.fathomLink;
    if (params.transcript !== undefined) row.transcript = params.transcript;
    if (params.aiSummary !== undefined) row.ai_summary = params.aiSummary;
    if (params.actionItems !== undefined) row.action_items = params.actionItems;
    if (params.scheduledDate !== undefined) row.scheduled_date = params.scheduledDate;
    if (params.anirudhAdded !== undefined) row.anirudh_added = params.anirudhAdded;
    if (params.mbrPptLink !== undefined) row.mbr_ppt_link = params.mbrPptLink;
    if (params.status === "Done") row.input_recorded_at = new Date().toISOString();

    const { data, error } = await (supabase.from("mbr_entries") as any).upsert(
      row,
      { onConflict: "deal_id,week_start" }
    ).select();

    if (!error && data?.[0]) {
      const newEntry: MBREntry = {
        id: data[0].id,
        dealId: data[0].deal_id,
        weekStart: data[0].week_start,
        status: data[0].status,
        mode: data[0].mode,
        notes: data[0].notes,
        updatedBy: data[0].updated_by,
        sentiment: data[0].sentiment || null,
        fathomLink: data[0].fathom_link || null,
        transcript: data[0].transcript || null,
        aiSummary: data[0].ai_summary || null,
        actionItems: Array.isArray(data[0].action_items) ? data[0].action_items : [],
        scheduledDate: data[0].scheduled_date || null,
        anirudhAdded: !!data[0].anirudh_added,
        anirudhJoining: !!data[0].anirudh_joining,
        inputRecordedAt: data[0].input_recorded_at || null,
        mbrPptLink: data[0].mbr_ppt_link || null,
      };
      setMbrEntries(prev => {
        const idx = prev.findIndex(e => e.weekStart === weekStart);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = newEntry;
          return updated;
        }
        return [newEntry, ...prev];
      });
    }
  }, []);

  // ── SoW CRUD ──
  const addSoWItem = useCallback(async (item: Omit<SoWItem, "id">) => {
    const { data } = await (supabase.from("deal_sow_items") as any).insert({
      deal_id: item.dealId, scope: item.scope, revenue_share: item.revenueShare,
      team_capability: item.teamCapability, teams: item.teams || [], line_item_value: item.lineItemValue || 0,
    }).select().single();
    if (data) setSowItems(prev => [...prev, { id: data.id, ...item }]);
  }, []);

  const updateSoWItem = useCallback(async (id: string, updates: Partial<SoWItem>) => {
    setSowItems(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    const db: any = {};
    if (updates.scope !== undefined) db.scope = updates.scope;
    if (updates.revenueShare !== undefined) db.revenue_share = updates.revenueShare;
    if (updates.teamCapability !== undefined) db.team_capability = updates.teamCapability;
    if (updates.teams !== undefined) db.teams = updates.teams;
    if (updates.lineItemValue !== undefined) db.line_item_value = updates.lineItemValue;
    await (supabase.from("deal_sow_items") as any).update(db).eq("id", id);
  }, []);

  const deleteSoWItem = useCallback(async (id: string) => {
    setSowItems(prev => prev.filter(s => s.id !== id));
    await supabase.from("deal_sow_items").delete().eq("id", id);
  }, []);

  // ── Onboarding ──
  const toggleOnboardingStep = useCallback(async (stepId: string) => {
    setOnboarding(prev => prev.map(s => s.id === stepId ? { ...s, completed: !s.completed, completedAt: !s.completed ? new Date().toISOString() : undefined } : s));
    const step = onboarding.find(s => s.id === stepId);
    if (step) {
      await (supabase.from("deal_onboarding_steps") as any).update({ completed: !step.completed, completed_at: !step.completed ? new Date().toISOString() : null }).eq("id", stepId);
    }
  }, [onboarding]);

  const seedOnboarding = useCallback(async (dealType: string) => {
    if (!dealId || onboarding.length > 0) return;
    const templates: Record<string, { category: string; stepName: string; owner: string }[]> = {
      Retainer: [
        { category: "Account Setup", stepName: "Create PC Code in system", owner: "Finance" },
        { category: "Account Setup", stepName: "Set up billing & invoicing", owner: "Finance" },
        { category: "Account Setup", stepName: "NDA / MSA signed & filed", owner: "Legal" },
        { category: "Account Setup", stepName: "Add client to CRM", owner: "Ops" },
        { category: "Team & Access", stepName: "Assign BOPM & team", owner: "Ops" },
        { category: "Team & Access", stepName: "Share access credentials (GA, GSC, CMS)", owner: "BOPM" },
        { category: "Team & Access", stepName: "Set up Slack channel with client", owner: "BOPM" },
        { category: "Kickoff", stepName: "Internal kickoff call", owner: "VSD" },
        { category: "Kickoff", stepName: "Client kickoff call", owner: "VSD" },
        { category: "Kickoff", stepName: "Share SOW & success metrics doc", owner: "BOPM" },
        { category: "Delivery", stepName: "Baseline audit completed", owner: "SEO" },
        { category: "Delivery", stepName: "Month 1 plan shared with client", owner: "BOPM" },
        { category: "Delivery", stepName: "First MBR scheduled", owner: "BOPM" },
      ],
      "Non-Retainer": [
        { category: "Account Setup", stepName: "Create PC Code in system", owner: "Finance" },
        { category: "Account Setup", stepName: "Set up billing & invoicing", owner: "Finance" },
        { category: "Account Setup", stepName: "Add client to CRM", owner: "Ops" },
        { category: "Team & Access", stepName: "Assign project lead", owner: "Ops" },
        { category: "Team & Access", stepName: "Share access credentials", owner: "Lead" },
        { category: "Kickoff", stepName: "Client kickoff call", owner: "VSD" },
        { category: "Kickoff", stepName: "Share project timeline & deliverables", owner: "Lead" },
        { category: "Delivery", stepName: "First deliverable milestone", owner: "Lead" },
      ],
    };
    const steps = templates[dealType] || templates["Retainer"];
    const rows = steps.map((s, i) => ({
      deal_id: dealId,
      step_name: s.stepName,
      category: s.category,
      owner: s.owner,
      sort_order: i,
      completed: false,
    }));
    const { data } = await (supabase.from("deal_onboarding_steps") as any).insert(rows).select();
    if (data) {
      setOnboarding(data.map((r: any) => ({
        id: r.id, dealId: r.deal_id, stepName: r.step_name, category: r.category,
        owner: r.owner, dueDate: r.due_date, completed: r.completed,
        completedAt: r.completed_at, sortOrder: r.sort_order,
      })));
    }
  }, [dealId, onboarding.length]);

  // ── RGY ──
  const addRGYWeek = useCallback(async (entry: Omit<RGYWeekly, "id">) => {
    const { data } = await (supabase.from("deal_rgy_weekly") as any).insert({
      deal_id: entry.dealId, week_start: entry.weekStart, internal: entry.internal,
      customer: entry.customer, delivery: entry.delivery, consumption: entry.consumption,
      notes: entry.notes, account_health: entry.accountHealth || "G",
      finance_billing: entry.financeBilling || "G", capability_seo: entry.capabilitySeo || "G",
      capability_creative: entry.capabilityCreative || "G", plan_of_action: entry.planOfAction || "",
      content: entry.content || "G", seo: entry.seo || "G", supply: entry.supply || "G",
      copy: entry.copy || "G", design: entry.design || "G", video: entry.video || "G",
      issue_date: entry.issueDate || null, issue_details: entry.issueDetails || "",
      discussed_action_plan: entry.discussedActionPlan || "", action_plan: entry.actionPlan || "",
      resolution_due_date: entry.resolutionDueDate || null, issue_status: entry.issueStatus || "Open",
    }).select().single();
    if (data) setRgyWeekly(prev => [{ id: data.id, ...entry }, ...prev]);
  }, []);

  const updateRGYWeek = useCallback(async (id: string, updates: Partial<RGYWeekly>) => {
    setRgyWeekly(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    const db: any = {};
    if (updates.accountHealth !== undefined) db.account_health = updates.accountHealth;
    if (updates.financeBilling !== undefined) db.finance_billing = updates.financeBilling;
    if (updates.capabilitySeo !== undefined) db.capability_seo = updates.capabilitySeo;
    if (updates.capabilityCreative !== undefined) db.capability_creative = updates.capabilityCreative;
    if (updates.planOfAction !== undefined) db.plan_of_action = updates.planOfAction;
    if (updates.internal !== undefined) db.internal = updates.internal;
    if (updates.customer !== undefined) db.customer = updates.customer;
    if (updates.delivery !== undefined) db.delivery = updates.delivery;
    if (updates.consumption !== undefined) db.consumption = updates.consumption;
    if (updates.content !== undefined) db.content = updates.content;
    if (updates.seo !== undefined) db.seo = updates.seo;
    if (updates.supply !== undefined) db.supply = updates.supply;
    if (updates.copy !== undefined) db.copy = updates.copy;
    if (updates.design !== undefined) db.design = updates.design;
    if (updates.video !== undefined) db.video = updates.video;
    if (updates.notes !== undefined) db.notes = updates.notes;
    if (updates.issueDate !== undefined) db.issue_date = updates.issueDate;
    if (updates.issueDetails !== undefined) db.issue_details = updates.issueDetails;
    if (updates.discussedActionPlan !== undefined) db.discussed_action_plan = updates.discussedActionPlan;
    if (updates.actionPlan !== undefined) db.action_plan = updates.actionPlan;
    if (updates.resolutionDueDate !== undefined) db.resolution_due_date = updates.resolutionDueDate;
    if (updates.issueStatus !== undefined) db.issue_status = updates.issueStatus;
    await (supabase.from("deal_rgy_weekly") as any).update(db).eq("id", id);
  }, []);

  // ── Financials CRUD ──
  const addFinancial = useCallback(async (row: Omit<FinancialRow, "id">) => {
    const { data } = await (supabase.from("deal_financials") as any).insert({
      deal_id: row.dealId, month: row.month, contracted: row.contracted,
      consumption: row.consumption, planned_gm_pct: row.plannedGmPct,
      actual_gm_pct: row.actualGmPct, invoiced: row.invoiced,
      received: row.received, outstanding: row.outstanding,
      invoice_date: row.invoiceDate || null, received_date: row.receivedDate || null,
      outstanding_date: row.outstandingDate || null,
    }).select().single();
    if (data) {
      setFinancials(prev => [...prev, {
        id: data.id, ...row,
      }].sort((a, b) => a.month.localeCompare(b.month)));
    }
  }, []);

  const updateFinancial = useCallback(async (id: string, updates: Partial<FinancialRow>) => {
    setFinancials(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    const db: any = {};
    if (updates.contracted !== undefined) db.contracted = updates.contracted;
    if (updates.consumption !== undefined) db.consumption = updates.consumption;
    if (updates.plannedGmPct !== undefined) db.planned_gm_pct = updates.plannedGmPct;
    if (updates.actualGmPct !== undefined) db.actual_gm_pct = updates.actualGmPct;
    if (updates.invoiced !== undefined) db.invoiced = updates.invoiced;
    if (updates.received !== undefined) db.received = updates.received;
    if (updates.outstanding !== undefined) db.outstanding = updates.outstanding;
    if (updates.invoiceDate !== undefined) db.invoice_date = updates.invoiceDate;
    if (updates.receivedDate !== undefined) db.received_date = updates.receivedDate;
    if (updates.outstandingDate !== undefined) db.outstanding_date = updates.outstandingDate;
    await (supabase.from("deal_financials") as any).update(db).eq("id", id);
  }, []);

  const deleteFinancial = useCallback(async (id: string) => {
    setFinancials(prev => prev.filter(f => f.id !== id));
    await supabase.from("deal_financials").delete().eq("id", id);
  }, []);

  // ── Tasks CRUD ──
  // Best-effort Slack DM to a task assignee.
  const notifyTask = (assigneeName: string | undefined, dealId: string, task: { title?: string; urgency?: string; endDate?: string }) => {
    if (!assigneeName || !assigneeName.trim() || !dealId) return;
    void supabase.functions.invoke("notify-assignment", {
      body: {
        kind: "task",
        assigneeName: assigneeName.trim(),
        dealId,
        taskTitle: task.title || "",
        taskUrgency: task.urgency || "",
        taskDueDate: task.endDate || "",
      },
    }).catch(err => console.warn("[notify-assignment] task failed", err));
  };

  const addTask = useCallback(async (task: Omit<DealTask, "id">) => {
    const { data } = await (supabase.from("deal_tasks") as any).insert({
      deal_id: task.dealId, title: task.title, description: task.description,
      stage: task.stage, assignee: task.assignee, start_date: task.startDate || null,
      end_date: task.endDate || null, urgency: task.urgency, logged_hours: task.loggedHours,
      sort_order: task.sortOrder, estimated_hours: task.estimatedHours || 0,
      subtasks: task.subtasks || [], phase: task.phase || "", tags: task.tags || [],
      auto_regen: task.autoRegen || false,
    }).select().single();
    if (data) setTasks(prev => [...prev, { id: data.id, ...task }]);
    notifyTask(task.assignee, task.dealId, { title: task.title, urgency: task.urgency, endDate: task.endDate });
  }, []);

  const addTasksBulk = useCallback(async (taskRows: Omit<DealTask, "id">[]) => {
    const rows = taskRows.map(task => ({
      deal_id: task.dealId, title: task.title, description: task.description,
      stage: task.stage, assignee: task.assignee, start_date: task.startDate || null,
      end_date: task.endDate || null, urgency: task.urgency, logged_hours: task.loggedHours || 0,
      sort_order: task.sortOrder, estimated_hours: task.estimatedHours || 0,
      subtasks: task.subtasks || [], phase: task.phase || "", tags: task.tags || [],
      auto_regen: task.autoRegen || false,
    }));
    const { data } = await (supabase.from("deal_tasks") as any).insert(rows).select();
    if (data) {
      const mapped = data.map((r: any) => ({
        id: r.id, dealId: r.deal_id, title: r.title, description: r.description || "",
        stage: r.stage, assignee: r.assignee || "", startDate: r.start_date || undefined,
        endDate: r.end_date || undefined, urgency: r.urgency, loggedHours: Number(r.logged_hours),
        sortOrder: r.sort_order, estimatedHours: Number(r.estimated_hours || 0),
        subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
        phase: r.phase || "", tags: Array.isArray(r.tags) ? r.tags : [],
        autoRegen: !!r.auto_regen,
      }));
      setTasks(prev => [...prev, ...mapped]);
      mapped.forEach((t: DealTask) =>
        notifyTask(t.assignee, t.dealId, { title: t.title, urgency: t.urgency, endDate: t.endDate })
      );
    }
  }, []);

  const updateTask = useCallback(async (id: string, updates: Partial<DealTask>) => {
    let prevAssignee: string | undefined;
    let nextTask: DealTask | undefined;
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      prevAssignee = t.assignee;
      nextTask = { ...t, ...updates };
      return nextTask;
    }));
    const db: any = {};
    if (updates.title !== undefined) db.title = updates.title;
    if (updates.description !== undefined) db.description = updates.description;
    if (updates.stage !== undefined) db.stage = updates.stage;
    if (updates.assignee !== undefined) db.assignee = updates.assignee;
    if (updates.startDate !== undefined) db.start_date = updates.startDate;
    if (updates.endDate !== undefined) db.end_date = updates.endDate;
    if (updates.urgency !== undefined) db.urgency = updates.urgency;
    if (updates.loggedHours !== undefined) db.logged_hours = updates.loggedHours;
    if (updates.sortOrder !== undefined) db.sort_order = updates.sortOrder;
    if (updates.estimatedHours !== undefined) db.estimated_hours = updates.estimatedHours;
    if (updates.subtasks !== undefined) db.subtasks = updates.subtasks;
    if ((updates as any).phase !== undefined) db.phase = (updates as any).phase;
    if ((updates as any).tags !== undefined) db.tags = (updates as any).tags;
    if (updates.autoRegen !== undefined) db.auto_regen = updates.autoRegen;
    await (supabase.from("deal_tasks") as any).update(db).eq("id", id);
    // Notify only when assignee actually changed to a non-empty value.
    if (
      nextTask &&
      updates.assignee !== undefined &&
      (updates.assignee || "").trim() !== "" &&
      (prevAssignee || "").trim() !== (updates.assignee || "").trim()
    ) {
      notifyTask(nextTask.assignee, nextTask.dealId, { title: nextTask.title, urgency: nextTask.urgency, endDate: nextTask.endDate });
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from("deal_tasks").delete().eq("id", id);
  }, []);

  const deleteMBREntry = useCallback(async (id: string) => {
    setMbrEntries(prev => prev.filter(e => e.id !== id));
    await supabase.from("mbr_entries").delete().eq("id", id);
  }, []);

  const quickUpdateMBRField = useCallback(async (entryId: string, field: string, value: any) => {
    const dbFieldMap: Record<string, string> = {
      status: "status",
      sentiment: "sentiment",
      mode: "mode",
      scheduledDate: "scheduled_date",
      fathomLink: "fathom_link",
      mbrPptLink: "mbr_ppt_link",
      notes: "notes",
    };
    const dbField = dbFieldMap[field];
    if (!dbField) return;

    // Optimistic update
    setMbrEntries(prev => prev.map(e => e.id === entryId ? { ...e, [field]: value } : e));

    const updateObj: any = { [dbField]: value };
    if (field === "status" && value === "Done") updateObj.input_recorded_at = new Date().toISOString();
    
    const { error } = await supabase.from("mbr_entries").update(updateObj).eq("id", entryId);
    if (error) {
      toast.error("Failed to update");
      // Revert
      setMbrEntries(prev => [...prev]);
    }
  }, []);

  return {
    sowItems, revenue, targets, rgyWeekly, onboarding, financials, tasks, mbrEntries, loading,
    addSoWItem, updateSoWItem, deleteSoWItem,
    toggleOnboardingStep, seedOnboarding,
    addRGYWeek, updateRGYWeek,
    addFinancial, updateFinancial, deleteFinancial,
    addTask, addTasksBulk, updateTask, deleteTask,
    upsertMBREntry, deleteMBREntry, quickUpdateMBRField,
    refresh: loadAll,
  };
}
