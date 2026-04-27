const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { access_token, timeMin: tMin, timeMax: tMax, q, maxResults } = await req.json();

    if (!access_token) {
      return new Response(JSON.stringify({ error: "Missing access_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const timeMin = tMin || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const timeMax = tMax || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    const params = new URLSearchParams({
      timeMin, timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(maxResults || 250),
    });
    if (q) params.set("q", q);
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: "Google API error", details: errText }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();

    return new Response(JSON.stringify({ events: data.items || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
