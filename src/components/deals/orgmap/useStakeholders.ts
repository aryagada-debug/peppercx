import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { softDelete } from "@/lib/trash";

export type Stakeholder = {
  id: string;
  deal_id: string;
  client_name: string;
  name: string;
  role: string;
  function: string;
  seniority: string;
  email: string;
  phone: string;
  linkedin_url: string;
  decision_power: number;
  tags: string[];
  notes: string;
  sort_order: number;
  updated_at: string;
};

export function useStakeholders(dealId: string, clientName: string) {
  const [data, setData] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Stakeholders are shared per client. We key on client_name; fall back to
    // this deal's rows if the client isn't yet known (e.g. brand-new client).
    const query = supabase
      .from("deal_stakeholders")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    const { data, error } = clientName
      ? await query.eq("client_name", clientName)
      : await query.eq("deal_id", dealId);
    if (error) {
      toast.error("Failed to load stakeholders");
    } else {
      setData((data || []) as Stakeholder[]);
      if (data && data.length) {
        const latest = (data as Stakeholder[]).reduce((m, r) => (r.updated_at > m ? r.updated_at : m), (data as Stakeholder[])[0].updated_at);
        setLastSavedAt(latest);
      }
    }
    setLoading(false);
  }, [dealId, clientName]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async () => {
    const sort = data.length ? Math.max(...data.map(d => d.sort_order)) + 1 : 0;
    const { data: inserted, error } = await supabase
      .from("deal_stakeholders")
      .insert({ deal_id: dealId, client_name: clientName || "", name: "New stakeholder", sort_order: sort })
      .select()
      .single();
    if (error || !inserted) { toast.error("Failed to add"); return null; }
    setData(prev => [...prev, inserted as Stakeholder]);
    setLastSavedAt(new Date().toISOString());
    return inserted as Stakeholder;
  }, [dealId, clientName, data]);

  const update = useCallback(async (id: string, patch: Partial<Stakeholder>) => {
    setData(prev => prev.map(r => r.id === id ? { ...r, ...patch } as Stakeholder : r));
    const { error } = await supabase.from("deal_stakeholders").update(patch).eq("id", id);
    if (error) { toast.error("Save failed"); load(); return; }
    setLastSavedAt(new Date().toISOString());
  }, [load]);

  const remove = useCallback(async (id: string) => {
    setData(prev => prev.filter(r => r.id !== id));
    const ok = await softDelete("deal_stakeholder", id);
    if (!ok) { toast.error("Delete failed"); load(); return; }
    toast.success("Moved to Trash");
    setLastSavedAt(new Date().toISOString());
  }, [load]);

  const duplicate = useCallback(async (id: string) => {
    const src = data.find(r => r.id === id);
    if (!src) return;
    const { id: _i, updated_at: _u, ...rest } = src;
    const sort = Math.max(...data.map(d => d.sort_order)) + 1;
    const { data: inserted, error } = await supabase
      .from("deal_stakeholders")
      .insert({ ...rest, deal_id: dealId, client_name: clientName || rest.client_name || "", name: `${src.name} (copy)`, sort_order: sort })
      .select()
      .single();
    if (error || !inserted) { toast.error("Duplicate failed"); return; }
    setData(prev => [...prev, inserted as Stakeholder]);
    setLastSavedAt(new Date().toISOString());
  }, [data, dealId, clientName]);

  return { data, loading, lastSavedAt, add, update, remove, duplicate, reload: load };
}