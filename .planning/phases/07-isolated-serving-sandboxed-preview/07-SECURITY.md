---
phase: 7
slug: isolated-serving-sandboxed-preview
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-23
---

# Phase 7 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audited inline (gsd-security-auditor subagent hit session limit; verification performed against implementation with file:line evidence).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → proxy.ts | Host header from HTTP client; used only for path rewrite, never for authz | Host string (untrusted) |
| Query param `?t=` → verifyServeToken | Serve token from query string; full HMAC verify before any data access | HMAC token (untrusted) |
| `tplId` URL segment → S3 key | tplId from URL; validated against token claims (HTML) and DB existence | UUID (non-enumerable) |
| process.env → token module | SERVE_TOKEN_SECRET must be present; absence = runtime panic | secret |
| serve route → DB (cross-workspace read) | Handler reads template/brand_config across workspaces under `app.serving='on'` | tenant metadata |
| Browser iframe → isolated origin | `sandbox="allow-scripts"` w/o `allow-same-origin` → opaque origin (browser-enforced) | rendered SPA |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (evidence) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-07-01-01 | Tampering | verifyServeToken sig compare | mitigate | `timingSafeEqual` + length guard — token.ts:74-77 | closed |
| T-07-01-02 | Repudiation | token exp | mitigate | exp in signed payload; `Date.now() >= exp → null` — token.ts:52,85 | closed |
| T-07-01-03 | EoP | SERVE_TOKEN_SECRET absent | mitigate | `process.env.SERVE_TOKEN_SECRET!` at module load — token.ts:103 | closed |
| T-07-01-04 | Info Disclosure | assertViteSpaKind error msg | accept | server-side only, not in client response body | closed |
| T-07-01-05 | Tampering | path traversal via requestPath | mitigate | leading-slash strip — serve-vite-spa.ts:82; S3 key is literal (no dir semantics) | closed |
| T-07-02-01 | EoP | cross-tenant access | mitigate | `claims.templateId !== tplId → 403` (route.ts:130); `template.workspaceId !== workspaceId → 404` (route.ts:203) | closed |
| T-07-02-02 | Tampering | HMAC forgery | mitigate | server-recomputed sig + timingSafeEqual — token.ts:71-77 | closed |
| T-07-02-03 | Tampering | exp tampering | mitigate | exp inside HMAC payload → sig mismatch → null | closed |
| T-07-02-04 | Info Disclosure | S3 key enumeration | mitigate | slash strip + non-enumerable UUID prefix; key built server-side | closed |
| T-07-02-05 | Info Disclosure | session cookie theft by served SPA | mitigate | no Set-Cookie on serve origin + CSP frame-ancestors — route.ts:buildSecurityHeaders | closed |
| T-07-02-06 | EoP | type confusion LIQUID→VITE_SPA | mitigate | `assertViteSpaKind` before S3 on both HTML & asset paths — route.ts:153,210 | closed |
| T-07-02-07 | Tampering | Body consumed / MIME sniff | mitigate | `getContentType` from extension; `nosniff`; single stream consume — route.ts | closed |
| T-07-02-08 | Tampering | CSP in meta tag | mitigate | `frame-ancestors` as HTTP response header — route.ts:buildSecurityHeaders | closed |
| T-07-02-09 | Repudiation | token replay within TTL | accept | scoped 1 template/30 min; bucket not public; jti deferred post-MVP | closed |
| T-07-02-10 | Info Disclosure | host spoofing in proxy | accept | Host used for routing only; authz in handler after rewrite | closed |
| T-07-03-01 | Info Disclosure | cookie theft by iframe SPA JS | mitigate | `sandbox="allow-scripts"` no allow-same-origin → opaque origin. **Empirically verified in UAT: `document.cookie` throws SecurityError inside iframe** | closed |
| T-07-03-02 | Tampering | accidental allow-same-origin | mitigate | code comment + UAT grep `allow-same-origin` count 0 — preview/page.tsx | closed |
| T-07-03-03 | EoP | unauthenticated token minting | mitigate | `requireWorkspaceRole` is first await before mintServeToken — preview/page.tsx:42 | closed |
| T-07-03-04 | EoP | IDOR cross-workspace template (dashboard) | mitigate | `withTenantDb({workspaceId: ctx.workspaceId})` session-scoped, RLS active — preview/page.tsx:47 | closed |
| T-07-03-05 | Info Disclosure | serve token in iframe src | accept | scoped 30 min; bucket not public; cookie-session serving deferred post-MVP | closed |
| T-07-03-06 | Tampering | clickjacking via iframe embed | mitigate | CSP `frame-ancestors {DASHBOARD_ORIGIN}` HTTP header — route.ts | closed |

*All threats closed. threats_open: 0.*

---

## Post-Plan Change Review — RLS Relaxation (migration 0009 `serving_read`)

During UAT the serving layer was found completely non-functional: the serve route uses the **global** Prisma client (no session workspace context), but `template`/`brand_config` carry **FORCE ROW LEVEL SECURITY** (phase 02, migration 0002), so every cross-workspace lookup returned null → 404. Fix: a PERMISSIVE `FOR SELECT` policy `serving_read`, gated on `current_setting('app.serving', true) = 'on'`, set transaction-locally inside `servingRead()`.

**Security assessment — verdict: SAFE as implemented.**

| Check | Finding |
|-------|---------|
| Transaction-local scope | `set_config('app.serving','on', true)` — `is_local=true` → reverted on tx end; cannot leak on pooled connections (route.ts:64) |
| Write exposure | Policy is **FOR SELECT only** — INSERT/UPDATE/DELETE untouched (migration 0009:19,23) |
| Untrusted trigger | `app.serving` is set ONLY inside `servingRead`; not client-controllable; GUC name not settable via request input |
| Primary cross-tenant control intact | HTML: token `claims.templateId === tplId` + `template.workspaceId === claims.workspaceId`; assets: non-enumerable UUID (pre-existing MVP tradeoff) |
| Dashboard preview unaffected | preview/page.tsx still uses session-scoped `withTenantDb` (RLS active); never sets `app.serving` |

**Residual:** the relaxation removes the RLS **defense-in-depth backstop** for the serving read path. Cross-tenant protection there now rests solely on the app-level HMAC/UUID checks (still present and verified). Recorded as accepted risk R-07-01.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-07-01 | T-07-02-01 / T-07-03-04 | `serving_read` policy bypasses the RLS backstop for the serving read path; primary token+UUID controls remain and are verified. Post-MVP hardening: dedicated least-privilege serving DB role, or encode workspace check into the policy. | Renan Cavenaghi | 2026-06-23 |
| R-07-02 | T-07-02-09 | Token replay within 30-min TTL accepted (scoped 1 template, bucket not public); jti/nonce deferred post-MVP. | Renan Cavenaghi | 2026-06-23 |
| R-07-03 | T-07-03-05 / T-07-02-04 | Serve token visible in iframe `src` (DevTools); asset path authorized by non-enumerable UUID only. Accepted MVP tradeoff; cookie-based serving session deferred. | Renan Cavenaghi | 2026-06-23 |
| R-07-04 | T-07-01-04 / T-07-02-10 | Server-side-only info (error kind value, host-for-routing) — no client data exposure. | Renan Cavenaghi | 2026-06-23 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-23 | 21 | 21 | 0 | Claude (inline; subagent session-limited) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-23
