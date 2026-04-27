const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { access_token, event_id, summary, description, start, end, attendees, location } = await req.json();
    if (!access_token || !event_id) {
      return new Response(JSON.stringify({ error: "Missing access_token or event_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body: Record<string, unknown> = {};
    if (summary !== undefined) body.summary = summary;
    if (description !== undefined) body.description = description;
    if (location !== undefined) body.location = location;
    if (start) body.start = { dateTime: start };
    if (end) body.end = { dateTime: end };
    if (Array.isArray(attendees)) {
      body.attendees = attendees.map((email: string) => ({ email }));
    }
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(event_id)}?sendUpdates=all`,
      {
        method: "PATCH",
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