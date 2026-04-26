-- 1. Add access_mode column
ALTER TABLE public.user_route_overrides
  ADD COLUMN IF NOT EXISTS access_mode text;

-- 2. Backfill from visible
UPDATE public.user_route_overrides
SET access_mode = CASE WHEN visible THEN 'edit' ELSE 'hidden' END
WHERE access_mode IS NULL;

-- 3. Enforce non-null + check constraint
ALTER TABLE public.user_route_overrides
  ALTER COLUMN access_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_route_overrides_access_mode_chk') THEN
    ALTER TABLE public.user_route_overrides
      ADD CONSTRAINT user_route_overrides_access_mode_chk
        CHECK (access_mode IN ('hidden','read','edit'));
  END IF;
END $$;