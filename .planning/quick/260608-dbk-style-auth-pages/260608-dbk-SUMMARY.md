---
phase: quick
plan: 260608-dbk
subsystem: auth-ui
tags: [styling, auth, shadcn, card, alert, tailwind]
dependency_graph:
  requires: []
  provides: [styled-login-page, styled-signup-page]
  affects: [apps/web/src/app/(auth)]
tech_stack:
  added: []
  patterns: [shadcn Card layout, Alert variant=destructive for errors, Label+Input field pairs]
key_files:
  created: []
  modified:
    - apps/web/src/app/(auth)/login/page.tsx
    - apps/web/src/app/(auth)/signup/page.tsx
decisions:
  - "Alert variant=destructive used for auth errors; removes all inline style={{color:red}}"
  - "verification_required/verification_sent states use Card+Alert layout matching main form pattern"
  - "CardFooter used for all footer links (sign up / log in toggle and Back to login)"
metrics:
  duration_minutes: 15
  completed_date: "2026-06-08"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase quick Plan 260608-dbk: Style Auth Pages Summary

Login and signup pages restyled with shadcn Card/Alert/Button/Input/Label — centered layout, destructive Alert errors, styled verification states — zero logic changes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Style login/page.tsx | fef9cf9 | apps/web/src/app/(auth)/login/page.tsx |
| 2 | Style signup/page.tsx | c651e39 | apps/web/src/app/(auth)/signup/page.tsx |

## What Was Built

Both auth pages now use the project design system consistently:

**Login page (`/login`):**
- Outer: `<main className="flex min-h-screen items-center justify-center bg-background px-4">`
- `<Card className="w-full max-w-sm">` wraps all content
- `CardHeader` holds `CardTitle` + `CardDescription`
- `CardContent` holds the form: `Alert variant="destructive"` for errors, `Label+Input` pairs with `gap-1.5` column layout, `Button size="lg" className="w-full"` submit
- `CardFooter` holds the Sign up toggle link
- `verification_required` state: same Card shell with `Alert` (default) wrapping both paragraphs, `CardFooter` with styled Back to login link

**Signup page (`/signup`):**
- Same Card-centered layout pattern as login
- Three-field form: Name, Email, Password (minLength={8} preserved, helper text as `<p className="text-xs text-muted-foreground">`)
- `verification_sent` state: Card with `Alert` wrapping both paragraphs + styled Back to login link

## Decisions Made

- `Alert variant="destructive"` replaces `<p role="alert" style={{color:"red"}}>` on both pages — gives proper semantic role + design-system error styling
- Two `AlertDescription` elements inside a single `Alert` used for multi-paragraph states (verification cards) — consistent with how the Alert component renders stacked descriptions
- `CardFooter` for footer navigation links aligns with the card's `border-t bg-muted/50` treatment, visually separating the form from the toggle

## Deviations from Plan

None — plan executed exactly as written.

## Build Verification

`pnpm --filter web build` exits 0. TypeScript check passes. All 8 pages prerender/generate successfully including `/login` (static) and `/signup` (static).

## Self-Check: PASSED

- [x] `apps/web/src/app/(auth)/login/page.tsx` — modified, committed at fef9cf9
- [x] `apps/web/src/app/(auth)/signup/page.tsx` — modified, committed at c651e39
- [x] Both commits present in git log
- [x] Build clean (exit 0, TypeScript passed)
- [x] `signIn.email` call count: 1 (unchanged)
- [x] `window.location.href` count: 1 (unchanged)
- [x] `signUp.email` call count: 1 (unchanged)
- [x] `verification_sent` count: 3 (type def + check + setFormState — unchanged)
- [x] No `style={{ color: "red" }}` remaining in either file
- [x] No inline `<p role="alert">` remaining in either file
