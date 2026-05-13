import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("unauthorized");
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("unauthorized");
  return data.user;
}

async function getCalendarAccessToken(userId: string) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error("calendar_oauth_not_configured");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const err = new Error("calendar_not_connected");
    (err as Error & { status?: number }).status = 428;
    throw err;
  }

  const expiresAt = new Date(data.expires_at).getTime();
  if (expiresAt > Date.now() + 60_000) return data.access_token as string;
  if (!data.refresh_token) throw new Error("calendar_refresh_token_missing");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });
  const refreshed = await res.json();
  if (!res.ok) throw new Error(refreshed?.error_description || refreshed?.error || "Google token refresh failed");

  const expiresAtIso = new Date(Date.now() + Math.max(60, Number(refreshed.expires_in || 3600) - 60) * 1000).toISOString();
  const { error: updateError } = await admin
    .from("google_calendar_connections")
    .update({ access_token: refreshed.access_token, expires_at: expiresAtIso, scopes: refreshed.scope || undefined })
    .eq("user_id", userId);
  if (updateError) throw updateError;
  return refreshed.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getUser(req);
    const accessToken = await getCalendarAccessToken(user.id);
    const { event_id } = await req.json();
    if (!event_id) return json({ error: "Missing event_id" }, 400);

    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(event_id)}?sendUpdates=all`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok && res.status !== 410 && res.status !== 404) {
      const text = await res.text();
      return json({ error: "Google API error", details: text }, res.status);
    }
    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as Error & { status?: number }).status || (message === "unauthorized" ? 401 : 500);
    return json({ error: message }, status);
  }
});
