/**
 * React Query replacement for `useStaffingData().people` + person CRUD.
 * Built side-by-side; no consumers cut over in Phase 2.
 */
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useTableSubscription, mappedListPatcher } from "@/lib/realtime";
import {
  dbToPerson,
  personToDb,
  STAFFING_PEOPLE_SELECT,
} from "@/lib/dbMappers";
import type { Person } from "@/data/staffingData";
import type { TablesUpdate } from "@/integrations/supabase/types";

async function fetchPeople(): Promise<Person[]> {
  const { data, error } = await supabase
    .from("staffing_people")
    .select(STAFFING_PEOPLE_SELECT);
  if (error) throw error;
  return (data || []).map(dbToPerson);
}

function personUpdatesToDb(updates: Partial<Person>): TablesUpdate<"staffing_people"> {
  const d: TablesUpdate<"staffing_people"> = {};
  if (updates.name !== undefined) d.name = updates.name;
  if (updates.roleCategory !== undefined) d.role_category = updates.roleCategory;
  if (updates.roleTitle !== undefined) d.role_title = updates.roleTitle;
  if (updates.pod !== undefined) d.pod = updates.pod;
  if (updates.region !== undefined) d.region = updates.region;
  if (updates.leaving !== undefined) d.leaving = updates.leaving;
  if (updates.tbh !== undefined) d.tbh = updates.tbh;
  if (updates.department !== undefined) d.department = updates.department;
  if (updates.designation !== undefined) d.designation = updates.designation;
  if (updates.reportingManager !== undefined) d.reporting_manager = updates.reportingManager;
  if (updates.band !== undefined) d.band = updates.band;
  if (updates.hourlyRate !== undefined) d.hourly_rate = updates.hourlyRate;
  if (updates.email !== undefined) d.email = updates.email;
  if (updates.slackUserId !== undefined) d.slack_user_id = updates.slackUserId;
  if (updates.subTeam !== undefined) d.sub_team = updates.subTeam;
  return d;
}

export function usePeopleQuery() {
  const key = qk.people();
  const query = useQuery({ queryKey: key, queryFn: fetchPeople });
  const patcher = useMemo(
    () => mappedListPatcher<any, Person>(key, dbToPerson),
    [key],
  );
  useTableSubscription({ table: "staffing_people", patcher });
  return query;
}

export function usePersonMutations() {
  const qc = useQueryClient();
  const key = qk.people();

  const addPerson = useMutation({
    mutationFn: async (person: Person) => {
      const { error } = await supabase.from("staffing_people").insert(personToDb(person));
      if (error) throw error;
      return person;
    },
    onSuccess: (person) => {
      qc.setQueryData<Person[]>(key, (prev) => (prev ? [...prev, person] : [person]));
    },
  });

  const updatePerson = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Person> }) => {
      const { error } = await supabase
        .from("staffing_people")
        .update(personUpdatesToDb(updates))
        .eq("id", id);
      if (error) throw error;
      return { id, updates };
    },
    onMutate: ({ id, updates }) => {
      const prev = qc.getQueryData<Person[]>(key);
      qc.setQueryData<Person[]>(key, (cur) =>
        cur?.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
  });

  const deletePerson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staffing_people").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<Person[]>(key, (prev) => prev?.filter((p) => p.id !== id));
    },
  });

  const bulkUpdatePeople = useMutation({
    mutationFn: async ({
      ids,
      updates,
    }: {
      ids: string[];
      updates: Partial<Person>;
    }) => {
      const { data, error } = await supabase
        .from("staffing_people")
        .update(personUpdatesToDb(updates))
        .in("id", ids)
        .select(STAFFING_PEOPLE_SELECT);
      if (error) throw error;
      return (data || []).map(dbToPerson);
    },
    onSuccess: (rows) => {
      const byId = new Map(rows.map((r) => [r.id, r]));
      qc.setQueryData<Person[]>(key, (prev) =>
        prev?.map((p) => byId.get(p.id) ?? p),
      );
    },
  });

  return { addPerson, updatePerson, deletePerson, bulkUpdatePeople };
}