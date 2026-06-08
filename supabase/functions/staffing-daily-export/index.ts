import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Ordered list of role columns. Each entry is [normalized role_key, display header].
// New role_keys not in this list are auto-appended as extra columns at the end.
const ROLE_COLUMNS: Array<[string, string]> = [
  ["seo_capability_leader",        "SEO Capability Leader"],
  ["rt_seo_capability_leader",     "SEO Capability Leader (RT)"],
  ["seo_growth_lead",              "SEO Growth Lead"],
  ["rt_seo_growth_lead",           "SEO Growth Lead (RT)"],
  ["seo_operations",               "SEO Operations"],
  ["rt_seo_operations",            "SEO Operations (RT)"],
  ["seo_group_head",               "SEO Group Head"],
  ["sr_seo_manager",               "Sr. SEO Manager"],
  ["seo_manager",                  "SEO Manager"],
  ["sr_seo_analyst",               "Sr. SEO Analyst"],
  ["seo_analyst",                  "SEO Analyst"],
  ["content_capability_leader",    "Content Capability Leader"],
  ["content_lead",                 "Content Lead"],
  ["rt_content_lead",              "Content Lead (RT)"],
  ["content_editor",               "Content Editor"],
  ["rt_content_editor",            "Content Editor (RT)"],
  ["managing_editor",              "Managing Editor"],
  ["senior_editor",                "Senior Editor"],
  ["rt_video_capability_leader",   "Video Capability Leader (RT)"],
  ["video_editor",                 "Video Editor"],
  ["rt_video_editor",              "Video Editor (RT)"],
  ["rt_creative_producer",         "Creative Producer (RT)"],
  ["rt_ad_creative_producer",      "AD Creative Producer (RT)"],
  ["rt_creative_strategist",       "Creative Strategist (RT)"],
  ["rt_copywriter",                "Copywriter (RT)"],
  ["rt_cd_scd_copy",               "CD/SCD Copy (RT)"],
  ["rt_cd_scd_design",             "CD/SCD Design (RT)"],
  ["rt_acd_agh_design",            "ACD/AGH Design (RT)"],
  ["rt_graphic_designer",          "Graphic Designer (RT)"],
  ["influencer_team",              "Influencer Team"],
  ["performance_marketing_team",   "Performance Marketing Team"],
];

function normalizeRoleKey(k: string): string {
  const v = (k || "").trim().toLowerCase();
  const map: Record<string, string> = {
    "rt_vsd": "vsd",
    "principal bopm": "principal_bopm",
    "rt_group_bopm": "principal_bopm",
    "group bopm": "principal_bopm",
    "senior bopm": "senior_bopm",
    "sr bopm": "senior_bopm",
    "rt_senior_bopm": "senior_bopm",
    "rt_bopm": "bopm",
  };
  if (map[v]) return map[v];
  return v.replace(/\s+/g, "_");
}

const fmtAlloc = (n: any) => {
  const x = Number(n);
  if (!isFinite(x)) return "";
  return Number.isInteger(x) ? String(x) : x.toFixed(1).replace(/\.0$/, "");
};

const ymd = (d = new Date()) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // Fetch in pages — staffing_deals can exceed the default 1000-row cap.
    const fetchAll = async <T,>(table: string, select: string): Promise<T[]> => {
      const out: T[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supa.from(table).select(select).range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data || []) as T[];
        out.push(...rows);
        if (rows.length < PAGE) break;
      }
      return out;
    };

    const [deals, assignments, people] = await Promise.all([
      fetchAll<any>("staffing_deals",
        "id,pc_code,account,deal_name,pod,geo,deal_status,staffing_status,mrr,total_deal_value,start_date,end_date,vsd,principal_bopm,senior_bopm,bopm"),
      fetchAll<any>("staffing_assignments",
        "staffing_deal_id,role_key,person_id,allocation_pct"),
      fetchAll<any>("staffing_people", "id,name"),
    ]);

    const peopleById = new Map(people.map((p) => [p.id, p.name]));

    // Group assignments by deal -> normalized role_key -> [text per person]
    const byDeal = new Map<string, Map<string, string[]>>();
    const totals = new Map<string, { count: number; sumAlloc: number }>();
    const extraRoleKeys = new Set<string>();
    const known = new Set(ROLE_COLUMNS.map(([k]) => k));

    for (const a of assignments) {
      const rk = normalizeRoleKey(a.role_key);
      if (!known.has(rk) && rk !== "vsd" && rk !== "principal_bopm" && rk !== "senior_bopm" && rk !== "bopm") {
        extraRoleKeys.add(rk);
      }
      const name = peopleById.get(a.person_id) || "(unknown)";
      const cell = a.allocation_pct != null ? `${name} (${fmtAlloc(a.allocation_pct)}%)` : name;
      let m = byDeal.get(a.staffing_deal_id);
      if (!m) { m = new Map(); byDeal.set(a.staffing_deal_id, m); }
      const arr = m.get(rk) || []; arr.push(cell); m.set(rk, arr);
      const t = totals.get(a.staffing_deal_id) || { count: 0, sumAlloc: 0 };
      t.count += 1; t.sumAlloc += Number(a.allocation_pct) || 0;
      totals.set(a.staffing_deal_id, t);
    }

    const extraCols: Array<[string, string]> = Array.from(extraRoleKeys).sort()
      .map((k) => [k, k.replace(/^rt_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + (k.startsWith("rt_") ? " (RT)" : "")]);

    const snapshot = ymd();
    const headers = [
      "Deal ID", "PC Code", "Account", "Deal Name", "Pod", "Geo",
      "Deal Status", "Staffing Status", "MRR", "Total Deal Value", "Start Date", "End Date",
      "VSD", "Principal BOPM", "Senior BOPM", "BOPM",
      ...ROLE_COLUMNS.map(([_, h]) => h),
      ...extraCols.map(([_, h]) => h),
      "# People Staffed", "Total Allocation %", "Snapshot Date",
    ];

    const rows = deals
      .sort((a, b) => (a.account || "").localeCompare(b.account || ""))
      .map((d) => {
        const m = byDeal.get(d.id) || new Map<string, string[]>();
        const t = totals.get(d.id) || { count: 0, sumAlloc: 0 };
        const cellFor = (rk: string) => (m.get(rk) || []).join(", ");
        return [
          d.id, d.pc_code || "", d.account || "", d.deal_name || "", d.pod || "", d.geo || "",
          d.deal_status || "", d.staffing_status || "",
          d.mrr ?? "", d.total_deal_value ?? "", d.start_date || "", d.end_date || "",
          d.vsd || "", d.principal_bopm || "", d.senior_bopm || "", d.bopm || "",
          ...ROLE_COLUMNS.map(([k]) => cellFor(k)),
          ...extraCols.map(([k]) => cellFor(k)),
          t.count, Number(t.sumAlloc.toFixed(2)), snapshot,
        ];
      });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Column widths
    ws["!cols"] = headers.map((h) => ({ wch: Math.min(40, Math.max(12, h.length + 2)) }));
    // Freeze header row + identity columns
    (ws as any)["!freeze"] = { xSplit: 4, ySplit: 1 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staffing");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const filename = `staffing-export-${snapshot}.xlsx`;
    const { error: upErr } = await supa.storage.from("staffing-exports").upload(filename, new Uint8Array(buf), {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
    if (upErr) throw upErr;

    // Retention: delete files older than 30 days.
    const { data: listing } = await supa.storage.from("staffing-exports").list("", { limit: 1000 });
    if (listing?.length) {
      const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
      const stale = listing
        .filter((f) => new Date(f.created_at || f.updated_at || 0).getTime() < cutoff)
        .map((f) => f.name);
      if (stale.length) await supa.storage.from("staffing-exports").remove(stale);
    }

    return new Response(
      JSON.stringify({ ok: true, filename, deals: rows.length, assignments: assignments.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("staffing-daily-export failed", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});