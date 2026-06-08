---
phase: 03
slug: template-authoring-brand-config
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-08
---

# Phase 03 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser -> Server Action | Template and brand authoring inputs cross from client UI into Server Actions. | Template name, markup, metadata overlay, logo URL, primary color, WhatsApp/contact text |
| Server Action -> TenantClient | Workspace identity must be derived from server session and membership checks. | `workspaceId`, authorized role, tenant-scoped mutations and reads |
| TenantClient -> PostgreSQL | Tenant-owned rows must remain scoped by app-level filters and PostgreSQL RLS. | Template rows, BrandConfig row, schema JSON, metadata JSON |
| Client component -> `parse()` | Client-side template parsing is advisory only; save-time parse is authoritative server-side. | User-authored markup, parsed field schema, parse warnings |
| BrandConfig -> future render pipeline | Brand values are stored in Phase 3 and later injected into rendered LP HTML in Phase 4. | Logo URL, color, contact text |
| Migration runner -> PostgreSQL | Migration SQL creates tenant-owned tables and enables policies before app use. | DDL for `template` and `brand_config`, RLS policy statements |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01-01 | Information Disclosure | TenantClient.template.findById | mitigate | `findById` filters by `{ id, workspaceId }`; `withTenantDb` sets transaction-local RLS context. Evidence: `apps/web/src/lib/db/tenant-db.ts:166`, `apps/web/src/lib/db/tenant-db.ts:215`, `apps/web/src/lib/db/tenant-db.ts:217`. | closed |
| T-03-01-02 | Tampering | Prisma schema / RLS missing | mitigate | `Template` and `BrandConfig` both carry `workspaceId`; migration enables and forces RLS and creates tenant policies. Evidence: `apps/web/prisma/schema.prisma:204`, `apps/web/prisma/schema.prisma:224`, `apps/web/prisma/migrations/0004_add_template_brand_config/migration.sql:51`, `apps/web/prisma/migrations/0004_add_template_brand_config/migration.sql:57`. | closed |
| T-03-01-03 | Elevation of Privilege | workspaceId from client | mitigate | Tenant helpers are only exposed through `withTenantDb`; writes inject `workspaceId` from server context. Actions derive context through workspace guards. Evidence: `apps/web/src/lib/db/tenant-db.ts:160`, `apps/web/src/lib/db/tenant-db.ts:205`, `apps/web/src/lib/templates/actions.ts:63`, `apps/web/src/lib/brand/actions.ts:49`. | closed |
| T-03-01-04 | Tampering | SaveBrandConfigSchema primaryColor CSS injection | mitigate | Server-side Zod schema requires six-digit hex color. Evidence: `apps/web/src/lib/brand/schema.ts:38`, `apps/web/src/lib/brand/actions.ts:51`. | closed |
| T-03-01-05 | Tampering | SaveBrandConfigSchema logoUrl scheme validation | mitigate | Server-side Zod schema requires valid URL and `https://` prefix. Evidence: `apps/web/src/lib/brand/schema.ts:26`, `apps/web/src/lib/brand/actions.ts:51`. | closed |
| T-03-01-06 | Denial of Service | markup String `@db.Text` unbounded size | accept | MVP v1 accepts unbounded markup for RBAC-gated internal authoring. Logged as AR-03-01. | closed |
| T-03-01-07 | Tampering | `render()` pulled into client bundle via parse import | mitigate | Engine package is marked side-effect free; web app uses workspace dependency/transpile config; client imports only `{ parse }` or types from `pageforge-engine`. Evidence: `package.json:5`, `apps/web/package.json:28`, `apps/web/next.config.ts:11`, `apps/web/src/components/templates/TemplateEditor.tsx:29`. | closed |
| T-03-02-01 | Information Disclosure | `template` table without RLS | mitigate | Migration enables and forces RLS and creates `tenant_isolation` policy for `template`. Evidence: `apps/web/prisma/migrations/0004_add_template_brand_config/migration.sql:51`, `apps/web/prisma/migrations/0004_add_template_brand_config/migration.sql:53`. | closed |
| T-03-02-02 | Information Disclosure | `brand_config` table without RLS | mitigate | Migration enables and forces RLS and creates `tenant_isolation` policy for `brand_config`. Evidence: `apps/web/prisma/migrations/0004_add_template_brand_config/migration.sql:57`, `apps/web/prisma/migrations/0004_add_template_brand_config/migration.sql:59`. | closed |
| T-03-02-03 | Tampering | Migration applied without RLS blocks | mitigate | Migration file contains the hand-appended RLS blocks for both Phase 3 tables before deployment. Evidence: `apps/web/prisma/migrations/0004_add_template_brand_config/migration.sql:47`. | closed |
| T-03-02-04 | Denial of Service | Migration failure leaving DB partial | accept | Prisma migration transaction behavior accepted for v1; if RLS DDL fails, deployment fails rather than leaving app code with tables in use. Logged as AR-03-02. | closed |
| T-03-03-01 | Information Disclosure | listTemplatesAction / template list page | mitigate | `listTemplatesAction` requires workspace membership and lists through `withTenantDb`; TenantClient list filters by `workspaceId`. Evidence: `apps/web/src/lib/templates/actions.ts:263`, `apps/web/src/lib/templates/actions.ts:267`, `apps/web/src/lib/db/tenant-db.ts:225`. | closed |
| T-03-03-02 | Information Disclosure | edit page template fetch by id alone | mitigate | Edit page requires role, fetches via tenant-scoped `findById`, and redirects if null. Evidence: `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx:28`, `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx:31`, `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx:36`. | closed |
| T-03-03-03 | Elevation of Privilege | viewer accessing template authoring routes | mitigate | New/edit routes and template mutation actions require `owner`, `admin`, or `editor`; unauthorized roles redirect in `requireWorkspaceRole`. Evidence: `apps/web/src/app/w/[slug]/templates/new/page.tsx:21`, `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx:28`, `apps/web/src/lib/workspaces/guards.ts:176`. | closed |
| T-03-03-04 | Tampering | markup SSTI via parse() | accept | Phase 3 parsing extracts metadata and does not render/evaluate template output. Render-time SSTI risk is deferred to Phase 4. Logged as AR-03-03. | closed |
| T-03-03-05 | Tampering | XSS via template name/metadata in JSX | mitigate | Phase 3 template UI renders values through React JSX expressions and the audit found no `dangerouslySetInnerHTML` in Phase 3 app/template/brand sources. Evidence: `apps/web/src/components/templates/TemplateEditor.tsx:51`, source grep result in 2026-06-08 audit. | closed |
| T-03-03-06 | Tampering | markup displayed in textarea reflected XSS | mitigate | Markup is stored in React state and rendered as textarea controlled value, so browser treats it as text. Evidence: `apps/web/src/components/templates/TemplateEditor.tsx:53`, `apps/web/src/components/templates/TemplateEditor.tsx:92`. | closed |
| T-03-03-07 | Tampering | `render()` imported in client component | mitigate | Client component imports `{ parse }` and `ParsedSchema` type only; grep found no `import render ... pageforge-engine` in `apps/web/src/components`, `apps/web/src/lib`, or `apps/web/src/app`. Evidence: `apps/web/src/components/templates/TemplateEditor.tsx:29`, 2026-06-08 audit grep. | closed |
| T-03-03-08 | Elevation of Privilege | slug forged to access another workspace templates | mitigate | Workspace guards resolve slug through organization membership for the authenticated user before returning `workspaceId` and role. Evidence: `apps/web/src/lib/workspaces/guards.ts:102`, `apps/web/src/lib/workspaces/guards.ts:117`, `apps/web/src/lib/workspaces/guards.ts:125`. | closed |
| T-03-04-01 | Information Disclosure | getBrandConfigAction / brand page | mitigate | Brand reads require workspace membership and run through `withTenantDb`; TenantClient filters `brandConfig.findFirst` by `workspaceId`. Evidence: `apps/web/src/app/w/[slug]/brand/page.tsx:28`, `apps/web/src/app/w/[slug]/brand/page.tsx:31`, `apps/web/src/lib/db/tenant-db.ts:260`. | closed |
| T-03-04-02 | Elevation of Privilege | viewer calling saveBrandConfigAction | mitigate | Save action requires `owner`, `admin`, or `editor`; viewer role is not allowed by `requireWorkspaceRole`. Evidence: `apps/web/src/lib/brand/actions.ts:49`, `apps/web/src/lib/workspaces/guards.ts:176`. | closed |
| T-03-04-03 | Tampering | primaryColor CSS injection at render time | mitigate | Save boundary validates six-digit hex before storage; Phase 4 still must avoid unsafe raw style injection. Evidence: `apps/web/src/lib/brand/schema.ts:38`, `apps/web/src/lib/brand/actions.ts:52`. | closed |
| T-03-04-04 | Tampering | logoUrl open redirect / XSS at render time | mitigate | Save boundary validates URL syntax and `https://` scheme before storage; Phase 4 still must sanitize before HTML injection. Evidence: `apps/web/src/lib/brand/schema.ts:26`, `apps/web/src/lib/brand/actions.ts:52`. | closed |
| T-03-04-05 | Tampering | whatsapp field injection | accept | Free text is limited to 32 chars in Phase 3 and must be HTML-escaped by Phase 4 rendering. Logged as AR-03-04. | closed |
| T-03-04-06 | Denial of Service | multiple upsert race conditions | accept | `BrandConfig.workspaceId` is unique and TenantClient uses Prisma `upsert`; last-write-wins is accepted for v1. Logged as AR-03-05. | closed |
| T-03-04-07 | Information Disclosure | brand token reference block reflects stored values | accept | Values are reflected to authenticated workspace members on the same workspace brand page. No cross-workspace disclosure path found. Logged as AR-03-06. | closed |

*Status: open - closed*
*Disposition: mitigate (implementation required) - accept (documented risk) - transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-01-06 | MVP v1 does not cap template markup size. The authoring tool is authenticated and RBAC-gated; large markup remains a storage/parse-time risk to revisit after MVP. | Plan 03-01 disposition | 2026-06-08 |
| AR-03-02 | T-03-02-04 | Migration failure partial-state risk is accepted because Prisma migration deployment executes DDL transactionally for this migration path; deployment failure blocks rollout. | Plan 03-02 disposition | 2026-06-08 |
| AR-03-03 | T-03-03-04 | Phase 3 `parse()` does not render or evaluate template output; SSTI belongs to the Phase 4 render threat model. | Plan 03-03 disposition | 2026-06-08 |
| AR-03-04 | T-03-04-05 | WhatsApp/contact text is free text with a 32-character cap. Phase 4 must HTML-escape before LP injection. | Plan 03-04 disposition | 2026-06-08 |
| AR-03-05 | T-03-04-06 | Concurrent brand saves use unique `workspaceId` plus Prisma upsert; last-write-wins is acceptable for v1 single-workspace settings. | Plan 03-04 disposition | 2026-06-08 |
| AR-03-06 | T-03-04-07 | Brand token reference reflects user-entered workspace values back to authenticated members of the same workspace only. | Plan 03-04 disposition | 2026-06-08 |

---

## Summary Threat Flags

| Summary | Finding | Mapping |
|---------|---------|---------|
| 03-01-SUMMARY.md | Expected RED tests noted future implementation gates only; no new security surface beyond plan-time threats. | T-03-01-01 through T-03-01-07 |
| 03-02-SUMMARY.md | No new security-relevant surface beyond migration threat model; RLS statements and policies reported present. | T-03-02-01 through T-03-02-04 |
| 03-03-SUMMARY.md | No new security surface beyond template authoring threat model. | T-03-03-01 through T-03-03-08 |
| 03-04-SUMMARY.md | No new security surface beyond brand config threat model; all STRIDE items addressed or accepted. | T-03-04-01 through T-03-04-07 |

No unregistered threat flags.

---

## Security Audit 2026-06-08

| Metric | Count |
|--------|-------|
| Threats found | 26 |
| Closed | 26 |
| Open | 0 |

### Verification Notes

- Verified app-level tenant scoping and RLS backstop for Template and BrandConfig.
- Verified Phase 3 Server Actions derive workspace identity from server-side guards, not client payloads.
- Verified brand config validation for `primaryColor`, `logoUrl`, and `whatsapp`.
- Verified template authoring imports `parse`, not `render`, in Phase 3 app/lib/component sources.
- Verified accepted risks are plan-authored and recorded above.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-08 | 26 | 26 | 0 | Codex gsd-secure-phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-08
