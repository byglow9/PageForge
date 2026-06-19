# Phase 7: Isolated Serving + Sandboxed Preview - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/proxy.ts` | proxy / middleware | request-response | none (first proxy in codebase) | no analog — use RESEARCH.md Pattern 1 |
| `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` | route handler | streaming, request-response | `apps/web/src/app/api/lps/[lpId]/export/route.ts` | role-match (same route handler + S3 + header injection shape) |
| `apps/web/src/lib/serve/token.ts` | lib utility | request-response | `apps/web/src/lib/auth/permissions.ts` (token/role logic) + `apps/web/src/lib/lps/actions.ts` (env-var-keyed secrets) | partial match (no HMAC util exists yet) |
| `apps/web/src/lib/serve/serve-vite-spa.ts` | lib utility | transform | `apps/web/src/lib/lps/render.ts` | exact (same guard-then-logic structure; reciprocal of its VITE_SPA rejection) |
| `apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx` | RSC page | request-response | `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` | exact (RSC page + requireWorkspace + error fallback shape) |
| `apps/web/tests/type-boundary.test.ts` | test | — | `apps/web/tests/type-boundary.test.ts` itself (extension) | exact (same file, add new describe block) |
| `apps/web/src/lib/project-templates/s3-upload.ts` | lib utility | file-I/O | self (MIME map reused by serving handler; no modification needed) | exact read-only reference |

---

## Pattern Assignments

### `apps/web/src/proxy.ts` (proxy, request-response)

**Analog:** None — this project has no existing `proxy.ts` or `middleware.ts`. Create fresh using RESEARCH.md Pattern 1.

**No-analog reason:** The project has never needed host-based routing before Phase 7. The research file provides the authoritative pattern sourced from Next.js 16 official docs.

**Key constraints from research (RESEARCH.md lines 182-213):**
- File name: `proxy.ts`, exported function name: `proxy` (not `middleware` — that is deprecated in Next.js 16)
- Regex for serving host: `/^([a-z0-9-]{1,64})\.serve\./i`
- Rewrite rule: `tplId` extracted from subdomain; `url.pathname` rewritten to `/serve/${tplId}${pathname}`
- Matcher must exclude `_next/static`, `_next/image`, `favicon.ico` (Pitfall 2)
- Dashboard host passes through with `NextResponse.next()`

**Pattern to implement (from RESEARCH.md lines 186-213):**
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SERVE_HOST_RE = /^([a-z0-9-]{1,64})\.serve\./i

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const match = SERVE_HOST_RE.exec(host)
  if (match) {
    const tplId = match[1]
    const url = request.nextUrl.clone()
    url.pathname = `/serve/${tplId}${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
```

---

### `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` (route handler, streaming)

**Analog:** `apps/web/src/app/api/lps/[lpId]/export/route.ts`

**Why this analog:** Same shape — exported `GET` function, async params, session/auth check up front, S3 interaction, response headers including CSP, try/catch with status codes. The export handler also demonstrates the `type-boundary` early-return pattern (lines 193-202).

**Imports pattern** (from `export/route.ts` lines 26-34):
```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { GetObjectCommand } from "@aws-sdk/client-s3";
// For serving handler, also import:
import { verifyServeToken } from "@/lib/serve/token";
import { resolveServePath, assertViteSpaKind } from "@/lib/serve/serve-vite-spa";
// Reuse s3Client singleton — same init as lps/actions.ts and project-templates/actions.ts
```

**S3 client singleton pattern** (from `apps/web/src/lib/lps/actions.ts` lines 49-57 and `project-templates/actions.ts` lines 38-46):
```typescript
// Module-level singleton — initialized once per cold start
// Security: credentials only from server-side env vars
const s3Client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
```

**Auth / token validation pattern** (mirror of `export/route.ts` lines 156-188 — session check replaced by token check):
```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tplId: string; path?: string[] }> }
) {
  try {
    const { tplId, path = [] } = await params
    // Token validation replaces session check for isolated origin
    const token = new URL(request.url).searchParams.get('t')
    const claims = token ? verifyServeToken(token) : null
    if (!claims || claims.templateId !== tplId) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    // ... rest of handler
  } catch (err) {
    // same pattern as export/route.ts lines 293-296
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
```

**Type-boundary early return pattern** (from `export/route.ts` lines 193-202):
```typescript
// export/route.ts already does this for the LIQUID path:
if ((lp.kind ?? "LIQUID") === "VITE_SPA") {
  return NextResponse.json(
    { error: "VITE_SPA landing pages cannot be exported via this endpoint..." },
    { status: 409 }
  );
}
// Serving handler mirrors this reciprocally — call assertViteSpaKind(template.kind)
// which throws "Type boundary violation" for kind !== 'VITE_SPA'
```

**S3 stream pattern** (from `apps/web/src/lib/lps/actions.ts` lines 591-601):
```typescript
// For chunked buffer accumulation (used in actions.ts for image-size check):
const response = await s3Client.send(s3Cmd);
const chunks: Uint8Array[] = [];
for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
  chunks.push(chunk);
}

// For direct streaming to Response (RESEARCH.md Pattern 2 — preferred for serving):
// Body has SdkStreamMixin.transformToWebStream() in AWS SDK v3 Node.js runtime
const webStream = response.Body!.transformToWebStream()
return new NextResponse(webStream, { headers: { 'Content-Type': contentType } })
```

**CSP header injection pattern** (from `export/route.ts` line 53 — but as HTTP header, not meta tag):
```typescript
// export/route.ts uses a <meta> tag (for static ZIP export — acceptable there)
// Serving handler MUST use HTTP response header (Pitfall 6: frame-ancestors ignored in meta)
return new NextResponse(webStream, {
  headers: {
    'Content-Type': contentType,
    'Content-Security-Policy': `frame-ancestors ${process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3000'}`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
})
```

**Error handling pattern** (from `export/route.ts` lines 293-296):
```typescript
} catch (err) {
  console.error("[serve/route] serving failed:", err);
  return new NextResponse('Internal Server Error', { status: 500 });
}
```

**MIME map reuse** (from `apps/web/src/lib/project-templates/s3-upload.ts` lines 27-37):
```typescript
// Import getContentType from serve-vite-spa.ts which wraps the same MIME map
// OR import the MIME logic directly from s3-upload.ts if exported
// Key: derive Content-Type from file extension, NEVER read Body bytes first (Pitfall 4)
const ext = path.extname(s3Path).toLowerCase()
const contentType = MIME[ext] ?? 'application/octet-stream'
```

**S3 key construction** (from `apps/web/src/lib/project-templates/s3-upload.ts` line 57):
```typescript
// Exact key format established in Phase 6 — do not deviate
const key = `workspaces/${workspaceId}/project-templates/${templateId}/dist/${normalizedPath}`
```

---

### `apps/web/src/lib/serve/token.ts` (lib utility, request-response)

**Analog:** `apps/web/src/lib/auth/permissions.ts` (role/auth logic structure) + `apps/web/src/lib/project-templates/actions.ts` lines 38-46 (env-var-keyed secrets)

**Why partial match:** No HMAC signing utility exists yet. The `permissions.ts` file shows how auth contracts are typed and exported; `actions.ts` shows the env-var-only credential pattern. The actual HMAC code comes from RESEARCH.md Pattern 3.

**Typing and export pattern** (from `permissions.ts` lines 8-23):
```typescript
import { z } from "zod"

// Named interface for claims (mirrors RoleSchema + ROLES pattern)
interface ServeClaims {
  workspaceId: string
  templateId: string
  exp: number
}

// Factory pattern for testability (Open Question 2 from RESEARCH.md):
// Export createTokenUtils(secret) so tests can pass a known secret without process.env
export function createTokenUtils(secret: string) {
  return { mintServeToken, verifyServeToken }
}
```

**Env-var secret pattern** (from `project-templates/actions.ts` lines 38-46 and `lps/actions.ts` lines 49-57):
```typescript
// Follow the established singleton pattern — env-var only, never from client
const SECRET = process.env.SERVE_TOKEN_SECRET! // min 32 bytes — fail fast at startup
```

**HMAC implementation** (from RESEARCH.md Pattern 3, lines 288-325):
```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'
// mintServeToken: JSON payload → base64url → HMAC-SHA256 → "${b64}.${sig}"
// verifyServeToken: split on '.', recompute sig, timingSafeEqual, parse claims, check exp
// Critical: use timingSafeEqual — never Buffer.from(a) === Buffer.from(b)
```

---

### `apps/web/src/lib/serve/serve-vite-spa.ts` (lib utility, transform)

**Analog:** `apps/web/src/lib/lps/render.ts`

**Why exact match:** `render.ts` is the LIQUID-side type guard — this file is its reciprocal for the VITE_SPA serving path (D-08). Same structure: a guard function that throws "Type boundary violation" + core logic function.

**Type guard pattern** (mirror of `render.ts` lines 46-54):
```typescript
// render.ts rejects VITE_SPA:
if (lp.kind === "VITE_SPA") {
  throw new Error(
    "Type boundary violation: VITE_SPA templates cannot be rendered via the LIQUID render path. Use the VITE_SPA serve path instead."
  );
}

// serve-vite-spa.ts rejects everything that is NOT VITE_SPA:
export function assertViteSpaKind(kind: string): void {
  if (kind !== 'VITE_SPA') {
    throw new Error(
      `Type boundary violation: only VITE_SPA templates can be served via the isolated serve path. ` +
      `Got kind="${kind}". Use renderLp() for LIQUID templates.`
    )
  }
}
```

**File header comment pattern** (from `render.ts` lines 1-16):
```typescript
/**
 * VITE_SPA serve utility — server-only module.
 *
 * IMPORTANT: NO "use server" directive — this is a server-only utility called
 * from route handlers, NOT a Server Action.
 *
 * Guard is the reciprocal of renderLp() in lib/lps/render.ts:
 * - renderLp()  rejects kind=VITE_SPA → use serve path
 * - assertViteSpaKind() rejects kind≠VITE_SPA → use renderLp()
 */
```

**SPA fallback logic** (no analog — new logic, informed by RESEARCH.md Pattern 4):
```typescript
export function resolveServePath(requestPath: string): { s3Path: string; isFallback: boolean } {
  const normalized = requestPath.replace(/^\/+/, '') || 'index.html'
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(normalized)
  if (hasExtension) {
    return { s3Path: normalized, isFallback: false }  // asset → 404 if missing
  }
  return { s3Path: 'index.html', isFallback: true }   // SPA route → index.html
}
```

**MIME map reuse** (from `s3-upload.ts` lines 27-37 — copy or import):
```typescript
// s3-upload.ts defines the canonical MIME map for this project:
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}
// Export getContentType() from serve-vite-spa.ts — same logic as s3-upload.ts lines 59-61
export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME[ext] ?? 'application/octet-stream'
}
```

---

### `apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx` (RSC page, request-response)

**Analog:** `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx`

**Why exact match:** Same pattern — async RSC page, awaited params destructuring, `requireWorkspace*` guard, tenant DB lookup, error fallback JSX, return statement with the preview component. The key difference: instead of calling `renderLp()` and passing `srcdoc`, this page mints a token and renders an `<iframe src={...}>`.

**Imports pattern** (from `lps/[lpId]/preview/page.tsx` lines 17-22, adapted):
```typescript
import { redirect } from "next/navigation";
import { requireWorkspaceRole } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { mintServeToken } from "@/lib/serve/token";
// No renderLp import — VITE_SPA serve path does not call the render engine
```

**Auth guard pattern** (from `lps/[lpId]/preview/page.tsx` lines 27-31):
```typescript
// LP preview uses requireWorkspace (any member):
const ctx = await requireWorkspace(slug);

// Project template preview: any member can preview (viewer has lp.preview)
// Use requireWorkspaceRole for consistency with other template routes (matches actions.ts):
const ctx = await requireWorkspaceRole(slug, ['owner', 'admin', 'editor', 'viewer'])
```

**Params and fetch pattern** (from `lps/[lpId]/preview/page.tsx` lines 27-40):
```typescript
export default async function PreviewPage({ params }: PreviewPageProps) {
  const { slug, id } = await params  // await params — Next.js 16 async params

  const ctx = await requireWorkspaceRole(slug, ['owner', 'admin', 'editor', 'viewer'])

  // Fetch template — withTenantDb scopes to workspaceId (IDOR prevention)
  const template = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
    db.template.findUnique({ where: { id } })
  )
  if (!template) {
    redirect(`/w/${slug}/project-templates`)
  }
```

**Error fallback JSX pattern** (from `lps/[lpId]/preview/page.tsx` lines 56-70):
```tsx
// Same structure — show error message with refresh link on failure
catch {
  return (
    <div className="px-8 py-6 flex flex-col items-center justify-center min-h-[400px] text-center">
      <p className="text-base text-gray-700 mb-4">
        Preview failed to load. Try refreshing.
      </p>
      <a href={`/w/${slug}/project-templates/${id}/preview`} ...>Refresh</a>
    </div>
  )
}
```

**iframe rendering** (no analog for cross-origin iframe — use RESEARCH.md Pattern 5):
```tsx
// Mint token server-side — workspaceId from session context (never from client)
const token = mintServeToken(ctx.workspaceId, id)

const serveOrigin = process.env.NODE_ENV === 'development'
  ? `http://${id}.serve.localhost:${process.env.PORT ?? 3000}`
  : `https://${id}.serve.${process.env.SERVE_DOMAIN}`

// sandbox="allow-scripts" ONLY — no allow-same-origin (PRJ-05, SC3)
return (
  <iframe
    src={`${serveOrigin}/?t=${token}`}
    sandbox="allow-scripts"
    style={{ width: '100%', height: '80vh', border: 'none' }}
    title="Template Preview"
  />
)
```

---

### `apps/web/tests/type-boundary.test.ts` (test, extension of existing file)

**Analog:** `apps/web/tests/type-boundary.test.ts` — same file, add a new `describe` block.

**Existing file structure** (lines 1-38 — full file already read):
```typescript
import { describe, it, expect } from "vitest";
import { renderLp } from "@/lib/lps/render";

describe("type boundary (V2-11)", () => {
  it("throws when kind=VITE_SPA is passed to renderLp", async () => {
    await expect(
      renderLp({ markupSnapshot: "<h1>Hello</h1>", values: {}, kind: "VITE_SPA" }, {} as any)
    ).rejects.toThrow("Type boundary violation");
  });

  it("does NOT throw when kind=LIQUID is passed to renderLp", async () => {
    const mockDb = { brandConfig: { findFirst: async () => null } } as any;
    const html = await renderLp(
      { markupSnapshot: "{{ title:text }}", values: { title: "Test" }, kind: "LIQUID" },
      mockDb
    );
    expect(typeof html).toBe("string");
    expect(html).toContain("Test");
  });
});
```

**New describe block to append** (from RESEARCH.md Pattern 6, lines 580-588):
```typescript
import { assertViteSpaKind } from "@/lib/serve/serve-vite-spa";

describe("type boundary (V2-11) — serve path", () => {
  it("throws when kind=LIQUID is passed to assertViteSpaKind", () => {
    expect(() => assertViteSpaKind('LIQUID')).toThrow('Type boundary violation')
  })
  it("does NOT throw when kind=VITE_SPA", () => {
    expect(() => assertViteSpaKind('VITE_SPA')).not.toThrow()
  })
})
```

**Pattern:** Synchronous guard — `assertViteSpaKind` is sync (unlike `renderLp` which is async), so use `expect(() => ...).toThrow()` not `await expect(...).rejects.toThrow()`.

---

## Shared Patterns

### Auth Guard — requireWorkspaceRole
**Source:** `apps/web/src/lib/workspaces/guards.ts` lines 176-187
**Apply to:** Preview page (`page.tsx`) — for minting the serve token (workspaceId from session)
```typescript
// requireWorkspaceRole: requires verified session + workspace membership + role check
// First operation in any action or page — before any data access
export async function requireWorkspaceRole(
  slug: string,
  allowedRoles: Role[]
): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace(slug);
  if (!allowedRoles.includes(ctx.role)) {
    redirect(`/w/${slug}`);
  }
  return ctx;
}
// Returns: { workspaceId, workspaceSlug, userId, role }
// workspaceId is the authoritative workspace UUID — pass to mintServeToken()
```

### S3 Client Singleton
**Source:** `apps/web/src/lib/project-templates/actions.ts` lines 38-46
**Apply to:** Serving route handler — replicate the same singleton pattern
```typescript
const s3Client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
```
**Note:** Do NOT import the s3Client from `project-templates/actions.ts` or `lps/actions.ts` — those are "use server" modules. The serving route handler must own its own singleton in `app/serve/.../route.ts` or in a shared `lib/serve/` module.

### Tenant Scoping (IDOR Prevention)
**Source:** `apps/web/src/lib/project-templates/s3-upload.ts` line 57 (key prefix) and `apps/web/src/lib/lps/actions.ts` lines 581-587 (prefix check)
**Apply to:** Serving route handler — validate that the S3 key prefix matches the token's workspaceId
```typescript
// lps/actions.ts shows the prefix ownership check pattern:
const expectedPrefix = `workspaces/${ctx.workspaceId}/lps/assets/`;
if (!input.key.startsWith(expectedPrefix)) {
  return { ok: false, error: "Invalid object key." };
}
// Serving handler: derive the full key from token claims (not from URL params)
// to prevent spoofing:
const key = `workspaces/${claims.workspaceId}/project-templates/${claims.templateId}/dist/${s3Path}`
// claims comes from verifyServeToken — HMAC-signed, cannot be forged
```

### Error Re-throw for Next.js Internals
**Source:** `apps/web/src/lib/project-templates/actions.ts` lines 138-144
**Apply to:** Any try/catch that wraps `requireWorkspaceRole` or `redirect()`
```typescript
// redirect() and notFound() throw special Next.js errors — must not be swallowed
if (
  error instanceof Error &&
  (error.message.includes("NEXT_REDIRECT") || error.message.includes("NEXT_NOT_FOUND"))
) {
  throw error;
}
```

### Async Params Pattern (Next.js 16)
**Source:** `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` line 29 and `export/route.ts` line 168
**Apply to:** All new pages and route handlers
```typescript
// Pages: await params in the component body
const { slug, id } = await params

// Route handlers: await params in the handler body
const { tplId, path = [] } = await params
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/src/proxy.ts` | proxy | request-response | Project has no existing proxy.ts or middleware.ts — this is the first host-detection layer. Use RESEARCH.md Pattern 1 (Next.js 16 official docs). |
| `apps/web/src/lib/serve/token.ts` (HMAC logic) | lib utility | request-response | No HMAC signing utility exists in the codebase. The `node:crypto` HMAC pattern comes from RESEARCH.md Pattern 3. The factory function `createTokenUtils(secret)` pattern for testability is novel. |

---

## Metadata

**Analog search scope:** `apps/web/src/` (all subdirectories), `apps/web/tests/`
**Files scanned:** 7 analog files read in full; 2 partial reads (lps/actions.ts targeted sections)
**Pattern extraction date:** 2026-06-19
