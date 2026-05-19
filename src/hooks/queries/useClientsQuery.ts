/**
 * Thin React Query wrapper around `clients` with realtime patching.
 * Existing `useClients` already uses React Query but with its own private
 * key + no realtime; this hook is the canonical version Phase 3 will
 * cut consumers over to.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useTableSubscription, defaultListPatcher } from "@/lib/realtime";

export interface ClientRow {
  id: string;
  name: string;
  pcCode: string;
  accountStatus: string;
  industry: string;
  salesPoc: string;
}

function dbToClient(row: any): ClientRow {
  return {
    id: row.id,
    name: row.name,
    pcCode: row.pc_code || "",
    accountStatus: row.account_status || "Active",
    industry: row.industry || "",
    salesPoc: row.sales_poc || "",
  };
}

async function fetchClients(): Promise<ClientRow[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, pc_code, account_status, industry, sales_poc")
    .order("name");
  if (error) throw error;
  return (data || []).map(dbToClient);
}

export function useClientsQuery() {
  const key = qk.clients();
  const query = useQuery({ queryKey: key, queryFn: fetchClients });
  const patcher = useMemo(() => defaultListPatcher<ClientRow>(key), [key]);
  useTableSubscription({ table: "clients", patcher });
  return query;
}