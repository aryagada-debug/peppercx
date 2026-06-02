-- Reset Divya's password and add Staffing visibility (read-only)
UPDATE auth.users
SET encrypted_password = crypt('Pepper@2026', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'divya.ranganathan@peppercontent.io';

INSERT INTO public.user_route_overrides (user_id, route_key, visible, access_mode)
SELECT u.id, 'staffing', true, 'read'
FROM auth.users u
WHERE u.email = 'divya.ranganathan@peppercontent.io'
ON CONFLICT (user_id, route_key) DO UPDATE
  SET visible = true, access_mode = 'read';