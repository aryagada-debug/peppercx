// Daily cron: triggers configurable notification rules
//   - mbr.missing_prev_month  (5th of month or later)
//   - deal.unstaffed_7d
//   - rgy.stale_7d
// Dedupe via notification_dispatch_log so the same deal is not pinged twice
// for the same (event, window).
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ACTIVE_STATUSES = ["Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal in Renewal Process"];

async function invokeEmail(events: Array<Record<string, unknown>>) {
  if (events.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-app-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
    },
    body: JSON.stringify({ action: "send", events }),
  });
  await res.text(); // ignore
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const summary: Record<string, number> = {};

    // ── Rule 5: deal.unstaffed_7d ───────────────────────────────
    {
      const { data: deals } = await admin
        .from("staffing_deals")
        .select("id, deal_status, created_at")
        .in("deal_status", ACTIVE_STATUSES);
      const cutoff = Date.now() - 7 * 86400 * 1000;
      const candidates = (deals || []).filter((d: any) => new Date(d.created_at).getTime() <= cutoff);
      if (candidates.length) {
        const ids = candidates.map((d: any) => d.id);
        const { data: assigns } = await admin
          .from("staffing_assignments")
          .select("staffing_deal_id, allocation_pct")
          .in("staffing_deal_id", ids);
        const staffed = new Set<string>();
        (assigns || []).forEach((a: any) => {
          if (Number(a.allocation_pct) > 0) staffed.add(a.staffing_deal_id);
        });
        const pending = ids.filter((id) => !staffed.has(id));
        const events: any[] = [];
        const week = Math.floor(Date.now() / (7 * 86400 * 1000));
        for (const id of pending) {
          const dedupe = `deal_unstaffed:${id}:${week}`;
          const { error } = await admin
            .from("notification_dispatch_log")
            .insert({ event_key: "deal.unstaffed_7d", dedupe_key: dedupe, deal_id: id });
          if (!error) events.push({ event: "deal_unstaffed", dealId: id });
        }
        summary.deal_unstaffed = events.length;
        await invokeEmail(events);
      }
    }

    // ── Rule 6: rgy.stale_7d ────────────────────────────────────
    {
      const { data: deals } = await admin
        .from("staffing_deals")
        .select("id, deal_status")
        .in("deal_status", ACTIVE_STATUSES);
      const ids = (deals || []).map((d: any) => d.id);
      const cutoffIso = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10);
      const { data: recent } = await admin
        .from("deal_rgy_weekly")
        .select("deal_id, week_start")
        .in("deal_id", ids)
        .gte("week_start", cutoffIso);
      const fresh = new Set<string>((recent || []).map((r: any) => r.deal_id));
      const stale = ids.filter((id) => !fresh.has(id));
      const events: any[] = [];
      const week = Math.floor(Date.now() / (7 * 86400 * 1000));
      for (const id of stale) {
        const dedupe = `rgy_stale:${id}:${week}`;
        const { error } = await admin
          .from("notification_dispatch_log")
          .insert({ event_key: "rgy.stale_7d", dedupe_key: dedupe, deal_id: id });
        if (!error) events.push({ event: "rgy_stale", dealId: id });
      }
      summary.rgy_stale = events.length;
      await invokeEmail(events);
    }

    // ── Rule 4: mbr.missing_prev_month (only after 5th of month) ─
    {
      const today = new Date();
      if (today.getUTCDate() >= 5) {
        const prev = new Date(today.getUTCFullYear(), today.getUTCMonth() - 1, 1);
        const ym = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
        const monthStart = `${ym}-01`;
        const thisMonthStart = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-01`;
        const { data: deals } = await admin
          .from("staffing_deals")
          .select("id, deal_status")
          .in("deal_status", ACTIVE_STATUSES);
        const ids = (deals || []).map((d: any) => d.id);
        const { data: entries } = await admin
          .from("mbr_entries")
          .select("deal_id, status, week_start")
          .in("deal_id", ids)
          .gte("week_start", monthStart)
          .lt("week_start", thisMonthStart);
        const done = new Set<string>(
          (entries || []).filter((e: any) => ["Done", "Not Required"].includes(e.status)).map((e: any) => e.deal_id),
        );
        const pending = ids.filter((id) => !done.has(id));
        const events: any[] = [];
        for (const id of pending) {
          const dedupe = `mbr_missing:${id}:${ym}`;
          const { error } = await admin
            .from("notification_dispatch_log")
            .insert({ event_key: "mbr.missing_prev_month", dedupe_key: dedupe, deal_id: id });
          if (!error) events.push({ event: "mbr_reminder", dealId: id, payload: { month: ym } });
        }
        summary.mbr_missing = events.length;
        await invokeEmail(events);
      } else {
        summary.mbr_missing = 0;
      }
    }

    return json({ ok: true, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: msg }, 500);
  }
});