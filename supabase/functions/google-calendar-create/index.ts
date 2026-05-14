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
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("unauthorized");
  return data.user;
}

async function getCalendarAccessToken(userId: string) {
  const googleClientId = GOOGLE_CLIENT_ID.trim().match(/\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com/i)?.[0] || GOOGLE_CLIENT_ID.trim();
  const googleClientSecret = GOOGLE_CLIENT_SECRET.trim();
  if (!googleClientId || !googleClientSecret) throw new Error("calendar_oauth_not_configured");
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
      client_id: googleClientId,
      client_secret: googleClientSecret,
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
    const { summary, description, start, end, attendees, location } = await req.json();
    if (!summary || !start || !end) return json({ error: "Missing summary, start, or end" }, 400);

    const body: Record<string, unknown> = {
      summary,
      description: description || "",
      location: location || undefined,
      start: { dateTime: start },
      end: { dateTime: end },
    };
    if (Array.isArray(attendees) && attendees.length) body.attendees = attendees.map((email: string) => ({ email }));

    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return json({ error: "Google API error", details: data }, res.status);
    return json({ event: { id: data.id, htmlLink: data.htmlLink, raw: data } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as Error & { status?: number }).status || (message === "unauthorized" ? 401 : 500);
    return json({ error: message }, status);
  }
});
