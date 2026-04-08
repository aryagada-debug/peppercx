import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SoWItem {
  id: string;
  dealId: string;
  scope: string;
  revenueShare: number;
  teamCapability: string;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) return;
    loadAll();
  }, [dealId]);

  async function loadAll() {
    if (!dealId) return;
    setLoading(true);
    const [sow, rev, tgt, rgy, onb] = await Promise.all([
      supabase.from("deal_sow_items").select("*").eq("deal_id", dealId),
      supabase.from("deal_revenue_monthly").select("*").eq("deal_id", dealId).order("month"),
      supabase.from("deal_targets_monthly").select("*").eq("deal_id", dealId).order("month"),
      supabase.from("deal_rgy_weekly").select("*").eq("deal_id", dealId).order("week_start", { ascending: false }),
      supabase.from("deal_onboarding_steps").select("*").eq("deal_id", dealId).order("sort_order"),
    ]);
    if (sow.data) setSowItems(sow.data.map((r: any) => ({ id: r.id, dealId: r.deal_id, scope: r.scope, revenueShare: Number(r.revenue_share), teamCapability: r.team_capability })));
    if (rev.data) setRevenue(rev.data.map((r: any) => ({ id: r.id, dealId: r.deal_id, month: r.month, mrr: Number(r.mrr), contraction: Number(r.contraction), delivered: Number(r.delivered), invoiced: Number(r.invoiced), actuals: Number(r.actuals) })));
    if (tgt.data) setTargets(tgt.data.map((r: any) => ({ id: r.id, dealId: r.deal_id, month: r.month, contractionTarget: Number(r.contraction_target), deliveryTarget: Number(r.delivery_target), invoicingTarget: Number(r.invoicing_target) })));
    if (rgy.data) setRgyWeekly(rgy.data.map((r: any) => ({ id: r.id, dealId: r.deal_id, weekStart: r.week_start, internal: r.internal, customer: r.customer, delivery: r.delivery, consumption: r.consumption, notes: r.notes })));
    if (onb.data) setOnboarding(onb.data.map((r: any) => ({ id: r.id, dealId: r.deal_id, stepName: r.step_name, category: r.category, owner: r.owner, dueDate: r.due_date, completed: r.completed, completedAt: r.completed_at, sortOrder: r.sort_order })));
    setLoading(false);
  }

  const addSoWItem = useCallback(async (item: Omit<SoWItem, "id">) => {
    const { data } = await (supabase.from("deal_sow_items") as any).insert({ deal_id: item.dealId, scope: item.scope, revenue_share: item.revenueShare, team_capability: item.teamCapability }).select().single();
    if (data) setSowItems(prev => [...prev, { id: data.id, ...item }]);
  }, []);

  const toggleOnboardingStep = useCallback(async (stepId: string) => {
    setOnboarding(prev => prev.map(s => s.id === stepId ? { ...s, completed: !s.completed, completedAt: !s.completed ? new Date().toISOString() : undefined } : s));
    const step = onboarding.find(s => s.id === stepId);
    if (step) {
      await (supabase.from("deal_onboarding_steps") as any).update({ completed: !step.completed, completed_at: !step.completed ? new Date().toISOString() : null }).eq("id", stepId);
    }
  }, [onboarding]);

  const addRGYWeek = useCallback(async (entry: Omit<RGYWeekly, "id">) => {
    const { data } = await (supabase.from("deal_rgy_weekly") as any).insert({ deal_id: entry.dealId, week_start: entry.weekStart, internal: entry.internal, customer: entry.customer, delivery: entry.delivery, consumption: entry.consumption, notes: entry.notes }).select().single();
    if (data) setRgyWeekly(prev => [{ id: data.id, ...entry }, ...prev]);
  }, []);

  return {
    sowItems, revenue, targets, rgyWeekly, onboarding, loading,
    addSoWItem, toggleOnboardingStep, addRGYWeek, refresh: loadAll,
  };
}
