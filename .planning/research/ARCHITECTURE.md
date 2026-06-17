# Architecture Research

**Domain:** Template-driven static-HTML landing page generator (multi-tenant SaaS)
**Researched:** 2026-06-01 (v1), 2026-06-17 (v2.0 addendum — React/Vite project-template type)
**Confidence:** HIGH (core v1 structure); MEDIUM (v2.0 build pipeline — integration choices are defensible but the specific sequencing carries implementation uncertainty)

---

## v1.0 Architecture (existing, unchanged)

> The v1 architecture below remains authoritative for the LiquidJS template type. The v2.0 section that follows describes how the React/Vite project-template type integrates alongside it.

The system is best understood as a **schema-centric pipeline**, not a CRUD app with a "render" button bolted on. One artifact — the **token schema** — is the contract that connects all three pillars (template authoring, LP generation, catalog). The parser produces the schema; the schema drives the form; the form produces values; values + markup produce static HTML. Every component points at the schema.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                            │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │  Template  │  │  Dynamic   │  │  Catalog   │  │  Preview/  │       │
│  │  Authoring │  │   Form     │  │ (folders/  │  │  Export    │       │
│  │   (markup) │  │ (per-schema)│  │ categories)│  │   view     │       │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘       │
├────────┼───────────────┼───────────────┼───────────────┼──────────────┤
│        │          APPLICATION / DOMAIN LAYER            │              │
├────────┼───────────────┼───────────────┼───────────────┼──────────────┤
│  ┌─────▼──────────────┐ │               │      ┌────────▼───────────┐  │
│  │  Schema/Parser     │ │               │      │  Render/Merge      │  │
│  │  (tokens → schema) │ │               │      │  Engine            │  │
│  │  THE CORE ENGINE   │ │               │      │ (markup+values→HTML)│ │
│  └─────┬──────────────┘ │               │      └────────┬───────────┘  │
│        │         ┌──────▼───────┐  ┌─────▼─────┐  ┌──────▼──────────┐  │
│        │         │ Form Gen     │  │ Catalog   │  │ Asset Storage   │  │
│        │         │ (schema→UI   │  │ Service   │  │ (image upload/  │  │
│        │         │  descriptor) │  │           │  │  serve)         │  │
│        │         └──────────────┘  └───────────┘  └─────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Auth / Tenancy (workspace context + RBAC) — wraps ALL of above  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│                              DATA LAYER                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │Workspaces│ │Templates │ │   LP     │ │ Folders/ │ │ Asset blobs  │ │
│  │ /members │ │+ schemas │ │instances │ │categories│ │(object store)│ │
│  │          │ │          │ │+ values  │ │          │ │              │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Schema/Parser** | Parse `{{token}}` markup → typed field schema; detect repeaters/loops, global-value references, duplicate tokens. The motor of the system. | Pure function `parse(markup) → Schema`. No DB, no I/O. Deterministic and unit-testable. |
| **Template Authoring** | CRUD on raw markup; trigger parse; surface parse errors/warnings; let author annotate field metadata (label, type override, help text) on top of the parsed schema. | Form/editor UI + endpoint that calls parser and persists `{markup, schema}` together. |
| **Form Generator** | Turn a stored schema into a UI form descriptor: one input per field, repeater add/remove controls, global-value fields pre-bound to workspace brand config. | Schema → form-descriptor transform (JSON), rendered by a schema-driven form renderer on the client. |
| **Render/Merge Engine** | Merge markup + values + workspace brand config → static HTML string. Iterate repeaters, substitute globals, **auto-escape all values**. | Logic-less, data-only substitution (Mustache-style). NOT a code-executing engine. |
| **Asset Storage** | Store uploaded images per workspace; return stable URLs embedded in rendered HTML; handle export bundling. | Object store (S3/compatible) + DB metadata row; tenant-prefixed keys. |
| **Catalog Service** | Organize LP instances into folders/categories; list/filter/duplicate within a workspace. | Standard scoped CRUD; folders are pure organization (no per-folder perms in v1). |
| **Auth / Tenancy** | Authenticate user, resolve active workspace, enforce RBAC, inject tenant context into every query. Cross-cutting. | Middleware that sets workspace context; DB-level row scoping (see Pattern 4). |

---

## v2.0 Addendum: React/Vite Project-Template Type

### The Core Problem

The v1 LiquidJS template type has a single render path: `markup string + values → static HTML string`, deterministic and CPU-bound. A React/Vite project is a **multi-file source tree** that requires a **build step** to produce static output, has a **different trust model** (third-party JS code executes), and its output is an **SPA with a JS runtime** rather than a flat HTML document. These three differences cascade through every subsystem: data model, build pipeline, preview, export, and multi-tenant isolation.

The integration must:
1. Let both template types coexist in the same catalog, folder tree, and workspace.
2. Introduce as few new abstractions as possible — extend existing ones via a `kind` discriminator rather than parallel model trees.
3. Not degrade security for the LiquidJS type by changing the trust model globally.

---

### 1. Data Model

#### 1.1 Template discriminator: the `kind` field

Add a `kind` enum to the existing `Template` model. This is the discriminator that gates all downstream behavior — which editor is shown, which pipeline runs, how preview works, how export packages output.

```
enum TemplateKind {
  LIQUID   // existing: markup string + LiquidJS render
  VITE_SPA // new: uploaded multi-file project source
}
```

The `Template` table gains:
- `kind  TemplateKind  @default(LIQUID)` — no migration impact on existing rows
- `sourceS3Prefix  String?` — S3 object prefix where the uploaded project source is stored, only non-null when `kind = VITE_SPA`
- `markup` and `schema` remain — they are `null`/empty for VITE_SPA templates or can store an extracted config schema (see Section 4 on editability)

All existing code that reads `Template.markup` or `Template.schema` continues to work unchanged because it only touches `kind = LIQUID` rows. No polymorphism in the ORM — just null checks gated on `kind`.

#### 1.2 LandingPage discriminator: the `kind` field

Add the same `kind` to the `LandingPage` model:
- `kind  TemplateKind  @default(LIQUID)`
- `markupSnapshot  String?` — already exists but becomes nullable; only set when `kind = LIQUID`
- `builtDistS3Prefix  String?` — S3 prefix where the built `dist/` output lives for this LP instance; only set when `kind = VITE_SPA`
- `values  Json` — remains. For LIQUID it stores form field values. For VITE_SPA in v2, it stores whatever editable config fields were extracted (see Section 4); for a fully hardcoded LP it is `{}`.

**Coexistence contract:** The `LandingPage` catalog listing, folder assignment, tag system, duplication, and deletion all work unchanged regardless of `kind`. The discriminator is only consulted by preview, export, and the generate/update pipelines.

#### 1.3 What is stored where (VITE_SPA)

| Artifact | Where | Key pattern | Notes |
|----------|-------|-------------|-------|
| Project source (ZIP) | S3 | `workspaces/{wId}/project-templates/{templateId}/source.zip` | Uploaded once at template registration. |
| Built `dist/` output (template preview) | S3 | `workspaces/{wId}/project-templates/{templateId}/dist/` | Built once from the source; re-built if source changes. |
| Built `dist/` output (per LP instance) | S3 | `workspaces/{wId}/lps/{lpId}/dist/` | Built per LP when data is injected and config changes. Immutable after generate. |
| Config schema (optional) | Postgres `Template.schema` (jsonb) | — | Extracted token map or JSON schema describing editable fields; same column, different interpretation. |
| LP config values | Postgres `LandingPage.values` (jsonb) | — | Same column. For hardcoded projects: `{}`. |

No new S3 bucket is needed — same bucket, same tenant-scoped prefix pattern already in use for `workspaces/{wId}/lps/assets/`.

#### 1.4 Source versioning

Source ZIP is stored at a fixed S3 key per template. When an admin re-uploads a new version, the key is overwritten and a new build is triggered. The template's `schemaVersion` is incremented (same field, same semantics as for LIQUID). Existing LP instances keep their `builtDistS3Prefix` pointing to the build that was in effect when they were generated — identical to how `markupSnapshot` works for LIQUID (D-06 analog: "LP survives template source changes").

---

### 2. Build/Render Pipeline

#### 2.1 Where the build runs

The build cannot run inside the Next.js app process. Reasons:
- Vite's programmatic `build()` API conflicts with `process.env.NODE_ENV` when `createServer` or other Next.js processes coexist in the same Node process.
- A Vite build runs untrusted third-party code (arbitrary `vite.config.ts`, arbitrary npm dependencies declared in the project's `package.json`). Running this in the same process as the app server violates the trust boundary v1 was designed to maintain.
- Vite builds are CPU- and memory-intensive and would block the Next.js event loop.

**Recommended approach: isolated build worker via job queue**

```
┌────────────────────────────────────────────────────────────────┐
│  Next.js App Server (existing)                                  │
│                                                                 │
│  uploadProjectSource() → enqueue build job → return 202        │
│  pollBuildStatus() → read job status from DB                   │
└───────────────────────────────┬────────────────────────────────┘
                                │ job queue (DB-backed or SQS/Redis)
                                ▼
┌────────────────────────────────────────────────────────────────┐
│  Build Worker Process (separate Node process or container)      │
│                                                                 │
│  1. Dequeue job: { templateId, workspaceId, sourceS3Key }      │
│  2. Download source ZIP from S3 to temp dir                    │
│  3. npm install (pinned to lockfile, no postinstall scripts)   │
│  4. vite build() — output to temp outDir                       │
│  5. Upload dist/ tree to S3 under workspace-scoped prefix      │
│  6. Update Template.builtDistS3Prefix; bump schemaVersion      │
│  7. Mark job complete                                           │
└────────────────────────────────────────────────────────────────┘
```

For v2.0 at small scale, the "queue" can be a `BuildJob` table in Postgres polled by a separate Node script (`node scripts/build-worker.js`). This avoids introducing Redis/SQS as a new dependency. At larger scale, replace with a proper queue.

**Security isolation for the build:**
- The build process runs as a non-root OS user with no access to app environment variables.
- A hard `ulimit` on memory and a build timeout (60–120 seconds) terminate runaway builds.
- `npm install` uses `--ignore-scripts` to block lifecycle hooks; postinstall scripts are the primary supply-chain attack vector for untrusted projects.
- The temp dir is fully deleted after the build (success or failure).
- S3 credentials available to the build worker are scoped to write-only to the specific workspace prefix via bucket policy.

**Why not Docker per build?** Docker provides stronger isolation but adds operational complexity (Docker daemon, image management, cold-start latency per build). For v2.0 where the uploaded projects are from a known Lovable export (trusted source, curated deps), process-level isolation with ulimits and `--ignore-scripts` is sufficient. Switch to containerized builds only if untrusted-arbitrary-project upload is required.

#### 2.2 Vite build configuration override

The build worker overrides the project's own `vite.config.ts` to set:
- `base: "./"` — relative asset paths so the SPA works when served from any S3 prefix (not an absolute path).
- `build.outDir` — points to the worker's temp output directory.
- `build.emptyOutDir: true`.
- No dev server plugins (strip `lovable-tagger`, etc.).

Using Vite's programmatic API with `configFile: false` and an inline config is the clean way to do this — the project's own config is ignored, preventing malicious config hooks:

```typescript
import { build } from 'vite';
import react from '@vitejs/plugin-react-swc';

await build({
  root: projectTempDir,
  configFile: false,        // ignore the project's own vite.config.ts
  base: './',               // relative paths — works from any S3 origin
  plugins: [react()],       // only trusted plugins
  build: {
    outDir: outTempDir,
    emptyOutDir: true,
  },
  logLevel: 'warn',
});
```

This is documented in Vite's JavaScript API (`build()` accepts `InlineConfig` which extends `UserConfig`; `configFile: false` disables auto-resolution). HIGH confidence.

#### 2.3 How built artifacts are stored per workspace

After the build, the worker walks the `dist/` directory and uploads each file to S3:

```
S3 key pattern: workspaces/{workspaceId}/lps/{lpId}/dist/{relative-path}
Examples:
  workspaces/abc/lps/xyz/dist/index.html
  workspaces/abc/lps/xyz/dist/assets/index-DiwrgTda.js
  workspaces/abc/lps/xyz/dist/assets/index-C5UkZJDy.css
```

The prefix `workspaces/{workspaceId}/lps/{lpId}/dist/` is stored in `LandingPage.builtDistS3Prefix`. No other reference to the per-file S3 keys is needed — the app reconstructs paths by joining the prefix with the filename.

---

### 3. Preview and Export

#### 3.1 Why `srcdoc` does not work for built SPAs

The existing LiquidJS preview uses `<iframe srcdoc="...">` — the entire HTML string is passed inline. This works because the LiquidJS output is a self-contained HTML document: inline CSS, no external script imports.

A Vite-built SPA's `index.html` contains `<script type="module" src="./assets/index-xxx.js">`. Browsers **block module script loading inside `srcdoc` iframes** (module scripts require an HTTP origin, not a `data:` origin). The `srcdoc` approach is not viable for built SPAs.

#### 3.2 Preview strategy: `src` pointing at a signed S3 URL or served proxy

The iframe must point at a real URL that serves `index.html` with the correct `Content-Type: text/html` and from an origin that can load the relative `./assets/` references.

Two options:

**Option A — Signed S3 GET URL for `index.html` (simplest, recommended for v2.0)**

Generate a short-lived presigned GET URL for `workspaces/{wId}/lps/{lpId}/dist/index.html` and set it as the iframe `src`. The browser loads `index.html`; relative `./assets/` references resolve to other objects in the same S3 origin. The S3 bucket needs `GetObject` presigning — the existing S3 client already supports this.

Limitation: S3's `GetObject` presigned URLs work for the `index.html` but the relative asset requests go out as unsigned S3 requests. If the bucket is private, these 403. Therefore: the `dist/` prefix must allow **public read** (or CloudFront access) for the relative asset references to resolve.

S3 path: `workspaces/{wId}/lps/{lpId}/dist/*` — public read for GET. The workspace prefix for uploads (`lps/assets/`) can remain private with presigning because images are referenced by absolute URL in the LIQUID type. The `dist/` prefix has different access needs.

**Option B — Next.js proxy route**

A route handler at `/api/lps/[lpId]/preview/[...path]` fetches the S3 object and streams it with the correct `Content-Type`. This keeps the bucket fully private but adds per-request proxying overhead. Suitable if the bucket cannot be partially public.

Recommendation: **Option A for v2.0** (simplest, zero proxying overhead, consistent with how Vite-built SPAs are normally deployed to S3). Secure the `dist/` prefix with CloudFront + OAC if full privacy is required later.

#### 3.3 Preview == export (redefined for VITE_SPA)

For LIQUID type: preview == export is guaranteed because both call the same `renderLp()` function synchronously. The invariant is: **the render function is the single source of truth**.

For VITE_SPA type: the invariant is redefined as: **the built `dist/` is the single source of truth for both preview and export**. Preview serves it from S3; export downloads it from S3 and bundles it. The build step produces the artifact once; preview and export both read the same artifact. No second render path is introduced.

This means:
- Preview is "what the user sees when the iframe loads from S3."
- Export is "a ZIP of the `dist/` directory as-is."
- The gap between preview and export is the same gap as between "serving from S3" and "unzipping locally" — the SPA's relative path assumptions must hold in both contexts. Setting `base: "./"` at build time ensures this.

#### 3.4 Export packaging

The export route for VITE_SPA lists all S3 objects under `workspaces/{wId}/lps/{lpId}/dist/`, downloads them, and streams a ZIP via `archiver` — the same dependency already in use. The ZIP preserves the directory structure:

```
lp-name.zip
├── index.html
└── assets/
    ├── index-DiwrgTda.js
    └── index-C5UkZJDy.css
```

The existing export route (`/api/lps/[lpId]/export/route.ts`) needs a branch on `lp.kind`:
- `LIQUID`: existing path (render HTML, rewrite image srcs, inject CSP meta, zip).
- `VITE_SPA`: list S3 objects at `builtDistS3Prefix`, download each, stream into ZIP.

CSP meta injection is not applied to VITE_SPA exports — the SPA has its own JS runtime and inline scripts; the strict "no scripts" CSP from the LIQUID export would break it.

---

### 4. Editability: How Content Becomes Configurable

#### 4.1 The current state of the Lovable project

Examining `renova-turismo-jornada-main/`, the content is **fully hardcoded** in React components. Values like the WhatsApp phone number, destination name, hero image, and itinerary items are string literals or static imports in TSX files. There is no data-injection mechanism.

To make a VITE_SPA template "editable" (i.e. the user fills a form, generating a new LP with different content), some injection mechanism must be introduced. Three approaches exist:

#### 4.2 Option A — No editability (simplest — valid for v2.0 Phase 1)

Register the Lovable project as-is. "Generating" an LP from it simply copies the built `dist/` into a new LP-scoped prefix. The LP catalog entry exists, preview works, export works. The user cannot change content through a form — they upload a new project source to create a variant.

**When to use:** When the Lovable project already represents one specific campaign (e.g. the Grécia LP is already complete and just needs to be in the PageForge catalog for organization and export). This is the correct starting point for v2.0.

**Trade-off:** No form-driven customization. Each campaign variant requires a separate project upload.

#### 4.3 Option B — Runtime config.json injection (recommended for v2.0 Phase 2 if editability is needed)

The Lovable project is modified once to read a `config.json` file fetched at startup instead of hardcoding values. At build time, a `public/config.json` is injected with the LP's values before `vite build` runs. The built SPA fetches `/config.json` (relative) on mount.

```
Build pipeline with config injection:
  1. LP values (from form) → write public/config.json in temp project dir
  2. vite build() → dist/ contains config.json baked into public/
  3. SPA fetches ./config.json at startup → renders with injected data
```

The `Template.schema` column stores a JSON schema describing the configurable fields (field names, types, labels) — parsed from the project's own config schema or manually authored once. This schema drives the same dynamic form UI used for LIQUID templates.

**What the Lovable project needs:** A one-time refactor to replace hardcoded values with reads from a config object fetched at startup. For the `InscrevaSe.tsx` example: `NAYARA_WHATSAPP` becomes `config.whatsapp`; `"Viagem à África do Sul"` becomes `config.campaign`. This is a one-time modification to the template project; campaign variants are then generated by filling the form.

**Trade-off:** Requires modifying the source project (acceptable for curated Lovable exports). Config is baked at build time — changing a value means rebuilding. Build latency is real (typically 30–90 seconds for a Vite project).

#### 4.4 Option C — Tokenization pass (not recommended for v2.0)

A pre-processing step replaces hardcoded values with `{{token}}` placeholders in the TSX source, which are substituted before `vite build` runs. This is fragile (string-replacing in arbitrary TSX is risky) and adds no benefit over Option B. Skip.

---

### 5. Multi-Tenant Isolation for Served Built Assets

#### 5.1 S3 key isolation

The existing isolation model is: `workspaces/{workspaceId}/...` prefix on every S3 key. The same applies to built SPA assets:

```
workspaces/{workspaceId}/lps/{lpId}/dist/
workspaces/{workspaceId}/project-templates/{templateId}/dist/
workspaces/{workspaceId}/project-templates/{templateId}/source.zip
```

A user in workspace `abc` cannot construct a URL to workspace `xyz`'s dist because the `lpId` is a CUID (unguessable), the `workspaceId` is never in the client-side URL, and all S3 access goes through the app server (presigned URLs are scoped to a single key and expire).

#### 5.2 Presigned URL scoping

The preview iframe `src` is a presigned `GetObject` URL for a specific `index.html` key. The URL encodes the exact S3 key, signed with the app's AWS credentials, valid for a short window (15 minutes is sufficient for a preview session). A user in a different workspace cannot derive or reuse this URL for a key in their own or another workspace — the signature is key-specific.

The existing `requestPresignedUploadAction` pattern (workspace-scoped key derived server-side from session, never from client input) applies unchanged for SPA source upload.

#### 5.3 Cross-tenant data in the build

The build worker must receive only the workspace-scoped source ZIP for the job being processed. The worker must not have filesystem or S3 access to other workspaces' prefixes. Enforced by:
- S3 IAM policy for the build worker role: `Allow GetObject` on `workspaces/${workspaceId}/project-templates/${templateId}/source.zip` only (parameterized per job via temporary STS credentials, or by scoping the worker to one workspace at a time).
- Temp directory is per-job, fully deleted post-build — no cross-job file persistence.

#### 5.4 No cross-tenant leakage via `dist/` content

Built SPAs are served by origin (the S3 bucket), not by a shared domain. If two workspaces' `dist/` outputs are in the same bucket, there is no mechanism for one to access the other's assets through the browser (same-origin policy on S3 URLs uses the bucket hostname, not the key prefix). Cross-tenant leakage at the S3 level is not possible without explicit cross-key bucket policy, which is not configured.

---

### 6. New vs Modified Components

#### 6.1 New components (v2.0)

| Component | Location | Description |
|-----------|----------|-------------|
| `BuildJob` Prisma model | `schema.prisma` | Tracks async build jobs: `{ id, workspaceId, templateId, lpId?, status, startedAt, completedAt, error }`. Status: `queued / running / done / failed`. |
| Build worker script | `scripts/build-worker.ts` | Dequeues build jobs; executes `vite build()` with `configFile: false`; uploads `dist/`; marks job complete. |
| `uploadProjectSourceAction` | `lib/templates/actions.ts` | New Server Action: accepts ZIP upload (presigned PUT to `source.zip` key), validates structure (has `package.json`, has `index.html`), enqueues build job. |
| Preview iframe for VITE_SPA | `app/w/[slug]/lps/[lpId]/preview/` | Generates a presigned GET URL for `dist/index.html` and renders `<iframe src={presignedUrl}>` instead of `<iframe srcdoc={html}>`. |
| Export route branch for VITE_SPA | `app/api/lps/[lpId]/export/route.ts` | New branch: list S3 objects at `builtDistS3Prefix`, download, ZIP, stream. |
| Build status polling endpoint | `app/api/builds/[jobId]/route.ts` | Client polls this to know when the build is done. Returns `{ status, error }`. |
| Config schema extractor (optional) | `src/engine/vite-project-schema.ts` | If editability (Option B) is chosen: reads a declared config schema from the project and converts to the same `ParsedSchema` type used by LIQUID. |

#### 6.2 Modified components (v2.0)

| Component | Change |
|-----------|--------|
| `Template` model | Add `kind`, `sourceS3Prefix`. `markup` and `schema` become optional. |
| `LandingPage` model | Add `kind`, `builtDistS3Prefix`. `markupSnapshot` becomes optional. |
| `Workspace` model | No change — `workspaceId` scoping already handles new prefixes. |
| Template listing/catalog UI | Show template `kind` as a badge; filter or sort by kind. |
| LP catalog listing | No structural change — `kind` is metadata; folders/tags/duplication unchanged. |
| `duplicateLpAction` | For `VITE_SPA`: copy the S3 dist prefix by re-running a copy job (S3 CopyObject for each file in the dist tree), or simply re-point the duplicate to the same immutable `builtDistS3Prefix` (acceptable if the copy is read-only). |
| `generateLpAction` | For `VITE_SPA`: if no config injection — create LP row with `builtDistS3Prefix` from template; if config injection — enqueue a build job with LP values, set `builtDistS3Prefix` after build completes. |
| Export route | Add `kind` branch (see above). |

#### 6.3 Components NOT modified (unchanged by v2.0)

- `pageforge-engine` (parse/render) — LIQUID path is untouched.
- `renderLp()` utility — LIQUID only; VITE_SPA does not call it.
- `BrandConfig` — LIQUID templates consume it at render time. VITE_SPA can optionally inject brand values into `config.json` at build time if the project reads them.
- `LpAsset` — LIQUID's per-asset tracking remains. For VITE_SPA, assets are part of the `dist/` tree and do not need per-row tracking.
- Auth/RBAC/workspace guards — unchanged; all actions still call `requireWorkspaceRole`.
- Folder/tag system — unchanged.

---

### 7. Data Flow Changes

#### 7.1 VITE_SPA template registration flow

```
User selects "Project (Vite/React)" template kind
    ↓
UI prompts for ZIP upload of the project folder
    ↓
requestPresignedUploadAction(slug, { filename: "source.zip", ... })
    → server scopes key to workspaces/{wId}/project-templates/{tempId}/source.zip
    → browser PUTs directly to S3
    ↓
uploadProjectSourceAction(slug, { templateId, s3Key })
    → validates ZIP structure server-side (has package.json, index.html)
    → creates Template { kind: VITE_SPA, sourceS3Prefix, ... }
    → enqueues BuildJob { templateId, target: "template_dist" }
    ↓
Build worker processes job:
    → downloads source.zip, extracts to temp dir
    → npm install --ignore-scripts (pinned lockfile)
    → vite build() with configFile: false, base: "./"
    → uploads dist/ to workspaces/{wId}/project-templates/{tempId}/dist/
    → sets Template.builtDistS3Prefix, marks job done
    ↓
Template available for LP generation
```

#### 7.2 VITE_SPA LP generation flow (no config injection)

```
User clicks "Generate LP" from a VITE_SPA template
    ↓
generateLpAction(slug, { templateId, name, values: {} })
    → creates LandingPage { kind: VITE_SPA, builtDistS3Prefix: template.builtDistS3Prefix }
    → no render step, no build step
    → LP is immediately available (pointing at template's built dist/)
    ↓
Preview: presigned GET URL for builtDistS3Prefix + "/index.html"
Export: ZIP of all files at builtDistS3Prefix
```

#### 7.3 VITE_SPA LP generation flow (with config injection — Phase 2)

```
User fills form (driven by Template.schema config fields)
    ↓
generateLpAction(slug, { templateId, name, values: { whatsapp, campaign, ... } })
    → creates LandingPage { kind: VITE_SPA, values, status: "building" }
    → enqueues BuildJob { templateId, lpId, configValues: values }
    ↓
Build worker:
    → downloads source.zip, extracts
    → writes public/config.json from values
    → vite build()
    → uploads dist/ to workspaces/{wId}/lps/{lpId}/dist/
    → sets LandingPage.builtDistS3Prefix, marks job done
    ↓
Preview and export use LP-specific dist/
```

---

### 8. Architectural Patterns (v1 patterns retained, v2.0 additions)

> v1 patterns 1–5 remain unchanged. v2.0 adds the following.

### Pattern 5: Template Kind Discriminator (coexistence without polymorphism)

**What:** A single `kind` field on `Template` and `LandingPage` gates all behavior divergence. Code that doesn't care about kind (catalog, folders, RBAC) reads neither; code that does (preview, export, build pipeline) branches on it.
**When to use:** Whenever adding a fundamentally different artifact type to an existing model. Simpler than a joined table per kind or a separate model tree.
**Trade-off:** `null` columns for fields that don't apply to a given kind. Acceptable when the null set is small and the catalog operations (the majority of code) are shared.

### Pattern 6: Async Build Pipeline with Status Polling

**What:** Heavy, potentially long-running operations (Vite build) are queued, not executed synchronously in the Server Action. The Server Action returns immediately with a job ID. The client polls a status endpoint until `done` or `failed`.
**When to use:** Any operation that cannot complete within a typical HTTP request timeout (30 seconds) or that runs untrusted code.
**Trade-off:** Adds async complexity to the UI (loading states, polling). Required here because build times can be 30–90 seconds.

### Pattern 7: `configFile: false` Vite Builds for Untrusted Projects

**What:** When invoking `vite build()` programmatically on a third-party project, always pass `configFile: false` and an inline `plugins` array containing only trusted plugins. This prevents malicious `vite.config.ts` from executing arbitrary code in the build worker.
**When to use:** Any platform that runs user-uploaded build projects.
**Trade-off:** The project's own Vite configuration is ignored. If the project relies on non-standard Vite plugins (path aliases, custom transforms), the build may fail or produce incorrect output. This is a known limitation for v2.0 — it is acceptable for Lovable exports because their config is predictable (`@vitejs/plugin-react-swc`, `@` alias, nothing else).

### Pattern 8: `base: "./"` for S3-Served SPAs

**What:** Set `base: "./"` in the overriding Vite config so all asset references in the built output use relative paths. This makes the SPA portable — it can be served from any URL depth without hardcoded path prefixes.
**When to use:** Any SPA stored in S3 at a varying key prefix and served from different origins.
**Trade-off:** Relative paths break if the HTML is served from a CDN root with SPA routing (e.g. navigating to `/about` — the browser requests `./assets/` relative to `/about/` not `/`). Not a concern for single-page LPs (no routing), but would be a concern if the SPA has multiple routes and is served with CloudFront SPA routing.

---

### 9. Anti-Patterns (v2.0 additions)

### Anti-Pattern 6: Running Vite build() in the Next.js app process

**What people do:** Call `vite build()` directly inside a Server Action or API route handler.
**Why it's wrong:** Conflicts with `process.env.NODE_ENV` between Next.js dev/prod; blocks the Node.js event loop for 30–90 seconds per build; runs untrusted code inside the app server process.
**Do this instead:** Enqueue a build job; run the build in a separate Node process (or container) with appropriate OS-level ulimits.

### Anti-Pattern 7: Trusting the project's own `vite.config.ts`

**What people do:** Run `vite build` using the uploaded project's own config file.
**Why it's wrong:** `vite.config.ts` can execute arbitrary Node.js code at build time (it runs in Node, not in the browser sandbox). A malicious config could exfiltrate environment variables, write files, or make network requests.
**Do this instead:** Pass `configFile: false` and an inline config with only trusted plugins.

### Anti-Pattern 8: Using `srcdoc` for SPA preview

**What people do:** Fetch the built `index.html` and set it as `<iframe srcdoc="...">` for preview.
**Why it's wrong:** Browsers block module script loading (`<script type="module">`) inside `srcdoc` iframes. The SPA will render a blank page.
**Do this instead:** Serve the built output from a real HTTP origin (S3 public/presigned URL or a proxy route) and set the iframe `src`.

### Anti-Pattern 9: Rebuilding on every preview

**What people do:** Trigger a new Vite build every time the preview page is opened.
**Why it's wrong:** Builds take 30–90 seconds; sequential builds block the queue; the output is deterministic given the same inputs.
**Do this instead:** Build once on source upload (for the template preview) and once on LP generation (if config injection). Cache the `builtDistS3Prefix`. Rebuild only when source or config values change.

### Anti-Pattern 10: Ignoring `npm install --ignore-scripts`

**What people do:** Run `npm install` without `--ignore-scripts` on an uploaded project.
**Why it's wrong:** `postinstall`, `preinstall`, and other lifecycle scripts execute arbitrary code on install — a well-known supply-chain attack vector.
**Do this instead:** Always pass `--ignore-scripts` when installing dependencies from an untrusted project. If the project requires lifecycle scripts to function, reject it (it is not a safe Vite build input).

---

### 10. Suggested Phase Decomposition for v2.0

**Dependency order:** the data model changes are additive (non-breaking), so they can land before any pipeline exists. Preview requires the build to have completed. Export requires preview to work. Config injection requires a schema extraction step. Each phase is independently shippable.

| Phase | Name | Deliverable | Depends On | Notes |
|-------|------|-------------|------------|-------|
| P1 | Data model + source upload | `Template.kind` + `sourceS3Prefix`; upload UI; ZIP stored in S3. No build yet. | Nothing (additive migration) | De-risks the migration first. The upload flow reuses existing presigned URL infrastructure. |
| P2 | Build pipeline | `BuildJob` model; build worker script; Vite build with `configFile: false`; `dist/` uploaded to S3 per template. | P1 | The worker can be a standalone script, no queue infra needed at this scale. |
| P3 | LP generation (no config injection) | `LandingPage.kind + builtDistS3Prefix`; generate action copies dist prefix; preview via presigned URL; export via S3 list + ZIP. | P2 | Fully functional end-to-end for hardcoded projects. |
| P4 | Config injection + form UI | Config schema extraction; `Template.schema` stores config field list; form UI for VITE_SPA; build-with-values pipeline; per-LP dist. | P3 | Optional for v2.0 if campaigns are hardcoded. Add only if form-driven customization is required. |
| P5 | Build observability + error UX | Build status polling; failure UI with error message; retry; source re-upload. | P2 | Can ship after P3 — the build either works or it doesn't; polish comes here. |

**Critical path for P3 (minimal viable VITE_SPA):** P1 → P2 → P3. This is the smallest increment that delivers "upload a Lovable project, preview it in PageForge, export a ZIP" while keeping the LiquidJS path untouched.

---

## Integration Points (v2.0)

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Object storage (S3-compatible) | Existing presigned PUT for source upload; `ListObjectsV2` + `GetObject` for dist listing and export; `PutObject` from build worker for dist upload | Existing `@aws-sdk/client-s3` covers all of this. No new S3 client needed. |
| Vite build runtime | Programmatic `build()` via `vite` package in build worker | `vite` is a devDependency of the build worker, not of the Next.js app. |
| npm / node_modules | `npm install --ignore-scripts` in temp dir | The build worker needs Node + npm available. Docker image for the worker should pin these. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Next.js app ↔ build worker | `BuildJob` Postgres table (app enqueues, worker dequeues) | No direct process IPC. Keeps the worker independently restartable. |
| Build worker ↔ S3 | AWS SDK with scoped credentials | Worker writes only to `workspaces/{wId}/...` prefix it owns for the job. |
| Preview page ↔ S3 | Presigned `GetObject` URL (15-min TTL) | Generated server-side by the preview RSC page; never exposed as a permanent link. |
| Export route ↔ S3 | `ListObjectsV2` + `GetObject` + `archiver` stream | Same pattern as current image-bundle export, applied to entire `dist/` tree. |
| LIQUID render path ↔ VITE_SPA path | No shared code below the `kind` branch | The two paths diverge at `generateLpAction` and at preview/export. `pageforge-engine` is not touched. |

---

## Sources

### v1.0 Sources (unchanged)
- [PostgreSQL Row Level Security for multi-tenant isolation — AWS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/) (HIGH)
- [Shipping multi-tenant SaaS using Postgres RLS — Nile](https://www.thenile.dev/blog/multi-tenant-rls) (MEDIUM)
- [Server-side template injection — PortSwigger Web Security Academy](https://portswigger.net/web-security/server-side-template-injection) (HIGH)
- PROJECT.md (HIGH)

### v2.0 Sources
- [Vite JavaScript API — `build()` function, `configFile`, `InlineConfig`](https://vite.dev/guide/api-javascript) (HIGH — official Vite docs; `configFile: false` confirmed, inline config confirmed)
- [Vite Shared Options — `base` configuration](https://vite.dev/config/shared-options) (HIGH — official Vite docs; relative `./` base for portable static output)
- Running untrusted JS as SaaS — Docker + job queue isolation pattern (MEDIUM — verified pattern from freeCodeCamp/pixeljets.com; `--ignore-scripts` lifecycle-hook attack vector confirmed)
- [Vite + React SPA on S3 + CloudFront — static asset serving](https://dev.to/one-beyond/deploying-a-react-vite-spa-to-a-private-s3-bucket-with-cloudfront-and-oac-mhh) (MEDIUM — confirms relative path requirement for S3-hosted SPAs)
- [Runtime config injection via `config.json` / `window.__APP_CONFIG__`](https://kharkevich.org/2024/12/20/spa-runtime-config/) (MEDIUM — established pattern for inject-at-build-time config into SPAs)
- `renova-turismo-jornada-main/` source inspection (HIGH — direct examination of the concrete Lovable project to be integrated; confirms hardcoded values, `@vitejs/plugin-react-swc`, predictable build config)
- `apps/web/prisma/schema.prisma` + `src/engine/` + `apps/web/src/lib/lps/` source inspection (HIGH — direct read of existing architecture)

---
*Architecture research for: template-driven static-HTML landing page generator (multi-tenant SaaS)*
*v1 researched: 2026-06-01*
*v2.0 addendum researched: 2026-06-17*
