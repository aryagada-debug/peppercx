## Problem

`parseCsatMatrix` already handles a flat array of strings correctly, so the fact that every dimension still lands as N/A means the CSAT value arriving from Apps Script isn't the flat array we assumed. Likely shapes we're not covering:

- A nested array (`[["1","2",...]]`) — happens when Apps Script wraps a grid response
- An object keyed by row title or index (`{ "Quality of the creative output": "1", ... }`)
- A single comma/newline-joined string (`"1, 2, 3, 4, 5, N/A, 5"`)

In all three cases `arr[i]` for i ≥ 1 is `undefined`, so every dimension becomes `null` (rendered as N/A).

## Fix

Harden `parseCsatMatrix` in `supabase/functions/pulse-google-form-webhook/index.ts` to normalize the input into a 7-slot array before mapping to dimensions:

1. If value is a nested single-element array, unwrap it.
2. If value is an object, try to map by exact dimension title first, else fall back to numeric keys `0..6`.
3. If value is a string containing commas or newlines, split on `/[,\n;|]+/` and trim.
4. If value is a lone scalar, wrap as `[v]` (existing behavior).
5. After normalization, run the existing per-index mapping: convert numeric strings, treat `"N/A"` (case-insensitive, with or without slash) as null, average the non-nulls, format as `X.X/5`.
6. Add `console.info("pulse_google_form_webhook_csat_parsed", { request_id, raw_type, raw_sample, perDimension, avg, display })` right after parsing (truncate `raw_sample` to keep logs small). Wire the `request_id` through by parsing CSAT after we have it (it already exists in the handler scope).

No schema, UI, or caller changes — the existing `csat_dimensions` / `csat_display` payload fields already flow to `GoogleFormResponseView`, so once parsing is correct the response drawer will show real per-dimension stars and the `X.X/5` overall.

## Verification

- Redeploy the function, then hit it with the diagnostic `test: true` payload from Settings using each shape (flat array, nested array, object, comma string, single string) and confirm the returned `parsed.csat_dimensions` / `parsed.csat_display` match expectations (e.g. `["1","2","3","4","5","N/A","5"]` → Ease=null, others populated, display `3.3/5`).
- Check `supabase--edge_function_logs` for the new `pulse_google_form_webhook_csat_parsed` line on a real submission to confirm which shape Apps Script actually sends.
