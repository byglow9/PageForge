---
phase: 260608-ly0-style-members-page
plan: "01"
subsystem: web/members-page
tags: [ui, tailwind, shadcn, members, presentation-only]
dependency_graph:
  requires: []
  provides: [styled-members-page]
  affects: [apps/web/src/app/w/[slug]/members/page.tsx]
tech_stack:
  added: []
  patterns:
    - Card/CardHeader/CardTitle/CardDescription/CardContent for section grouping
    - Badge variant=secondary for current user role; variant=outline for member/invitation roles
    - Alert/AlertTitle/AlertDescription for generated invite URL display
    - Input component replacing plain <input>
    - Native <select> with Tailwind classes (no Label import — Label is "use client")
    - Button size=sm/xs with outline and destructive variants
    - Tailwind flex layout replacing inline style={{ display: "inline" }}
key_files:
  created: []
  modified:
    - apps/web/src/app/w/[slug]/members/page.tsx
decisions:
  - Used native <label> with Tailwind classes (text-sm font-medium leading-none) instead of importing Label component because Label has "use client" directive and the page must remain a Server Component
  - Used native <select> with Tailwind utility classes for role dropdowns to avoid introducing "use client" dependencies
metrics:
  duration: "~5 minutes"
  completed: "2026-06-08"
  tasks_completed: 1
  files_modified: 1
---

# Phase 260608-ly0 Plan 01: Style Members Page Summary

Styled the workspace members page with the PageForge design system — Card-wrapped sections, Badge role indicators, Input, Alert for invite links, and Button variants — with zero changes to server logic.

## What Was Done

**Task 1: Restyle members/page.tsx with design system components** (commit: 7dae599)

Rewrote the JSX return of `MembersPage` to use shadcn/ui components and Tailwind utility classes. All server actions (`inviteAction`, `changeRoleAction`, `removeAction`), Prisma queries, guards, redirect calls, and the async Server Component declaration are byte-for-byte identical to the original.

Changes summary:
- Outer wrapper: `<div className="px-8 py-6 space-y-8">`
- Header: `<h1>` with `text-2xl font-semibold`, role shown as `<Badge variant="secondary">`
- Invite section wrapped in `<Card>` with `<CardHeader>/<CardContent>`, invite URL displayed in `<Alert>`
- Invite form: `<Input>` for email, styled native `<select>` for role, `<Button size="sm">` for submit
- Pending invitations section: `<Card>` with `className="p-0"` content, styled `<table>` with `bg-muted/50` thead, `divide-y divide-border` tbody, `<Badge variant="outline">` for role
- Current members section: same card+table pattern; Actions column uses `flex items-center gap-2` layout, `<Button size="xs" variant="outline">` for Change role, `<Button size="xs" variant="destructive">` for Remove
- `(you)` and `(owner)` labels rendered as `<Badge variant="secondary">` and `<Badge variant="outline">` respectively

## Verification

- `pnpm --filter web build` exits 0 (clean TypeScript + Next.js compilation)
- `"use server"` appears 3 times (one per action)
- `"use client"` does not appear in the file
- `encodeURIComponent` present in `inviteAction`
- All `name` attributes (`email`, `role`, `memberId`) and `option value` attributes (`admin`, `editor`, `viewer`) preserved

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this is a pure presentational restyle. All data fetching and logic was already functional in the original file.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- File exists: apps/web/src/app/w/[slug]/members/page.tsx — FOUND
- Commit exists: 7dae599 — FOUND
- Build: exit 0 — PASSED
