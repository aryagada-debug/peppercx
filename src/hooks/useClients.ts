import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Client {
  id: string;
  name: string;
  website: string;
  salesPoc: string;
  industry: string;
  pcCode: string;
  accountStatus: string;
  signingEntity: string;
  geography: string;
  dailyPocName: string;
  dailyPocPhone: string;
  dailyPocLinkedin: string;
  homPocName: string;
  homPocPhone: string;
  homPocLinkedin: string;
  leadSource: string;
  competitorInvolved: string;
  notes: string;
  billingAddress: string;
  gstNumber: string;
  contractSignedDate: string | null;
  ndaSigned: boolean;
}

function dbToClient(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    website: row.website || "",
    salesPoc: row.sales_poc || "",
    industry: row.industry || "",
    pcCode: row.pc_code || "",
    accountStatus: row.account_status || "Active",
    signingEntity: row.signing_entity || "",
    geography: row.geography || "",
    dailyPocName: row.daily_poc_name || "",
    dailyPocPhone: row.daily_poc_phone || "",
    dailyPocLinkedin: row.daily_poc_linkedin || "",
    homPocName: row.hom_poc_name || "",
    homPocPhone: row.hom_poc_phone || "",
    homPocLinkedin: row.hom_poc_linkedin || "",
    leadSource: row.lead_source || "",
    competitorInvolved: row.competitor_involved || "",
    notes: row.notes || "",
    billingAddress: row.billing_address || "",
    gstNumber: row.gst_number || "",
    contractSignedDate: row.contract_signed_date || null,
    ndaSigned: row.nda_signed || false,
  };
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("name");
    if (data) setClients(data.map(dbToClient));
    if (error) console.error("Failed to load clients:", error);
    setLoading(false);
  }

  const addClient = useCallback(async (client: Omit<Client, "id">) => {
    const { data, error } = await supabase.from("clients").insert({
      name: client.name,
      website: client.website,
      sales_poc: client.salesPoc,
      industry: client.industry,
      pc_code: client.pcCode,
      account_status: client.accountStatus,
      signing_entity: client.signingEntity,
      geography: client.geography,
      daily_poc_name: client.dailyPocName,
      daily_poc_phone: client.dailyPocPhone,
      daily_poc_linkedin: client.dailyPocLinkedin,
      hom_poc_name: client.homPocName,
      hom_poc_phone: client.homPocPhone,
      hom_poc_linkedin: client.homPocLinkedin,
      lead_source: client.leadSource,
      competitor_involved: client.competitorInvolved,
      notes: client.notes,
      billing_address: client.billingAddress,
      gst_number: client.gstNumber,
      contract_signed_date: client.contractSignedDate,
      nda_signed: client.ndaSigned,
    }).select().single();
    if (data) {
      const newClient = dbToClient(data);
      setClients(prev => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
      return newClient;
    }
    if (error) console.error("Failed to add client:", error);
    return null;
  }, []);

  const updateClient = useCallback(async (id: string, updates: Partial<Client>) => {
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.website !== undefined) dbUpdates.website = updates.website;
    if (updates.salesPoc !== undefined) dbUpdates.sales_poc = updates.salesPoc;
    if (updates.industry !== undefined) dbUpdates.industry = updates.industry;
    if (updates.pcCode !== undefined) dbUpdates.pc_code = updates.pcCode;
    if (updates.accountStatus !== undefined) dbUpdates.account_status = updates.accountStatus;
    if (updates.signingEntity !== undefined) dbUpdates.signing_entity = updates.signingEntity;
    if (updates.geography !== undefined) dbUpdates.geography = updates.geography;
    if (updates.dailyPocName !== undefined) dbUpdates.daily_poc_name = updates.dailyPocName;
    if (updates.dailyPocPhone !== undefined) dbUpdates.daily_poc_phone = updates.dailyPocPhone;
    if (updates.dailyPocLinkedin !== undefined) dbUpdates.daily_poc_linkedin = updates.dailyPocLinkedin;
    if (updates.homPocName !== undefined) dbUpdates.hom_poc_name = updates.homPocName;
    if (updates.homPocPhone !== undefined) dbUpdates.hom_poc_phone = updates.homPocPhone;
    if (updates.homPocLinkedin !== undefined) dbUpdates.hom_poc_linkedin = updates.homPocLinkedin;
    if (updates.leadSource !== undefined) dbUpdates.lead_source = updates.leadSource;
    if (updates.competitorInvolved !== undefined) dbUpdates.competitor_involved = updates.competitorInvolved;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.billingAddress !== undefined) dbUpdates.billing_address = updates.billingAddress;
    if (updates.gstNumber !== undefined) dbUpdates.gst_number = updates.gstNumber;
    if (updates.contractSignedDate !== undefined) dbUpdates.contract_signed_date = updates.contractSignedDate;
    if (updates.ndaSigned !== undefined) dbUpdates.nda_signed = updates.ndaSigned;

    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    await supabase.from("clients").update(dbUpdates).eq("id", id);
  }, []);

  return { clients, loading, addClient, updateClient, refresh: loadClients };
}
