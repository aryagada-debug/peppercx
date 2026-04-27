const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { access_token, summary, description, start, end, attendees, location } = await req.json();
    if (!access_token || !summary || !start || !end) {
      return new Response(JSON.stringify({ error: "Missing access_token, summary, start, or end" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body: Record<string, unknown> = {
      summary,
      description: description || "",
      location: location || undefined,
      start: { dateTime: start },
      end: { dateTime: end },
    };
    if (Array.isArray(attendees) && attendees.length) {
      body.attendees = attendees.map((email: string) => ({ email }));
    }
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Google API error", details: data }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ event: { id: data.id, htmlLink: data.htmlLink, raw: data } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});