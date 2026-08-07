import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "send" | "list" | "get" | "modify";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function getCreds() {
  const idRaw = GOOGLE_CLIENT_ID.trim();
  const clientId = idRaw.match(/\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com/i)?.[0] || idRaw;
  const clientSecret = GOOGLE_CLIENT_SECRET.trim();
  if (!clientId || !clientSecret) throw new Error("gmail_oauth_not_configured");
  return { clientId, clientSecret };
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

async function getAccessToken(admin: SupabaseClient, userId: string) {
  const { data: conn, error } = await admin.from("gmail_connections")
    .select("access_token, refresh_token, expires_at, google_email")
    .eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!conn) throw new Error("gmail_not_connected");

  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt - Date.now() > 30_000) {
    return { token: conn.access_token as string, email: conn.google_email as string | null };
  }

  if (!conn.refresh_token) throw new Error("gmail_reauth_required");

  const creds = getCreds();
  const params = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
    refresh_token: conn.refresh_token as string,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString(),
  });
  const rawBody = await res.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(rawBody); } catch { /* non-JSON body */ }
  if (!res.ok) {
    console.error("[gmail-api] token refresh failed", res.status, rawBody);
    const code = String(data?.error ?? "");
    if (code === "invalid_grant" || code === "invalid_request" || res.status === 400 || res.status === 401) {
      throw new Error("gmail_reauth_required");
    }
    throw new Error(String(data?.error_description ?? data?.error ?? "token_refresh_failed"));
  }
  const expiresIn = Number(data.expires_in) || 3600;
  const newExpires = new Date(Date.now() + Math.max(60, expiresIn - 60) * 1000).toISOString();
  await admin.from("gmail_connections").update({
    access_token: data.access_token as string, expires_at: newExpires,
  }).eq("user_id", userId);
  return { token: data.access_token as string, email: conn.google_email as string | null };
}

function b64urlEncode(s: string) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildRaw({ to, cc, bcc, subject, body, from, replyToMessageId, references }: {
  to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string; from?: string | null;
  replyToMessageId?: string; references?: string;
}) {
  const lines: string[] = [];
  if (from) lines.push(`From: ${from}`);
  lines.push(`To: ${to.join(", ")}`);
  if (cc?.length) lines.push(`Cc: ${cc.join(", ")}`);
  if (bcc?.length) lines.push(`Bcc: ${bcc.join(", ")}`);
  lines.push(`Subject: ${subject}`);
  if (replyToMessageId) lines.push(`In-Reply-To: ${replyToMessageId}`);
  if (references) lines.push(`References: ${references}`);
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: text/html; charset="UTF-8"');
  lines.push("");
  lines.push(body);
  return b64urlEncode(lines.join("\r\n"));
}

function decodeB64Url(v: string) {
  const padded = v.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (v.length % 4)) % 4);
  try { return decodeURIComponent(escape(atob(padded))); } catch { return ""; }
}

function extractBody(payload: any): { text: string; html: string } {
  let text = "", html = "";
  const walk = (p: any) => {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data) text ||= decodeB64Url(p.body.data);
    if (p.mimeType === "text/html" && p.body?.data) html ||= decodeB64Url(p.body.data);
    if (Array.isArray(p.parts)) p.parts.forEach(walk);
  };
  walk(payload);
  return { text, html };
}

function headerMap(headers: any[]) {
  const m: Record<string, string> = {};
  for (const h of headers || []) m[(h.name || "").toLowerCase()] = h.value || "";
  return m;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getUser(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;
    if (!action) return json({ error: "missing_action" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { token, email } = await getAccessToken(admin, user.id);

    if (action === "send") {
      const to = Array.isArray(body.to) ? body.to.filter((x: unknown) => typeof x === "string" && x.includes("@")) : [];
      if (to.length === 0) return json({ error: "missing_recipients" }, 400);
      const subject = typeof body.subject === "string" ? body.subject.slice(0, 998) : "";
      const html = typeof body.body === "string" ? body.body : "";
      const cc = Array.isArray(body.cc) ? body.cc.filter((x: unknown) => typeof x === "string" && x.includes("@")) : undefined;
      const bcc = Array.isArray(body.bcc) ? body.bcc.filter((x: unknown) => typeof x === "string" && x.includes("@")) : undefined;
      const raw = buildRaw({ to, cc, bcc, subject, body: html, from: email, replyToMessageId: body.replyTo, references: body.references });
      const send = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw, threadId: body.threadId || undefined }),
      });
      const data = await send.json();
      if (!send.ok) return json({ error: data?.error?.message || "gmail_send_failed", detail: data }, 500);
      return json({ ok: true, id: data.id, threadId: data.threadId });
    }

    if (action === "list") {
      const maxResults = Math.min(Number(body.maxResults) || 25, 100);
      const q = typeof body.q === "string" ? body.q : "in:inbox";
      const params = new URLSearchParams({ maxResults: String(maxResults), q });
      const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = await listRes.json();
      if (!listRes.ok) return json({ error: list?.error?.message || "gmail_list_failed" }, 500);
      const ids: string[] = (list.messages || []).map((m: any) => m.id);
      const messages = await Promise.all(ids.map(async (id) => {
        const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const m = await r.json();
        const h = headerMap(m.payload?.headers || []);
        return {
          id: m.id, threadId: m.threadId, snippet: m.snippet || "",
          labelIds: m.labelIds || [], internalDate: m.internalDate,
          from: h.from || "", subject: h.subject || "(no subject)", date: h.date || "",
          unread: (m.labelIds || []).includes("UNREAD"),
        };
      }));
      return json({ messages, googleEmail: email });
    }

    if (action === "get") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return json({ error: "missing_id" }, 400);
      const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const m = await r.json();
      if (!r.ok) return json({ error: m?.error?.message || "gmail_get_failed" }, 500);
      const h = headerMap(m.payload?.headers || []);
      const { text, html } = extractBody(m.payload);
      return json({
        id: m.id, threadId: m.threadId, snippet: m.snippet || "",
        from: h.from || "", to: h.to || "", cc: h.cc || "", subject: h.subject || "(no subject)",
        date: h.date || "", messageId: h["message-id"] || "", references: h.references || "",
        text, html, labelIds: m.labelIds || [],
      });
    }

    if (action === "modify") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return json({ error: "missing_id" }, 400);
      const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ addLabelIds: body.addLabelIds || [], removeLabelIds: body.removeLabelIds || [] }),
      });
      const data = await r.json();
      if (!r.ok) return json({ error: data?.error?.message || "gmail_modify_failed" }, 500);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gmail-api] error", message);
    const status = message === "unauthorized"
      ? 401
      : (message === "gmail_not_connected" || message === "gmail_reauth_required")
        ? 412
        : 500;
    return json({ error: message }, status);
  }
});