import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function GmailCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ran = useRef(false);
  const [state, setState] = useState<"running" | "done" | "error">("running");
  const [message, setMessage] = useState("Finishing Gmail connection…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      const code = params.get("code");
      const stateParam = params.get("state");
      const error = params.get("error");
      if (error) { setState("error"); setMessage(`Google returned: ${error}`); return; }
      if (!code || !stateParam) { setState("error"); setMessage("Missing OAuth response from Google."); return; }
      try {
        const { data, error: invErr } = await supabase.functions.invoke("gmail-oauth", {
          body: { action: "callback", code, state: stateParam, redirectUri: `${window.location.origin}/gmail/callback` },
        });
        if (invErr) throw invErr;
        if (data?.error) throw new Error(data.error);
        setState("done");
        setMessage("Gmail connected.");
        toast.success("Gmail connected");
        const target = data?.redirectTo || `${window.location.origin}/inbox`;
        try { const u = new URL(target); navigate(u.pathname + u.search); }
        catch { navigate("/inbox"); }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to connect Gmail";
        setState("error"); setMessage(msg); toast.error(msg);
      }
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="rounded-lg border border-border bg-card px-8 py-10 max-w-md w-full text-center space-y-4">
        {state === "running" && <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />}
        {state === "done" && <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />}
        {state === "error" && <AlertCircle className="h-8 w-8 mx-auto text-destructive" />}
        <p className="text-sm text-foreground">{message}</p>
        {state === "error" && (
          <button onClick={() => navigate("/inbox")} className="text-xs text-primary underline">Back to Inbox</button>
        )}
      </div>
    </div>
  );
}