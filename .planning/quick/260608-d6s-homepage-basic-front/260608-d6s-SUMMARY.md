---
phase: quick/260608-d6s-homepage-basic-front
plan: "01"
subsystem: web-ui
tags: [homepage, hero, tailwind, design-system, next-js]
dependency_graph:
  requires: []
  provides: [styled-homepage]
  affects: [apps/web/src/app/page.tsx]
tech_stack:
  added: []
  patterns: [buttonVariants-on-link, server-component-hero]
key_files:
  modified:
    - apps/web/src/app/page.tsx
decisions:
  - "Used buttonVariants on Next.js Link instead of wrapping Link in Button (Button uses @base-ui/react/button which has no asChild)"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-08T12:33:29Z"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 260608-d6s: Homepage Basic Front Summary

**One-liner:** Centered full-screen hero with PageForge heading, tagline, and styled Sign up (default) / Log in (outline) CTA links using buttonVariants on Next.js Link.

## What Was Done

Rewrote `apps/web/src/app/page.tsx` to replace the bare unstyled homepage with a design-system-consistent hero section. The page is a pure Server Component with no client directives, no inline styles, and no new dependencies.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite homepage with styled hero | 7723f8c | apps/web/src/app/page.tsx |

## Implementation Details

- Outer `<main>` uses `flex min-h-screen flex-col items-center justify-center bg-background` for full-viewport centering
- Inner container is `max-w-sm` with `flex flex-col items-center gap-6 px-4 text-center`
- `<h1>` uses `text-4xl font-bold tracking-tight text-foreground`
- Tagline `<p>` uses `text-base text-muted-foreground`
- CTA row uses `flex flex-wrap justify-center gap-3`
- "Sign up" link: `buttonVariants({ variant: "default", size: "lg" })` — `href="/signup"`
- "Log in" link: `buttonVariants({ variant: "outline", size: "lg" })` — `href="/login"`
- Removed nav element and pipe separator from the original file

## Verification

- `pnpm --filter web build` exits 0; `/` route listed as static in the route table
- All 14 routes compile without TypeScript or import errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this is a static Server Component with no data fetching; all content is final.

## Threat Flags

No new security surface introduced. Page is intentionally public with no user input, no data fetching, and no auth. Consistent with T-quick-d6s-01 (accept).

## Self-Check: PASSED

- apps/web/src/app/page.tsx: FOUND
- Commit 7723f8c: FOUND
