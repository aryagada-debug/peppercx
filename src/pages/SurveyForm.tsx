import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import SurveyWizard from "@/components/pulse/SurveyWizard";
import { defaultConfig, normalizePulseConfig, PulseConfig } from "@/lib/pulseSurvey";

// Standalone public survey form. Mounted OUTSIDE AuthProvider so anonymous
// recipients can submit without ever hitting Lovable's editor auth wall.
type Invite = {
  invite_id: string;
  recipient_name: string;
  recipient_email: string;
  account_snapshot: string;
  deal_name_snapshot: string;
  completed: boolean;
};

export default function SurveyForm() {
  const params = useParams();
  const token = useMemo(() => {
    const routeToken = params.token || "";
    if (routeToken) return routeToken;
    if (typeof window === "undefined") return "";
    const qs = new URLSearchParams(window.location.search);
    const q = qs.get("token") || qs.get("survey") || "";
    if (q) return q;
    const m = window.location.pathname.match(/^\/(?:survey|s)\/([^/?#]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : "";
  }, [params.token]);

  const isPreview = token === "preview" || token === "demo";
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [config, setConfig] = useState<PulseConfig>(defaultConfig);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!token) {
          setError("This survey link is missing a token.");
          return;
        }
        // Load editable config (best-effort)
        supabase.from("pulse_survey_config" as any).select("config").eq("is_active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
          if (cancelled) return;
          const cfg = (data as any)?.config;
          if (cfg && typeof cfg === "object") setConfig(normalizePulseConfig(cfg));
        });
        if (isPreview) {
          setInvite({
            invite_id: "preview",
            recipient_name: "Ananya Sharma",
            recipient_email: "ananya@example.com",
            account_snapshot: "HDFC Bank",
            deal_name_snapshot: "SEO Retainer",
            completed: false,
          });
          return;
        }
        const { data, error } = await supabase.rpc("get_survey_invite_by_token" as any, { _token: token });
        if (cancelled) return;
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          setError("This survey link is invalid or has expired.");
          return;
        }
        setInvite(row as Invite);
        if ((row as Invite).completed) setCompleted(true);
        // Fire-and-forget opened beacon
        supabase.rpc("mark_survey_invite" as any, { _token: token, _state: "opened" }).then(() => {});
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load survey.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, isPreview]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="p-6 max-w-md w-full text-center space-y-2">
          <h1 className="text-lg font-semibold">Survey unavailable</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="p-8 max-w-md w-full text-center space-y-2">
          <div style={{ fontSize: 36 }}>🎉</div>
          <h1 className="text-lg font-semibold">Thanks — already received.</h1>
          <p className="text-sm text-muted-foreground">We've got your earlier response. Reach out anytime at centralcx@peppercontent.io.</p>
        </Card>
      </div>
    );
  }

  const subtitle = invite ? `${invite.account_snapshot || ""}${invite.deal_name_snapshot ? ` — ${invite.deal_name_snapshot}` : ""}` : undefined;

  return (
    <SurveyWizard
      config={config}
      headerSubtitle={subtitle}
      preview={isPreview}
      initial={{
        respondent: {
          role: "" as any,
          name: invite?.recipient_name || "",
          email: invite?.recipient_email || "",
          company: invite?.account_snapshot || "",
          capabilities: ["seo", "content"],
        },
      }}
      onSubmit={async (payload) => {
        const { data, error: rpcErr } = await supabase.rpc("submit_pulse_response" as any, {
          _token: token,
          _payload: payload as any,
        });
        if (rpcErr) return { ok: false, error: rpcErr.message };
        const res = (data || {}) as { ok?: boolean; error?: string; churn_risk?: string };
        if (res.error) return { ok: false, error: res.error };
        if (res.churn_risk === "HIGH") {
          supabase.functions.invoke("pulse-churn-alert", { body: { payload, invite: { account: invite?.account_snapshot, deal: invite?.deal_name_snapshot } } }).catch(() => {});
        }
        return { ok: true };
      }}
    />
  );
}