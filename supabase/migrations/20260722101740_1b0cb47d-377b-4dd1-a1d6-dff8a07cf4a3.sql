-- Disable the legacy per-deal MBR/RGY notification rules that have been
-- replaced by the aggregated BOPM digests (mbr.reminder_bopm_digest,
-- rgy.reminder_bopm_digest).
UPDATE public.notification_rules
SET enabled = false, updated_at = now()
WHERE event_key IN ('mbr.missing_prev_month', 'rgy.stale_7d', 'rgy.alert');