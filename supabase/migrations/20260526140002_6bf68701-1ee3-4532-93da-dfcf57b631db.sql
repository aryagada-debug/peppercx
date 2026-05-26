INSERT INTO public.route_visibility (role, route_key, visible, access_mode)
SELECT role, 'people-ops', visible, access_mode
FROM public.route_visibility
WHERE route_key = 'staffing'
ON CONFLICT (role, route_key) DO NOTHING;