---
phase: "03"
plan: "04"
subsystem: brand-config
tags: [brand, server-actions, rsc, client-components, tenant-isolation, rbac]
dependency_graph:
  requires: [03-01, 03-02, 03-03]
  provides: [brand-settings-page, save-brand-config-action, get-brand-config-action, brand-config-form]
  affects: [04-render-engine]
tech_stack:
  added: []
  patterns: [server-actions-with-use-server, rsc-page-pattern, client-island-pattern, withTenantDb-tenant-isolation, upsert-one-per-workspace]
key_files:
  created:
    - apps/web/src/lib/brand/actions.ts
    - apps/web/src/app/w/[slug]/brand/page.tsx
    - apps/web/src/components/brand/BrandConfigForm.tsx
  modified:
    - apps/web/tests/tenant-isolation.test.ts
decisions:
  - "canEdit derived server-side in RSC page (WorkspaceContext.role) and passed as boolean prop to client — client never computes authorization"
  - "Empty string inputs normalized to null in saveBrandConfigAction to distinguish 'not configured' from 'set to empty'"
  - "brandConfig.upsert uses where: { workspaceId } via @unique constraint — guarantees exactly one BrandConfig per workspace"
  - "BrandConfigForm uses useTransition + startTransition (AcceptButton pattern) instead of manual FormState union type"
  - "tenant-isolation tests use async import() not require() — project uses ESM (vitest runs as ESM)"
metrics:
  duration_minutes: 6
  completed_date: "2026-06-05"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 03 Plan 04: Brand Config Vertical Slice Summary

Brand Server Actions (saveBrandConfigAction with upsert semantics + getBrandConfigAction) + Brand Settings RSC page at /w/[slug]/brand + BrandConfigForm client island with live hex swatch + tenant isolation tests extended to cover BrandConfig. Completes Phase 3.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Brand Server Actions (saveBrandConfigAction, getBrandConfigAction) | 2f26f7f | Done |
| 2 | Brand settings page + BrandConfigForm + tenant isolation test extension | 042759a | Done |

## What Was Built

**Brand Server Actions (`apps/web/src/lib/brand/actions.ts`)**
- `saveBrandConfigAction(slug, input)`: requireWorkspaceRole(owner/admin/editor), Zod safeParse SaveBrandConfigSchema with fieldErrors pattern, normalize empty strings to null, brandConfig.upsert({ where: { workspaceId } }) for create-or-update semantics (D-09)
- `getBrandConfigAction(slug)`: requireWorkspace (any role including viewer), brandConfig.findFirst()
- Turns brand.test.ts RED source assertion GREEN (file now exists and contains "upsert")
- Security: T-03-04-01 (workspaceId from session), T-03-04-02 (viewer redirect), T-03-04-03/04 (Zod validates hex + https://)

**Brand Settings RSC Page (`apps/web/src/app/w/[slug]/brand/page.tsx`)**
- requireWorkspace gates access (all roles including viewer)
- withTenantDb server-side fetch of current BrandConfig
- canEdit = can(ctx.role, "brand", "update") computed server-side — client receives boolean
- Renders BrandConfigForm with slug, initial config, canEdit

**BrandConfigForm Client Island (`apps/web/src/components/brand/BrandConfigForm.tsx`)**
- Logo URL: type="url", onBlur validates https:// scheme; inline error "Enter a valid URL starting with https://."
- Primary Color: type="text", onChange updates live 24x24px color swatch (shows #e5e7eb when empty/invalid); onBlur validates /^#[0-9a-fA-F]{6}$/
- WhatsApp / Contact: type="text", no blur validation in v1
- Brand token reference block: font-mono code block showing brand.logo, brand.primary_color, brand.whatsapp resolved values (or "(not configured)")
- Save: useTransition + startTransition(async () => saveBrandConfigAction()); sonner toast on success/error
- Read-only mode when !canEdit: all inputs disabled, no Save button rendered

**Tenant Isolation Test Extension (`apps/web/tests/tenant-isolation.test.ts`)**
- New describe block "BrandConfig tenant isolation (Phase 3)"
- Source assertion: tenant-db.ts brandConfig.upsert uses where: { workspaceId } (app-level isolation, D-14)
- Source assertion: saveBrandConfigAction uses requireWorkspaceRole with owner/admin/editor (T-03-04-02)
- Source assertion: upsert present in brand actions (D-09)
- Source assertion: getBrandConfigAction uses requireWorkspace(slug) not requireWorkspaceRole
- Pure permission checks (async import, no DB): viewer false, editor true, owner true, admin true for brand.update; viewer true for brand.read

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Worktree created from incorrect base commit**
- **Found during:** Task 1 (before writing any code)
- **Issue:** The worktree was created from commit 10db639 (Phase 2 end) but the execution context specified base 490db032 (Phase 3 wave 3 end). The worktree was missing all files created in plans 03-01, 03-02, 03-03 (including tenant-db.ts BrandConfig extensions, schema.ts, shadcn components, etc.).
- **Fix:** Ran `git reset --hard 490db032f77c56eb5f44745f4933adae3bd47654` as prescribed in the `<worktree_branch_check>` protocol.
- **Files modified:** None (git operation brings existing files in)
- **Commit:** N/A

**2. [Rule 1 - Bug] tenant-isolation.test.ts permission checks used require() in ESM environment**
- **Found during:** Task 2 (test run)
- **Issue:** New BrandConfig describe block used `require("@/lib/workspaces/guards")` for permission checks. The project uses ESM (vitest runs ESM), so synchronous require() of path aliases fails with "Cannot find module".
- **Fix:** Changed all permission check tests to use `async` + `await import("@/lib/workspaces/guards")`, matching the pattern used in brand.test.ts.
- **Files modified:** `apps/web/tests/tenant-isolation.test.ts`
- **Commit:** 042759a (included in Task 2 commit)

## Known Stubs

None — all three fields (logoUrl, primaryColor, whatsapp) are wired end-to-end from form state to saveBrandConfigAction to brandConfig.upsert. Token reference block reflects live state values.

## Threat Flags

No new security surface introduced beyond the plan's threat model. All STRIDE items addressed:
- T-03-04-01: withTenantDb scopes brandConfig queries to ctx.workspaceId
- T-03-04-02: requireWorkspaceRole redirects viewer before DB write
- T-03-04-03: Zod /^#[0-9a-fA-F]{6}$/ at save boundary
- T-03-04-04: Zod https:// at save boundary
- T-03-04-05: whatsapp max 32 chars; Phase 4 must HTML-escape
- T-03-04-06: @unique workspaceId + Prisma upsert atomic; last-write-wins accepted

## Verification Results

- `pnpm --filter @pageforge/web test`: 10/10 test files passed, 224 tests passed, 10 skipped (DB-required)
- `pnpm --filter @pageforge/web build`: 15 routes compiled including /w/[slug]/brand, zero TypeScript errors
- `pnpm --filter @pageforge/web typecheck`: zero errors
- brand.test.ts: RED source assertion turned GREEN (19/19 pass)
- tenant-isolation.test.ts: new BrandConfig describe block 9 tests pass

## Self-Check: PASSED

All key files found. Both task commits verified.
