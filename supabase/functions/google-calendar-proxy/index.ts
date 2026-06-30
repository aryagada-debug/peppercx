import { createClient } from "npm:@supabase/supabase-js@2";

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
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await userClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("unauthorized");
  return { id: data.claims.sub as string };
}

async function refreshAccessToken(userId: string, refreshToken: string) {
  const googleClientId = GOOGLE_CLIENT_ID.trim().match(/\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com/i)?.[0] || GOOGLE_CLIENT_ID.trim();
  const googleClientSecret = GOOGLE_CLIENT_SECRET.trim();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const refreshed = await res.json();
  if (!res.ok) {
    // invalid_grant => refresh token has been revoked/expired. Clear the stored
    // connection so the UI shows a Connect button instead of looping on 401s.
    const reason = String(refreshed?.error || "");
    if (reason === "invalid_grant" || reason === "unauthorized_client") {
      await admin.from("google_calendar_connections").delete().eq("user_id", userId);
      const err = new Error("calendar_refresh_token_missing");
      (err as Error & { status?: number }).status = 428;
      throw err;
    }
    const err = new Error(refreshed?.error_description || refreshed?.error || "Google token refresh failed");
    (err as Error & { status?: number }).status = 428;
    throw err;
  }
  const expiresAtIso = new Date(Date.now() + Math.max(60, Number(refreshed.expires_in || 3600) - 60) * 1000).toISOString();
  await admin
    .from("google_calendar_connections")
    .update({ access_token: refreshed.access_token, expires_at: expiresAtIso, scopes: refreshed.scope || undefined })
    .eq("user_id", userId);
  return refreshed.access_token as string;
}

async function getCalendarAccessToken(userId: string, forceRefresh = false) {
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
  if (!forceRefresh && expiresAt > Date.now() + 60_000) return data.access_token as string;
  if (!data.refresh_token) throw new Error("calendar_refresh_token_missing");
  return await refreshAccessToken(userId, data.refresh_token);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getUser(req);
    let accessToken = await getCalendarAccessToken(user.id);
    const { timeMin: tMin, timeMax: tMax, q, maxResults } = await req.json().catch(() => ({}));

    const now = new Date();
    const timeMin = tMin || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const timeMax = tMax || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(maxResults || 250),
    });
    if (q) params.set("q", String(q));

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
    let res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 401) {
      // Stored token rejected by Google — force refresh and retry once
      await res.body?.cancel();
      accessToken = await getCalendarAccessToken(user.id, true);
      res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    }
    const data = await res.json();
    if (!res.ok) return json({ error: "Google API error", details: data }, res.status);
    return json({ events: data.items || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as Error & { status?: number }).status || (message === "unauthorized" ? 401 : 500);
    return json({ error: message }, status);
  }
});
