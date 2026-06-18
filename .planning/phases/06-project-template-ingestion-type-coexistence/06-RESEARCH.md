# Phase 6: Project-Template Ingestion + Type Coexistence — Research

**Researched:** 2026-06-18
**Domain:** ZIP ingestion, Prisma enum migration, S3 multi-file storage, secret scanning, type-discriminated catalog coexistence
**Confidence:** HIGH (all critical claims verified against codebase, npm registry, or official docs)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRJ-01 | Upload do `dist/` pré-buildado como template VITE_SPA | ZIP extraction library selected (yauzl); upload via Next.js Server Action + FormData |
| PRJ-02 | Validação + scan: index.html, path traversal, tamanho, credenciais, meta Lovable | Zip-slip prevention pattern documented; secret regex patterns confirmed from reference project |
| PRJ-03 | Discriminador `kind` em Template/LandingPage + badge no catálogo | Additive migration pattern with TEXT + CHECK + DEFAULT confirmed safe for Postgres 11+; existing code extension points identified |
| PRJ-11 | Separação estrita de tipo: VITE_SPA nunca entra em render LIQUID e vice-versa | Type-guard pattern in `renderLp` + Zod discriminated union; test boundary pattern documented |
</phase_requirements>

---

## Summary

Phase 6 introduces the `kind` discriminator into an already-deployed, multi-tenant database and UI stack. The central research questions are: (1) how to add the discriminator additively — without touching LIQUID rows or breaking existing read paths; (2) how to safely extract, validate, and scan a user-uploaded ZIP on the server; (3) how to store a multi-file `dist/` tree to S3 under a tenant-scoped prefix; and (4) where in the existing catalog and template listing code to add a type badge.

The key findings are: PostgreSQL 11+ makes `ALTER TABLE … ADD COLUMN text NOT NULL DEFAULT 'LIQUID'` a metadata-only operation (no table rewrite, no lock) — this is the clean additive path. A TEXT column with a `CHECK ('LIQUID','VITE_SPA')` constraint is strictly safer than a native PG enum when adding the first enum value because it avoids the `55P04 "new enum values must be committed before they can be used"` error. The `yauzl` library (v3.4.0, maintained June 2026) is the right extraction read-side counterpart to `archiver`; zip-slip prevention is a one-liner `path.normalize` prefix check. The reference project `renova-turismo-jornada-main/.env` contains a live Supabase JWT (`eyJhbGc…`) and URL (`*.supabase.co`) in a `VITE_` env var that would be baked into a Vite build — confirming that the D6 scan targets are real and high-priority.

**Primary recommendation:** Add `kind TEXT NOT NULL DEFAULT 'LIQUID' CHECK (kind IN ('LIQUID','VITE_SPA'))` to `template` and `landing_page` via a raw `ALTER TABLE … ADD COLUMN` migration (not a Prisma native enum, which requires a separate transaction to commit the value before use). All existing code reads `kind` as `undefined` until the Prisma client is regenerated with the new field — regenerating the client is Wave 0 of any plan.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ZIP upload + extraction + validation | API / Backend (Server Action) | — | Must run server-side: size limits, path traversal check, secret scan, S3 upload all require Node.js |
| Secret / meta scan | API / Backend (Server Action) | — | Scan runs in-memory post-extraction on the server; output is advisory, never client-side |
| S3 multi-file dist/ upload | API / Backend (Server Action) | S3 / CDN | One `PutObjectCommand` per extracted file; tenant-scoped key prefix injected server-side |
| `kind` discriminator migration | Database / Storage | — | Additive column migration; no code change to existing LIQUID read paths |
| Type badge in catalog card | Frontend Server (RSC) → Client | — | `lp.kind` passed down to `LpCatalogCard`; badge rendered client-side |
| Type-boundary guard in render path | API / Backend | — | `renderLp()` in `lib/lps/render.ts` throws if `kind !== 'LIQUID'`; reciprocal in VITE_SPA serve path (Phase 7) |
| Template listing + kind filter | API / Backend (Server Action) | Frontend Client | `listTemplatesAction` already queries `template`; kind badge in `TemplateCard` |

---

## Standard Stack

### Core (already installed — reuse, do not re-install)

| Library | Installed Version | Purpose | Notes |
|---------|------------------|---------|-------|
| `@aws-sdk/client-s3` | ^3.1064.0 | Multi-file `dist/` upload per-key to S3 | One `PutObjectCommand` per extracted file; same pattern as `requestPresignedUploadAction` |
| `archiver` | ^8.0.0 | ZIP export (write) | Read-side uses `yauzl`, not archiver |
| `zod` | ^4.4.3 | Schema validation for upload action input | Validate ZIP metadata, enforce size limits |
| `prisma` | ^7.8.0 | ORM; migration for `kind` column | Use `--create-only` + manual raw SQL column add |
| `file-type` | ^22.0.1 | Magic bytes check already used in `requestPresignedUploadAction` | Can detect `application/zip` from first bytes |

### New Library: yauzl

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `yauzl` | 3.4.0 | ZIP extraction (read-side counterpart to archiver) | Streaming entry-by-entry API; no auto-extraction to disk (prevents zip-slip by design); actively maintained (June 2026 release) [VERIFIED: npm registry] |
| `@types/yauzl` | 3.4.0 | TypeScript types for yauzl | Bundled with library in v3 [VERIFIED: npm registry] |

**Version verification:** `npm view yauzl version` → `3.4.0` (2026-06-07) [VERIFIED: npm registry]

**Installation:**
```bash
pnpm --filter web add yauzl
pnpm --filter web add -D @types/yauzl
```

### Alternatives Considered

| Recommended | Alternative | Tradeoff |
|-------------|-------------|----------|
| yauzl | unzipper | unzipper (v0.12.3, last modified 2024-07-31) is less maintained and extracts to FS by default (zip-slip risk if used naively) |
| yauzl | adm-zip | adm-zip (v0.5.17) buffers entire ZIP in memory — bad for large dist/ ZIPs; no streaming API |
| TEXT + CHECK | Prisma native enum | Prisma enum + default in same migration triggers Postgres error 55P04 ("new enum values must be committed before they can be used") — requires multi-step migration; TEXT+CHECK avoids the error entirely [CITED: github.com/prisma/prisma/issues/8424] |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  │  POST /w/[slug]/project-templates/new  (multipart FormData: name, zipFile)
  ▼
Server Action: createProjectTemplateAction
  ├─► [1] requireWorkspaceRole (owner/admin/editor)
  ├─► [2] Read ZIP buffer from FormData
  ├─► [3] ZIP validation (yauzl):
  │       • Size guard: compressed < 50 MB, uncompressed < 200 MB
  │       • index.html presence check
  │       • Path traversal: each entry.fileName must NOT contain '../'
  │         and normalized path must start with the dist root
  ├─► [4] Secret scan (in-memory, text entries only):
  │       • Regex: JWT pattern, sk_live_, AKIA[A-Z0-9]{16}, *.supabase.co, *.lovable.app
  │       • Returns: scanFindings[] — advisory, does NOT block
  │       • If findings: return { ok: 'warn', data: { findings } } for user confirmation
  ├─► [5] S3 multi-file upload:
  │       • For each ZIP entry: PutObjectCommand with key
  │         workspaces/{wId}/project-templates/{templateId}/dist/{entry.fileName}
  ├─► [6] Prisma: create Template { kind: 'VITE_SPA', name, workspaceId, … }
  └─► [7] Return { ok: true, data: { templateId } }

Catalog (existing LpsPage RSC):
  ├─► listLpsAction → db.lp.list() — now returns lp.kind field
  ├─► CatalogGrid → LpCatalogCard — receives lp.kind, renders type badge
  └─► TemplatesPage → listTemplatesAction → TemplateCard — kind badge
```

### Recommended Project Structure — New Files Only

```
apps/web/src/
├── app/w/[slug]/
│   └── project-templates/
│       └── new/
│           ├── page.tsx          # RSC wrapper (requireWorkspaceRole, pass slug)
│           └── ProjectTemplateForm.tsx  # Client component: file input + name + confirm-warnings
├── lib/project-templates/
│   ├── actions.ts                # createProjectTemplateAction (Server Action)
│   ├── schema.ts                 # Zod: CreateProjectTemplateSchema
│   ├── zip-validate.ts           # validateZip(buffer): Promise<ZipValidationResult>
│   ├── secret-scan.ts            # scanDistFiles(entries): ScanFinding[]
│   └── s3-upload.ts              # uploadDistToS3(entries, workspaceId, templateId): void
└── prisma/migrations/
    └── 0006_kind_discriminator/
        └── migration.sql         # ALTER TABLE ... ADD COLUMN kind TEXT NOT NULL DEFAULT 'LIQUID'
```

### Pattern 1: Additive `kind` Column Migration (TEXT + CHECK)

**What:** Add `kind TEXT NOT NULL DEFAULT 'LIQUID'` to `template` and `landing_page` in a single `ALTER TABLE` statement. All existing rows get `kind='LIQUID'` automatically without a data migration (Postgres 11+ catalog-stored default).

**When to use:** Any additive non-null column with a constant default on an existing table in Postgres 11+.

**Why TEXT + CHECK instead of native ENUM:** Prisma's `prisma migrate dev --create-only` generates a migration that tries to `CREATE TYPE` and then `ALTER COLUMN … DEFAULT` in the same transaction — Postgres error 55P04 fires because a freshly added enum value cannot be used in the same transaction that created it. TEXT + CHECK sidesteps this entirely. [CITED: github.com/prisma/prisma/issues/8424]

**Migration SQL:**
```sql
-- Migration: 0006_kind_discriminator
-- Adds kind discriminator to template and landing_page tables.
-- ADDITIVE: existing LIQUID rows are unaffected (DEFAULT 'LIQUID').
-- Pattern: TEXT + CHECK constraint instead of native PG enum to avoid
-- Prisma error 55P04 ("new enum values must be committed before they can be used").
-- Postgres 11+ stores constant defaults in catalog — no table rewrite, no lock.

ALTER TABLE "template"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'LIQUID'
    CHECK ("kind" IN ('LIQUID', 'VITE_SPA'));

ALTER TABLE "landing_page"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'LIQUID'
    CHECK ("kind" IN ('LIQUID', 'VITE_SPA'));

-- RLS policies are already active on both tables (from 0004/0005 migrations).
-- The kind column inherits the existing workspace_id RLS policy automatically
-- (no new policy needed; the existing USING/WITH CHECK covers all columns).
```

**Prisma schema addition:**
```prisma
// In Template model:
kind  String @default("LIQUID") // "LIQUID" | "VITE_SPA"

// In LandingPage model:
kind  String @default("LIQUID") // "LIQUID" | "VITE_SPA"
```

**After migration:** run `prisma generate` to regenerate the client. All existing `template.create(data)` calls in `tenant-db.ts` will typecheck because `kind` has a `@default` — no existing create call needs to pass `kind`.

**Existing code impact:** ZERO changes required to existing LIQUID read/write paths. `db.template.list()`, `db.lp.list()`, all `findById`, all `create` — none pass `kind`, and the `@default("LIQUID")` fills it automatically.

### Pattern 2: ZIP Extraction with Zip-Slip Prevention (yauzl)

**What:** Stream each entry from the uploaded ZIP buffer, validating paths before processing content.

**When to use:** Any server-side ZIP processing of untrusted uploads.

```typescript
// Source: zip-slip prevention pattern — [CITED: medium.com/intrinsic-blog/protecting-node-js-applications-from-zip-slip]
import yauzl from "yauzl";
import path from "path";

export interface ZipEntry {
  fileName: string;
  buffer: Buffer;
}

export interface ZipValidationResult {
  ok: boolean;
  error?: string;
  entries?: ZipEntry[];
}

const MAX_COMPRESSED_BYTES = 50 * 1024 * 1024;   // 50 MB compressed ZIP
const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024; // 200 MB total uncompressed

export async function validateAndExtractZip(
  zipBuffer: Buffer
): Promise<ZipValidationResult> {
  if (zipBuffer.length > MAX_COMPRESSED_BYTES) {
    return { ok: false, error: "ZIP file exceeds the 50 MB compressed size limit." };
  }

  return new Promise((resolve) => {
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        return resolve({ ok: false, error: "Invalid or corrupt ZIP file." });
      }

      const entries: ZipEntry[] = [];
      let totalUncompressed = 0;
      let hasIndexHtml = false;

      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        const fileName = entry.fileName;

        // Zip-slip prevention: normalize and verify path stays within root
        const normalizedFileName = path.normalize(fileName);
        if (
          normalizedFileName.startsWith("..") ||
          normalizedFileName.includes("../") ||
          path.isAbsolute(normalizedFileName)
        ) {
          zipfile.close();
          return resolve({
            ok: false,
            error: `ZIP contains a path traversal entry: "${fileName}". Upload rejected.`,
          });
        }

        // Track index.html presence (accept at root OR in a dist/ subfolder)
        if (
          normalizedFileName === "index.html" ||
          normalizedFileName.endsWith("/index.html")
        ) {
          hasIndexHtml = true;
        }

        // Zip bomb: uncompressed size cap
        totalUncompressed += entry.uncompressedSize;
        if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
          zipfile.close();
          return resolve({
            ok: false,
            error: "ZIP total uncompressed size exceeds the 200 MB limit.",
          });
        }

        // Skip directories — only extract file entries
        if (fileName.endsWith("/")) {
          zipfile.readEntry();
          return;
        }

        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            zipfile.close();
            return resolve({ ok: false, error: "Failed to read ZIP entry." });
          }

          const chunks: Buffer[] = [];
          readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
          readStream.on("end", () => {
            entries.push({ fileName: normalizedFileName, buffer: Buffer.concat(chunks) });
            zipfile.readEntry();
          });
          readStream.on("error", () => {
            zipfile.close();
            resolve({ ok: false, error: "Failed to read ZIP entry stream." });
          });
        });
      });

      zipfile.on("end", () => {
        if (!hasIndexHtml) {
          return resolve({
            ok: false,
            error: "ZIP must contain an index.html file at the root or in a subfolder.",
          });
        }
        resolve({ ok: true, entries });
      });

      zipfile.on("error", () =>
        resolve({ ok: false, error: "Invalid or corrupt ZIP file." })
      );
    });
  });
}
```

### Pattern 3: Secret Scan (Post-Extraction, In-Memory)

**What:** After extracting text entries, scan content for known credential patterns and Lovable artifacts. Returns advisory findings — never blocks the upload.

**Confirmed patterns from reference project (`renova-turismo-jornada-main`):**
- **Supabase JWT** (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey…`): present in `.env` as `VITE_SUPABASE_PUBLISHABLE_KEY` — baked into Vite build via `import.meta.env` replacement. The Supabase anon key is NOT a true secret (it's publishable), but its presence signals that the project connects to an external backend, breaking the "static dist/" assumption.
- **Supabase URL** (`https://*.supabase.co`): present in `.env` as `VITE_SUPABASE_URL`. Signals live backend dependency (D6 fronteira declarada).
- **Lovable app URL** (`*.lovable.app`): present in `index.html` OG meta tags. Identifies Lovable-hosted project origin.
- **Lovable tagger** (`lovable-tagger` in vite.config.ts): dev-only component tagger; should NOT appear in `dist/` (runs only in `mode === 'development'`). Not a scan target.

```typescript
// Source: patterns confirmed from renova-turismo-jornada-main reference project [VERIFIED: codebase]
export interface ScanFinding {
  file: string;
  type: string;
  description: string;
}

const SECRET_PATTERNS: Array<{ type: string; pattern: RegExp; description: string }> = [
  {
    type: "SUPABASE_JWT",
    // Supabase JWTs always start with this specific header (HS256 alg + JWT typ)
    pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    description: "Supabase JWT anon key detected. This key is baked into the bundle and visible to all users. Ensure it is intentional and your Supabase project's Row Level Security is enabled.",
  },
  {
    type: "SUPABASE_URL",
    pattern: /https:\/\/[a-z0-9]+\.supabase\.co/,
    description: "Supabase project URL detected. This LP depends on a live Supabase backend — it may not function correctly without that backend.",
  },
  {
    type: "STRIPE_LIVE_KEY",
    pattern: /sk_live_[A-Za-z0-9]{24,}/,
    description: "Stripe live secret key detected. This is a high-severity credential — remove it from your project before uploading.",
  },
  {
    type: "AWS_ACCESS_KEY",
    pattern: /AKIA[A-Z0-9]{16}/,
    description: "AWS access key detected. This is a credential — remove it before uploading.",
  },
  {
    type: "LOVABLE_APP_URL",
    pattern: /[a-z0-9-]+\.lovable\.app/,
    description: "Lovable-hosted URL detected in the bundle. You may want to update canonical URLs to your own domain after registering this template.",
  },
];

/** Text extensions to scan (skip binary assets) */
const TEXT_EXTENSIONS = new Set([".html", ".js", ".mjs", ".cjs", ".css", ".json", ".ts", ".tsx"]);

export function scanDistFiles(entries: Array<{ fileName: string; buffer: Buffer }>): ScanFinding[] {
  const findings: ScanFinding[] = [];

  for (const entry of entries) {
    const ext = path.extname(entry.fileName).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;

    const content = entry.buffer.toString("utf-8");

    for (const { type, pattern, description } of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        findings.push({ file: entry.fileName, type, description });
      }
    }
  }

  return findings;
}
```

### Pattern 4: S3 Multi-File Upload for `dist/`

**What:** Upload each extracted ZIP entry as a separate S3 object under the tenant-scoped prefix.

**S3 key convention:** `workspaces/{workspaceId}/project-templates/{templateId}/dist/{normalizedFileName}`

This mirrors the existing LP asset convention (`workspaces/{wId}/lps/assets/{uuid}.ext`) from `requestPresignedUploadAction`. The prefix is non-enumerable: a user knowing one file's key cannot list others (S3 does not have directory listings by default unless explicitly enabled).

```typescript
// Source: follows requestPresignedUploadAction pattern in apps/web/src/lib/lps/actions.ts [VERIFIED: codebase]
import { PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types"; // already inferred from file-type in existing code

export async function uploadDistToS3(
  entries: Array<{ fileName: string; buffer: Buffer }>,
  workspaceId: string,
  templateId: string,
  s3Client: S3Client
): Promise<void> {
  const bucket = process.env.S3_BUCKET!;

  // Upload in parallel (Promise.all); entries are already in-memory from extraction
  await Promise.all(
    entries.map(async (entry) => {
      const key = `workspaces/${workspaceId}/project-templates/${templateId}/dist/${entry.fileName}`;
      const contentType = mime.lookup(entry.fileName) || "application/octet-stream";

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: entry.buffer,
          ContentType: contentType,
        })
      );
    })
  );
}
```

**Note on mime-types:** The project does not currently install `mime-types`. Acceptable alternatives: (a) install `mime-types` (tiny, zero deps), or (b) use a small inline extension-to-MIME map covering the common Vite output extensions (`.html`, `.js`, `.css`, `.png`, `.svg`, `.ico`, `.woff2`). Option (b) avoids a new dependency.

### Pattern 5: Type-Boundary Guard in render path

**What:** `renderLp()` must reject VITE_SPA templates explicitly rather than silently attempting LiquidJS merge on a React bundle.

**Where:** `apps/web/src/lib/lps/render.ts` — the single render path for LIQUID.

```typescript
// Extend renderLp signature to include kind check
// Source: extends existing render.ts pattern [VERIFIED: codebase]
export async function renderLp(
  lp: { markupSnapshot: string; values: Record<string, unknown>; kind?: string },
  db: TenantClient
): Promise<string> {
  if (lp.kind === "VITE_SPA") {
    throw new Error(
      "Type boundary violation: VITE_SPA templates cannot be rendered via the LIQUID render path. Use the VITE_SPA serve path instead."
    );
  }
  // ... existing render logic unchanged
}
```

**Reciprocal guard:** The VITE_SPA serve/export path (Phase 7/8) must check `kind === 'VITE_SPA'` before serving. A LIQUID template passed to the VITE_SPA path throws equivalently. Both guards are covered by boundary tests (see V2-11 in success criteria).

### Pattern 6: Type Badge in Catalog Card

**What:** Pass `lp.kind` (or `template.kind`) to the card component and render a small badge.

**Where in existing code:**
- `CatalogLp` interface in `CatalogGrid.tsx` — add `kind: string`
- `LpCatalogCardProps` in `LpCatalogCard.tsx` — add `kind: string` to the `lp` prop
- `listLpsAction` return type — add `kind: string` to the mapped result
- `TemplateCard.tsx` — add `kind` badge similarly

**Badge rendering (follows existing pattern):**
```tsx
// In LpCatalogCard CardHeader area — follows existing folder/tag badge pattern
{lp.kind === "VITE_SPA" && (
  <Badge variant="outline" className="text-xs shrink-0">
    Vite SPA
  </Badge>
)}
```

### Pattern 7: `createProjectTemplateAction` — Two-Phase Confirmation

**What:** The action has two distinct call shapes to support the D6 "warn before complete" flow:

1. **Phase 1 (validate + scan):** Client sends ZIP. Server validates, scans, returns findings if any. `{ ok: 'warn', data: { findings, uploadToken } }` — does NOT persist yet.
2. **Phase 2 (confirm + persist):** Client re-sends with `confirmed: true`. Server re-validates the uploadToken (prevents replay), then persists.

**Simpler alternative (recommended for Phase 6 MVP):** Since this is an ingest-only phase (no serving), the simpler approach is: validate + scan in a single action, persist regardless of scan findings, return findings in the success response. The UI shows a toast/alert listing findings after the template is created. This avoids the two-phase complexity while still meeting the D6 requirement ("achados são avisados ao usuário antes de concluir" can be interpreted as "before navigating away" rather than "before writing to DB").

**Decision:** MVP simplification — single action, persist on success, return `{ findings }` in the result for UI to surface. No upload token / two-phase needed.

### Anti-Patterns to Avoid

- **Never extract ZIP to disk.** yauzl's `fromBuffer` + entry-by-entry streaming keeps everything in memory. Writing to disk in a serverless/ephemeral environment creates race conditions and cleanup issues.
- **Never use a Prisma native enum for `kind`.** The `55P04` error fires when Prisma's generated migration tries to use a new enum value as a default in the same transaction that creates the enum type. TEXT + CHECK is universally safe.
- **Never inject `workspaceId` or `templateId` from client payload.** The S3 key prefix MUST be built from server-session-derived `workspaceId` (same as `requestPresignedUploadAction`).
- **Never skip the `path.normalize` + prefix check on ZIP entry filenames.** Zip-slip allows writing outside the intended directory — it's the canonical attack for archive extraction.
- **Never pass a VITE_SPA `markupSnapshot` to `renderLp()`.** A React bundle passed to LiquidJS will either crash or produce corrupt output silently; the explicit guard prevents silent corruption.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP extraction + streaming | Custom ZIP parser | `yauzl` | ZIP format has edge cases (streaming vs central directory, ZIP64, encoding); yauzl handles all of them |
| Zip-slip prevention | Custom path sanitizer | `path.normalize` + prefix check (one-liner) | Standard pattern; the only correct check is normalize + startsWith |
| MIME type from extension | Extension-to-string map | `mime-types` (or inline map for 8 extensions) | `mime-types` is 1 KB; covers edge cases like `.mjs`, `.woff2` |
| S3 multi-file upload | Custom upload loop | `@aws-sdk/client-s3` `PutObjectCommand` (already installed) | Re-uses existing S3 client singleton |
| Secret scanning | External service / CLI | In-memory regex scan (Pattern 3 above) | For 5 well-known patterns, a regex scan is sufficient and avoids network call; no new dependency |

**Key insight:** The ZIP validation and S3 upload are fully server-side — there is no client-side complexity here (unlike the presigned URL + ImageUploadField pattern in Phase 4). This simplifies the implementation significantly.

---

## Existing Code Extension Points (Concrete, Verified)

The planner needs exact file paths and function signatures to avoid reinventing.

### 1. S3 Client Singleton

**File:** `apps/web/src/lib/lps/actions.ts` (lines 49–57)

The S3 client is initialized once at module level with `new S3Client({ region, endpoint, forcePathStyle, credentials })`. The new `createProjectTemplateAction` should use the same `s3Client` singleton — either import it from a shared `lib/s3.ts` (if extracted) or replicate the initialization pattern.

**Current S3 key prefix for LP assets:**
```
workspaces/{workspaceId}/lps/assets/{uuid}.{ext}
```
**New S3 key prefix for project-template dist/:**
```
workspaces/{workspaceId}/project-templates/{templateId}/dist/{normalizedFileName}
```

### 2. `withTenantDb` + `TenantClient`

**File:** `apps/web/src/lib/db/tenant-db.ts`

Pattern for all tenant-scoped writes:
```typescript
await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
  return db.template.create({ name, markup: "", schema: {}, metadataOverlay: {} });
  //                          ^ will need kind: "VITE_SPA" added to signature
});
```

**What to extend:** `TenantTemplateHelpers.create()` currently accepts `{ name, markup, schema, metadataOverlay }`. Add optional `kind?: string` (defaults to `"LIQUID"` at the DB level, so the caller only passes it for VITE_SPA).

### 3. `listTemplatesAction` + `TemplateCard`

**File:** `apps/web/src/lib/templates/actions.ts` — lists all templates for a workspace via `db.template.list()`.
**File:** `apps/web/src/components/templates/TemplateCard.tsx` — renders a single template card.

`listTemplatesAction` returns a mapped array from `db.template.list()`. Once the Prisma client is regenerated with `kind`, `template.kind` is available on every row. Add `kind` to the mapped return type and pass it to `TemplateCard` for the badge.

### 4. `listLpsAction` + `CatalogLp` + `LpCatalogCard`

**File:** `apps/web/src/lib/lps/actions.ts` — `listLpsAction` maps `db.lp.list()` to a shape consumed by `CatalogGrid`.
**File:** `apps/web/src/components/catalog/CatalogGrid.tsx` — `CatalogLp` interface.
**File:** `apps/web/src/components/catalog/LpCatalogCard.tsx` — `LpCatalogCardProps.lp`.

Add `kind: string` to the `listLpsAction` return type, `CatalogLp`, and `LpCatalogCardProps.lp`. The badge conditional is one JSX line.

### 5. `renderLp()` — Type Guard

**File:** `apps/web/src/lib/lps/render.ts`

The function signature currently accepts `{ markupSnapshot: string; values: Record<string, unknown> }`. Add `kind?: string` and throw if `kind === 'VITE_SPA'`. Called from:
- `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` — must pass `lp.kind`
- `apps/web/src/app/api/lps/[lpId]/export/route.ts` — must pass `lp.kind`

Both callers fetch the LP via `db.lp.findById()` or `prisma.landingPage.findUnique()` — after client regeneration, `.kind` is available on the returned record.

### 6. Migration Numbering

Existing migrations: `0001` through `0005`. New migration: **`0006_kind_discriminator`**.

Pattern (matches 0004, 0005): `prisma migrate dev --create-only --name kind_discriminator` → Prisma generates SQL; **delete the generated SQL and replace with the raw ALTER TABLE statements** above (Prisma would otherwise generate a native ENUM type + `55P04` error). Then run `prisma migrate deploy`.

---

## Common Pitfalls

### Pitfall 1: Prisma Native Enum + Default = 55P04 Error

**What goes wrong:** Prisma's auto-generated migration for `enum TemplateKind { LIQUID VITE_SPA }` + `kind TemplateKind @default(LIQUID)` produces SQL that calls `ALTER TABLE … DEFAULT 'LIQUID'::` in the same transaction as `ALTER TYPE … ADD VALUE 'LIQUID'`. Postgres rejects this with error 55P04: "new enum values must be committed before they can be used."

**Why it happens:** Postgres requires enum value additions to be committed before they can be referenced as defaults. Prisma's `--create-only` workflow does not split the transaction.

**How to avoid:** Use TEXT + CHECK as described in Pattern 1. The migration is a single `ALTER TABLE … ADD COLUMN … TEXT NOT NULL DEFAULT 'LIQUID' CHECK (kind IN ('LIQUID','VITE_SPA'))` — no enum type involved.

**Warning signs:** Running `prisma migrate dev` on a schema with a new native enum column fails with 55P04 in the migration output.

### Pitfall 2: Zip-Slip via Missing normalize + prefix Check

**What goes wrong:** Extracting ZIP entries without checking the normalized path allows an attacker to craft a ZIP with entries like `../../etc/passwd` or `../../../app/server.js`. On a server-side extraction, this writes arbitrary files outside the intended output directory.

**Why it happens:** ZIP files can have any string as an entry filename, including paths with `..` traversal segments.

**How to avoid:** Always call `path.normalize(entry.fileName)` and check that the result does NOT start with `..` and is NOT an absolute path. Reject the entire ZIP immediately on first violation (Pattern 2).

**Warning signs:** Extracted files appear outside the expected dist tree; unit tests with `../` entries succeed.

### Pitfall 3: Baked VITE_ Env Vars in dist/ Bundle

**What goes wrong:** Vite replaces `import.meta.env.VITE_*` references with literal values at build time. The `dist/` output contains the actual secret values from the project's `.env`, even if the source code uses `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` symbolically.

**Why it happens:** Confirmed in the reference project: `renova-turismo-jornada-main/.env` contains `VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGc…"` — a full Supabase JWT that is baked into the compiled JS bundle. The scan must check the compiled output, not the source files.

**How to avoid:** The D6 scan runs post-extraction on the compiled `dist/` entries — this is the correct layer (Pattern 3).

**Warning signs:** Scan misses a key because it ran on source files (pre-build) instead of `dist/` entries.

### Pitfall 4: Creating `kind` as NON-NULL Without Default Fails With Existing Rows

**What goes wrong:** `ALTER TABLE template ADD COLUMN kind TEXT NOT NULL` without a `DEFAULT` clause fails immediately if the table has existing rows, because the DB cannot fill the non-null column for those rows.

**Why it happens:** Standard SQL behavior: non-null column add requires a default or the table must be empty.

**How to avoid:** Always include `DEFAULT 'LIQUID'` in the ADD COLUMN statement (Pattern 1). Postgres 11+ stores this as a catalog default — zero rows are rewritten.

**Warning signs:** Migration fails with "column cannot be cast automatically" or "null value in column".

### Pitfall 5: Forgetting to Pass `kind` to `renderLp()` Call Sites

**What goes wrong:** The type guard in `renderLp()` throws if `kind === 'VITE_SPA'`, but if callers don't pass `kind`, the guard never fires — VITE_SPA templates silently enter the LIQUID render path and produce corrupt HTML.

**Why it happens:** `kind` is optional in the signature (to avoid breaking callers before they're updated). Optional = easy to forget.

**How to avoid:** Make `kind` a required parameter in `renderLp()` AFTER updating both call sites in the same wave. The type error from TypeScript catches forgotten callers at compile time.

### Pitfall 6: ZIP Bomb via Low Compression Ratio

**What goes wrong:** A ZIP of highly-compressible content (e.g., 1 GB of `AAAA…`) is only a few KB compressed but expands to gigabytes in memory during extraction.

**Why it happens:** The compressed-size check passes (ZIP is small), but the uncompressed size is enormous.

**How to avoid:** Track `totalUncompressed += entry.uncompressedSize` before opening the read stream (yauzl provides `entry.uncompressedSize` from the ZIP central directory). Reject if total exceeds 200 MB (Pattern 2).

---

## Runtime State Inventory

This phase is purely additive. No rename/refactor/migration of existing data is involved beyond the schema column addition.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | All existing `template` and `landing_page` rows lack a `kind` column | Column added with `DEFAULT 'LIQUID'` — existing rows automatically get `kind='LIQUID'`; no data migration required |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | S3 env vars (`S3_BUCKET`, `S3_REGION`, etc.) already configured for Phase 4 | Reuse unchanged |
| Build artifacts | Prisma generated client (`apps/web/src/generated/prisma/`) is stale after schema change | Run `prisma generate` in Wave 0 after migration |

---

## Code Examples

### Full `createProjectTemplateAction` skeleton

```typescript
// apps/web/src/lib/project-templates/actions.ts
"use server";

import { requireWorkspaceRole } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { validateAndExtractZip } from "./zip-validate";
import { scanDistFiles } from "./secret-scan";
import { uploadDistToS3 } from "./s3-upload";
import { CreateProjectTemplateSchema } from "./schema";
import type { ActionResult } from "@/lib/workspaces/actions";
import { S3Client } from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";

const s3Client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export async function createProjectTemplateAction(
  slug: string,
  formData: FormData
): Promise<ActionResult<{ id: string; findings: ScanFinding[] }>> {
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Extract and validate inputs from FormData
  const name = formData.get("name");
  const zipFile = formData.get("zipFile");
  if (typeof name !== "string" || !(zipFile instanceof File)) {
    return { ok: false, error: "Invalid form data." };
  }

  // Zod validation
  const parsed = CreateProjectTemplateSchema.safeParse({ name });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: ... };
  }

  // Read ZIP into buffer (server-side — no presigned URL pattern needed here)
  const zipBuffer = Buffer.from(await zipFile.arrayBuffer());

  // Validate ZIP structure + path traversal + size
  const validation = await validateAndExtractZip(zipBuffer);
  if (!validation.ok) {
    return { ok: false, error: validation.error! };
  }

  // Scan for secrets and Lovable artifacts (advisory)
  const findings = scanDistFiles(validation.entries!);

  // Generate a new template ID up-front (needed for S3 key prefix)
  const templateId = crypto.randomUUID();

  // Upload dist/ entries to S3 under tenant-scoped prefix
  await uploadDistToS3(validation.entries!, ctx.workspaceId, templateId, s3Client);

  // Persist Template record with kind='VITE_SPA'
  await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
    await db.template.create({
      id: templateId,      // explicit — DB row id MUST equal the S3 key prefix templateId (Phase 7 serving lookup)
      // kind defaults to 'LIQUID' in the DB; must pass 'VITE_SPA' explicitly
      // After TenantTemplateHelpers.create() is extended with kind?: and id?:
      kind: "VITE_SPA",
      name: parsed.data.name,
      markup: "",          // VITE_SPA has no markup; empty string satisfies NOT NULL
      schema: {},          // VITE_SPA has no token schema
      metadataOverlay: {}, // VITE_SPA has no metadata overlay
    });
  });

  revalidatePath(`/w/${slug}/templates`);
  return { ok: true, data: { id: templateId, findings } };
}
```

### Boundary test for V2-11

```typescript
// apps/web/tests/type-boundary.test.ts
import { describe, it, expect } from "vitest";
import { renderLp } from "@/lib/lps/render";

describe("type boundary (V2-11)", () => {
  it("throws when kind=VITE_SPA is passed to renderLp", async () => {
    await expect(
      renderLp(
        { markupSnapshot: "<h1>Hello</h1>", values: {}, kind: "VITE_SPA" },
        /* db */ {} as any
      )
    ).rejects.toThrow("Type boundary violation");
  });

  it("does NOT throw when kind=LIQUID is passed to renderLp", async () => {
    // renderLp requires a live db for brand config — mock it
    const mockDb = { brandConfig: { findFirst: async () => null } } as any;
    await expect(
      renderLp(
        { markupSnapshot: "{{ title:text }}", values: { title: "Test" }, kind: "LIQUID" },
        mockDb
      )
    ).resolves.toBeTruthy();
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Prisma native enum for discriminator | TEXT + CHECK constraint (avoids 55P04) | Additive migration works in a single statement |
| Full in-memory ZIP (adm-zip, jszip) | Streaming entry-by-entry (yauzl) | Memory-safe for large dist/ ZIPs |
| Upload to disk, then process | Buffer in memory, upload to S3 directly | No disk I/O; serverless-compatible |

**Deprecated/outdated:**
- `adm-zip` for server-side ZIP reading: buffers entire ZIP in RAM; acceptable for small files, not for dist/ ZIPs that can be 30–100 MB uncompressed.
- Native Postgres enum type for feature flags / discriminators in an existing table: TEXT + CHECK is operationally identical but avoids `55P04` and is easier to extend (just add a CHECK value, no `ALTER TYPE … ADD VALUE` needed).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `50 MB compressed / 200 MB uncompressed` are appropriate ZIP size limits for a Vite `dist/` | Standard Stack / zip-validate.ts | A real project exceeds these limits and the upload is erroneously rejected — limits are configurable and should be env-var-backed |
| A2 | VITE_SPA templates should store `markup: ""` and `schema: {}` (empty) for the LIQUID fields | Pattern 7 skeleton | If Prisma schema requires NOT NULL non-empty for these fields, the empty-string/empty-object default needs a separate nullable migration or a sentinel value |
| A3 | The `lovable-tagger` plugin does not embed artifacts in `dist/` (only in dev mode) | Pattern 3 / not a scan target | If lovable-tagger does embed something in `dist/`, the scan may need to add a tagger pattern |
| A4 | Supabase anon key (publishable) is advisory-only, not blocking | Pattern 3 | Some teams treat the anon key as confidential; the current design warns but does not block — align with product decision |

---

## Open Questions (RESOLVED)

1. **ZIP size limits**
   - What we know: no current defined limit for this phase; Phase 4 image limit is 5 MB.
   - What's unclear: a full Vite build can range from 5 MB to 100+ MB depending on images/assets bundled; the "right" limit depends on S3 storage cost tolerance.
   - Recommendation: start with 50 MB compressed / 200 MB uncompressed, backed by env vars `MAX_DIST_ZIP_COMPRESSED_MB` and `MAX_DIST_ZIP_UNCOMPRESSED_MB` so they can be adjusted without code changes.

2. **Template `markup` column for VITE_SPA**
   - What we know: `markup TEXT NOT NULL` in the current schema; VITE_SPA has no LiquidJS markup.
   - What's unclear: storing `""` satisfies NOT NULL but may confuse code that reads `markup` and passes it to the parser.
   - Recommendation: add a guard to `createTemplateAction` and `parseTemplateAction` that skips parsing when `kind === 'VITE_SPA'` — same pattern as the render guard (V2-11).

3. **Confirmation UX for scan findings**
   - What we know: D6 says "achados são AVISADOS ao usuário antes de concluir."
   - What's unclear: whether "before concluding" means (a) before the DB write (two-phase action), or (b) after the write, displayed in a toast/alert that the user must dismiss.
   - Recommendation: MVP = option (b): single action, write to DB on success, return findings in the result, surface them as a warning toast/alert. This is simpler and sufficient for Phase 6 (no serving yet, so there is no downstream risk from an un-confirmed upload).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@aws-sdk/client-s3` | S3 multi-file upload | ✓ | ^3.1064.0 | — |
| `yauzl` | ZIP extraction | ✗ (not installed yet) | 3.4.0 | — (no fallback; must install) |
| PostgreSQL | `kind` column migration | ✓ | 16+ (per CLAUDE.md) | — |
| S3_BUCKET / S3_REGION env vars | S3 upload | ✓ (configured in Phase 4) | — | — |

**Missing dependencies with no fallback:**
- `yauzl` — must install via `pnpm --filter web add yauzl`

**Missing dependencies with fallback:**
- None

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (upload action) | `requireWorkspaceRole` (better-auth) |
| V3 Session Management | no (no new session handling) | — |
| V4 Access Control | yes | `requireWorkspaceRole` gates upload to owner/admin/editor; workspace_id from session only |
| V5 Input Validation | yes | Zod on action inputs; yauzl entry validation; path.normalize zip-slip check; size limits |
| V6 Cryptography | no (no crypto operations) | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Zip-Slip (path traversal in archive) | Tampering | `path.normalize` + prefix check before extraction (Pattern 2) |
| Zip Bomb (decompression bomb) | DoS | `entry.uncompressedSize` cap before reading stream (Pattern 2) |
| SSRF via dist/ S3 key injection | Tampering | S3 key built server-side from session-derived workspaceId — client cannot influence key prefix |
| Credential exposure in dist/ bundle | Information Disclosure | D6 scan (Pattern 3) — advisory; Supabase anon key confirmed present in reference project |
| Cross-tenant template access | Spoofing | RLS + `workspaceId` filter on all template queries (existing pattern, unchanged) |
| Type confusion: VITE_SPA → LIQUID render | Tampering | Explicit type guard in `renderLp()` (Pattern 5, V2-11) |

---

## Sources

### Primary (HIGH confidence)
- Codebase `apps/web/` — verified all extension points, migration patterns, S3 client setup, existing guards, TenantClient interface, and catalog component props [VERIFIED: codebase]
- `apps/web/prisma/schema.prisma` — verified current Template and LandingPage models (no `kind` column); confirmed TEXT column approach needed [VERIFIED: codebase]
- `apps/web/prisma/migrations/0004_add_template_brand_config/migration.sql` — confirmed exact RLS migration pattern [VERIFIED: codebase]
- `renova-turismo-jornada-main/.env` — confirmed live Supabase JWT and URL in VITE_ env vars [VERIFIED: codebase]
- `renova-turismo-jornada-main/index.html` — confirmed `*.lovable.app` URLs in OG meta tags [VERIFIED: codebase]
- `npm view yauzl version` → `3.4.0` (2026-06-07); `npm view unzipper version` → `0.12.3` (2024-07-31) [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- [Protecting Node.js Applications from Zip Slip](https://medium.com/intrinsic-blog/protecting-node-js-applications-from-zip-slip-b24a37811c10) — path.normalize + prefix check pattern
- [Prisma issue #8424](https://github.com/prisma/prisma/issues/8424) — confirmed 55P04 error when using new enum value as default in same migration
- [PostgreSQL docs — ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) — confirmed Postgres 11+ stores constant defaults in catalog (no table rewrite)

### Tertiary (LOW confidence — flagged)
- ZIP size recommendations (50 MB / 200 MB) — [ASSUMED] based on typical Vite dist/ output ranges; no authoritative source for "right" limits in this context

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all libraries verified against npm registry; existing S3/Prisma/yauzl patterns confirmed from codebase
- Migration Pattern: HIGH — TEXT+CHECK confirmed from Postgres and Prisma issue tracker; RLS pattern copied verbatim from existing migrations
- Secret Scan Patterns: HIGH — regex targets confirmed from reference project (`renova-turismo-jornada-main`) live `.env` and `index.html`
- Architecture: HIGH — all extension points verified in codebase with exact file paths and function signatures
- Pitfalls: HIGH — 55P04, zip-slip, and zip-bomb are documented failure modes; baked env var confirmed in reference project

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (stable stack; no fast-moving dependencies)
