import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

// Beta typed wrapper around supabase.auth.oauth (types not exposed yet in the SDK).
type OAuthClient = { name?: string; client_name?: string; redirect_uris?: string[] } | null;
type OAuthDetails = {
  client?: OAuthClient;
  scope?: string;
  scopes?: string[];
  redirect_uri?: string;
  redirect_url?: string;
  redirect_to?: string;
} | null;
type OAuthResult = { redirect_url?: string; redirect_to?: string } | null;

function oauth() {
  return (supabase.auth as unknown as {
    oauth: {
      getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails; error: { message: string } | null }>;
      approveAuthorization: (id: string) => Promise<{ data: OAuthResult; error: { message: string } | null }>;
      denyAuthorization: (id: string) => Promise<{ data: OAuthResult; error: { message: string } | null }>;
    };
  }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthDetails>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      setAccount(sess.session.user.email ?? sess.session.user.id);
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-2 text-center">
          <h1 className="text-lg font-medium">Could not load this authorization</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "an application";
  const scopeList = details.scopes ?? (details.scope ? details.scope.split(/\s+/).filter(Boolean) : []);
  const redirect = details.redirect_uri ?? details.client?.redirect_uris?.[0];

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-medium tracking-tight">Connect {clientName} to CX OS</h1>
          <p className="text-sm text-muted-foreground">
            {clientName} will be able to call CX OS tools while you are signed in.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Signed in as</span>{" "}
            <span className="font-medium">{account}</span>
          </div>
          {redirect ? (
            <div className="break-all">
              <span className="text-muted-foreground">Redirect</span>{" "}
              <span className="font-mono text-xs">{redirect}</span>
            </div>
          ) : null}
          {scopeList.length > 0 ? (
            <div>
              <span className="text-muted-foreground">Requested access</span>
              <ul className="mt-1 list-disc pl-5">
                {scopeList.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            This does not bypass CX OS permissions or backend policies. Tools run as you.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Cancel connection
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? "Working…" : "Approve"}
          </Button>
        </div>
      </div>
    </main>
  );
}