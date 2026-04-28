
-- Unschedule any prior versions if they exist (safe no-op otherwise)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname IN (
    'staffing-weekly-capacity-reminder',
    'staffing-assignment-start-reminder',
    'staffing-assignment-end-reminder'
  ) LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'staffing-weekly-capacity-reminder',
  '30 3 * * 1',
  $$
  SELECT net.http_post(
    url:='https://gdklfxqbocvoxcfthysy.supabase.co/functions/v1/staffing-capacity-reminders?mode=weekly',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdka2xmeHFib2N2b3hjZnRoeXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjE1OTMsImV4cCI6MjA4OTYzNzU5M30.rHinakkAMWIJ_5AdFLd65DXBWpUCHwM1Zty76y4z7x8"}'::jsonb,
    body:=concat('{"time":"', now(), '"}')::jsonb
  );
  $$
);

SELECT cron.schedule(
  'staffing-assignment-start-reminder',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://gdklfxqbocvoxcfthysy.supabase.co/functions/v1/staffing-capacity-reminders?mode=start',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdka2xmeHFib2N2b3hjZnRoeXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjE1OTMsImV4cCI6MjA4OTYzNzU5M30.rHinakkAMWIJ_5AdFLd65DXBWpUCHwM1Zty76y4z7x8"}'::jsonb,
    body:=concat('{"time":"', now(), '"}')::jsonb
  );
  $$
);

SELECT cron.schedule(
  'staffing-assignment-end-reminder',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://gdklfxqbocvoxcfthysy.supabase.co/functions/v1/staffing-capacity-reminders?mode=end',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdka2xmeHFib2N2b3hjZnRoeXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjE1OTMsImV4cCI6MjA4OTYzNzU5M30.rHinakkAMWIJ_5AdFLd65DXBWpUCHwM1Zty76y4z7x8"}'::jsonb,
    body:=concat('{"time":"', now(), '"}')::jsonb
  );
  $$
);
