---
phase: 09-modelo-de-overrides-runtime-de-aplica-o
audit_date: 2026-06-25
asvs_level: 2
block_on: high
threats_total: 11
threats_closed: 11
threats_open: 0
result: secured
---

# SECURITY.md — Phase 9: Modelo de Overrides + Runtime de Aplicação

**Audit date:** 2026-06-25
**ASVS level:** 2 (default)
**block_on:** high (default)
**Mode:** Verify declared mitigations exist in implemented code (register authored at plan time).
**Result:** SECURED — 11/11 threats CLOSED (8 mitigate verified in code, 3 accept recorded below).

Implementation files were treated as READ-ONLY. No implementation file was modified.

---

## Threat Verification (mitigate)

| Threat ID | Category | Evidence (file:line) | Status |
|-----------|----------|----------------------|--------|
| T-09-01-01 | Tampering | `apps/web/src/lib/lps/actions.ts:382-403` — `hasOverridePayload` then `SaveViteSpaOverridesSchema.safeParse({id,overrides,primaryColorOverride})` runs BEFORE `db.lp.update` at `:420-424`. Type enum + value `z.string()` in `apps/web/src/lib/lps/schema.ts:198-207`; payload schema at `:265-278`. | CLOSED |
| T-09-01-02 | Spoofing | `apps/web/src/lib/lps/actions.ts:354` `requireWorkspaceRole(slug,...)` → `:371` `withTenantDb({workspaceId: ctx.workspaceId})` → `:372-375` `db.lp.findById(id)` returns null/404 cross-tenant. workspaceId never from client. | CLOSED |
| T-09-01-03 | CSS Injection | `apps/web/src/lib/lps/schema.ts:274-277` `/^#[0-9a-fA-F]{6}$/` on `primaryColorOverride`; `apps/web/src/lib/brand/theme.ts:82` triplet output is digits + `%` + spaces only. | CLOSED |
| T-09-01-05 | Elevation of Privilege | `apps/web/src/lib/lps/actions.ts:354` gates on `requireWorkspaceRole(slug, ["owner","admin","editor"])`; `apps/web/src/lib/workspaces/guards.ts:176-187` redirects when role not allowed (viewer excluded). | CLOSED |
| T-09-02-01 | XSS | `apps/web/src/lib/overrides/apply-shim.ts:70-75` `escapeJsonForHtml` unicode-escapes `< > &` (plus U+2028/U+2029); applied `:109-111` to the `<script type="application/json">` sentinel. Shim reads via `sentinel.textContent` `:145`. Applied at BOTH entry points: serve `route.ts:279`, export `route.ts:283`. | CLOSED |
| T-09-02-03 | CSS Injection | Color path in shim `apps/web/src/lib/overrides/apply-shim.ts:153-154` calls `setProperty('--primary', hexToHslTripletShim(value))`; `hexToHslTripletShim` = `theme.ts:45-83` whose output is constrained to numeric triplet (`H S% L%`) regardless of input. `primaryColorOverride` separately hex-validated (schema `:274-277`). See Observation O-1. | CLOSED |
| T-09-02-04 | Information Disclosure | `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts:136` `workspaceId = claims.workspaceId` (verified HMAC token, not client). LP read `:256-261` `servingRead(... landingPage.findMany({ where: { templateId: tplId, workspaceId } }))`. `servingRead` sets `app.serving='on'` `:64-69`. landing_page additionally bound by `tenant_isolation` RLS (fail-closed). See Observation O-2. | CLOSED |
| T-09-02-05 | Tampering | `apps/web/src/lib/overrides/apply-shim.ts` — per-override `try/catch` `:148-157`, `pathToNode` internal `try/catch` `:129-138`, DOMContentLoaded handler `try/catch` `:142-159`, outer IIFE `try/catch` `:124-161`. Malformed path silently skipped. | CLOSED |

**Verified — no innerHTML sink (constraint c):** grep across `src/lib/overrides/`, `src/app/serve/`, `src/app/api/lps/` finds `innerHTML` only in comments/test assertions verifying its absence. Override values are written exclusively via `node.textContent` (`apply-shim.ts:152`).

**Verified — validate-before-persist (constraint a):** override fields are read from the RAW `input` (`actions.ts:382-383`, `:389-393`), not from `parsed.data` (which `UpdateLpSchema` strips), and validated by `SaveViteSpaOverridesSchema.safeParse` before any `db.lp.update`. Matches the W1 claim.

**Verified — escape applied in both paths (constraint b):** `escapeJsonForHtml` runs inside `buildOverrideInjection`, which is the single function invoked by both the serve route (`route.ts:279`) and the export route (`route.ts:283`).

**Verified — serve workspaceId from token (constraint d):** `workspaceId` is assigned from `claims.workspaceId` (`route.ts:136`) for the index.html path; the LP lookup `where` clause uses that server-derived value, never a URL/query param.

---

## Accepted Risks Log

| Threat ID | Category | Rationale (verified) | Status |
|-----------|----------|----------------------|--------|
| T-09-01-04 | Information Disclosure — `LandingPage.values` cross-tenant read | RLS holds: `apps/web/prisma/migrations/0005_catalog_folders_tags/migration.sql:192-196` — `landing_page` has `ENABLE` + `FORCE ROW LEVEL SECURITY` with `tenant_isolation` policy `USING/WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text)`. App-level reads also scoped via `withTenantDb`. Rationale holds. | ACCEPTED |
| T-09-02-02 | XSS — value applied via `node.textContent` | `textContent` never parses HTML; the only override-value write is `apply-shim.ts:152`. No innerHTML sink exists (grep-confirmed). Explicit design decision per CONTEXT.md. Rationale holds. | ACCEPTED |
| T-09-02-06 | Denial of Service — large overrides array | `SaveViteSpaOverridesSchema.overrides` is `z.array(PfOverrideSchema).optional()` with no `.max()` (`schema.ts:269`) — unbounded by design in Phase 9. Overrides are per-LP and only writable by owner/admin/editor of the owning workspace (`actions.ts:354`); no cross-tenant amplification. Cap deferred to Phase 12. Rationale holds. | ACCEPTED |

---

## Observations (non-blocking)

**O-1 — Defense-in-depth weaker than register wording for color-type overrides (T-09-02-03).**
The register's first clause ("primaryColorOverride hex-validated") describes the `<style>` tag path (`buildBrandStyleTagForLp`). The shim's `type === 'color'` override applies `ov.value`, which `PfOverrideSchema.value` validates only as `z.string()` (`schema.ts:206`) — NOT hex. The operative protection is the second clause: `ov.value` is never used raw; it is always passed through `hexToHslTriplet`, whose output is constrained to a numeric `H S% L%` triplet (or `NaN`), which `setProperty('--primary', ...)` cannot use to inject CSS. The threat is not bypassable, so it remains CLOSED. Recommendation (optional, future hardening): add a hex `.regex` to `PfOverrideSchema` when `type === 'color'` (refinement) for layered validation rather than relying solely on output sanitization.

**O-2 — Serve-route override injection is fail-closed, possibly more than intended (functional, not security).**
`servingRead` sets only `app.serving='on'`. Migration `0009_serving_read_policy` adds a `serving_read` SELECT policy to `template` and `brand_config` only — NOT to `landing_page`. Inside `servingRead`, `app.current_workspace_id` is unset, so `landing_page`'s `tenant_isolation` policy filters the `findMany` to zero rows. Security impact: none — this is strictly fail-closed (no cross-tenant or any disclosure), so T-09-02-04 stays CLOSED. Functional note for the team: serve-route preview overrides may never render because the LP read returns nothing under RLS. Worth confirming against the export route (which uses `set_config('app.current_workspace_id', ...)` and does surface overrides). This is a functional/preview-fidelity concern, not a security gap, and does not block the phase.

---

## Unregistered Flags

None. Both phase summaries use a `## Threat Surface Scan` section (not `## Threat Flags`) and both state: "No new threat surface introduced beyond what was planned." No new attack surface appeared during implementation that lacks a threat mapping.

---

## Summary

- **Threats closed:** 11/11 (8 mitigate verified in code + 3 accept recorded).
- **Blockers (OPEN_THREATS):** none.
- **Warnings (unregistered flags):** none.
- **Observations:** 2 non-blocking (O-1 layered-validation hardening, O-2 fail-closed serve-route functional note).
- **Phase disposition:** SECURED — clear to ship from a declared-mitigation standpoint.
