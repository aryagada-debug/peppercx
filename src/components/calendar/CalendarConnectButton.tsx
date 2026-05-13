import { CalendarDays, CheckCircle2, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { cn } from "@/lib/utils";

interface Props {
  size?: "sm" | "default";
  className?: string;
}

export function CalendarConnectButton({ size = "sm", className }: Props) {
  const { connected, connecting, checking, googleEmail, connect, disconnect } = useGoogleCalendar();

  if (connected) {
    return (
      <div className={cn("inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1", className)}>
        <CheckCircle2 className="h-3.5 w-3.5 text-positive" />
        <span className="text-caption text-foreground">{googleEmail ? `Synced: ${googleEmail}` : "Calendar synced"}</span>
        <button
          type="button"
          onClick={disconnect}
          className="ml-1 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Disconnect calendar"
        >
          <LogOut className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <Button size={size} variant="outline" onClick={connect} disabled={connecting || checking} className={cn("gap-1.5", className)}>
      {connecting || checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
      Connect Google Calendar
    </Button>
  );
}