import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

/** Record a visit to a record so it appears in the Home → Recently Viewed card. */
export function useRecentView(entityType: string, entityId: string | null | undefined, entityName: string | null | undefined) {
  const { user } = useAuth();
  useEffect(() => {
    if (!user || !entityId || !entityName) return;
    const run = async () => {
      await supabase.from("user_recent_views").upsert({
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        viewed_at: new Date().toISOString(),
      }, { onConflict: "user_id,entity_type,entity_id" });
    };
    run();
  }, [user, entityType, entityId, entityName]);
}