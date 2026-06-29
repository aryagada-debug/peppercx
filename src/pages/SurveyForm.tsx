import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";

// Standalone public survey form. Mounted OUTSIDE AuthProvider so anonymous
// recipients can submit without ever hitting Lovable's editor auth wall.
// Writes directly to Supabase via the anon client — no edge function, no JWT.

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
  const [nps, setNps] = useState<number | null>(null);
  const [csat, setCsat] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!token) {
          setError("This survey link is missing a token.");
          return;
        }
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
        if ((row as Invite).completed) setSubmitted(true);
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

  const canSubmit = useMemo(() => nps !== null && csat !== null && !submitting, [nps, csat, submitting]);

  const submit = async () => {
    if (!canSubmit || !invite) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isPreview) { setSubmitted(true); return; }
      const payload = {
        nps: { score: nps },
        experience: { avg: csat },
        respondent: {
          name: invite.recipient_name,
          email: invite.recipient_email,
          company: invite.account_snapshot,
        },
        comment,
      };
      const { error: insErr } = await supabase
        .from("survey_responses" as any)
        .insert({
          invite_id: invite.invite_id,
          nps,
          csat_avg: csat,
          respondent_name: invite.recipient_name || null,
          respondent_email: invite.recipient_email || null,
          respondent_company: invite.account_snapshot || null,
          payload,
        } as any);
      if (insErr) {
        if (/duplicate|unique|already/i.test(insErr.message)) {
          setSubmitted(true);
          return;
        }
        throw insErr;
      }
      await supabase.rpc("mark_survey_invite" as any, { _token: token, _state: "completed" });
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.message || "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">Pepper Pulse</h1>
          <p className="text-sm text-muted-foreground">
            {invite?.account_snapshot}{invite?.deal_name_snapshot ? ` — ${invite.deal_name_snapshot}` : ""}
          </p>
        </div>

        {submitted ? (
          <Card className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" />
            <h2 className="text-lg font-semibold">Thank you!</h2>
            <p className="text-sm text-muted-foreground">
              {isPreview ? "This is a preview of the survey experience." : "Your feedback has been recorded."}
            </p>
          </Card>
        ) : (
          <Card className="p-6 space-y-6">
            <div>
              <p className="text-sm font-medium mb-2">
                Hi {invite?.recipient_name?.split(" ")[0] || "there"}, how likely are you to recommend Pepper to a colleague?
              </p>
              <div className="grid grid-cols-11 gap-1">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setNps(i)}
                    className={`h-10 rounded-md border text-sm font-medium transition ${
                      nps === i ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                    }`}
                  >{i}</button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>Not at all likely</span><span>Extremely likely</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">How would you rate your overall experience?</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCsat(n)}
                    className={`flex-1 h-10 rounded-md border text-sm font-medium transition ${
                      csat === n ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                    }`}
                  >{n}</button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>Poor</span><span>Excellent</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Anything you'd like to share? (optional)</label>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="What's working well, what could improve…" />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full" disabled={!canSubmit} onClick={submit}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : "Submit feedback"}
            </Button>
          </Card>
        )}

        <p className="text-center text-[11px] text-muted-foreground">Sent by Pepper Content · centralcx@peppercontent.io</p>
      </div>
    </div>
  );
}