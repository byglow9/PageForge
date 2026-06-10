# SECURITY.md — PageForge

## Phase 04 — lp-generation-assets-preview-export

**Audit Date:** 2026-06-09
**ASVS Level:** 1
**Block On:** high severity open threats
**Threats Closed:** 17/18
**Threats Open:** 1/18

---

## Threat Verification

### Closed Threats

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-04-01-01 | ElevationOfPrivilege | mitigate | `tenant-db.ts:358-396` — every `lp.findById`, `lp.update`, `lp.delete` includes `workspaceId` in the Prisma `where` clause; RLS backstop via `SELECT set_config('app.current_workspace_id', ${workspaceId}, true)` at `tenant-db.ts:242` |
| T-04-01-02 | Tampering | mitigate | `renderer.ts:108-111` — `sanitizeRichText`, `sanitizeUrl`, `sanitizeCssColor` applied per field type before LiquidJS scope assembly; `renderer.ts:14` — `outputEscape:'escape'` on LiquidJS engine |
| T-04-01-03 | InformationDisclosure | mitigate | `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` referenced only in `actions.ts:54-56` (server-side `"use server"` file); no `NEXT_PUBLIC_` prefix; not present in any client component |
| T-04-01-04 | Tampering | mitigate | `render.ts:47-55` — brand fetched via `db.brandConfig.findFirst()` (DB, server-side); scope keys explicitly mapped to `{ logo, primary_color, whatsapp }` from DB column values; no client key injection path |
| T-04-01-05 | ElevationOfPrivilege | mitigate | `actions.ts:152,247,300,356` — every mutating Server Action calls `requireWorkspaceRole(slug, [...])` before any DB operation; `workspaceId` sourced exclusively from `ctx.workspaceId` returned by the guard |
| T-04-02-01 | Spoofing | mitigate | `LpPreview.tsx:65-68` — `sandbox="allow-same-origin"` on iframe; `srcDoc={html}` set from RSC-rendered prop, never from client-constructed string |
| T-04-02-02 | Tampering | mitigate | `renderer.ts:107-118` — `sanitizeRichText`, `sanitizeUrl`, `sanitizeCssColor` per field type applied before render scope assembly; `outputEscape:'escape'` at `renderer.ts:14` handles text fields |
| T-04-02-03 | Tampering | mitigate | `renderer.ts:108` — `sanitizeRichText(String(raw ?? ''))` applied server-side in `render()` for richtext fields; `sanitizers.ts:44-46` — uses `sanitize-html` with strict allowlist; `RichTextField.tsx` security comment at line 10-12 explicitly notes sanitization is server-side |
| T-04-02-04 | ElevationOfPrivilege | mitigate | `tenant-db.ts:358-366` — `db.lp.findById` uses `tx.landingPage.findFirst({ where: { id, workspaceId } })`; cross-workspace `lpId` returns null; RLS backstop active in same transaction |
| T-04-02-05 | ElevationOfPrivilege | mitigate | `actions.ts:398,442` — `listLpsAction`/`getLpAction` use `requireWorkspace`; `actions.ts:152,247,300,356` — mutations use `requireWorkspaceRole(["owner","admin","editor"])`; `lps/page.tsx:23` — `requireWorkspace` guards list page |
| T-04-03-01 | Tampering | mitigate | `actions.ts:506-513` — `fileTypeFromBuffer(new Uint8Array(input.firstBytes))` with `ALLOWED_MIME_TYPES = Set(["image/jpeg","image/png","image/webp"])`; client MIME untrusted per comment at `actions.ts:478` |
| T-04-03-02 | Tampering | mitigate | `actions.ts:521-531` — `PutObjectCommand` scoped to exact key `workspaces/${ctx.workspaceId}/lps/assets/${crypto.randomUUID()}.${ext}`; `getSignedUrl` with `expiresIn:3600`; `signableHeaders: new Set(["content-type"])` |
| T-04-03-03 | InformationDisclosure | accept | Accepted risk — CORS configuration on MinIO/S3 bucket is a deployment concern outside Phase 4 scope. Documented in `.env.example` with `S3_ENDPOINT`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL`. Production CORS policy must be applied at deployment time. See Accepted Risks section below. |
| T-04-03-04 | Tampering | mitigate | `renderer.ts:109-111` — image field values pass through `sanitizeUrl()` which blocks `javascript:`, `data:`, `vbscript:` schemes; `sanitizers.ts:59-81` — allowlist of `https?://`, `mailto:`, `tel:`, relative paths only |
| T-04-03-05 | DoS | mitigate | `actions.ts:484-539` — server receives only `firstBytes: number[]` (4100 bytes) + metadata; full file bytes go directly to S3 via presigned PUT from the browser (`ImageUploadField.tsx:138-161`); no app-server memory spike from file contents |
| T-04-03-06 | ElevationOfPrivilege | mitigate | `actions.ts:517-518` — S3 key constructed as `workspaces/${ctx.workspaceId}/lps/assets/${crypto.randomUUID()}.${ext}`; `ctx.workspaceId` from `requireWorkspaceRole` return value (server session); filename is UUID, no client input used in key construction |
| T-04-04-01 | ElevationOfPrivilege | mitigate | `route.ts:150-153` — `auth.api.getSession({ headers: requestHeaders })` returns 401 if no session; `route.ts:156-162` — LP fetched; `route.ts:165-175` — `prisma.member.findUnique({ where: { organizationId_userId: { organizationId: lp.workspaceId, userId: session.user.id } } })` returns 403 if not member |
| T-04-04-02 | ElevationOfPrivilege | mitigate | `route.ts:165-175` — after fetching LP by `lpId`, workspace membership verified via `prisma.member.findUnique` keyed on `lp.workspaceId` + `session.user.id`; 403 returned if no membership record |
| T-04-04-03 | Tampering | mitigate | `route.ts:80-117` — `extractS3ImageUrls` only returns URLs starting with `process.env.S3_PUBLIC_BASE_URL`; `route.ts:206-209` — `fetch(url, { redirect: "error" })` prevents SSRF via open redirect; external CDN/brand URLs left as absolute references |
| T-04-04-04 | Spoofing | mitigate | `route.ts:53` — `CSP_META` with `default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'none'`; no `script-src` listed, inherits `default-src 'none'`; `route.ts:55-61` — `injectCsp()` inserts into `<head>` |
| T-04-04-05 | InformationDisclosure | accept | Accepted risk — exported ZIP is delivered to the authenticated user who requested it. Cross-tenant content cannot appear in the ZIP: the IDOR check at `route.ts:165-175` and tenant-scoped `renderLp()` call at `route.ts:179-188` ensure only the authenticated user's own workspace content is rendered. See Accepted Risks section below. |
| T-04-04-06 | DoS | mitigate | `route.ts:237` — `new ZipArchive({ zlib: { level: 9 } })` (archiver `ZipArchive extends Archiver extends Transform`); `route.ts:252` — `Readable.toWeb(archive)` streams to `NextResponse` without buffering full ZIP; images fetched sequentially (`route.ts:205-228`), each appended individually (`route.ts:243-244`) |

---

### Open Threats (BLOCKER)

| Threat ID | Category | Mitigation Declared | Gap Found | Files Searched |
|-----------|----------|---------------------|-----------|----------------|
| T-04-02-06 | Tampering | `reconcileLpValues runs server-side in updateLpAction; old keys not in the new schema are dropped` | `reconcileLpValues` is called **client-side** in `LpForm.tsx:223` (a `"use client"` component) before `updateLpAction` is invoked. `updateLpAction` itself (`actions.ts:236-284`) does NOT call `reconcileLpValues` — it stores whatever `values` the client submits without server-side schema reconciliation. A caller bypassing the LpForm client path can submit arbitrary stale keys to `updateLpAction` and they will be persisted to `LandingPage.values`. The declared mitigation ("server-side in updateLpAction") is absent. | `apps/web/src/lib/lps/actions.ts`, `apps/web/src/lib/lps/reconcile.ts`, `apps/web/src/components/lps/LpForm.tsx` |

**Note on risk scope for T-04-02-06:** Downstream render security is maintained because the engine's per-type sanitization (`renderer.ts:107-118`) sanitizes whatever values it encounters, and LiquidJS with `strictVariables:false` ignores keys not declared in the template. Stale keys cannot cause XSS. The residual risk is data integrity: a malicious editor-role user can persist arbitrary key/value pairs to `LandingPage.values` via a direct Server Action call, polluting the stored JSON record. This is a data-integrity gap, not a confidentiality or privilege-escalation gap. Severity: medium (data integrity, editor role required).

---

## Accepted Risks

| Threat ID | Rationale |
|-----------|-----------|
| T-04-03-03 | S3/MinIO CORS bucket policy is a deployment-time configuration. The app correctly generates presigned PUT URLs server-side (SigV4). CORS only affects which browser origins can execute the PUT — a misconfigured CORS policy could allow other origins to upload to the bucket using a stolen presigned URL, but the uploaded object would still be scoped to the key derived from the authenticated user's workspaceId. The risk is not cross-tenant data corruption. Documented in `apps/web/.env.example`. Must be addressed in production deployment runbook. |
| T-04-04-05 | The ZIP is delivered exclusively to the authenticated requesting user. Tenant isolation is enforced before render: (1) `auth.api.getSession` authentication gate, (2) `prisma.member.findUnique` workspace membership check, (3) `renderLp()` called with `withTenantDb({ workspaceId: lp.workspaceId })` scoping brand config and all tenant helpers. No cross-tenant content can appear in the exported ZIP. |

---

## Unregistered Flags

The SUMMARY.md files for plans 01, 03, and 04 use `## Threat Surface Scan` (not `## Threat Flags`), and plan 02 uses `## Threat Flags`. All sections report no new attack surface beyond what the threat register covers. No unregistered flags to log.

---

## Implementation Gaps (for engineering team)

**T-04-02-06 — `reconcileLpValues` must run server-side in `updateLpAction`**

Current state: `reconcileLpValues` is called in the client component `LpForm.tsx` and the reconciled result is passed to `updateLpAction`. The server action stores it without re-validation.

Required fix: Move schema reconciliation into `updateLpAction` server-side. When `markupSnapshot` is provided in the update payload, the action should:
1. Parse the new `markupSnapshot` to extract fields (`parse(markupSnapshot)`)
2. Call `reconcileLpValues(parsedFields, existingValues)` on the **current DB values** (not client-submitted)
3. Merge with any client-provided top-level field updates
4. Store the reconciled result

This closes the gap where an editor-role caller could submit unrestricted key/value pairs via a direct `updateLpAction` invocation. The fix must be in `apps/web/src/lib/lps/actions.ts` — not in a client component.
