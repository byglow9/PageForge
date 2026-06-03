# Phase 2: Multi-Tenancy Foundation - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the multi-tenant foundation of PageForge: **workspaces, authentication, and
role-based access control**, with tenant isolation enforced at a layer that cannot be
forgotten — **before any scoped data exists**. This is also where the application shell
(Next.js + Postgres + auth) is bootstrapped for the first time on top of the pure Phase 1
engine library. Covers WS-01 through WS-05.

In scope:
- Authentication (email + password) with mandatory email verification before use.
- Workspace creation and membership; a user can belong to multiple workspaces.
- RBAC with four roles (owner/admin/editor/viewer) gating permitted actions.
- Member invitation flow (copyable link in v1) with account-creation-on-accept.
- Tenant isolation: app-level `workspace_id` scoping **plus** Postgres Row-Level Security
  as a backstop, with tenant context derived from the server session and validated against
  membership on every request.
- The Next.js app shell + Postgres + Prisma + better-auth wiring (first time in the repo).

Out of scope (other phases): template authoring UI + brand config persistence (Phase 3),
the dynamic form, image upload, LP generation/preview/export (Phase 4), catalog/folders
(Phase 5). No template/LP/brand domain tables are *built* here, but the schema must be
designed so every tenant-owned table carries `workspace_id` from day one. Social/OAuth
login, magic-link, MFA, automated invitation emails, billing, and hosted LP URLs are all
deferred.
</domain>

<decisions>
## Implementation Decisions

### Authentication
- **D-01:** Login methods in v1 are **email + password only**. Social/OAuth (Google) and
  magic-link are deferred to a future milestone — better-auth supports adding them later
  without rework.
- **D-02:** **Email verification is mandatory** — the user must confirm their email before
  creating or joining a workspace. This means the app needs working **transactional email**
  in v1 (the planner/researcher must select and wire an email sender; better-auth exposes
  the verification hook but does not send mail itself).
- **D-03:** **No MFA in v1.** Two-factor auth is a future capability; it does not block
  isolation or RBAC. Keep the foundation scope lean.

### Workspace Model & Membership
- **D-04:** **Explicit workspace creation** after signup — the user names/creates the
  workspace before proceeding. No auto-created personal workspace.
- **D-05:** **Multi-workspace membership** — a user can belong to N workspaces. The active
  workspace is resolved from a **slug in the URL path** (e.g. `/w/{slug}/...`). The slug is
  never trusted on its own (see D-12).
- **D-06:** Member invitation in v1 is a **copyable invite link** — the owner/admin
  generates a link to share manually. No automated invitation email in v1 (despite WS-03's
  "by email" wording; the literal email-send is deferred). Note: transactional email still
  exists for D-02 verification, so re-introducing auto-sent invites later is cheap.
- **D-07:** When an invitee **has no account yet, the invite link leads to signup**, and on
  completion they join as a member with the role chosen by the inviter
  (account-creation-on-accept). Invite tokens should expire (exact TTL is a planner detail).

### RBAC — Role / Permission Matrix
- **D-08:** **Four roles: owner, admin, editor, viewer.** `owner` = single workspace owner
  (billing/deletion are future, but the role exists now and is distinct from admin);
  `admin` manages members + workspace settings; `editor` manages content; `viewer` consumes.
  Note: better-auth's organization plugin ships default roles `owner/admin/member` — `editor`
  and `viewer` are **custom roles** that must be defined via better-auth's access-control
  (permission statements). The researcher must confirm the custom-role mechanism.
- **D-09:** **Member & role management (invite, remove, change role, edit workspace
  settings) is restricted to owner + admin.** editor and viewer cannot manage members.
- **D-10:** **viewer = view + preview/export.** A viewer can see templates and LPs, open the
  preview, and download/export the generated HTML, but cannot create/edit/duplicate anything.
- **D-11:** **editor = content only.** editor can create/edit/duplicate templates, LPs, and
  brand config (in later phases), but **cannot** change workspace settings (name/slug) or
  manage members. Settings stay with owner/admin.

### Tenant Isolation Enforcement
- **D-12:** **Tenant context comes from the server session, validated against membership.**
  The active workspace (from the URL slug) is cross-checked server-side: confirm the user is
  a member of that workspace and resolve their role, *before* any data access. The slug alone
  is never authoritative. (Directly satisfies roadmap success criterion 4.)
- **D-13:** **Isolation = app-level scoping + Postgres RLS, both in v1.** Every query filters
  by `workspace_id` at the application layer **and** Postgres Row-Level Security enforces the
  same `workspace_id` boundary as a backstop. Defense in depth from day one — meets criterion
  4 literally rather than deferring RLS.
- **D-14:** **`workspace_id` is injected through a central data layer, not per-query by hand.**
  Data access goes through a helper/repository (e.g. a per-request extended Prisma client) that
  injects the session's `workspace_id`, and the Postgres RLS policy receives the workspace via
  `SET LOCAL` (or equivalent) per request/transaction. Forgetting the app-level filter is still
  blocked by the database. Manual per-query `where workspace_id` is rejected as the primary
  mechanism ("a layer that cannot be forgotten").

### Claude's Discretion
- Exact invite-token TTL and link format.
- Choice of transactional email provider/transport for D-02 (and how it's stubbed in
  local/dev — e.g. console/log transport vs MailHog/Mailpit).
- Monorepo layout: where the Next.js app lives relative to the existing `pageforge-engine`
  package (the repo already has `pnpm-workspace.yaml`). The engine stays a pure library.
- Exact Prisma schema shape for users/sessions/workspaces/members/invitations (within the
  constraint that every tenant-owned table carries `workspace_id`).
- Precise mechanics of per-request Prisma extension + RLS `SET LOCAL` wiring.
- Session duration/refresh defaults (better-auth defaults are acceptable unless research
  surfaces a reason to change).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 2: Multi-Tenancy Foundation" — goal, the 4 success criteria
  (esp. criterion 3 cross-tenant access tests and criterion 4 session-derived tenant context +
  RLS backstop), `**Mode:** mvp`, and the WS-01..WS-05 mapping.
- `.planning/REQUIREMENTS.md` §"Authentication & Workspaces" — WS-01 (sign up/log in),
  WS-02 (create workspace), WS-03 (invite by email), WS-04 (roles gate actions),
  WS-05 (per-workspace isolation, no cross-workspace access).
- `.planning/PROJECT.md` §"Key Decisions" — multi-tenant with workspaces/teams (RBAC) is the
  load-bearing architectural decision; §"Constraints" — isolation by workspace from the start.

### Tech stack & security guidance
- `CLAUDE.md` — recommended stack: **better-auth 1.6.13** (organization plugin: workspaces,
  members, invitations, roles/permissions), **Prisma 7.8.0 + PostgreSQL 16+**, **Next.js
  16.2.7 (App Router) + TypeScript**, **Zod 4.4.3** for Server Action input validation.
  §"Stack Patterns by Variant" — adopt Postgres **Row-Level Security** keyed on `workspace_id`
  plus app-level scoping; design every tenant-owned table with `workspace_id` from day one.
  §"What NOT to Use" — do not trust client to supply tenant context.

### Prior-phase context (carry-forward)
- `.planning/phases/01-core-engine-parser-merge/01-CONTEXT.md` — D-09 (brand.* tokens resolve
  from the **workspace** brand config → the workspace is the tenant boundary); the engine is a
  pure `parse`/`render` library imported later, so Phase 2 builds the app+DB shell around it
  without touching the engine.

### Existing engine package
- `package.json` (root) — current repo is the `pageforge-engine` library only (liquidjs, zod,
  sanitize-html; vitest). Next.js / Prisma / Postgres / better-auth are **not yet installed**.
- `pnpm-workspace.yaml` — monorepo is already initialized; the Next.js app slots in as a
  workspace package alongside the engine.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`pageforge-engine` package** (root `src/`, `tests/`): pure `parse(markup) → Schema` and
  `render(markup, values, brand) → HTML` functions plus Zod schemas. Phase 2 does NOT import
  or modify it — it only needs to coexist in the monorepo so Phase 3/4 can consume it.
- **`pnpm-workspace.yaml` + `tsconfig.json` + `vitest.config.ts`** already exist — the app
  package can reuse the established pnpm/TypeScript/Vitest tooling conventions.

### Established Patterns
- **Greenfield app layer.** No Next.js app, no DB, no auth code exists yet. There are no
  existing app/server patterns to follow — Phase 2 establishes them (auth wiring, session
  handling, the central tenant-scoped data layer, RLS migration conventions). These patterns
  become the constraint for Phases 3–5.
- The repo uses **ESM + TypeScript strict** (engine `package.json` `"type": "module"`).

### Integration Points
- The tenant-scoped data layer (D-14) and the `workspace_id`-on-every-table schema rule are
  the contract Phases 3–5 build on: templates, LP records, brand config, folders, and assets
  will all be created as workspace-owned tables behind this same isolation layer.
- better-auth's session + active-organization (workspace) is the source of tenant context that
  every downstream Server Action / route handler reads (D-12).

</code_context>

<specifics>
## Specific Ideas

- "A layer that cannot be forgotten" is the literal design driver for D-13/D-14: app-level
  filtering is convenience, **RLS is the guarantee**. Cross-tenant access tests (criterion 3)
  should probe by raw ID across workspaces and expect denial even if an app-level filter were
  bugged.
- Slug-in-URL tenancy (`/w/{slug}/...`) is wanted for explicit, debuggable tenant context —
  but the slug is a routing hint only; authorization always re-derives from session+membership.
- Keep auth modalities minimal now (email+password) precisely so the foundation ships and the
  isolation guarantee gets the attention, not login surface area.

</specifics>

<deferred>
## Deferred Ideas

- **Social/OAuth login (Google) and magic-link** — deferred; better-auth can add later without
  schema rework (D-01).
- **MFA / TOTP** — future capability (D-03).
- **Automated invitation emails** — v1 uses copyable links; auto-send invites can reuse the
  D-02 transactional-email infra later (D-06).
- **Subdomain-per-workspace tenancy** — considered and rejected for v1 (wildcard DNS / cross-
  subdomain cookies); slug-in-URL chosen instead (D-05).
- **Billing / workspace deletion / ownership transfer** — owner role exists now but its
  billing/deletion powers are future scope.
- **Per-folder member permissions** — explicitly v2 (REQUIREMENTS PERM-01); permissions stay at
  the workspace level.

None of the above blocks Phase 2.

</deferred>

---

*Phase: 2-Multi-Tenancy Foundation*
*Context gathered: 2026-06-03*
