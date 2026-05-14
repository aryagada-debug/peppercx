import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { invokeCalendarFunction } from "@/hooks/useGoogleCalendar";

export default function CalendarCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Connecting Google Calendar…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("error");
      const code = params.get("code");
      const state = params.get("state");

      if (error) {
        setFailed(true);
        setMessage(`Google Calendar connection was cancelled: ${error}`);
        return;
      }
      if (!code || !state) {
        setFailed(true);
        setMessage("Missing Google Calendar callback details.");
        return;
      }

      try {
        const data = await invokeCalendarFunction("google-calendar-oauth", {
          action: "callback",
          code,
          state,
          redirectUri: `${window.location.origin}/calendar/callback`,
        });
        toast.success("Google Calendar connected");
        window.location.replace(data?.redirectTo || "/home");
      } catch (err) {
        console.error("calendar callback", err);
        setFailed(true);
        setMessage(err instanceof Error ? err.message : "Could not finish Google Calendar connection.");
      }
    };

    void run();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
          {failed ? <CalendarDays className="h-5 w-5 text-destructive" /> : <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-medium text-foreground">Google Calendar</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {failed && (
          <Button variant="outline" onClick={() => navigate("/home", { replace: true })}>
            Back to Home
          </Button>
        )}
      </div>
    </div>
  );
}
