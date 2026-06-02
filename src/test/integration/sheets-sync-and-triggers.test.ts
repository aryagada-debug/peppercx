/**
 * Regression tests against the live Lovable Cloud backend:
 *
 * 1. The `sync_bopm_fields_from_assignment` trigger recomputes
 *    `staffing_deals.vsd` / `principal_bopm` whenever an assignment
 *    is inserted, updated, or deleted.
 *
 * 2. The `sheets-sync-deals` edge function creates a deal in the app
 *    when that deal exists in the master sheet but is missing from
 *    the `staffing_deals` table.
 *
 * These talk to the real backend with the publishable (anon) key —
 * the affected tables have public RLS so this works without auth.
 * Tests clean up after themselves.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TEST_DEAL_ID = `__regtest_${Date.now()}`;
const TEST_ASSIGN_ID = `__regtest_a_${Date.now()}`;

describe("staffing_assignments → staffing_deals trigger", () => {
  let personId = "";
  let personName = "";

  beforeAll(async () => {
    const { data: people, error: pErr } = await supabase
      .from("staffing_people")
      .select("id, name")
      .limit(1);
    if (pErr) throw pErr;
    expect(people && people.length).toBeGreaterThan(0);
    personId = people![0].id;
    personName = people![0].name;

    // Seed a throwaway deal row we own.
    const { error: dErr } = await supabase.from("staffing_deals").upsert({
      id: TEST_DEAL_ID,
      pc_code: "REGTEST",
      deal_name: "Regression Test Deal",
      account: "Regression Test",
      vsd: "",
      principal_bopm: "",
    });
    if (dErr) throw dErr;
  }, 30_000);

  it("recomputes vsd column on assignment insert and clears on delete", async () => {
    // INSERT
    const { error: iErr } = await supabase.from("staffing_assignments").insert({
      id: TEST_ASSIGN_ID + "_vsd",
      staffing_deal_id: TEST_DEAL_ID,
      person_id: personId,
      role_key: "vsd",
      allocation_pct: 25,
    });
    expect(iErr).toBeNull();

    let { data: deal } = await supabase
      .from("staffing_deals").select("vsd").eq("id", TEST_DEAL_ID).single();
    expect(deal?.vsd).toContain(personName);

    // DELETE
    const { error: delErr } = await supabase
      .from("staffing_assignments").delete().eq("id", TEST_ASSIGN_ID + "_vsd");
    expect(delErr).toBeNull();

    ({ data: deal } = await supabase
      .from("staffing_deals").select("vsd").eq("id", TEST_DEAL_ID).single());
    expect(deal?.vsd || "").not.toContain(personName);
  }, 30_000);

  it("recomputes principal_bopm column on assignment insert", async () => {
    const { error: iErr } = await supabase.from("staffing_assignments").insert({
      id: TEST_ASSIGN_ID + "_pb",
      staffing_deal_id: TEST_DEAL_ID,
      person_id: personId,
      role_key: "principal_bopm",
      allocation_pct: 50,
    });
    expect(iErr).toBeNull();

    const { data: deal } = await supabase
      .from("staffing_deals")
      .select("principal_bopm")
      .eq("id", TEST_DEAL_ID)
      .single();
    expect(deal?.principal_bopm).toContain(personName);

    // cleanup
    await supabase.from("staffing_assignments").delete().eq("id", TEST_ASSIGN_ID + "_pb");
    await supabase.from("staffing_deals").delete().eq("id", TEST_DEAL_ID);
  }, 30_000);
});

describe("sheets-sync-deals edge function", () => {
  it("creates a deal that is in the sheet but missing from the app", async () => {
    // Pick a real synced deal currently in DB (proxy for being present in the sheet).
    const { data: existing, error: exErr } = await supabase
      .from("staffing_deals")
      .select("id, pc_code")
      .not("pc_code", "is", null)
      .neq("pc_code", "")
      .limit(1);
    if (exErr) throw exErr;
    expect(existing && existing.length).toBeGreaterThan(0);
    const probe = existing![0];

    // Remove it so the sync has to recreate it.
    const { error: delErr } = await supabase
      .from("staffing_deals").delete().eq("id", probe.id);
    expect(delErr).toBeNull();

    const { data: gone } = await supabase
      .from("staffing_deals").select("id").eq("id", probe.id).maybeSingle();
    expect(gone).toBeNull();

    // Run the sync.
    const { data: syncResp, error: fnErr } = await supabase.functions.invoke(
      "sheets-sync-deals",
      { body: { triggered_by: "regression-test" } },
    );
    expect(fnErr).toBeNull();
    expect(syncResp?.success).toBe(true);
    expect(syncResp?.dealsUpserted).toBeGreaterThan(0);

    // The deleted deal should have been re-created from the sheet.
    const { data: restored } = await supabase
      .from("staffing_deals").select("id, pc_code").eq("id", probe.id).maybeSingle();
    expect(restored?.id).toBe(probe.id);
  }, 120_000);
});