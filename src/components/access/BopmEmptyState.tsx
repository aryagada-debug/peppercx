import { AlertCircle } from "lucide-react";

/**
 * Shown to a BOPM-persona user when their `visibleDealIds` set is empty.
 * Most likely cause: their profile is not linked to a staffing person.
 */
export function BopmEmptyState({ section = "this section" }: { section?: string }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">
          No deals are tagged to you yet
        </div>
        <p className="text-xs text-muted-foreground max-w-xl">
          {section} only shows deals where you're listed as Principal BOPM,
          Senior BOPM, BOPM, or are staffed on the deal. If you expect to see
          deals here, ask an admin to link your profile to your record in the
          People directory under <span className="font-medium">Settings → Users &amp; Roles</span>.
        </p>
      </div>
    </div>
  );
}