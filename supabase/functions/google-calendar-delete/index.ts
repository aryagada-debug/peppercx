const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { access_token, event_id } = await req.json();
    if (!access_token || !event_id) {
      return new Response(JSON.stringify({ error: "Missing access_token or event_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(event_id)}?sendUpdates=all`,
      { method: "DELETE", headers: { Authorization: `Bearer ${access_token}` } },
    );
    if (!res.ok && res.status !== 410 && res.status !== 404) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: "Google API error", details: text }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});