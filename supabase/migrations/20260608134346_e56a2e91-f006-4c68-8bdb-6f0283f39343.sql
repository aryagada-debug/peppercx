SELECT cron.unschedule('sheets-sync-deals-3h');
DROP TABLE IF EXISTS public.sync_runs CASCADE;