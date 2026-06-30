UPDATE public.gmail_connections SET is_central = false WHERE is_central = true;
UPDATE public.gmail_connections SET is_central = true WHERE google_email = 'centralcx@peppercontent.io';