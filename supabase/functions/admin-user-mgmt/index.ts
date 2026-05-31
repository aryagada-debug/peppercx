import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Admin client (service role) — bypasses RLS, used for auth.admin operations
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // Every action — including `provision_demo_logins` — now requires an
    // authenticated admin. Previously demo provisioning was public, which
    // let any internet caller reset the 8 named demo accounts to the known
    // password.
    const isPublicAction = false;

    let callerId: string | null = null;
    let userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    if (!isPublicAction) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userErr } = await userClient.auth.getUser(token);
      if (userErr || !userData?.user?.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerId = userData.user.id;

      // Verify caller has admin role
      const { data: roleRows } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleRows) {
        return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "list") {
      const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          users: data.users.map((u) => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
            email_confirmed_at: u.email_confirmed_at ?? null,
          })),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "delete") {
      const targetId = body.user_id;
      if (!targetId) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (targetId === callerId) {
        return new Response(JSON.stringify({ error: "You cannot delete yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await adminClient.auth.admin.deleteUser(targetId);
      // If the auth user is already gone, treat as success and clean up
      // the orphan profile / role rows that the UI is still showing.
      const msg = (error?.message || "").toLowerCase();
      const alreadyGone = !!error && (msg.includes("user not found") || msg.includes("not found"));
      if (error && !alreadyGone) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await adminClient.from("profiles").delete().eq("user_id", targetId);
      await adminClient.from("user_roles").delete().eq("user_id", targetId);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "bulk_provision") {
      const sendInvite = body.send_invite !== false;
      const DEFAULT_PASSWORD = "Pepper@2026";
      // Load all staffing_people with non-empty email
      const { data: people, error: pErr } = await adminClient
        .from("staffing_people")
        .select("id, name, email")
        .neq("email", "")
        .not("email", "is", null);
      if (pErr) {
        return new Response(JSON.stringify({ error: pErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // List existing auth users to skip duplicates
      const { data: authList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const existingByEmail = new Map<string, string>();
      (authList?.users || []).forEach((u) => {
        if (u.email) existingByEmail.set(u.email.toLowerCase(), u.id);
      });

      // List skipped people (no email or whitespace)
      const { data: allPeople } = await adminClient
        .from("staffing_people")
        .select("id, name, email");
      const skipped_names = (allPeople || [])
        .filter((p) => !p.email || !p.email.trim())
        .map((p) => p.name);

      let created = 0;
      const errors: { name: string; error: string }[] = [];
      const linked: { name: string; email: string }[] = [];

      for (const person of people || []) {
        const email = person.email!.trim().toLowerCase();
        if (!email) continue;

        let userId = existingByEmail.get(email);

        if (!userId) {
          const { data: newUser, error: cErr } = await adminClient.auth.admin.createUser({
            email,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: person.name },
          });
          if (cErr || !newUser?.user) {
            errors.push({ name: person.name, error: cErr?.message || "create failed" });
            continue;
          }
          userId = newUser.user.id;
          created++;
        } else {
          // Reset existing accounts to the shared password so it stays predictable.
          await adminClient.auth.admin.updateUserById(userId, {
            password: DEFAULT_PASSWORD,
            email_confirm: true,
          }).catch(() => {});
          linked.push({ name: person.name, email });
        }

        // Upsert profile with staffing_person_id
        await adminClient.from("profiles").upsert(
          { user_id: userId, display_name: person.name, staffing_person_id: person.id },
          { onConflict: "user_id" },
        );

        // Ensure 'user' role exists
        await adminClient
          .from("user_roles")
          .insert({ user_id: userId, role: "user" })
          .select()
          .then((r) => r, () => null);
      }

      return new Response(
        JSON.stringify({
          created,
          linked: linked.length,
          skipped: skipped_names.length,
          skipped_names,
          errors,
          password: DEFAULT_PASSWORD,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "provision_person") {
      const DEFAULT_PASSWORD = "Pepper@2026";
      const personId: string | undefined = body.person_id;
      if (!personId) {
        return new Response(JSON.stringify({ error: "person_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: person, error: pErr } = await adminClient
        .from("staffing_people")
        .select("id, name, email")
        .eq("id", personId)
        .maybeSingle();
      if (pErr || !person) {
        return new Response(JSON.stringify({ error: pErr?.message || "Person not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const email = ((body.email as string) || person.email || "").trim();
      const name = ((body.name as string) || person.name || "").trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(JSON.stringify({ error: "valid email required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const emailLower = email.toLowerCase();

      // Find existing auth user with this email.
      const { data: authList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const existing = (authList?.users || []).find(
        (u) => (u.email || "").toLowerCase() === emailLower,
      );

      let userId: string;
      let status: "created" | "reset";
      if (existing) {
        await adminClient.auth.admin.updateUserById(existing.id, {
          password: DEFAULT_PASSWORD,
          email_confirm: true,
        });
        userId = existing.id;
        status = "reset";
      } else {
        const { data: newUser, error: cErr } = await adminClient.auth.admin.createUser({
          email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: name },
        });
        if (cErr || !newUser?.user) {
          return new Response(JSON.stringify({ error: cErr?.message || "create failed" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = newUser.user.id;
        status = "created";
      }

      // Explicit profile link → overrides any email-only auto-link from handle_new_user.
      await adminClient.from("profiles").upsert(
        { user_id: userId, display_name: name, staffing_person_id: person.id },
        { onConflict: "user_id" },
      );
      await adminClient
        .from("user_roles")
        .insert({ user_id: userId, role: "user" })
        .select()
        .then((r) => r, () => null);

      return new Response(
        JSON.stringify({ status, user_id: userId, email }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "provision_demo_logins") {
      const DEMO_PASSWORD = "Demo@1234";
      const DEMO_ACCOUNTS: { personId: string; email: string; appRole: "member" | "user" }[] = [
        // VSDs → 'member' role
        { personId: "p_adityashaw",        email: "aditya.shaw+demo@peppercontent.io",       appRole: "member" },
        { personId: "p_neema_jayadas",     email: "neema.jayadas+demo@peppercontent.io",     appRole: "member" },
        { personId: "p_aamir_khan",        email: "aamir.khan+demo@peppercontent.io",        appRole: "member" },
        { personId: "p_sumit_shekhawat",   email: "sumit.shekhawat+demo@peppercontent.io",   appRole: "member" },
        { personId: "p_sneha_iyer",        email: "sneha.iyer+demo@peppercontent.io",        appRole: "member" },
        // BOPMs → 'user' role
        { personId: "p_ritu_shinde",       email: "ritu.shinde+demo@peppercontent.io",       appRole: "user" },
        { personId: "p_tiffany_fernandes", email: "tiffany.fernandes+demo@peppercontent.io", appRole: "user" },
        { personId: "p_shreshtha_pathak",  email: "shreshtha.pathak+demo@peppercontent.io",  appRole: "user" },
      ];

      const ids = DEMO_ACCOUNTS.map((a) => a.personId);
      const { data: people } = await adminClient
        .from("staffing_people")
        .select("id, name")
        .in("id", ids);
      const personById = new Map((people || []).map((p: any) => [p.id, p.name as string]));

      const { data: authList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const existingByEmail = new Map<string, string>();
      (authList?.users || []).forEach((u) => {
        if (u.email) existingByEmail.set(u.email.toLowerCase(), u.id);
      });

      const results: { email: string; person: string; status: string; error?: string }[] = [];

      for (const acc of DEMO_ACCOUNTS) {
        const personName = personById.get(acc.personId);
        if (!personName) {
          results.push({ email: acc.email, person: acc.personId, status: "missing_person" });
          continue;
        }
        const emailLower = acc.email.toLowerCase();
        let userId = existingByEmail.get(emailLower);
        let status = "linked";

        if (!userId) {
          const { data: newUser, error: cErr } = await adminClient.auth.admin.createUser({
            email: acc.email,
            password: DEMO_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: personName },
          });
          if (cErr || !newUser?.user) {
            results.push({ email: acc.email, person: personName, status: "error", error: cErr?.message || "create failed" });
            continue;
          }
          userId = newUser.user.id;
          status = "created";
        } else {
          // Reset password to known demo value so it stays predictable.
          await adminClient.auth.admin.updateUserById(userId, {
            password: DEMO_PASSWORD,
            email_confirm: true,
          }).catch(() => {});
          status = "reset";
        }

        await adminClient.from("profiles").upsert(
          { user_id: userId, display_name: personName, staffing_person_id: acc.personId },
          { onConflict: "user_id" },
        );
        // Replace any auto-assigned roles with the persona-specific role.
        await adminClient.from("user_roles").delete().eq("user_id", userId);
        await adminClient
          .from("user_roles")
          .insert({ user_id: userId, role: acc.appRole })
          .select()
          .then((r) => r, () => null);

        results.push({ email: acc.email, person: personName, status });
      }

      return new Response(
        JSON.stringify({ password: DEMO_PASSWORD, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "provision_bopm_logins") {
      // Provision/sync auth accounts for every BOPM-style person using their
      // real settings email, with a known shared password for A/B testing.
      // - Matches by role_title OR designation containing "BOPM" / Account Engagement / Business Operations.
      // - If an auth account already exists but with a different email, the auth
      //   email is updated to match staffing_people.email (settings → users).
      // - (Re)links profile.staffing_person_id so deal-visibility works.
      const BOPM_PASSWORD = "Pepper@2026";
      const { data: bopms, error: bErr } = await adminClient
        .from("staffing_people")
        .select("id, name, email, role_title, designation")
        .or(
          [
            "role_title.ilike.%BOPM%",
            "designation.ilike.%BOPM%",
            "designation.ilike.%Account Engagement%",
            "designation.ilike.%Business Operations Project Manager%",
          ].join(","),
        );
      if (bErr) {
        return new Response(JSON.stringify({ error: bErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Dedupe by id (the table can carry duplicate rows for the same person).
      type Bopm = { id: string; name: string; email: string; role_title: string; designation: string };
      const dedup = new Map<string, Bopm>();
      for (const p of bopms || []) {
        if (!p.email || !p.email.trim()) continue;
        if (!dedup.has(p.id)) dedup.set(p.id, p as Bopm);
      }

      const { data: authList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const existingByEmail = new Map<string, string>();
      (authList?.users || []).forEach((u) => {
        if (u.email) existingByEmail.set(u.email.toLowerCase(), u.id);
      });

      const results: {
        person_id: string; name: string; email: string; role_title: string;
        status: string; error?: string;
      }[] = [];
      const skipped: { name: string; reason: string }[] = [];

      for (const p of dedup.values()) {
        const targetEmail = p.email.trim();
        const emailLower = targetEmail.toLowerCase();
        let userId = existingByEmail.get(emailLower);
        let status = "linked";

        // If we don't have an auth user with this exact email, check if a
        // profile already linked this person to a different auth account —
        // in that case, update that auth user's email to the settings email.
        if (!userId) {
          const { data: existingProfile } = await adminClient
            .from("profiles")
            .select("user_id")
            .eq("staffing_person_id", p.id)
            .limit(1)
            .maybeSingle();
          if (existingProfile?.user_id) {
            const { error: updErr } = await adminClient.auth.admin.updateUserById(
              existingProfile.user_id,
              { email: targetEmail, password: BOPM_PASSWORD, email_confirm: true },
            );
            if (!updErr) {
              userId = existingProfile.user_id;
              existingByEmail.set(emailLower, userId);
              status = "email_synced";
            }
          }
        }

        if (!userId) {
          const { data: newUser, error: cErr } = await adminClient.auth.admin.createUser({
            email: targetEmail,
            password: BOPM_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: p.name },
          });
          if (cErr || !newUser?.user) {
            results.push({
              person_id: p.id, name: p.name, email: p.email, role_title: p.role_title,
              status: "error", error: cErr?.message || "create failed",
            });
            continue;
          }
          userId = newUser.user.id;
          status = "created";
        } else if (status === "linked") {
          // Reset password to known shared value for A/B testing.
          await adminClient.auth.admin.updateUserById(userId, {
            password: BOPM_PASSWORD,
            email_confirm: true,
          }).catch(() => {});
          status = "reset";
        }

        // (Re)link profile to person — critical for deal visibility.
        await adminClient.from("profiles").upsert(
          { user_id: userId, display_name: p.name, staffing_person_id: p.id },
          { onConflict: "user_id" },
        );
        await adminClient
          .from("user_roles")
          .insert({ user_id: userId, role: "user" })
          .select()
          .then((r) => r, () => null);

        results.push({
          person_id: p.id, name: p.name, email: targetEmail,
          role_title: p.role_title, status,
        });
      }

      // Note any BOPMs we couldn't process for missing emails
      for (const p of bopms || []) {
        if (!p.email || !p.email.trim()) skipped.push({ name: p.name, reason: "missing email" });
      }

      return new Response(
        JSON.stringify({ password: BOPM_PASSWORD, count: results.length, results, skipped }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-user-mgmt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
