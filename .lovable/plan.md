## Plan

1. **Use the stored parsed CSAT first**
   - Update the Google Form response viewer to read `payload.csat_dimensions` before trying to re-parse `payload.answers`.
   - This matches what the webhook already stores after parsing the fixed-order Google Form array.

2. **Add fixed-order array parsing in the viewer**
   - If the response still only has raw answers, parse the answer under either:
     - `How are we doing on each of these?`
     - `Rate how we're doing where it counts. Mark N/A for anything that doesn't apply to you.`
   - Map array index `0..6` to the seven experience dimensions.
   - Convert `"1".."5"` to numbers and treat `"N/A"` as `null`.

3. **Preserve fallback behavior**
   - Keep the existing object/key-based parsing so older or differently shaped responses still render.
   - Keep the overall Experience pill using the average of non-null dimension scores, falling back to the stored CSAT when needed.

4. **Clean up the console warning**
   - Convert the local `QA` component to `forwardRef` so the dialog no longer emits the React ref warning shown in console logs.

5. **Verify**
   - Run a focused check with a sample payload like `["1","2","3","4","5","N/A","5"]` and confirm the section renders `1,2,3,4,5,N/A,5` with Experience `3.3/5`.