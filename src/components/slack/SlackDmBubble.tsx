import { useState } from "react";
import { MessageCircle, X, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SlackDmPanel, type SlackDmScope } from "./SlackDmPanel";

/**
 * Floating bubble that opens a Slack DM panel.
 * `scope` controls who can be DM'd:
 *   - "anyone"   → free-text email lookup against the Slack workspace (used on Home)
 *   - "staffing" → only people in staffing_people (used on Staffing page)
 * The `offsetRight` lets us avoid stacking on top of SlackChatBot when both are mounted.
 */
export function SlackDmBubble({ scope, label = "Slack DMs", offsetRight = 96 }: { scope: SlackDmScope; label?: string; offsetRight?: number }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ right: offsetRight }}
        className="fixed bottom-6 z-40 h-12 px-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:brightness-110 transition-all flex items-center gap-2 text-xs font-medium"
        title={label}
      >
        <MessageCircle className="h-4 w-4" />
        {label}
      </button>
    );
  }

  return (
    <div
      style={{ right: offsetRight }}
      className={cn(
        "fixed bottom-6 z-40 w-[360px] h-[480px] shadow-2xl rounded-md overflow-hidden bg-background border border-border flex flex-col",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
        <span className="text-xs font-medium">{label}</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setOpen(false)} title="Minimize">
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setOpen(false)} title="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <SlackDmPanel scope={scope} className="h-full border-0 rounded-none" />
      </div>
    </div>
  );
}