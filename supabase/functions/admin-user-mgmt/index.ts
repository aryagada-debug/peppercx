import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claims.claims.sub;

    // Admin client (service role) — bypasses RLS, used for auth.admin operations
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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

    const body = await req.json().catch(() => ({}));
    const action = body.action;

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
          users: data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at })),
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
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "bulk_provision") {
      const sendInvite = body.send_invite !== false;
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
          const tempPassword = crypto.randomUUID() + "Aa1!";
          const { data: newUser, error: cErr } = await adminClient.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: person.name },
          });
          if (cErr || !newUser?.user) {
            errors.push({ name: person.name, error: cErr?.message || "create failed" });
            continue;
          }
          userId = newUser.user.id;
          created++;

          if (sendInvite) {
            // Send password-setup email (non-blocking on failure)
            const redirectTo = `${new URL(req.url).origin.replace("/functions/v1", "")}`;
            await adminClient.auth.admin.generateLink({
              type: "recovery",
              email,
              options: { redirectTo: `${SUPABASE_URL.replace(".supabase.co", ".lovable.app")}/reset-password` },
            }).catch(() => {});
            // Use the user-friendly resetPasswordForEmail via a public client
            await userClient.auth.resetPasswordForEmail(email, {
              redirectTo: req.headers.get("origin")
                ? `${req.headers.get("origin")}/reset-password`
                : undefined,
            }).catch(() => {});
          }
        } else {
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
        }),
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
