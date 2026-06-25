---
phase: quick-260625-i1c
plan: "01"
subsystem: workspace-dashboard
tags: [dashboard, nav, prisma, rsc, rbac]
dependency_graph:
  requires: [requireWorkspace, can, prisma, Card UI component, lucide-react]
  provides: [Dashboard nav item with exact-match, live metric counts, role-gated shortcut links]
  affects: [SidebarNav active state, /w/[slug] page content]
tech_stack:
  added: []
  patterns: [RSC async server component, Promise.all parallel Prisma counts, role-gated conditional rendering]
key_files:
  created: []
  modified:
    - apps/web/src/app/w/[slug]/SidebarNav.tsx
    - apps/web/src/app/w/[slug]/page.tsx
decisions:
  - "Used exact?: boolean flag on NavItem instead of a separate NavItem subtype to keep the items array homogeneous"
  - "prisma.member.count uses organizationId (not workspaceId) matching the better-auth Member model schema"
  - "workspaceId in counts always sourced from requireWorkspace() session context, never from URL input (T-i1c-01)"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-25T16:05:25Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-260625-i1c Plan 01: Dashboard do Workspace Summary

**One-liner:** Workspace home page replaced from slug-titled placeholder with real dashboard: Dashboard nav item with exact active-match, three live Prisma count metrics (templates / landing pages / members), role card, and role-gated quick-access shortcut links.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | SidebarNav — Dashboard item with exact-match active flag | 12df8f6 | SidebarNav.tsx |
| 2 | Dashboard page.tsx — real counts, metric cards, shortcut cards | 7d496f5 | page.tsx |

## What Was Built

### Task 1 — SidebarNav.tsx

- Added `LayoutDashboard` to the `lucide-react` named import.
- Added `exact?: boolean` to the `NavItem` interface.
- Inserted `{ href: /w/${slug}, label: "Dashboard", icon: LayoutDashboard, exact: true }` as the first item in the `items` array (before the `canAuthorTemplates` spread).
- Updated the `.map()` destructure to include `exact`, and replaced the active check with:
  ```
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  ```
  This ensures Dashboard highlights only on exact `/w/${slug}` and all other items retain prefix-match behavior.

### Task 2 — page.tsx

- Replaced inline-style placeholder JSX with a fully Tailwind-based layout.
- `h1` now reads "Dashboard" (was the workspace slug).
- Removed all "Coming in Phase 3" / "Coming in Phase 4" placeholder text.
- Added `Promise.all` parallel Prisma counts:
  - `prisma.template.count({ where: { workspaceId: ctx.workspaceId } })`
  - `prisma.landingPage.count({ where: { workspaceId: ctx.workspaceId } })`
  - `prisma.member.count({ where: { organizationId: ctx.workspaceId } })` — uses `organizationId` per better-auth Member schema
- Three metric `Card` components render live counts for Templates, Landing Pages, Members.
- Role card shows `ctx.role` (capitalized via Tailwind `capitalize`).
- Quick access section with 4 shortcut links:
  - Landing Pages — always visible
  - Members — always visible
  - Templates — visible only when `can(ctx.role, "template", "create")` is true
  - Brand Settings — visible only when `can(ctx.role, "brand", "update")` is true

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all metric counts are wired to live Prisma queries. All shortcut links point to real routes.

## Threat Flags

No new threat surface introduced. Counts use session-validated `ctx.workspaceId` from `requireWorkspace()` — no URL input flows into queries (T-i1c-01 mitigated as planned).

## Self-Check: PASSED

- `apps/web/src/app/w/[slug]/SidebarNav.tsx` — exists and modified (commit 12df8f6)
- `apps/web/src/app/w/[slug]/page.tsx` — exists and modified (commit 7d496f5)
- `npx tsc --project apps/web/tsconfig.json --noEmit` — exits 0, zero errors
- Both commits verified in git log
