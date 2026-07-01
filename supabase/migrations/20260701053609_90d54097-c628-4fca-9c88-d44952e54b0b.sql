
CREATE TABLE IF NOT EXISTS public.slack_channel_health (
  deal_id text PRIMARY KEY REFERENCES public.staffing_deals(id) ON DELETE CASCADE,
  channel_id text,
  channel_name text,
  is_connected boolean NOT NULL DEFAULT false,
  msg_count_90d integer NOT NULL DEFAULT 0,
  msg_count_30d integer NOT NULL DEFAULT 0,
  msg_count_7d integer NOT NULL DEFAULT 0,
  external_count_90d integer NOT NULL DEFAULT 0,
  internal_count_90d integer NOT NULL DEFAULT 0,
  last_msg_at timestamptz,
  first_msg_at timestamptz,
  avg_gap_hours numeric,
  rgy text NOT NULL DEFAULT 'R',
  reason text,
  computed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.slack_channel_health TO authenticated;
GRANT ALL ON public.slack_channel_health TO service_role;

ALTER TABLE public.slack_channel_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership can read slack health" ON public.slack_channel_health
  FOR SELECT TO authenticated
  USING (public.is_leadership_viewer(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_slack_messages_channel_created
  ON public.slack_messages(channel_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.refresh_slack_channel_health()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH agg AS (
    SELECT
      channel_id,
      COUNT(*) FILTER (WHERE created_at >= now() - interval '90 days')::int AS c90,
      COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS c30,
      COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS c7,
      COUNT(*) FILTER (WHERE created_at >= now() - interval '90 days' AND source = 'slack')::int AS ext,
      COUNT(*) FILTER (WHERE created_at >= now() - interval '90 days' AND source = 'app')::int AS intn,
      MAX(created_at) AS last_at,
      MIN(created_at) FILTER (WHERE created_at >= now() - interval '90 days') AS first_at
    FROM public.slack_messages
    WHERE dm_thread_id IS NULL
    GROUP BY channel_id
  ), src AS (
    SELECT
      d.id AS deal_id,
      NULLIF(trim(d.slack_channel_id), '') AS channel_id,
      COALESCE(a.c90, 0) AS c90,
      COALESCE(a.c30, 0) AS c30,
      COALESCE(a.c7, 0) AS c7,
      COALESCE(a.ext, 0) AS ext,
      COALESCE(a.intn, 0) AS intn,
      a.last_at, a.first_at
    FROM public.staffing_deals d
    LEFT JOIN agg a ON a.channel_id = NULLIF(trim(d.slack_channel_id), '')
    WHERE public._is_active_staffing_status(d.deal_status)
  )
  INSERT INTO public.slack_channel_health AS h (
    deal_id, channel_id, channel_name, is_connected,
    msg_count_90d, msg_count_30d, msg_count_7d,
    external_count_90d, internal_count_90d,
    last_msg_at, first_msg_at, avg_gap_hours,
    rgy, reason, computed_at
  )
  SELECT
    deal_id, channel_id, NULL,
    channel_id IS NOT NULL,
    c90, c30, c7, ext, intn, last_at, first_at,
    CASE
      WHEN c90 > 1 AND first_at IS NOT NULL AND last_at IS NOT NULL AND last_at > first_at
        THEN EXTRACT(EPOCH FROM (last_at - first_at))/3600.0/(c90 - 1)
      ELSE NULL
    END,
    CASE
      WHEN channel_id IS NULL THEN 'R'
      WHEN c30 = 0 THEN 'R'
      WHEN c7 >= 3 AND c90 >= 20 THEN 'G'
      ELSE 'Y'
    END,
    CASE
      WHEN channel_id IS NULL THEN 'No Slack channel linked'
      WHEN c30 = 0 THEN 'No messages in last 30 days'
      WHEN c7 >= 3 AND c90 >= 20 THEN 'Healthy cadence'
      WHEN last_at IS NULL THEN 'Channel linked but no message history'
      ELSE 'Active but low volume or slow cadence'
    END,
    now()
  FROM src
  ON CONFLICT (deal_id) DO UPDATE SET
    channel_id = EXCLUDED.channel_id,
    is_connected = EXCLUDED.is_connected,
    msg_count_90d = EXCLUDED.msg_count_90d,
    msg_count_30d = EXCLUDED.msg_count_30d,
    msg_count_7d = EXCLUDED.msg_count_7d,
    external_count_90d = EXCLUDED.external_count_90d,
    internal_count_90d = EXCLUDED.internal_count_90d,
    last_msg_at = EXCLUDED.last_msg_at,
    first_msg_at = EXCLUDED.first_msg_at,
    avg_gap_hours = EXCLUDED.avg_gap_hours,
    rgy = EXCLUDED.rgy,
    reason = EXCLUDED.reason,
    computed_at = EXCLUDED.computed_at;

  DELETE FROM public.slack_channel_health h
   WHERE NOT EXISTS (
     SELECT 1 FROM public.staffing_deals d
      WHERE d.id = h.deal_id AND public._is_active_staffing_status(d.deal_status)
   );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_slack_channel_health() TO authenticated, service_role;
