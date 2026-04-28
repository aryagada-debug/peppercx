## Problem

The "Admin / VSD / BOPMs/Creative" persona switcher in the top bar has two issues:

1. **Switching does nothing until refresh.** `useUserRole` is a hook with **per-component local state**. When `RoleSwitcher` calls `setViewAsRole`, only its own copy of `viewAsRole` updates. Every other component that calls `useUserRole()` (sidebar, ProtectedRoute, pages, deal access checks, etc.) keeps its old `viewAsRole` value and only picks up the change on a full refresh when each instance re-reads `localStorage` on mount.
2. **Active persona is not visually prominent.** The animated indicator pill is `bg-primary` with `text-primary-foreground`, but on the current theme the contrast is weak and the inactive items look almost identical to the active one. There's no icon emphasis or color shift to signal selection.

## Fix

### 1. Make persona switching instant (global state)

Refactor `src/hooks/useUserRole.ts` so the `viewAsRole` override (and the loaded role/route data) lives in a **single shared store**, not per-hook local state. Two clean options that fit the project:

- Create a tiny `UserRoleProvider` context that holds `actualRole`, `viewAsRole`, `visibleRoutes`, `routeAccess`, `loading`, and exposes `setViewAsRole` + `refresh`. Mount it once in `src/App.tsx` (above the routes, inside `AuthProvider`). `useUserRole()` becomes `useContext(UserRoleContext)`.
- Keep the public API of `useUserRole` identical so no call sites change.

Result: `RoleSwitcher` calling `setViewAsRole("member")` updates the single store → every consumer (sidebar visibility, ProtectedRoute, page-level edit gates, DealDetail, Targets, etc.) re-renders immediately and the role-scoped Supabase reload (`load()` in the hook) runs once for everyone.

Also: keep the `localStorage` persistence so the choice survives reloads (already there), and keep reading it once on provider mount.

### 2. Make the active persona obvious

Update `src/components/layout/RoleSwitcher.tsx`:

- Active button: solid `bg-primary text-primary-foreground` **plus** `font-medium`, slightly larger horizontal padding, and the icon tinted to `text-primary-foreground`. Keep the sliding indicator but raise its contrast (e.g. add a subtle `ring-1 ring-primary/40`) so it reads as a clearly selected chip.
- Inactive buttons: `text-muted-foreground` with `hover:bg-muted hover:text-foreground`, icon at `opacity-70`.
- Add a small left-side label/chip "Viewing as:" before the segmented control so users always know what the control represents. On the current 1179px viewport there is room next to the search/theme toggles; on narrower widths hide the label with `hidden md:inline`.
- Add a subtle persistent badge in the top bar (next to the user menu) that reads `Viewing as VSD` / `Viewing as BOPMs` whenever `viewAsRole !== null`, with a small "Reset" affordance that calls `setViewAsRole(null)`. This makes the override unmistakable even when the segmented control is off-screen.

No other behavior changes. Two-font-weight and flat-UI rules from the project memory are preserved (Regular + Medium only, no shadows/gradients, semantic colors only via `bg-primary` / `bg-muted`).

## Files to edit

- `src/hooks/useUserRole.ts` — split into a `UserRoleProvider` + `useUserRole` consumer hook; same return shape.
- `src/App.tsx` — wrap routes in `<UserRoleProvider>` (inside `AuthProvider`).
- `src/components/layout/RoleSwitcher.tsx` — stronger active styling, "Viewing as:" label, optional reset chip.
- `src/components/layout/AppLayout.tsx` — render the small "Viewing as X · Reset" badge in the top bar when an override is active (only for true admins).

No DB or edge function changes.