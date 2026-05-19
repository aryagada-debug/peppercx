UPDATE public.deal_tasks t
SET description = COALESCE(t.description, '')
  || CASE WHEN COALESCE(t.description, '') = '' THEN '' ELSE E'\n\n' END
  || '<p>Record the MBR directly: <a href="https://peppercx.lovable.app/deals/'
  || COALESCE(sd.id::text, t.deal_id)
  || '?tab=MBR&action=record" target="_blank" rel="noopener noreferrer">Open MBR recorder</a></p>'
FROM (SELECT id::text AS id FROM public.staffing_deals) sd
WHERE t.phase = 'MBR'
  AND (t.title ILIKE 'Schedule MBR%' OR t.title ILIKE 'Update MBR%')
  AND (t.description IS NULL OR t.description NOT ILIKE '%action=record%')
  AND sd.id = t.deal_id;

UPDATE public.deal_tasks t
SET description = COALESCE(t.description, '')
  || CASE WHEN COALESCE(t.description, '') = '' THEN '' ELSE E'\n\n' END
  || '<p>Record the MBR directly: <a href="https://peppercx.lovable.app/deals/'
  || t.deal_id
  || '?tab=MBR&action=record" target="_blank" rel="noopener noreferrer">Open MBR recorder</a></p>'
WHERE t.phase = 'MBR'
  AND (t.title ILIKE 'Schedule MBR%' OR t.title ILIKE 'Update MBR%')
  AND (t.description IS NULL OR t.description NOT ILIKE '%action=record%');