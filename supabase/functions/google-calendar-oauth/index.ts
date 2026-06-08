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

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

function getCalendarCredentials() {
  const clientIdInput = GOOGLE_CLIENT_ID.trim();
  const clientId = clientIdInput.match(/\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com/i)?.[0] || clientIdInput;
  const clientSecret = GOOGLE_CLIENT_SECRET.trim();
  if (!clientId || !clientSecret) throw new Error("calendar_oauth_not_configured");
  if (!/^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(clientId)) {
    throw new Error("calendar_oauth_invalid_client_id_format");
  }
  return { clientId, clientSecret };
}

type Action = "init" | "callback" | "status" | "disconnect";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64urlEncode(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  return atob(padded);
}

async function hmac(value: string) {
  const keyData = new TextEncoder().encode(SERVICE_ROLE || GOOGLE_CLIENT_SECRET);
  const message = new TextEncoder().encode(value);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, message);
  const bytes = Array.from(new Uint8Array(signature));
  return b64urlEncode(String.fromCharCode(...bytes));
}

async function signState(payload: Record<string, unknown>) {
  const encoded = b64urlEncode(JSON.stringify(payload));
  return `${encoded}.${await hmac(encoded)}`;
}

async function verifyState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) throw new Error("Invalid calendar state");
  const expected = await hmac(payload);
  if (expected !== signature) throw new Error("Invalid calendar state signature");
  const parsed = JSON.parse(b64urlDecode(payload));
  if (!parsed.exp || Number(parsed.exp) < Date.now()) throw new Error("Calendar connection expired; please try again");
  return parsed as { userId: string; redirectTo: string; exp: number };
}

function isAllowedOrigin(url: URL) {
  const host = url.hostname;
  const isHttps = url.protocol === "https:";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return (isHttps && (host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com") || host === "peppercx.lovable.app")) || isLocal;
}

function parseCallbackUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("Missing redirect URI");
  const url = new URL(value);
  if (!isAllowedOrigin(url) || url.pathname !== "/calendar/callback") throw new Error("Invalid redirect URI");
  return url;
}

function parseRedirectTo(value: unknown, origin: string) {
  if (typeof value !== "string") return `${origin}/home`;
  const url = new URL(value, origin);
  if (!isAllowedOrigin(url) || url.origin !== origin) return `${origin}/home`;
  return url.toString();
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

async function tokenRequest(params: URLSearchParams) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.error || "Google token exchange failed");
  return data as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const credentials = getCalendarCredentials();

    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;
    if (!action) return json({ error: "Missing action" }, 400);

    // `status` is a read-only probe used during app boot — when the caller
    // isn't signed in (e.g. /login route, expired token), return a clean
    // "not connected" instead of 401 so it doesn't surface as a runtime
    // error. All other actions still require a valid session.
    let user;
    if (action === "status") {
      try {
        user = await getUser(req);
      } catch {
        return json({ connected: false, googleEmail: null, updatedAt: null });
      }
    } else {
      user = await getUser(req);
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (action === "status") {
      const { data } = await admin
        .from("google_calendar_connections")
        .select("google_email, connected_at, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      return json({ connected: !!data, googleEmail: data?.google_email || null, updatedAt: data?.updated_at || null });
    }

    if (action === "init") {
      const redirectUri = parseCallbackUrl(body.redirectUri);
      const redirectTo = parseRedirectTo(body.redirectTo, redirectUri.origin);
      const state = await signState({ userId: user.id, redirectTo, exp: Date.now() + 10 * 60_000 });
      const params = new URLSearchParams({
        client_id: credentials.clientId,
        redirect_uri: redirectUri.toString(),
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        state,
      });
      return json({ authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
    }

    if (action === "callback") {
      const code = typeof body.code === "string" ? body.code : "";
      const state = typeof body.state === "string" ? body.state : "";
      if (!code || !state) return json({ error: "Missing Google callback details" }, 400);
      const redirectUri = parseCallbackUrl(body.redirectUri);
      const verified = await verifyState(state);
      if (verified.userId !== user.id) return json({ error: "Calendar connection belongs to another user" }, 403);

      const existing = await admin
        .from("google_calendar_connections")
        .select("refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();

      const tokenData = await tokenRequest(new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        redirect_uri: redirectUri.toString(),
        grant_type: "authorization_code",
      }));

      let googleEmail: string | null = null;
      try {
        const userInfo = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userInfo.ok) {
          const profile = await userInfo.json();
          googleEmail = typeof profile.email === "string" ? profile.email : null;
        }
      } catch (_) {
        googleEmail = null;
      }

      const expiresAt = new Date(Date.now() + Math.max(60, tokenData.expires_in - 60) * 1000).toISOString();
      const refreshToken = tokenData.refresh_token || existing.data?.refresh_token || null;
      if (!refreshToken) return json({ error: "Google did not return an offline refresh token; remove app access in Google and try again" }, 400);

      const { error: upsertError } = await admin.from("google_calendar_connections").upsert({
        user_id: user.id,
        google_email: googleEmail,
        access_token: tokenData.access_token,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        scopes: tokenData.scope || SCOPES,
      }, { onConflict: "user_id" });

      if (upsertError) throw upsertError;
      return json({ ok: true, redirectTo: verified.redirectTo });
    }

    if (action === "disconnect") {
      const { data } = await admin
        .from("google_calendar_connections")
        .select("access_token, refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();

      await admin.from("google_calendar_connections").delete().eq("user_id", user.id);

      const token = data?.refresh_token || data?.access_token;
      if (token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === "unauthorized" ? 401 : 500;
    return json({ error: message }, status);
  }
});
