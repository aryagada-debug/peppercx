import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const BOPM_PASSWORD = "Pepper@2026";

  const { data: bopms } = await adminClient
    .from("staffing_people")
    .select("id, name, email, role_title, designation")
    .or("role_title.ilike.%BOPM%,designation.ilike.%BOPM%,designation.ilike.%Account Engagement%,designation.ilike.%Business Operations Project Manager%");

  const dedup = new Map<string, any>();
  for (const p of bopms || []) {
    if (!p.email || !p.email.trim()) continue;
    if (!dedup.has(p.id)) dedup.set(p.id, p);
  }

  const { data: authList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const existingByEmail = new Map<string, string>();
  (authList?.users || []).forEach((u) => { if (u.email) existingByEmail.set(u.email.toLowerCase(), u.id); });

  const results: any[] = [];
  for (const p of dedup.values()) {
    const targetEmail = p.email.trim();
    const emailLower = targetEmail.toLowerCase();
    let userId = existingByEmail.get(emailLower);
    let status = "linked";

    if (!userId) {
      const { data: existingProfile } = await adminClient
        .from("profiles").select("user_id").eq("staffing_person_id", p.id).limit(1).maybeSingle();
      if (existingProfile?.user_id) {
        const { error: updErr } = await adminClient.auth.admin.updateUserById(existingProfile.user_id, {
          email: targetEmail, password: BOPM_PASSWORD, email_confirm: true,
        });
        if (!updErr) { userId = existingProfile.user_id; status = "email_synced"; }
        else { results.push({ name: p.name, email: targetEmail, status: "email_sync_error", error: updErr.message }); continue; }
      }
    }

    if (!userId) {
      const { data: newUser, error: cErr } = await adminClient.auth.admin.createUser({
        email: targetEmail, password: BOPM_PASSWORD, email_confirm: true, user_metadata: { full_name: p.name },
      });
      if (cErr || !newUser?.user) { results.push({ name: p.name, email: targetEmail, status: "error", error: cErr?.message }); continue; }
      userId = newUser.user.id; status = "created";
    } else if (status === "linked") {
      await adminClient.auth.admin.updateUserById(userId, { password: BOPM_PASSWORD, email_confirm: true }).catch(() => {});
      status = "reset";
    }

    await adminClient.from("profiles").upsert(
      { user_id: userId, display_name: p.name, staffing_person_id: p.id }, { onConflict: "user_id" });
    await adminClient.from("user_roles").insert({ user_id: userId, role: "user" }).select().then(r => r, () => null);

    results.push({ person_id: p.id, name: p.name, email: targetEmail, status });
  }

  return new Response(JSON.stringify({ password: BOPM_PASSWORD, count: results.length, results }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
