import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const PASSWORD = "Pepper@2026";

  const { data: people } = await admin
    .from("staffing_people")
    .select("id, name, email")
    .neq("email", "")
    .not("email", "is", null);

  const dedup = new Map<string, any>();
  for (const p of people || []) {
    const e = (p.email || "").trim();
    if (!e || !e.includes("@")) continue;
    if (!dedup.has(p.id)) dedup.set(p.id, { ...p, email: e });
  }

  // Page through all auth users
  const existingByEmail = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users || [];
    users.forEach(u => { if (u.email) existingByEmail.set(u.email.toLowerCase(), u.id); });
    if (users.length < 1000) break;
    page++;
    if (page > 20) break;
  }

  const results: any[] = [];
  for (const p of dedup.values()) {
    const targetEmail = p.email;
    const emailLower = targetEmail.toLowerCase();
    let userId = existingByEmail.get(emailLower);
    let status = "linked";

    if (!userId) {
      const { data: existingProfile } = await admin
        .from("profiles").select("user_id").eq("staffing_person_id", p.id).limit(1).maybeSingle();
      if (existingProfile?.user_id) {
        const { error: updErr } = await admin.auth.admin.updateUserById(existingProfile.user_id, {
          email: targetEmail, password: PASSWORD, email_confirm: true,
        });
        if (!updErr) { userId = existingProfile.user_id; status = "email_synced"; existingByEmail.set(emailLower, userId); }
        else { results.push({ name: p.name, email: targetEmail, status: "email_sync_error", error: updErr.message }); continue; }
      }
    }

    if (!userId) {
      const { data: newUser, error: cErr } = await admin.auth.admin.createUser({
        email: targetEmail, password: PASSWORD, email_confirm: true, user_metadata: { full_name: p.name },
      });
      if (cErr || !newUser?.user) { results.push({ name: p.name, email: targetEmail, status: "error", error: cErr?.message }); continue; }
      userId = newUser.user.id; status = "created";
    } else if (status === "linked") {
      await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true }).catch(() => {});
      status = "reset";
    }

    await admin.from("profiles").upsert(
      { user_id: userId, display_name: p.name, staffing_person_id: p.id }, { onConflict: "user_id" });
    await admin.from("user_roles").insert({ user_id: userId, role: "user" }).select().then(r => r, () => null);

    results.push({ person_id: p.id, name: p.name, email: targetEmail, status });
  }

  results.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  return new Response(JSON.stringify({ password: PASSWORD, count: results.length, results }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
