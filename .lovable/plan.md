# Fix: cursor loses focus in Survey form text fields

## Root cause

In `src/components/pulse/SurveyWizard.tsx`, the step components (`AboutStep`, `OutcomesStep`, `ExperienceStep`, `RetentionGrowthStep`, `RecommendStep`) are **defined inside** the `SurveyWizard` function body. They are then rendered as JSX elements (`<AboutStep />`, `<OutcomesStep />`, etc.) in `renderStep()`.

Because each render of `SurveyWizard` creates brand-new function references for these step components, React sees a different component type every keystroke and **unmounts + remounts** the whole subtree. That destroys the `<input>` / `<textarea>` DOM node, so the caret disappears and typing feels broken (only the first character sticks).

## Fix

Render the step functions as plain function calls that return JSX, instead of as JSX component elements. This treats their output as inline JSX belonging to `SurveyWizard`, so the underlying inputs are not remounted between keystrokes.

Change in `renderStep()`:

```text
case "about":            return AboutStep();
case "outcomes":         return OutcomesStep();
case "experience":       return ExperienceStep();
case "retention_growth": return RetentionGrowthStep();
case "recommend":        return RecommendStep();
```

No other changes — signatures, styles, validation, and layout stay identical.

(An equivalent alternative would be to hoist each step component to module scope and pass state via props, but that is a much larger refactor. The call-as-function fix is minimal and fully resolves the remount.)  
  
Additionally, for each of the option box, increase the thickness of the boundary

## Scope

- File: `src/components/pulse/SurveyWizard.tsx` (only the 5 lines in `renderStep`).
- No changes to `pulseSurvey.ts`, `SurveyForm.tsx`, styles, or backend.