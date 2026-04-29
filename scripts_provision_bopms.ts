import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gdklfxqbocvoxcfthysy.supabase.co";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "Pepper@2026";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const { data: bopms, error } = await admin
  .from("staffing_people")
  .select("id, name, email, role_title")
  .in("role_title", ["BOPM", "Senior BOPM", "Principal BOPM"]);
if (error) { console.error(error); process.exit(1); }

const dedup = new Map<string, any>();
for (const p of bopms!) {
  if (!p.email?.trim()) continue;
  if (!dedup.has(p.id)) dedup.set(p.id, p);
}

// Existing users
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const byEmail = new Map<string, string>();
list?.users.forEach((u) => { if (u.email) byEmail.set(u.email.toLowerCase(), u.id); });

const out: any[] = [];
for (const p of dedup.values()) {
  const email = p.email.trim();
  const lower = email.toLowerCase();
  let userId = byEmail.get(lower);
  let status = "linked";
  if (!userId) {
    const { data: nu, error: ce } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: p.name },
    });
    if (ce || !nu?.user) {
      out.push({ person_id: p.id, name: p.name, email, role_title: p.role_title, status: "error", error: ce?.message });
      continue;
    }
    userId = nu.user.id;
    status = "created";
  } else {
    const { error: ue } = await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
    status = ue ? "reset_failed" : "reset";
  }
  await admin.from("profiles").upsert(
    { user_id: userId, display_name: p.name, staffing_person_id: p.id },
    { onConflict: "user_id" }
  );
  await admin.from("user_roles").insert({ user_id: userId, role: "user" }).then(() => null, () => null);
  out.push({ person_id: p.id, name: p.name, email, role_title: p.role_title, status });
}

console.log(JSON.stringify({ password: PASSWORD, count: out.length, results: out }, null, 2));
