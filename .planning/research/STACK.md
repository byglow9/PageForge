# Stack Research

**Domain:** Template-driven static-HTML landing-page generator SaaS (multi-tenant, RBAC, marketing agencies)
**Researched:** 2026-06-01 (v1) / 2026-06-17 (v2.0 additions)
**Confidence:** HIGH (core stack + templating/sandbox + form gen verified via Context7 + official docs); MEDIUM (image storage variant choice, rich-text); MEDIUM (v2.0 build-sandbox decision — multiple sources corroborate the pattern, no single authoritative benchmark)

---

## TL;DR — The Load-Bearing Decision

The product's "motor" is the **token → schema → dynamic form → merge → static HTML** pipeline, fed by **author-written markup** (untrusted template code). That single fact drives the most important choice: the rendering engine must be **safe to run on attacker-controlled templates** AND support **loops / repeatable blocks** natively.

**→ Use LiquidJS** (`liquidjs@10.27.0`). It was explicitly designed to run untrusted template code (Shopify's threat model), it has no arbitrary JS/`eval`/filesystem access, and `{% for %}` gives you repeatable blocks for free. Do NOT use Handlebars, EJS, Pug, or Nunjucks for this — they either execute JS or have well-documented sandbox escapes (see "What NOT to Use").

---

## v2.0 TL;DR — The New Load-Bearing Decision

v2.0 accepts a user-uploaded **React/Vite project** (e.g. Lovable export: `src/`, `package.json`, `vite.config.ts`, assets). Unlike v1's LiquidJS strings (no JS execution, safe-by-design), this is **arbitrary third-party JavaScript** that must be **built** (`npm install` + `vite build`) to become servable. This reopens every attack vector v1 was designed to avoid.

**→ The crux: where and how does `vite build` run?**

The architecture decision is: **ephemeral Docker container triggered by a background job queue (BullMQ + Redis), running on your own host/VM, with network isolation and script blocking (`--ignore-scripts`)**. This is the only path that is realistic, safe, and self-hostable for a small SaaS. All other options fail on at least one of: feasibility, security, or cost. Details in the v2.0 sections below.

The **equally important corollary**: for v2.0, content in Lovable-exported projects is **hardcoded in React components** — there is no token substitution unless you add a code-transform step. The MVP for v2.0 should therefore treat the Lovable project as a **black-box static build** (register → build → store dist/ on S3 → serve/preview via iframe → export as ZIP). Content editing via PageForge forms is a **subsequent phase** requiring a pre-build code injection step.

---

## Recommended Stack — v1 (unchanged)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js (App Router)** | 16.2.7 | Full-stack framework: UI, API/Server Actions, SSR preview, route handlers for export | One codebase for the dashboard, the form UI, server-side template rendering, and download endpoints. Server Actions keep the merge/render logic server-side (never trust client to render untrusted templates). RSC makes the LP preview a server render of LiquidJS output. Dominant choice for TS SaaS in 2025. |
| **TypeScript** | 5.x | Type safety across schema → form → render | The token schema is the contract between three subsystems; static typing prevents drift. Non-negotiable for this kind of schema-driven app. |
| **PostgreSQL** | 16+ | Primary datastore (workspaces, members, templates, schemas, LP records, folders) | Relational integrity for multi-tenant + RBAC; `jsonb` columns store the per-token schema and the filled LP values without a rigid table per template. The "schema + values as JSON, structure as relations" hybrid is exactly Postgres' sweet spot. |
| **Prisma** | 7.8.0 | Type-safe ORM + migrations | Best-in-class TS DX, generated types feed the whole pipeline, first-class `jsonb` support, migration tooling. v7 is the current major. (Drizzle is the credible alternative — see Alternatives.) |
| **LiquidJS** | 10.27.0 | Template parsing + rendering engine (the motor) | **Safe by design for untrusted templates** (no JS eval, no FS, no globals leak), native `{% for %}` loops = repeatable blocks, filters for formatting, browser + Node. Renders identically server-side for preview and for final static HTML. |
| **Zod** | 4.4.3 | Token schema validation + form validation + Server Action input validation | The token schema is itself data — Zod validates the derived schema, validates submitted LP values against that schema at runtime, and guards Server Action boundaries. v4 is current. |
| **React Hook Form** | 7.77.0 | Dynamic form runtime (incl. add/remove repeater items) | `useFieldArray` is the canonical solution for "add/remove items in a repeatable block." Performant uncontrolled inputs scale to large generated forms. Pairs with Zod via `@hookform/resolvers`. |

### Supporting Libraries (v1)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **better-auth** | 1.6.13 | Auth + organizations/teams + RBAC | Has a first-class **organization plugin** (workspaces, members, invitations, roles/permissions) — covers the multi-tenant + RBAC requirement out of the box instead of hand-rolling. (Auth.js/NextAuth is the alternative; it has no built-in org model.) |
| **Tiptap** | 3.24.0 | Rich-text field editor (`@tiptap/react` + StarterKit) | For the `rich text` field type (paragraphs in the LP). Headless ProseMirror wrapper, mature, outputs HTML you control. More production-ready than Lexical (still pre-1.0). |
| **sanitize-html** | 2.17.4 | Server-side sanitization of rich-text HTML before it enters the LP | **Mandatory.** Rich-text values are user input that gets injected as raw HTML into the static output. Sanitize on the server with an allowlist before merge. (DOMPurify 3.4.7 is the client/JSDOM alternative; sanitize-html is purpose-built for Node server use.) |
| **@aws-sdk/client-s3** + **@aws-sdk/s3-request-presigner** | 3.1071.x | Image upload + storage (S3-compatible) | Generate presigned PUT URLs server-side; browser uploads directly to the bucket. Keeps large image bytes off your app server. Works with AWS S3, Cloudflare R2, Backblaze B2, MinIO. |
| **archiver** | 8.0.0 | Stream a ZIP of `index.html` + downloaded image assets for export | Streaming ZIP = constant memory, can pipe straight to the HTTP response. Best fit for "export LP as a self-contained folder/zip." |
| **@hookform/resolvers** | latest | Bridge Zod schema → React Hook Form | Connects the runtime form validation to the same Zod schema derived from tokens. |
| **shadcn/ui + Tailwind CSS** | latest / 4.x | Dashboard/catalog UI components | Standard 2025 component approach for Next.js SaaS; you own the code, fast to build the catalog/folders/forms UI. |
| **TanStack Query** | 5.x | Client cache for catalog/list views (optional) | Only if you find Server Actions + RSC insufficient for interactive catalog filtering. Don't add preemptively. |

### Development Tools (v1)

| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** | Package manager | Fast, disk-efficient; default for modern Next.js setups. |
| **Vitest** | Unit/integration tests | Critical for the parser → schema → render pipeline; test that known templates produce known HTML and that malicious templates are neutralized. |
| **Biome** or ESLint + Prettier | Lint/format | Biome is faster single-tool; ESLint if you need the broader plugin ecosystem. |
| **Docker Compose** | Local Postgres + MinIO (S3 emulation) | Reproduce S3 + DB locally without cloud accounts. |
| **Playwright** | E2E for the author→generate→export flow | Verify the full pipeline including ZIP download. |

---

## v2.0 Stack Additions — React/Vite Project Support

This section covers only what is new for v2.0. Everything above remains unchanged.

### Reference Project Context

The concrete reference (`renova-turismo-jornada-main/`) is a Lovable-exported React/Vite SPA with:
- **`package.json`**: React 18, React Router DOM 6, TanStack Query 5, Radix UI (full suite), embla-carousel, Tailwind 3, TypeScript 5, `@vitejs/plugin-react-swc`, `lovable-tagger` dev dep. ~60 npm packages in dependencies alone.
- **`vite.config.ts`**: Standard `@vitejs/plugin-react-swc`, path alias `@/` → `./src`, `lovable-tagger` in dev mode only.
- **`src/App.tsx`**: `BrowserRouter` + `Routes` → 13 lazy-loaded page components. Each page is a separate LP campaign.
- **`src/pages/`**: 14 pages. Each page is a full standalone LP (hero, sections, CTA, footer) with hardcoded text and image imports.
- **`src/assets/`**: ~40+ images (JPG/WEBP/PNG) bundled as Vite asset imports.
- **No `.env` tokens** that map to PageForge schema. All content is hardcoded in JSX.

Key implication: the Lovable export is a **multi-page SPA** where every `src/pages/*.tsx` is a distinct LP sharing a design system (`src/components/campaigns/`, `src/components/ui/`). When built, `vite build` produces a single `dist/` folder with `index.html` + hashed JS/CSS bundles + `assets/`. React Router client-side routing serves each LP at its route (e.g. `/grecia`, `/turquia`).

### v2.0 Core Additions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **BullMQ** | 5.78.1 | Job queue for async build orchestration | Build jobs (npm install + vite build) take 60–180s and must not block HTTP requests. BullMQ + Redis is the standard Redis-backed queue for Node.js SaaS — no vendor lock-in, no per-job pricing, retries/progress tracking built in. Self-hostable on the same infra as the app. |
| **ioredis** | 5.11.1 | Redis client (BullMQ dependency) | BullMQ requires ioredis. If already running Redis for session/cache, reuse the same instance. |
| **dockerode** | 5.0.0 | Node.js Docker API client | Spawn, monitor, and destroy ephemeral build containers from the BullMQ worker process. The worker is a standalone Node.js process (not inside Next.js server); dockerode talks to the Docker daemon via unix socket. |
| **unzipper** | 0.12.3 | Stream-extract user-uploaded project ZIP | User uploads a ZIP of their project; unzipper streams it to a temp directory before the build container mounts it. Lighter and more stream-native than adm-zip for large archives. |

### v2.0 Supporting Additions

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Redis** | (infra, not npm) | BullMQ broker + optional build-status pub/sub | Provision one Redis instance (Upstash, Railway Redis, or self-hosted) shared between the Next.js app (enqueue) and the worker process (dequeue + execute). |
| **@aws-sdk/client-s3** | already in v1 | Upload built `dist/` tree to S3 per-tenant prefix | Reuse the existing SDK. After build, recursively upload `dist/**` to `s3://bucket/workspaces/{workspaceId}/projects/{projectId}/dist/`. |
| **archiver** | already in v1 | ZIP export of built dist/ folder | Reuse existing. For v2.0 export, stream `dist/` tree (index.html + assets/) as ZIP to the user — same mechanism as v1 image-bundle export. |

---

## v2.0 Build Pipeline Architecture

### The Problem in Full

Running `npm install` on user-supplied `package.json` and then `vite build` on user-supplied source code is fundamentally different from v1's LiquidJS rendering:

- **`npm install` executes arbitrary code** via lifecycle hooks (`preinstall`, `postinstall`, `prepare`). A malicious or compromised package can exfiltrate secrets, write files, open network connections, or escalate privileges — all before `vite build` runs.
- **`vite build` executes user-written JS/TS** through the build pipeline. Vite plugins, `vite.config.ts`, and any code that runs at build time (e.g. `import.meta.glob`) is trusted code.
- **The threat model changed completely**: v1 assumed a single untrusted string; v2.0 accepts a full dependency tree from npm and arbitrary TypeScript.

### Recommended Architecture: Docker + BullMQ Worker

```
[Next.js App]
    │
    ├── User uploads ZIP → S3 (raw project) [presigned PUT]
    │
    ├── POST /api/projects/[id]/build
    │       → validates session/workspace ownership
    │       → enqueues job: BullMQ.add('build-project', { projectId, workspaceId, s3Key })
    │       → returns jobId + SSE or polling endpoint
    │
[BullMQ Worker — separate Node.js process]
    │
    ├── Dequeues job
    ├── Downloads ZIP from S3 → temp dir on host (e.g. /tmp/builds/{jobId}/)
    ├── Extracts ZIP (unzipper)
    ├── Validates package.json (allowlist check — see security below)
    ├── Spawns ephemeral Docker container:
    │       image: node:22-alpine
    │       volume: /tmp/builds/{jobId}:/workspace:rw
    │       workdir: /workspace
    │       network: none  ← CRITICAL: no network after image pull
    │       memory: 2g, cpus: 1
    │       user: nobody (non-root)
    │       command: sh -c "npm install --ignore-scripts && npx vite build"
    │       timeout: 300s
    ├── Monitors container stdout/stderr (progress → BullMQ job data)
    ├── On success: uploads /tmp/builds/{jobId}/dist/** to S3
    │       prefix: workspaces/{workspaceId}/projects/{projectId}/v{buildNum}/
    ├── Stores S3 prefix + build metadata in Postgres (Prisma)
    ├── Marks job complete → BullMQ
    ├── Cleans up: rm -rf /tmp/builds/{jobId}/, docker rm container
    │
[Next.js App — serves preview]
    ├── Preview: route handler at /api/preview/[projectId]
    │       → generates signed S3 URL for dist/index.html (or proxies content)
    │       → embedded in <iframe> in the PageForge dashboard
    │
    └── Export: route handler at /api/export/[projectId]
            → lists s3://bucket/workspaces/{w}/projects/{p}/v{n}/ objects
            → streams all files as ZIP via archiver
```

### Why Docker + BullMQ (not the alternatives)

**Option A: Docker + BullMQ worker (recommended)**
- Isolation: container-level (network namespace, PID namespace, filesystem mount)
- `--network none` prevents npm postinstall from phoning home or exfiltrating secrets
- `--ignore-scripts` blocks most postinstall attack vectors; `--network none` catches the bypass cases
- Startup time: 2–5s container spawn (acceptable for a 60–180s build)
- Ops complexity: requires Docker on the host + Redis + a worker process. Medium ops burden.
- Cost: compute costs only when building. No per-run vendor pricing.

**Option B: Firecracker / gVisor / Kata Containers (over-engineered for v2.0)**
- Stronger isolation (VM-level or syscall-interception boundary vs. container-level)
- Firecracker: AWS Lambda's isolation model. Startup ~125ms but requires KVM on bare metal — incompatible with most VPS providers and Vercel.
- gVisor: user-space kernel boundary. Better isolation than Docker but ~2x overhead on syscall-heavy workloads (npm install is syscall-heavy). Requires compatible kernel + runtime setup.
- Verdict: appropriate if PageForge becomes a multi-million MAU platform running thousands of untrusted builds/day. For v2.0 early SaaS, Docker + network isolation + ignore-scripts achieves sufficient security with 10x less ops complexity.

**Option C: Serverless build services (Trigger.dev / AWS CodeBuild / Inngest)**
- Trigger.dev v4 (4.4.6): tasks run in dedicated managed infra, no time limit, TypeScript-native. Zero Redis/worker infra. Per-run pricing.
- AWS CodeBuild Lambda mode: 15-minute max, no Docker image builds. Insufficient for npm install + vite build on large projects.
- Verdict for v2.0: Trigger.dev is the **best alternative to self-hosting** if you want to avoid managing Docker daemon + worker process. Cost is acceptable at small scale (< 50k jobs/month free tier approximation). Trade-off: sends user code to third-party infrastructure, which may matter for enterprise clients. BullMQ + Docker is cheaper at scale and keeps code on your infra.

**Option D: Run `vite build` inside the Next.js process (child_process.exec)**
- NEVER DO THIS. The Next.js server process has access to all environment variables (DB credentials, S3 keys, better-auth secrets). A malicious build script can read `process.env` and exfiltrate everything. Additionally, npm install could take 3+ minutes, blocking the server or timing out the request. This is the textbook server-side RCE vector.

**Option E: "No-build" — accept pre-built dist/ as user upload**
- Viable for MVP if users can run `vite build` locally and upload the `dist/` folder (or ZIP).
- Eliminates build-sandbox problem entirely: you only store and serve static files.
- Security: the dist/ still contains arbitrary JS that runs in end-users' browsers (not your server). This is a content moderation concern (phishing, malicious LP scripts), not an RCE concern for PageForge itself.
- Limitation: breaks the "regenerate on content change" use-case. Also requires the user to own the build toolchain, which is fine for developers but not for non-technical agency users.
- **Recommendation**: implement the "accept pre-built dist/ ZIP" path first as the v2.0 MVP, then add server-side building (Docker + BullMQ) in a subsequent phase when demand proves the need. This inverts complexity: start simple, add build infra only when validated.

### Security Hardening for Build Containers

**Layer 1 — Pre-build validation (Next.js API, before enqueueing)**
- Parse `package.json` before accepting the upload. Reject if `scripts.postinstall`, `scripts.preinstall`, or `scripts.prepare` contains suspicious patterns (curl, wget, python, eval, base64). This is not a hard security boundary but catches naive attacks early.
- Check `package.json` size and dependency count (reject if > 500 deps — signals an unusual project).
- Validate file extensions in ZIP: only allow `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.html`, `.json`, `.svg`, `.png`, `.jpg`, `.webp`, `.ico`, `.woff2`, `.ttf`. Reject `.sh`, `.py`, `.rb`, `.exe`.
- Reject path traversal in ZIP entries (entries with `../` in filename).

**Layer 2 — npm install flags**
- Always run: `npm install --ignore-scripts --no-audit --prefer-offline` (or pnpm equivalent)
- `--ignore-scripts`: blocks lifecycle hooks. Catches the majority of postinstall attacks.
- `--no-audit`: skip the npm audit network call (network is disabled anyway, but belt-and-suspenders).
- `--prefer-offline`: fails fast if a package isn't in the layer cache, reducing external dependency.
- **Caveat**: `--ignore-scripts` is bypassable via `binding.gyp` (Phantom Gyp attack) + network isolation closes this secondary vector.

**Layer 3 — Container isolation**
- `--network none`: the most important flag. A postinstall script that can't reach the internet cannot exfiltrate secrets. Combined with `--ignore-scripts`, this eliminates the practical RCE-to-exfiltration chain.
- `--memory 2g --cpus 1`: prevents resource exhaustion DoS against the host.
- `--user nobody`: non-root user inside container limits damage if container escape occurs.
- `--read-only` filesystem except `/workspace` and `/tmp`: prevents writing to system paths.
- Timeout enforced by dockerode: kill container after 300s.

**Layer 4 — Post-build**
- Upload only `dist/` subdirectory to S3 — never the full source tree, `node_modules`, or `.env` file.
- Validate that `dist/index.html` exists before marking the build successful.
- Clean up temp dir and container immediately after upload regardless of success/failure.

**Layer 5 — npm v12 / pnpm v10 context**
- npm v12 (shipping July 2026) blocks `postinstall` scripts by default — `--ignore-scripts` behavior becomes the default. If targeting npm 12+ in the container image, this layer is automatic.
- pnpm v10+ blocks lifecycle scripts by default via `onlyBuiltDependencies`. If using pnpm in the build container (faster installs, stricter defaults), this is better than npm for untrusted installs.
- Recommendation: use `node:22-alpine` image with pnpm installed; run `pnpm install --frozen-lockfile` (uses the lockfile the user uploaded, pinning all transitive deps) + set `onlyBuiltDependencies: []` in a `.npmrc` override to block all scripts.

### Storing and Serving Built Output (S3 + CDN)

**Storage layout in S3 (per-tenant isolation by prefix)**
```
s3://pageforge-bucket/
  workspaces/{workspaceId}/
    projects/{projectId}/
      source/
        {uploadId}.zip          ← raw user-uploaded ZIP
      builds/
        {buildId}/
          dist/
            index.html
            assets/
              index-{hash}.js
              index-{hash}.css
              {image-hash}.webp
              ...
```

Every prefix is scoped to `workspaceId`. Access is never by direct S3 URL to end-users (bucket is private). PageForge generates presigned GET URLs for preview and proxies or pre-signs for export.

**Preview (iframe in PageForge dashboard)**

Option A — S3 presigned URL for `dist/index.html`:
- Generate a short-lived (1h) presigned GET URL for the `dist/index.html` object.
- Embed in an `<iframe src={presignedUrl}>` on the preview page.
- Problem: the HTML loads `assets/index-{hash}.js` with a relative path. The browser resolves these relative to the presigned URL's origin (S3 domain), which works. However, the presigned URL is per-file — the JS and CSS assets are at different S3 URLs and are publicly accessible via the hashed filename (low risk — no PII in bundles) OR you need a presigned URL per asset.
- Simpler alternative: make the `builds/{buildId}/dist/` prefix publicly readable via a CDN prefix policy scoped to that path. Rotate/delete the prefix when the build is superseded.

Option B — Cloudflare R2 public CDN URL with prefix scoping (recommended):
- R2 has zero egress fees. Enable public access on the bucket scoped to `workspaces/{workspaceId}/projects/{projectId}/builds/{buildId}/dist/`.
- CDN URL for preview: `https://cdn.pageforge.com/workspaces/{wid}/projects/{pid}/builds/{bid}/dist/index.html`
- All relative asset paths (`./assets/index.js`) resolve correctly at the CDN origin.
- This is the simplest working preview path. No presigned URL rotation needed for preview.
- Access control: the CDN URL contains workspace+project+build IDs (GUIDs). Not guessable in practice. For stricter isolation, add a signed CDN URL layer (R2 supports Cloudflare Workers for auth).

**Export (ZIP download)**

The built `dist/` is already a self-contained deployable artifact:
- `index.html` + `assets/` with hashed filenames + any images that Vite embedded.
- Export = download the `dist/` prefix from S3 and stream as ZIP via `archiver`.
- Use the existing `/api/export/[lpId]` route handler pattern from v1, but instead of building from LiquidJS + downloading images, it streams the S3 `dist/` tree.
- The resulting ZIP is drop-deployable to Netlify, Vercel, S3 static hosting, or any web server with SPA fallback routing.

**Difference from v1 export**: v1 export ZIP contains `index.html` (one file) + referenced images. v2.0 export ZIP contains `dist/` tree with hashed JS/CSS bundles + inlined/processed images. The `archiver` streaming mechanism is identical.

### Database Schema Additions (Prisma)

New tables/columns needed in v2.0 (additive, no changes to v1 schema):

```
Template (existing)
  + type: enum('LIQUID', 'VITE_PROJECT')   -- discriminate template engine

ViteProjectTemplate
  + templateId: FK → Template
  + sourceS3Key: text                        -- raw ZIP upload key
  + buildStatus: enum('PENDING', 'BUILDING', 'SUCCESS', 'FAILED')
  + buildJobId: text                          -- BullMQ job ID for polling
  + distS3Prefix: text                        -- built dist/ prefix in S3
  + buildLog: text                            -- last 10k chars of build stdout
  + builtAt: timestamp
  + buildDurationMs: int

LandingPage (existing)
  -- no schema change needed for MVP
  -- a VITE_PROJECT LP is just a pointer to a built dist/ at distS3Prefix
  -- "editing" a VITE_PROJECT LP = re-triggering a build with new source
```

### Content Editing (Future Phase — NOT v2.0 MVP)

The reference project has **all content hardcoded in JSX** (e.g. `Grecia.tsx` hardcodes `"Viagem para a Grécia"`, image imports, component props). There is no `VITE_` environment variable substitution for page content — those are only used for API keys.

To support PageForge-style "fill a form → regenerate" for Lovable projects, a future phase would need:
- A **code injection step before build**: transform source files to replace hardcoded strings with values from a JSON payload (e.g. inject via `src/content.json` imported by components, or `VITE_CONTENT_JSON` env var + JSON.parse at build time).
- OR a **post-build HTML patching** step (regex-replace known strings in `dist/index.html` and JS bundles — fragile, not recommended).
- OR a **runtime content approach**: inject a `window.__PAGEFORGE_CONTENT__` global into `index.html` before serving; components read from it at runtime. This requires modifying the Lovable project's components to read from the global.

None of these are trivial. The MVP v2.0 is: **register → build → preview → export**. Content parameterization is a v2.1+ feature.

---

## The Templating / Token Pipeline (v1 — unchanged)

The PROJECT defines the engine as `markup + token schema`. Recommended mechanics:

1. **Token syntax = Liquid syntax directly.** Don't invent a custom `{{token}}` mini-language and a separate parser — reuse Liquid's. `{{ field }}` for scalars, `{% for item in repeater %}…{% endfor %}` for repeatable blocks, `{{ field | filter }}` for formatting. This means **the parser is the proven LiquidJS parser**, not custom code you must secure yourself.
2. **Schema extraction.** Parse the template once with LiquidJS to walk its AST / variable references and derive the token list. Authors annotate each token's *type* (text, rich text, image, color, button+URL, repeater) via a lightweight convention or a sidecar config the author fills in the template UI. Persist the derived schema as `jsonb`.
3. **Schema → Zod → form.** Generate a Zod schema from the token schema; React Hook Form + `useFieldArray` renders the dynamic form, including add/remove for repeaters.
4. **Merge / render.** On generate/preview/export, run LiquidJS **server-side** with the saved values as the context. Rich-text values are sanitized with `sanitize-html` *before* being passed in (and marked so Liquid won't double-escape them).
5. **Sandboxing posture.** LiquidJS does not execute arbitrary JS. Additionally: (a) run renders with a timeout and output-size cap to stop loop-based DoS, (b) disable filesystem tags (`include`/`render` from disk) — keep templates DB-backed strings only, (c) sanitize all rich-text inputs, (d) escape by default and only mark sanitized rich-text as safe.

**Repeatable blocks (the critical requirement):** handled natively by Liquid `{% for %}`. A `repeater` token maps to an array in the values JSON; each array element is an object of sub-fields. `useFieldArray` manages the array client-side; Liquid iterates it server-side. This is exactly the Greece template's "9 itinerary days, 6 inclusion cards, 5 differentials, 3 testimonials" case.

**Global brand/contact values:** inject a workspace-level `brand`/`contact` object into the Liquid render context so `{{ brand.whatsapp }}`, `{{ brand.logo }}`, `{{ brand.primary_color }}` resolve everywhere without per-LP entry.

---

## Static HTML Generation + Export

**v1 (LiquidJS):**
- Server Action / route handler runs LiquidJS → produces the final `index.html` string. Store it (or regenerate on demand — regeneration is cheap and avoids stale HTML; PROJECT says re-editing means regenerate).
- Image handling in export: (a) reference S3 URLs directly, or (b) **self-contained ZIP**: download images server-side, rewrite `src` to relative `./assets/...`, stream `index.html` + `assets/` via `archiver`. Mode (b) is default for v1.

**v2.0 (Vite Project):**
- No LiquidJS render step. The dist/ folder IS the output; it was produced by the build job.
- Export = stream `dist/` tree from S3 as ZIP via `archiver` (no image rewriting needed — Vite already hashed and inlined images in the bundle).
- Preview = CDN URL or presigned S3 URL for `dist/index.html` embedded in `<iframe>`.

**Why streaming ZIP (archiver) over jszip/fflate:** archiver streams to the HTTP response with constant memory and is the standard for server-side ZIP-of-files. fflate is faster for pure in-memory buffers but archiver's file/stream API fits "bundle html + N images" more cleanly. jszip is more browser-oriented.

---

## Installation

```bash
# --- v1 (existing) ---

# Core
pnpm add next@16 react react-dom liquidjs zod @prisma/client
pnpm add -D prisma

# Auth + RBAC
pnpm add better-auth

# Forms
pnpm add react-hook-form @hookform/resolvers

# Rich text + sanitization
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/pm sanitize-html

# Image upload (S3-compatible)
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Export / zip
pnpm add archiver

# UI
pnpm add tailwindcss   # + shadcn/ui via its CLI

# Dev
pnpm add -D vitest @playwright/test typescript

# --- v2.0 additions ---

# Job queue (in Next.js app — for enqueueing)
pnpm add bullmq ioredis

# ZIP extraction (Next.js app — receives user ZIP upload)
pnpm add unzipper

# Docker client (in the worker process — separate package.json or same monorepo pkg)
pnpm add dockerode
pnpm add -D @types/dockerode

# Note: Redis must be provisioned as infrastructure (Upstash / Railway / self-hosted)
# Note: Docker daemon must be running on the worker host
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| LiquidJS | Nunjucks (sandbox mode) | Only if you need template inheritance/macros AND can rigorously audit the sandbox. Not worth the SSTI risk here — Nunjucks has documented sandbox escapes. |
| LiquidJS | MJML (for email-grade tables) | If the LPs were emails. They're web LPs, so plain Liquid + HTML/CSS is correct. |
| Prisma | Drizzle ORM (0.45.2) | If you want SQL-closer queries, lighter runtime, and edge compatibility. Drizzle is the strongest alternative; pick it if the team prefers SQL-first. Both are fine. |
| better-auth | Auth.js (NextAuth) v5 | If you already standardize on NextAuth elsewhere — but you'll hand-build the workspace/org/RBAC model that better-auth's organization plugin gives you free. |
| Next.js full-stack | Remix/React Router 7, or SvelteKit | If the team has strong existing expertise. Next.js is the safest default for the TS/React SaaS labor market and RSC-based server rendering. |
| S3 presigned + archiver | UploadThing | UploadThing simplifies upload DX but adds a vendor + cost; direct S3-compatible (R2/B2) is cheaper and portable for a SaaS storing many campaign images. |
| Tiptap | Lexical 0.x | If bundle size / extreme scale matters more than maturity. Lexical is still pre-1.0; Tiptap is the safer production pick now. |
| PostgreSQL | MySQL | Either works; Postgres `jsonb` + RLS-readiness makes it the better fit for schema-as-JSON + future row-level multi-tenant isolation. |
| **BullMQ + Docker worker** (v2.0) | **Trigger.dev v4** | If you want zero infra management for build jobs (no Redis, no Docker daemon, no worker process). Trigger.dev v4 (4.4.6) handles orchestration, retries, and observability out of the box. Trade-off: user code goes to third-party infra + per-run cost at scale. Best alternative if self-hosting Docker is not acceptable. |
| **BullMQ + Docker worker** (v2.0) | **AWS CodeBuild** | If already on AWS. CodeBuild's Lambda compute mode has a hard 15-min limit (insufficient) and doesn't support Docker-in-Docker. Standard EC2 compute is fine but more ops overhead than a single Docker daemon. Not worth it over a simple worker unless you're already deep in AWS. |
| **"pre-built dist/ upload" MVP** (v2.0) | **Server-side build** | For v2.0 MVP, accepting a user-provided `dist/` ZIP (output of their own `vite build`) eliminates the build-sandbox problem entirely. Implement this first, add server-side building only when validated by demand. |
| **Docker `--network none`** (v2.0) | **gVisor / Firecracker** | If running thousands of builds/day on bare metal with KVM and the threat model requires VM-level isolation. Over-engineered for early SaaS. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Handlebars / Mustache** | Not designed for untrusted templates; helper-based SSTI and prototype-pollution payloads are documented. No native safe loop sandboxing for hostile authors. | LiquidJS |
| **EJS / Pug / `lodash.template`** | Execute embedded JavaScript by design → trivial RCE when the template author is untrusted. This is the textbook SSTI → RCE vector. | LiquidJS |
| **Nunjucks (as your safe layer)** | Has a "sandbox" but multiple public sandbox-breakout writeups exist; risky as your primary trust boundary for attacker-written templates. | LiquidJS |
| **`eval` / `new Function` / `vm` for "custom" templating** | Rolling your own interpreter or string-templating over untrusted markup is the #1 way to ship an RCE. | LiquidJS (proven parser) |
| **`dangerouslySetInnerHTML` with un-sanitized rich text** | Stored XSS in every generated LP and in the dashboard preview. | sanitize-html (server) before render/preview |
| **Storing images as DB blobs / on local app FS** | Doesn't scale, complicates multi-tenant, breaks on serverless/ephemeral hosts. | S3-compatible object storage + presigned uploads |
| **A separate table per template's fields** | Schema explosion; templates are user-defined and dynamic. | `jsonb` schema + `jsonb` values, validated by Zod |
| **Client-side-only rendering of the final HTML** | Lets clients tamper with the untrusted-template render boundary; preview ≠ export fidelity. | Render with LiquidJS server-side; client only previews the server output |
| **`child_process.exec` / `spawn` for `npm install` + `vite build` in the Next.js process** (v2.0) | The Next.js server holds all secrets (DB, S3, auth). Running untrusted build scripts in the same process = instant RCE-to-secret-exfiltration. Request timeout (30–60s) is also far shorter than a real build. | Docker container via dockerode (isolated process, no env access, network blocked) |
| **vm2** | Deprecated; has critical unpatched sandbox-escape vulnerabilities. Archived in 2023. | Not applicable to this build pipeline (vm2 was for JS eval, not full builds). Mentioned because teams sometimes reach for it as "sandboxing." |
| **isolated-vm** | Better than vm2 but only sandboxes JS evaluation — cannot run `npm install` or file I/O. Applies to JS eval use cases, not build pipelines. | Docker container |
| **Vercel Serverless Functions for the build worker** | 60s max execution, cold starts, no Docker daemon available, no persistent filesystem. Fundamentally incompatible with a 60–180s `npm install + vite build`. | Separate long-running worker process (VPS, Railway, Fly.io, EC2) with Docker daemon |

---

## Stack Patterns by Variant

**v1 — minimal infra / lowest ops (recommended for v1):**
- Vercel (Next.js) + Neon/Supabase Postgres + Cloudflare R2 (S3 API, no egress fees) + Prisma + better-auth.
- Because: managed everything, R2 egress-free is ideal when exporting/serving many images.

**v1 — SQL-first team:**
- Swap Prisma → Drizzle. Same Postgres, same everything else.

**v1 — DB-level multi-tenant isolation:**
- Adopt Postgres Row-Level Security keyed on `workspace_id`. v1 can be app-level scoping only (every query filtered by workspace), but design the schema with `workspace_id` on every tenant-owned table from day one.

**v1 — portable self-contained export:**
- Use archiver to bundle `index.html` + downloaded `/assets` images with rewritten relative paths.

**v2.0 MVP — accept pre-built dist/ ZIP (simplest, ship first):**
- User runs `vite build` locally, uploads `dist/` ZIP via PageForge UI.
- PageForge: validate ZIP structure → upload to S3 → mark build SUCCESS → enable preview/export.
- No Docker daemon. No BullMQ. No build security surface.
- Use this path to validate the feature. Add server-side builds only when users ask.

**v2.0 — server-side build on self-hosted infra:**
- Railway / Fly.io / VPS with Docker daemon + Redis.
- BullMQ worker as a separate process (separate Dockerfile) on the same host or adjacent VM.
- Build containers: `node:22-alpine`, `--network none`, `--memory 2g`, `--ignore-scripts`.
- Built `dist/` → Cloudflare R2 with public CDN prefix for preview.

**v2.0 — server-side build with managed job execution (no self-hosted Docker):**
- Trigger.dev v4 (4.4.6) for job orchestration. No Redis, no worker process.
- Each task: download ZIP from S3 → call Trigger.dev shell exec in its managed runtime → upload dist/.
- Requires Trigger.dev account. User code executes on Trigger.dev infra (acceptable risk for most SaaS).

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.2.7 | react@19 | Next 16 requires React 19. Confirm RSC/Server Actions APIs against the 16 docs. |
| prisma@7.8.0 | @prisma/client@7.x | Keep CLI and client major versions in lockstep. v7 is a major — check migration notes if upgrading older projects (greenfield = no issue). |
| zod@4.4.3 | @hookform/resolvers (current) | Resolvers added Zod v4 support; pin a resolvers version that lists Zod 4 in peer deps. |
| react-hook-form@7.77.0 | react@19 | RHF 7.x supports React 19. |
| @tiptap/react@3.24.0 | react@19, @tiptap/pm | Tiptap 3 is the current major; install the matching `@tiptap/pm` and extension versions (all on 3.x). |
| liquidjs@10.27.0 | Node 18+ / browser | Pure JS, isomorphic. Same module renders preview (server) and export (server). |
| archiver@8.0.0 | Node 18+ | Streaming API; pipe to Web/Node response stream in route handler. |
| bullmq@5.78.1 | ioredis@5.11.1 | BullMQ requires ioredis. ioredis 5.x is current; BullMQ peer-deps list matches. |
| dockerode@5.0.0 | Docker Engine 24+ | dockerode 5 is the current major. Uses Docker REST API over unix socket. Requires Docker daemon on the worker host. |
| unzipper@0.12.3 | Node 18+ | Stream-based ZIP extraction. No native deps. |
| @trigger.dev/sdk@4.4.6 | Node 18+ / Next.js 14+ | v4 is GA (Aug 2025). If choosing Trigger.dev over BullMQ, use v4 — v3 and below have a different task API. |
| Lovable project (reference) | Vite 5.4.x, React 18, Node 22 | The reference project's lockfile pins Vite ^5.4.19. The build container should use Node 22 (matches Lovable's own build docs). |

---

## Sources

- `/harttle/liquidjs` (Context7) — confirmed LiquidJS is "simple, expressive and safe", Shopify/GitHub-Pages compatible, isomorphic; `{% for %}` loop + filter support — HIGH
- `npm view {package} version` (npm registry, 2026-06-17) — current versions for bullmq@5.78.1, ioredis@5.11.1, dockerode@5.0.0, unzipper@0.12.3, @aws-sdk/client-s3@3.1071.0, @trigger.dev/sdk@4.4.6, inngest@4.6.0 — HIGH
- `npm view` (registry, 2026-06-01) — versions for next@16.2.7, prisma@7.8.0, zod@4.4.3, react-hook-form@7.77.0, @tiptap/react@3.24.0, sanitize-html@2.17.4, archiver@8.0.0, liquidjs@10.27.0 — HIGH
- https://docs.lovable.dev/tips-tricks/external-deployment-hosting — Lovable exports are standard Vite projects; build = `npm ci && npm run build`; output is `dist/`; requires SPA routing fallback — HIGH
- https://socket.dev/blog/pnpm-10-0-0-blocks-lifecycle-scripts-by-default — pnpm v10+ blocks lifecycle scripts by default via `onlyBuiltDependencies`; pnpm is safer than npm for untrusted installs — HIGH
- https://www.aikido.dev/blog/npm-v12-block-postinstall — npm v12 (July 2026) will block postinstall scripts by default; `--ignore-scripts` becomes standard behavior — MEDIUM (announced, not yet shipped)
- https://semgrep.dev/blog/2026/rip-npm-postinstall-scripts-npm-v12-default-change/ — RIP postinstall: detailed explanation of npm v12 change and migration — MEDIUM
- https://pnpm.io/supply-chain-security — pnpm's own guide on supply chain security, `onlyBuiltDependencies`, `approve-builds` — HIGH
- https://remarkablemark.org/blog/2026/05/15/secure-npm-install-with-ignore-scripts/ — `--ignore-scripts` best practice for untrusted installs; caveat: `binding.gyp` bypass + Phantom Gyp attack — MEDIUM
- https://github.com/google/security-research/security/advisories/GHSA-wr8v-3jqh-9x36 — `--ignore-scripts` bypass via crafted `package.json`; network isolation (`--network none`) mitigates exfiltration half of the bypass — HIGH
- https://www.freecodecamp.org/news/running-untrusted-javascript-as-a-saas-is-hard-this-is-how-i-tamed-the-demons-973870f76e1c — layered defense (rate limit → async queue → process isolation → Docker container) is the accepted pattern for untrusted code in SaaS — MEDIUM
- https://northflank.com/blog/how-to-spin-up-a-secure-code-sandbox-and-microvm-in-seconds-with-northflank-firecracker-gvisor-kata-clh — Firecracker/gVisor/Kata for stronger isolation; Docker is sufficient for most SaaS; microVMs warranted at scale — MEDIUM
- https://www.buildmvpfast.com/blog/inngest-vs-trigger-dev-vs-bullmq-background-jobs-nextjs-2026 — BullMQ vs Trigger.dev vs Inngest cost/complexity comparison for Next.js SaaS 2026 — MEDIUM
- https://trybuildpilot.com/610-trigger-dev-vs-inngest-vs-temporal-2026 — Trigger.dev v4 GA August 2025, no time limit, managed infra, TypeScript-native — MEDIUM
- https://developers.cloudflare.com/use-cases/saas/data-isolation/ — R2 prefix-based tenant isolation pattern for SaaS — MEDIUM
- aws.amazon.com/blogs/networking-and-content-delivery — SPA deployment on S3/CloudFront with SPA routing fallback pattern — HIGH
- hacefresko.com — LiquidJS SSTI only via template-string concatenation; context-based render is safe — MEDIUM
- disse.cting.org — Nunjucks sandbox breakout documented — MEDIUM
- arxiv.org/html/2405.01118v1 "Survey of Overlooked Dangers of Template Engines" — prefer no-exec engines over sandboxed-JS engines — MEDIUM

---
*Stack research for: template-driven static-HTML landing-page generator SaaS + v2.0 React/Vite project support*
*v1 researched: 2026-06-01*
*v2.0 additions researched: 2026-06-17*
