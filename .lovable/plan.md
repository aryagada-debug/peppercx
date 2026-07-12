## Change

In `src/components/pulse/SurveyWizard.tsx` `validate()`, drop the "required" checks for all free-text (textarea/text) inputs so they behave as optional again. Scale/star/choice questions stay required.

### Fields reverted to optional

- `nps.verbatim` (NPS follow-up comment)
- `capability_deep_dive.seo.win_outcome` (single SEO/GEO win outcome textarea)
- `experience.comment` (experience follow-up comment)
- `retention.save_lever` (renewal save-lever textarea, including when intent is unsure/risk/gone)

### UI

- Remove the red `*` required marker from the `FieldLabel` of each of the four textarea fields above. Leave `*` on all scale/choice/star questions (still required).  
Make the feedback form in light theme

### Out of scope

- No changes to scale, star, radio, or multi-select validation.
- No changes to `pulseSurvey.ts`, `SurveyForm.tsx`, styles, layout, or post-submit screen.