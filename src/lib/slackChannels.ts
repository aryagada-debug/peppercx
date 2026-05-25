import { supabase } from "@/integrations/supabase/client";

export interface SlackChannel { id: string; name: string; is_private: boolean }
interface ChannelListResponse { channels?: SlackChannel[]; error?: string; retryAfter?: number; slackError?: string; cached?: boolean }

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; channels: SlackChannel[] } | null = null;
let inflight: Promise<SlackChannel[]> | null = null;

export function getCachedSlackChannels(): SlackChannel[] | null {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.channels;
  return null;
}

export function clearSlackChannelCache() {
  cache = null;
}

/**
 * Fetch Slack channels with in-memory caching + in-flight dedupe so opening
 * the picker on multiple deals back-to-back doesn't re-paginate Slack and
 * trip its rate limit. Throws a friendly Error on failure.
 */
export async function loadSlackChannels(force = false): Promise<SlackChannel[]> {
  if (!force) {
    const cached = getCachedSlackChannels();
    if (cached) return cached;
    if (inflight) return inflight;
  }
  inflight = (async () => {
    const { data, error } = await supabase.functions.invoke<ChannelListResponse>("slack-list-channels");
    if (error) {
      // Functions client surfaces non-2xx as FunctionsHttpError with a context.
      const status = (error as { context?: { status?: number } }).context?.status;
      const body = (error as { context?: { body?: unknown } }).context?.body as ChannelListResponse | undefined;
      if (status === 429 || body?.error === "rate_limited") {
        const retry = body?.retryAfter || 30;
        throw new Error(`Slack is rate-limiting channel lookups. Try again in ${retry}s.`);
      }
      if (status === 401 || body?.error === "auth_failed") {
        throw new Error("Slack connection needs to be re-authorized.");
      }
      throw new Error(error.message || "Failed to load Slack channels.");
    }
    if (data?.error) {
      if (data.error === "rate_limited") {
        throw new Error(`Slack is rate-limiting channel lookups. Try again in ${data.retryAfter || 30}s.`);
      }
      if (data.error === "auth_failed") {
        throw new Error("Slack connection needs to be re-authorized.");
      }
      throw new Error(data.error);
    }
    const channels = data?.channels || [];
    cache = { at: Date.now(), channels };
    return channels;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
