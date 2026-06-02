DO $$
DECLARE
  v_uid uuid;
  v_email text := 'divya.ranganathan@peppercontent.io';
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(v_email);

  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email, crypt('Pepper@2026', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Divya Ranganathan"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  END IF;

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (v_uid, 'Divya Ranganathan')
  ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name;

  DELETE FROM public.user_roles WHERE user_id = v_uid;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'view_only'::app_role);
END $$;