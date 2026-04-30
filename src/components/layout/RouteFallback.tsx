import { Loader2 } from "lucide-react";

/**
 * Minimal full-page fallback shown while a lazy-loaded route chunk is being
 * fetched. Intentionally light — no sidebar/header skeleton — so that
 * navigations between already-cached routes feel instant on subsequent
 * visits, and the first visit shows a single subtle spinner instead of a
 * jarring layout flash.
 */
export function RouteFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}