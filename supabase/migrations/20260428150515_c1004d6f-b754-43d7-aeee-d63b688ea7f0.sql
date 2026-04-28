
-- 1. Add access_mode to route_visibility (role-level access)
ALTER TABLE public.route_visibility
  ADD COLUMN IF NOT EXISTS access_mode TEXT;

-- 2. Backfill from existing visible flag and role defaults
UPDATE public.route_visibility
SET access_mode = CASE
  WHEN visible = false THEN 'hidden'
  WHEN role = 'view_only' THEN 'read'
  ELSE 'edit'
END
WHERE access_mode IS NULL;

-- 3. Default + check constraint
ALTER TABLE public.route_visibility
  ALTER COLUMN access_mode SET DEFAULT 'edit';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'route_visibility_access_mode_chk') THEN
    ALTER TABLE public.route_visibility
      ADD CONSTRAINT route_visibility_access_mode_chk
      CHECK (access_mode IN ('hidden','read','edit'));
  END IF;
END $$;

ALTER TABLE public.route_visibility
  ALTER COLUMN access_mode SET NOT NULL;
