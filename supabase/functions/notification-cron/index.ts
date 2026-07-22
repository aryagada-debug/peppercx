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
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") || "https://peppercx.lovable.app";

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

// ── Helpers ────────────────────────────────────────────────────────────────
function splitNames(v: string | null | undefined): string[] {
  return String(v || "").split(/[,/]/).map((s) => s.trim()).filter((s) => s.length > 1);
}
function isoWeekKey(d: Date): string {
  // Simple week key: YYYY-Www based on Monday-start UTC weeks.
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7; // Mon=0
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function workingDaysRemaining(now: Date): number {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const endDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  let count = 0;
  for (let d = now.getUTCDate(); d <= endDay; d++) {
    const day = new Date(Date.UTC(y, m, d)).getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

type NameEmailRow = { name: string; email: string | null };
async function resolveNameToEmail(admin: any, names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const clean = Array.from(new Set(names.filter((n) => n && n.length > 1)));
  if (clean.length === 0) return out;
  const { data } = await admin.from("staffing_people").select("name, email").in("name", clean);
  ((data || []) as NameEmailRow[]).forEach((r) => {
    if (r.email && /@/.test(r.email)) out.set(r.name, r.email.trim());
  });
  return out;
}

/** Group deals into per-BOPM buckets. */
type Bucket = { bopmName: string; bopmEmail: string; vsdNames: Set<string>; deals: Array<any> };
async function groupByBopm(admin: any, deals: any[]): Promise<Bucket[]> {
  const allBopm = new Set<string>();
  const allVsd = new Set<string>();
  for (const d of deals) {
    for (const n of [...splitNames(d.bopm), ...splitNames(d.senior_bopm), ...splitNames(d.principal_bopm)]) allBopm.add(n);
    for (const n of splitNames(d.vsd)) allVsd.add(n);
  }
  const [bopmMap, vsdMap] = await Promise.all([
    resolveNameToEmail(admin, Array.from(allBopm)),
    resolveNameToEmail(admin, Array.from(allVsd)),
  ]);
  const buckets = new Map<string, Bucket>();
  for (const d of deals) {
    const bopmNames = [...splitNames(d.bopm), ...splitNames(d.senior_bopm), ...splitNames(d.principal_bopm)];
    for (const bn of bopmNames) {
      const be = bopmMap.get(bn);
      if (!be) continue;
      const key = be.toLowerCase();
      if (!buckets.has(key)) buckets.set(key, { bopmName: bn, bopmEmail: be, vsdNames: new Set(), deals: [] });
      const b = buckets.get(key)!;
      b.deals.push(d);
      for (const vn of splitNames(d.vsd)) if (vsdMap.get(vn)) b.vsdNames.add(vn);
    }
  }
  return Array.from(buckets.values()).map((b) => ({
    ...b,
    // Attach resolved VSD emails on the fly for callers.
    vsdEmails: Array.from(b.vsdNames).map((n) => vsdMap.get(n)!).filter(Boolean),
  })) as any;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const summary: Record<string, number> = {};
    const now = new Date();
    const weekday = now.getUTCDay(); // 0=Sun..6=Sat
    const weekKey = isoWeekKey(now);

    // ── T1: mbr.reminder_bopm_digest (working-day slots) ─────────────
    {
      const wdr = workingDaysRemaining(now);
      const SLOTS = new Set([10, 7, 4, 1]);
      const isWorking = weekday >= 1 && weekday <= 5;
      if (isWorking && SLOTS.has(wdr)) {
        const prev = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
        const ym = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
        const monthLabel = prev.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
        const currentMonth = now.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
        const monthStart = `${ym}-01`;
        const thisMonthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
        const { data: deals } = await admin
          .from("staffing_deals")
          .select("id, account, deal_name, vsd, principal_bopm, senior_bopm, bopm, deal_status")
          .in("deal_status", ACTIVE_STATUSES);
        const dealsArr = deals || [];
        const ids = dealsArr.map((d: any) => d.id);
        const { data: entries } = await admin
          .from("mbr_entries")
          .select("deal_id, status, week_start")
          .in("deal_id", ids)
          .gte("week_start", monthStart)
          .lt("week_start", thisMonthStart);
        const done = new Set<string>(
          (entries || []).filter((e: any) => ["Done", "Not Required"].includes(e.status)).map((e: any) => e.deal_id),
        );
        const pendingDeals = dealsArr.filter((d: any) => !done.has(d.id));
        const buckets = await groupByBopm(admin, pendingDeals);
        const ordinal = { 10: "first", 7: "second", 4: "third", 1: "final" }[wdr] || "";
        const events: any[] = [];
        for (const b of buckets as any[]) {
          const dedupe = `mbr_digest:${b.bopmEmail.toLowerCase()}:${ym}:${wdr}`;
          const { error } = await admin.from("notification_dispatch_log").insert({
            event_key: "mbr.reminder_bopm_digest", dedupe_key: dedupe, deal_id: null,
          });
          if (error) continue;
          events.push({
            event: "mbr_bopm_digest",
            recipients: [b.bopmEmail],
            payload: {
              cc_emails: b.vsdEmails,
              bopm_name: b.bopmName,
              vsd_name: Array.from(b.vsdNames).join(", "),
              mbr_month: monthLabel,
              current_month: currentMonth,
              days_remaining: String(wdr),
              reminder_ordinal: ordinal,
              rows: b.deals.map((d: any) => ({
                account: d.account || "",
                deal: d.deal_name || "",
                month: monthLabel,
                link: `${APP_ORIGIN}/mbr?deal=${encodeURIComponent(d.id)}`,
              })),
            },
          });
        }
        summary.mbr_bopm_digest = events.length;
        await invokeEmail(events);
      } else {
        summary.mbr_bopm_digest = 0;
      }
    }

    // ── T2: rgy.reminder_bopm_digest (Friday) ────────────────────────
    if (weekday === 5) {
      const { data: deals } = await admin
        .from("staffing_deals")
        .select("id, account, deal_name, vsd, principal_bopm, senior_bopm, bopm, deal_status")
        .in("deal_status", ACTIVE_STATUSES);
      const dealsArr = deals || [];
      const ids = dealsArr.map((d: any) => d.id);
      const cutoffIso = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10);
      const { data: rgyRows } = await admin
        .from("deal_rgy_weekly")
        .select("deal_id, week_start, overall_rgy, created_at")
        .in("deal_id", ids)
        .order("week_start", { ascending: false });
      const latestByDeal = new Map<string, any>();
      for (const r of rgyRows || []) {
        if (!latestByDeal.has((r as any).deal_id)) latestByDeal.set((r as any).deal_id, r);
      }
      const staleDeals = dealsArr.filter((d: any) => {
        const last = latestByDeal.get(d.id);
        return !last || last.week_start < cutoffIso;
      });
      const buckets = await groupByBopm(admin, staleDeals);
      const weekLabel = `Week of ${now.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
      const events: any[] = [];
      for (const b of buckets as any[]) {
        const dedupe = `rgy_digest:${b.bopmEmail.toLowerCase()}:${weekKey}`;
        const { error } = await admin.from("notification_dispatch_log").insert({
          event_key: "rgy.reminder_bopm_digest", dedupe_key: dedupe, deal_id: null,
        });
        if (error) continue;
        events.push({
          event: "rgy_bopm_digest",
          recipients: [b.bopmEmail],
          payload: {
            cc_emails: b.vsdEmails,
            bopm_name: b.bopmName,
            vsd_name: Array.from(b.vsdNames).join(", "),
            week_label: weekLabel,
            rows: b.deals.map((d: any) => {
              const last = latestByDeal.get(d.id);
              return {
                account: d.account || "",
                deal: d.deal_name || "",
                rgy: last?.overall_rgy || "Not set",
                last_updated: last?.week_start
                  ? `${last.week_start} (${Math.floor((Date.now() - new Date(last.week_start).getTime()) / 86400000)}d ago)`
                  : "Never",
              };
            }),
          },
        });
      }
      summary.rgy_bopm_digest = events.length;
      await invokeEmail(events);
    } else {
      summary.rgy_bopm_digest = 0;
    }

    // ── T3: nps.reminder_bopm_digest (Wednesday) ─────────────────────
    if (weekday === 3) {
      const { data: invites } = await admin
        .from("survey_invites")
        .select("id, deal_id, recipient_name, recipient_email, sent_at, completed_at, email_status")
        .not("sent_at", "is", null)
        .is("completed_at", null);
      const pendInv = (invites || []).filter((i: any) => i.email_status !== "failed");
      if (pendInv.length > 0) {
        const dealIds = Array.from(new Set(pendInv.map((i: any) => i.deal_id)));
        const { data: deals } = await admin
          .from("staffing_deals")
          .select("id, account, deal_name, vsd, principal_bopm, senior_bopm, bopm, deal_status")
          .in("id", dealIds)
          .in("deal_status", ACTIVE_STATUSES);
        const dealMap = new Map<string, any>((deals || []).map((d: any) => [d.id, d]));
        const invitesByDeal = new Map<string, any[]>();
        for (const inv of pendInv) {
          if (!dealMap.has(inv.deal_id)) continue;
          if (!invitesByDeal.has(inv.deal_id)) invitesByDeal.set(inv.deal_id, []);
          invitesByDeal.get(inv.deal_id)!.push(inv);
        }
        const activeDeals = Array.from(invitesByDeal.keys()).map((id) => dealMap.get(id));
        const buckets = await groupByBopm(admin, activeDeals);
        const events: any[] = [];
        for (const b of buckets as any[]) {
          const rows: any[] = [];
          for (const d of b.deals) {
            for (const inv of invitesByDeal.get(d.id) || []) {
              const sentAt = inv.sent_at ? new Date(inv.sent_at) : null;
              const days = sentAt ? Math.floor((Date.now() - sentAt.getTime()) / 86400000) : 0;
              rows.push({
                account: d.account || "",
                poc_name: inv.recipient_name || inv.recipient_email,
                poc_email: inv.recipient_email,
                sent_date: sentAt ? sentAt.toISOString().slice(0, 10) : "",
                days_outstanding: String(days),
              });
            }
          }
          if (rows.length === 0) continue;
          const dedupe = `nps_digest:${b.bopmEmail.toLowerCase()}:${weekKey}`;
          const { error } = await admin.from("notification_dispatch_log").insert({
            event_key: "nps.reminder_bopm_digest", dedupe_key: dedupe, deal_id: null,
          });
          if (error) continue;
          events.push({
            event: "nps_bopm_digest",
            recipients: [b.bopmEmail],
            payload: {
              cc_emails: b.vsdEmails,
              bopm_name: b.bopmName,
              vsd_name: Array.from(b.vsdNames).join(", "),
              poc_count: rows.length,
              account_count: b.deals.length,
              rows,
            },
          });
        }
        summary.nps_bopm_digest = events.length;
        await invokeEmail(events);
      } else {
        summary.nps_bopm_digest = 0;
      }
    } else {
      summary.nps_bopm_digest = 0;
    }

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