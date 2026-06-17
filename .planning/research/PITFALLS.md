# Pitfalls Research

**Domain:** Multi-tenant SaaS — untrusted third-party React/Vite project ingestion, build, and hosting (PageForge v2.0)
**Researched:** 2026-06-17
**Confidence:** HIGH (security pitfalls grounded in published CVEs, real supply-chain incident post-mortems, OWASP, and W3C/WHATWG specs; operational pitfalls HIGH from Docker/Node ecosystem; product-scope pitfalls MEDIUM from reasoned analysis of the concrete Lovable reference project)

> **Context:** v1 deliberately avoided executing untrusted code — LiquidJS, no JS eval, static HTML, sanitize-html. v2.0 adds ingesting Lovable React/Vite project folders (multi-file, require `npm install` + `vite build`, contain live runtime JS). This reopens every attack surface v1 closed and adds new ones that did not exist before. The pitfalls below are specific to the "upload → build → serve untrusted front-end project" capability. The original v1 PITFALLS.md (Pitfalls 1–7) remain valid and are not repeated here.
>
> Reference project confirmed: `renova-turismo-jornada-main/` — React 18 + Vite 5 + react-router-dom (multi-route SPA), Supabase client, Google Analytics, 70+ npm dependencies, `lovable-tagger` devDep, `.env` with live Supabase project credentials checked in.

---

## Critical Pitfalls

### Pitfall V2-1: Arbitrary Code Execution During `npm install` via Postinstall Scripts

**What goes wrong:**
`npm install` (and `pnpm install`, `bun install`) runs lifecycle hooks — `preinstall`, `install`, `postinstall`, `prepare` — on **every package in the dependency tree**, not just top-level dependencies. A malicious or compromised package in the tenant's `package.json` (or a transitive dependency) executes arbitrary code on your build server with the privileges of the Node process and full access to all environment variables available in that shell. This is not theoretical: in March 2026 the axios typosquat and in May 2026 the Shai-Hulud supply-chain worm (84 packages) executed `env` dumps and HTTP-exfiltrated `AWS_ACCESS_KEY_ID`, `DATABASE_URL`, `NPM_TOKEN`, and other CI secrets. The renova-turismo reference project has 70+ direct npm dependencies and hundreds of transitive ones — any one of them is a potential vector.

**Why it happens:**
Teams treat `npm install` as safe because they do it on their own machines constantly. The difference in a SaaS build pipeline is that (a) you are running `npm install` on *someone else's* `package.json`, (b) your build environment has access to cloud credentials and database connection strings that a developer's laptop doesn't, and (c) you cannot vet the full transitive dependency tree of every uploaded project.

**How to avoid:**
- Run `npm install --ignore-scripts` (or `pnpm install --ignore-scripts`) as the first line of the build. This disables all lifecycle hooks across the entire dependency tree.
- Then, only re-enable scripts for packages that Vite actually requires for native compilation (none in a typical Vite/React/Tailwind project — `vite build` itself does not require native modules). For the reference project, `--ignore-scripts` is safe: no `node-gyp`, no `better-sqlite3`, no native add-ons.
- Verify with `npm ls --parseable | xargs npm info --json lifecycle` (or `npm pkg get scripts` per package) whether any listed dep legitimately needs postinstall before enabling it.
- Run the entire build inside a **network-isolated container** (see Pitfall V2-3) so even if a script runs, it cannot phone home.
- Use `npm ci --ignore-scripts` (not `npm install`) to install from the lockfile exactly, preventing dependency drift from the user-submitted `package-lock.json`.

**Warning signs:**
- Build pipeline calls `npm install` or `pnpm install` without `--ignore-scripts`.
- Build container has outbound internet access during `npm install`.
- Build environment has `AWS_*`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, or any PageForge service credentials in its environment variables.
- No per-build resource accounting — a build that takes unexpectedly long might be a script phoning home.

**Phase to address:** **Phase: Build pipeline security foundation — the very first thing built for v2.0, before any tenant project is ever installed.** Nothing else about v2.0 can be safely built until this is locked down.

---

### Pitfall V2-2: Secret Exfiltration During Build — PageForge Credentials Leaked via Build-Time Env

**What goes wrong:**
Your build workers are Next.js server processes (or spawned subprocesses). If the same process that handles PageForge API requests also spawns `vite build` for a tenant project, the `process.env` of the build subprocess inherits your production environment: `DATABASE_URL`, `BETTER_AUTH_SECRET`, AWS S3 credentials, and anything else you set via `.env` or deployment platform secrets. A malicious postinstall/build plugin reads `process.env` and exfiltrates it via an outbound HTTP call. The result is full compromise of the PageForge multi-tenant database and S3 bucket, affecting every tenant.

A secondary vector: the reference project's own `.env` file ships with a live Supabase anon key and project URL. If you persist this file into your build environment without stripping it, the tenant's credentials (not yours) leak too — which is a support/trust problem even if not a PageForge infrastructure breach.

**Why it happens:**
Spawning a child process (`child_process.spawn('npm', ['ci', ...])`) inherits the parent's environment by default. Developers don't think of the build subprocess as "untrusted code running in my process space" — but it is exactly that.

**How to avoid:**
- **Never run tenant builds in the same process, container, or environment as your app server.** Use a dedicated build worker that receives only what it needs (the project files) and has zero PageForge secrets in its environment.
- Spawn build subprocesses with an explicit, minimal `env` object: `spawn('npm', ['ci', '--ignore-scripts'], { env: { PATH: '/usr/bin:/usr/local/bin', HOME: '/tmp/build', NODE_ENV: 'production' } })`. Do not spread `process.env`.
- Before executing any build, strip all `.env` files from the uploaded project (they contain tenant-owned secrets, see `.env` in the reference project). Never allow a tenant's `.env` to participate in the Vite build — Vite reads `.env` automatically and may bake secrets into the bundle.
- Store PageForge secrets in the secrets manager (AWS Secrets Manager, Doppler, etc.) and inject them into the app server at startup — not as plain environment variables that child processes inherit.
- Confirm after build that no PageForge environment variables appear in the built bundle: `grep -r 'BETTER_AUTH_SECRET\|DATABASE_URL\|AWS_SECRET' dist/`.

**Warning signs:**
- `child_process.spawn` or `exec` does not pass an explicit `env` argument (defaults to inheriting `process.env`).
- `.env` files from uploaded projects are not stripped before build.
- Build runs on the same host/container as the Next.js API server.
- Tenant-uploaded `vite.config.ts` is used as-is without auditing (it could define `define: { 'process.env.DATABASE_URL': JSON.stringify(process.env.DATABASE_URL) }`).

**Phase to address:** **Phase: Build pipeline security foundation (same phase as V2-1).** The build environment design must address credential isolation before any real project is built.

---

### Pitfall V2-3: SSRF and Network Access During Build — Internal Services Reachable from Build Container

**What goes wrong:**
During `npm install` or `vite build`, packages and build plugins can make arbitrary outbound HTTP/TCP requests. If the build runs on your infrastructure (ECS, Kubernetes, GCE), the build process has access to the VPC network, including: the Postgres database, the Redis cache, internal admin APIs, and cloud metadata endpoints (e.g. `http://169.254.169.254/latest/meta-data/` on AWS — which returns IAM role credentials). A supply-chain-compromised package in the tenant's lockfile requests the EC2 metadata URL and obtains an IAM key with S3 and RDS access. The tenant's package might also use `require('dns').lookup()` to fingerprint your internal network topology.

**Why it happens:**
Cloud VMs and containers sit on a network where internal services are reachable by default. Build pipelines are not normally treated as adversarial code — they're your code, on your infra. Tenant builds are not your code.

**How to avoid:**
- Run builds in an **egress-restricted environment**: no network access at all during `npm install` (use a pre-populated npm cache volume or a private npm registry mirror) and only allowlisted CDN calls during `vite build` (usually none are needed for a pure static build).
- If running on AWS/GCP/Azure, add an iptables/secgroup rule that blocks access to the cloud metadata endpoint (`169.254.169.254` and `fd00:ec2::254`) from the build container. AWS also supports IMDSv2 with hop-limit=1 — containers behind Docker's bridge network cannot reach it.
- Use a network namespace for each build: Docker `--network=none` is the strongest option; a private VPC subnet with no internet gateway and an explicit block of `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, and `169.254.0.0/16` is acceptable.
- If you need the tenant project to fetch npm packages during build, pre-download all packages listed in the lockfile before entering the isolated environment (use `npm ci --cache` into a read-only volume, then run the isolated build offline).

**Warning signs:**
- Build containers can reach `curl http://169.254.169.254/` successfully (test this before launch).
- Build runs in the same VPC subnet as the database and Redis without network policy / security groups.
- No outbound network monitoring on build workers — you can't detect a build that phones home.
- Build workers have IAM instance profiles with write access to S3 or Secrets Manager.

**Phase to address:** **Phase: Build pipeline security foundation.** Verified by a "metadata probe" test — run a build that attempts to `curl` the metadata endpoint and assert it fails.

---

### Pitfall V2-4: Served-XSS — Malicious JS in Tenant Bundle Executes in End Users' Browsers

**What goes wrong:**
After a successful `vite build`, you host the tenant's `dist/` output. The built files contain the tenant's JavaScript. Even if the build pipeline is safe, the built bundle itself can contain JavaScript that: steals PageForge session cookies (if served on the same origin as the dashboard), injects analytics/tracking the tenant didn't disclose, phone-home beacons, or clickjacking scripts. This is not hypothetical — the reference project already contains Google Analytics (`gtag.js`) in `index.html`. A malicious tenant could include a keylogger targeting form inputs or a script that reads `document.cookie` and exfiltrates it to a third-party server. If the bundle is served on the same domain as the PageForge dashboard (`pageforge.com/preview/tenant-a/`), the malicious script has full access to PageForge session cookies and can impersonate the authenticated user.

**Why it happens:**
Teams think "the output is just HTML/CSS/JS — static, harmless." But built JavaScript is fully live code. Serving it on the same origin as the authenticated app is the same as serving user-uploaded PHP on your app server.

**How to avoid:**
- **Never serve tenant built bundles on the same origin as the PageForge dashboard.** Use a fully separate origin: a wildcard subdomain per tenant (`tenant-a.pages.pageforge.com`) or a completely separate domain (`pageforgehosts.com`). The browser's Same-Origin Policy then prevents tenant JS from reading PageForge session cookies.
- For preview (within the PageForge dashboard), load the built bundle inside an `<iframe>` with `sandbox` attribute. The correct sandbox for a React SPA preview is `sandbox="allow-scripts allow-same-origin"` — **but this combination defeats sandboxing** (the sandboxed page's script can remove the sandbox attribute via `parentElement`). Therefore use a cross-origin iframe: serve the preview on a different origin (`preview.pageforgehosts.com`) and set `sandbox="allow-scripts"` without `allow-same-origin`. The page still renders; it just cannot access the parent origin's cookies/DOM.
- Set `Content-Security-Policy` headers on served tenant pages that restrict what the tenant bundle can do: `frame-ancestors 'self'` to prevent the tenant page from being used as a clickjacking frame; `upgrade-insecure-requests`; block inline eval if possible.
- Mark all PageForge session cookies as `HttpOnly` (immune to `document.cookie` reads) and `SameSite=Strict` (immune to cross-origin inclusion). These don't prevent a same-origin attack but are defense in depth for the cross-origin case.

**Warning signs:**
- Tenant build output is served under `pageforge.com` or any path/subdomain that shares cookies with the dashboard.
- Preview iframe uses `sandbox="allow-scripts allow-same-origin"` on the same origin as the dashboard.
- Session cookies are not `HttpOnly`.
- No Content-Security-Policy on served tenant pages.

**Phase to address:** **Phase: Hosting and serving architecture (must be decided before any preview is built).** This is an architectural decision that cannot be retrofitted — it determines the domain/subdomain plan for the entire feature.

---

### Pitfall V2-5: Cross-Tenant Asset Leakage — Build Outputs and Uploaded Files Accessible Across Tenants

**What goes wrong:**
If build outputs (`dist/`) are stored in S3 at predictable or shared paths, one tenant can access another's built bundle by guessing the path or exploiting a missing `workspace_id` scope. Concrete risk: a path like `s3://pageforge-builds/{lp-id}/dist/index.html` where `lp-id` is a sequential integer is trivially enumerable. A second vector is the build process itself writing to shared disk: if two tenant builds run concurrently in the same directory or use a shared npm cache, build artifacts can bleed across tenants (e.g. a shared `node_modules/.cache` that gets poisoned by one build and consumed by another). A third vector: the uploaded project's source files (`src/`, `components/`) themselves may contain sensitive customer data (phone numbers, prices embedded in hardcoded JSX) that must be tenant-isolated in storage.

**Why it happens:**
The v1 S3 isolation story was for images only (tenant-prefixed, non-guessable). Extending to "entire build output directories" requires deliberately applying the same discipline to a much larger file tree that developers think of as "generated" and therefore low-sensitivity.

**How to avoid:**
- Store all build artifacts under tenant-scoped S3 prefixes: `{workspace_id}/{lp_id}/dist/`. Use the same non-enumerable UUID approach established in v1 for images.
- Each build runs in a **per-build ephemeral directory** (`/tmp/builds/{build-id}/`) that is cleaned up after the build completes. Never reuse directories across tenants or builds.
- Shared npm cache: if you pre-warm a shared read-only npm cache to avoid re-downloading packages, ensure it is truly read-only during builds (mount as read-only volume) so a malicious postinstall cannot poison it for subsequent builds.
- Build worker IAM/permissions: each build should only be able to write to its own `{workspace_id}/{lp_id}/` prefix. Use S3 bucket policies or pre-signed PUT URLs scoped to the specific prefix.
- Apply the same cross-tenant access tests from v1 (Pitfall 5 in the original PITFALLS.md) to build artifacts and source file storage.

**Warning signs:**
- Build artifact paths include sequential integers or predictable slugs without a workspace prefix.
- Multiple builds run in the same `/tmp/builds/` subdirectory (no per-build isolation).
- npm cache is a shared read-write directory accessible to all build workers.
- S3 bucket for builds does not have workspace-scoped IAM policies.

**Phase to address:** **Phase: Build pipeline + storage architecture.** Verify with cross-tenant artifact access tests identical to the v1 IDOR tests.

---

### Pitfall V2-6: `vite.config.ts` as a Code Execution Vector — Tenant Config Runs Arbitrary Node.js

**What goes wrong:**
`vite.config.ts` is a Node.js module that is `require()`d or `import()`ed by the Vite CLI. It can contain arbitrary JavaScript — `import { execSync } from 'child_process'; execSync('curl ...')` — and it runs with full Node.js access on your build server. The reference project's `vite.config.ts` imports `lovable-tagger` (a devDependency). A malicious `vite.config.ts` could import any module available in the build environment, read `process.env`, make network calls, or write files. This is distinct from postinstall scripts (Pitfall V2-1): even with `--ignore-scripts`, `vite build` still `import()`s `vite.config.ts`.

**Why it happens:**
`vite.config.ts` is treated as "configuration," not "executable code." But configuration files in the Node.js ecosystem are executable modules. There is no sandboxing layer between `vite.config.ts` and the host process.

**How to avoid:**
- **Parse, don't execute** the tenant's `vite.config.ts` before building. Extract the fields you care about (plugins, aliases, base path) using static analysis (e.g. parse the AST with `@babel/parser` or `acorn` and extract the config object literals), then **replace** `vite.config.ts` with a PageForge-controlled `vite.config.ts` that applies only the safe subset.
- The PageForge-generated `vite.config.ts` should: set `build.outDir`, set `base` to the correct hosting path (see Pitfall V2-8), include `@vitejs/plugin-react-swc`, and **not** include `lovable-tagger` or any tenant-supplied plugin.
- If full static analysis of `vite.config.ts` is too complex, simply **replace it unconditionally** with a minimal, known-safe Vite config before running the build. The risk of breaking the build is low: for a standard Lovable export, the only required config fields are the React plugin and path aliases (`@` → `src/`).
- Apply the same treatment to `postcss.config.js`, `tailwind.config.ts`, and `eslint.config.js` — all are Node.js modules that run during build.

**Warning signs:**
- Build pipeline runs `vite build` on the tenant's original, unmodified `vite.config.ts`.
- No validation or replacement of `postcss.config.js` / `tailwind.config.ts` before the build.
- Build logs show `lovable-tagger` initializing (it makes network calls to the Lovable API to tag components — runs as a Vite plugin during build).

**Phase to address:** **Phase: Build pipeline security foundation (same phase as V2-1, V2-2, V2-3).** Config file treatment is part of the build hardening spec.

---

### Pitfall V2-7: Build Resource Exhaustion — CPU, Memory, Disk, and Time Bombs

**What goes wrong:**
A `vite build` on a large project can consume significant resources. The reference project has 70+ npm deps; a malicious or pathological project could have thousands of dependencies (dependency bomb), circular imports that cause infinite expansion, or JavaScript source files designed to maximize TypeScript/SWC compilation time. Without hard limits, a single tenant build can: starve concurrent builds of CPU, OOM-kill the build worker (which takes down other in-progress builds), fill the ephemeral disk with `node_modules` or build output, or hang indefinitely (blocking the build queue). A resource exhaustion attack can be used as a denial-of-service against PageForge's build capacity without any code execution.

**Why it happens:**
Build pipelines for first-party projects are designed for throughput, not adversarial inputs. Resource limits are added as an afterthought — or not at all — because "our builds never ran wild before."

**How to avoid:**
- Run each build in a Docker container with explicit resource limits: `--cpus 1.0 --memory 1536m --memory-swap 1536m` (no swap allowed — disk swap can be exhausted too). Use `--pids-limit 64` to cap process spawning.
- Set a hard build timeout: kill the container after N minutes (5–10 minutes is generous for a standard Vite + React build; the reference project builds in under 60 seconds). OOM-killed containers exit with code 137; timeout kills should exit with a distinct code (SIGKILL/124) for clear error reporting.
- Limit disk allocation per build using Docker's `--storage-opt` or a quota on the ephemeral build directory. After build, measure and enforce a maximum `dist/` output size (e.g., reject builds producing more than 50 MB of output before upload).
- Limit `node_modules` installation: cap the number of packages (`npm ls --json | jq '[.dependencies | keys] | length'`), reject if the tree exceeds a threshold (e.g., 500 packages), or enforce a dependency allowlist for known-safe Lovable stacks.
- Queue builds — never allow more concurrent builds than your build worker pool. Rate-limit build submissions per workspace.

**Warning signs:**
- Build containers run without `--memory` limits.
- No build timeout — builds queue indefinitely.
- No disk quota — a `node_modules` directory for a pathological project can exceed 2 GB.
- Build workers share a host with the app server (resource exhaustion takes down the app).
- No per-workspace rate limiting on build submissions.

**Phase to address:** **Phase: Build pipeline operational hardening** (can follow the security foundation phase, but must be in place before opening to multiple tenants).

---

### Pitfall V2-8: SPA Routing and Base-Path Breaks on Export — React Router Doesn't Know Where It's Hosted

**What goes wrong:**
The reference project uses `react-router-dom` with `BrowserRouter` and no `basename` prop. When the built SPA is served at a path like `/preview/workspace-123/lp-456/` instead of `/`, all asset paths and client-side navigation break. Vite produces `<script src="/assets/index-abc123.js">` (absolute paths from root) rather than `./assets/index-abc123.js` (relative), so the assets 404. React Router's `<Link to="/grecia">` pushes `/grecia` instead of `/preview/workspace-123/lp-456/grecia`, causing 404s on navigation. Even if hosted at the subdomain root (`lp-456.pages.pageforge.com/`), a multi-route SPA that expects a server-side catch-all (`/*` → `index.html`) won't work on a static file host unless that routing rule is configured. Additionally, the reference project has 12 routes — each is a separate LP — so the "one template = one LP" model needs to decide which route to serve.

**Why it happens:**
Lovable projects are developed and deployed on Lovable's own hosting, which handles all routing transparently. The assumption `basename='/'` is baked into the project. PageForge is a different hosting environment with different path layouts.

**How to avoid:**
- As part of the PageForge-controlled `vite.config.ts` (see Pitfall V2-6), inject the correct `base` path: `base: '/'` for subdomain hosting, or `base: '/preview/tenant/lp/'` for path-based hosting. This fixes Vite's asset path generation.
- For react-router-dom, either: (a) patch `App.tsx` to inject the correct `basename` into `BrowserRouter`, or (b) serve each LP on a subdomain root (simplest — no `basename` needed). Option (b) is strongly preferred; it also solves Pitfall V2-4 (origin isolation).
- For static file hosting of an SPA, configure the file server to return `index.html` for all paths under the LP's root (`try_files $uri $uri/ /index.html` in Nginx, or a `_redirects` rule on Cloudflare Pages). Without this, direct links to any non-root route return 404.
- If a Lovable project contains multiple routes and each route is a separate LP (like the reference project), require tenants to specify *which route* this LP represents at upload time, and generate a single-route build (or redirect all routes to the chosen one). This is a product decision, but the technical default must be defined.

**Warning signs:**
- Preview of the LP shows a blank page or 404 assets when hosted at any path other than `/`.
- Navigation within the preview SPA causes 404s.
- Vite build output contains absolute asset paths (`/assets/...`) rather than relative ones (`./assets/...`).
- `BrowserRouter` has no `basename` prop and the app is not served at `/`.

**Phase to address:** **Phase: Build + hosting configuration** (cannot be deferred — the LP is un-previewable without this).

---

### Pitfall V2-9: Tenant `.env` File Contains Live Credentials — Ingested and Potentially Baked into Bundle

**What goes wrong:**
The reference project ships a `.env` file with live Supabase credentials in the repository (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID). When PageForge ingests the uploaded project zip, `.env` is included. Vite reads `.env` automatically by default. During `vite build`, all `VITE_`-prefixed variables in `.env` are statically replaced into the bundle via `import.meta.env.*`. The built `dist/` contains the tenant's Supabase anon key baked in — which is public by Supabase design (anon key is safe, access is gated by RLS). However: (a) if the tenant has RLS misconfigured, their database is now exposed; (b) if the tenant accidentally included a `SUPABASE_SERVICE_ROLE_KEY` in `.env` (bypasses all RLS), it's now baked into the public bundle. Beyond Supabase: other tenant projects might include payment API keys, CRM tokens, or internal endpoint URLs.

**Why it happens:**
`.env` is part of the project zip. Vite reads it automatically with no opt-in required. Developers often include `.env` (not `.env.local`) in their repositories without realizing it.

**How to avoid:**
- **Strip all `.env*` files** from the uploaded project before running the build. There is no case where PageForge should use the tenant's environment variables during the build.
- Before stripping, scan `.env` files for high-risk patterns: service-role keys (`service_role`), `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`, and warn the user that their project contains credentials that will not be preserved in the PageForge-built version.
- Generate a minimal, PageForge-controlled `.env` for the build that contains only what the build process needs (typically: nothing extra beyond what the PageForge-supplied `vite.config.ts` provides).
- Scan the built `dist/` bundle for credential patterns (base64-encoded Supabase JWTs, `sk_live_`, `AAAA`, etc.) and warn the tenant before publishing if detected.

**Warning signs:**
- `find /build-dir -name '.env*'` returns files before the build runs.
- Build logs show `vite:env loaded .env` — the tenant's `.env` was read.
- `grep -r 'supabase.co' dist/` returns hits with a specific project ID baked in.
- No pre-build `.env` stripping step in the build pipeline.

**Phase to address:** **Phase: Build pipeline security foundation** (input sanitization before build).

---

### Pitfall V2-10: Lovable-Specific Runtime Dependencies Break Outside Lovable Hosting

**What goes wrong:**
The reference project includes `lovable-tagger` as a devDependency. This is a Vite plugin that, during development, calls the Lovable API to tag components for the visual editor. In a production build it is conditionally excluded (`mode === 'development' && componentTagger()`), so the built bundle is clean. However: (a) a tenant may have `lovable-tagger` active in production mode, baking API calls into the bundle; (b) the Supabase client (`@supabase/supabase-js`) is a runtime dependency whose backend must exist and be configured for the app to function — if the tenant's Supabase project is deleted or keys are rotated, the built LP may silently break (empty content, network errors, blank sections); (c) the reference project also has `react-helmet-async`, Google Analytics inline in `index.html`, and Open Graph meta pointing to `renova-turismo-jornada.lovable.app` — all artifacts of Lovable's hosting environment that produce incorrect behavior on PageForge.

**Why it happens:**
Lovable projects are built to run on Lovable's infrastructure. PageForge is a different environment. The assumption "export the project folder and it runs anywhere" is partially true for the static build output, but many Lovable projects have runtime dependencies on Supabase backends, Lovable APIs, or hardcoded Lovable domains.

**How to avoid:**
- During the ingestion step (before build), **audit `package.json`** for Lovable-specific packages (`lovable-tagger`) and Supabase dependencies. Warn the user if found: "This project connects to an external Supabase backend; the LP will require that backend to be live and configured for dynamic content to load."
- Audit `index.html` for hardcoded third-party scripts (analytics, chat widgets, Lovable API calls) that reference external services. Surface these to the user — they may be intentional (the tenant wants analytics) or accidental.
- Define a **PageForge-controlled `index.html` template** (or a post-processing step) that strips Lovable-specific meta tags (`og:url`, `twitter:*` pointing to `.lovable.app`) and replaces them with PageForge-generated values.
- For LPs whose content is driven by Supabase data at runtime (not hardcoded), document clearly that PageForge can only snapshot what the Vite build produces — it cannot replace a live Supabase backend. This is a product boundary, not a bug.

**Warning signs:**
- `vite build` output shows console warnings about missing `VITE_SUPABASE_*` variables (means the build tried to use env vars that weren't available).
- Built LP fetches `https://*.supabase.co` at runtime (visible in browser DevTools Network tab of the preview).
- `index.html` contains `og:url` pointing to `.lovable.app`.
- `lovable-tagger` is not conditionally excluded in production mode.

**Phase to address:** **Phase: Ingestion and validation** (before build) and **Phase: Post-build audit** (after build, before serving).

---

### Pitfall V2-11: Breaking the v1 "No JS Execution" Safety Guarantee — Conflation of Two Template Types

**What goes wrong:**
v1 templates produce server-rendered, static HTML with no JavaScript execution (LiquidJS renders on the server; export is pure HTML). v2.0 adds a second template type (Lovable projects) that produces JavaScript bundles that execute in the user's browser. If the codebase conflates the two types — sharing render paths, preview components, export flows, or security checks — v1 safety guarantees are accidentally weakened. Specific risks: (a) a v1 HTML template is accidentally routed through the build pipeline (SSTI potential); (b) a Lovable LP's served JS is incorrectly treated as "static HTML" and served on the same PageForge origin (Pitfall V2-4); (c) CSP policies for v1 exports (which should forbid all scripts) are loosened to accommodate v2 previews; (d) the export ZIP for a Lovable LP is incorrectly described as "static HTML" when it actually contains runtime JavaScript.

**Why it happens:**
The natural implementation path is to extend the existing LP model with a new `type` field and add type-specific branches. Under time pressure, branches are not always cleanly separated, and abstractions leak across types.

**How to avoid:**
- Maintain **strict type-level separation** in the codebase: two rendering engines, two preview components, two export flows, two security models. Share only the data model (LP record in Postgres) and the catalog/folder UI. Resist the urge to unify the render path prematurely.
- v1 LP previews must remain served from the PageForge domain (they are server-rendered HTML, safe). v2 LP previews must be served from a sandboxed cross-origin (Pitfall V2-4). These cannot use the same `<PreviewFrame>` component without careful type branching.
- Document and test the type boundary explicitly: a v1 template ID cannot be passed to the v2 build pipeline, and a Lovable project ID cannot be rendered by LiquidJS.
- Review CSP and export policies per type: v1 exports should ship with `<meta http-equiv="Content-Security-Policy" content="script-src 'none'">`. v2 exports cannot make this claim.

**Warning signs:**
- A single `renderLP(id)` function without a type check routes both template types through the same code path.
- The preview component for both types uses the same iframe origin.
- The export ZIP description says "static HTML" for v2 Lovable LPs.
- v1 CSP was loosened to `script-src 'self'` to fix a v2 preview issue.

**Phase to address:** **Phase: Architecture and type system design** (before building either render path in v2) and enforced in every subsequent phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Run `npm install` without `--ignore-scripts` | Works with all packages, no breakage | Arbitrary code execution on build server during any tenant build | **Never** — no Vite/React/Tailwind build requires postinstall scripts |
| Spawn build subprocess inheriting `process.env` | No extra work | Build process has access to all PageForge production secrets | **Never** — always pass an explicit minimal `env` object |
| Serve tenant built bundles on the same origin as the dashboard | Simpler routing, no subdomain management | Tenant JS can read PageForge session cookies, CSRF tokens | **Never** — architectural decision that can't be patched later |
| Use tenant's original `vite.config.ts` unchanged | No parsing/replacement logic needed | `vite.config.ts` is executable Node.js — runs arbitrary code during build | **Never** for untrusted tenants |
| Build inside the same container/process as the app server | Saves infrastructure cost | Resource exhaustion on one build takes down the entire app | **Never** — isolate from day one |
| Skip `.env` stripping before build | Tenant's env vars available during build | Tenant credentials baked into bundle; PageForge credentials exposed if inherited | **Never** |
| Reuse the same preview component for v1 and v2 LPs | Less code | v2 Lovable LP preview must be cross-origin sandboxed; sharing breaks v1's security model | **Never** — type-branch the preview from the start |
| Allow npm cache to be a shared read-write volume | Faster builds (cache hits) | Cache poisoning: one build's postinstall can modify cache entries consumed by later builds | Acceptable as **read-only** volume only |
| No build timeout / resource limits in v2 MVP | Simpler to ship | One pathological tenant project hangs the entire build queue | Acceptable temporarily only if builds are manually reviewed; not for self-service |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `npm ci` / `npm install` | Running without `--ignore-scripts` in the build pipeline | Always use `npm ci --ignore-scripts`; validate no native deps need rebuild |
| `vite build` CLI | Passing `--config tenant/vite.config.ts` (executes tenant code) | Replace config with PageForge-controlled file before invoking `vite build` |
| `child_process.spawn` for build | Not passing explicit `env` (inherits `process.env`) | `spawn('npm', [...], { env: { PATH: '...', NODE_ENV: 'production' } })` — no spreading of `process.env` |
| S3 for build artifact storage | Flat paths without workspace prefix | Enforce `{workspace_id}/{lp_id}/dist/` prefix; scoped IAM per build |
| Preview iframe | `sandbox="allow-scripts allow-same-origin"` — cancels sandboxing | Serve preview on cross-origin subdomain; use `sandbox="allow-scripts"` only |
| Tenant `.env` files | Included in build directory (Vite reads them automatically) | Strip all `.env*` before invoking any build tooling |
| Docker build containers | No `--memory`, `--cpus`, `--pids-limit` | Hard limits + timeout + per-build ephemeral directories |
| react-router-dom `BrowserRouter` | No `basename` when hosted at non-root path | Patch basename or serve on subdomain root; configure catch-all routing on the file server |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No build concurrency limit | Build queue backs up; builds time out; CPU spikes to 100% | Per-worker concurrency cap; queue length limit; rate limiting per workspace | First tenant who submits 5 builds in quick succession |
| Full `npm ci` on every build with no cache | 60–120 second installs for a 70-dep project | Pre-warm a read-only package cache volume; share across builds for the same lockfile hash | At any scale — npm install dominates build time |
| Serving large built bundles (multi-MB JS) from app origin | Slow LP preview in dashboard | Host bundles on CDN; lazy-load preview | Bundles > 1 MB (Lovable projects with Radix UI can easily exceed 500 KB gzipped) |
| Per-build Docker container cold start | Build takes 30s before npm even starts | Warm container pool; pre-pull base images | On-demand build workers with no warm pool |
| Synchronous build blocking the API request | API times out after 30–60s; dashboard shows no feedback | Build is always async: submit → job ID → poll / webhook | Every build — Vite builds are 30–120 seconds |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `npm install` without `--ignore-scripts` | RCE on build server via postinstall (real attack: Shai-Hulud worm, 2026-05) | Always `--ignore-scripts`; network-isolated container |
| Build subprocess inherits `process.env` | PageForge DB/S3 credentials exfiltrated via env | Explicit minimal `env` object in `spawn()` |
| Build runs with outbound network access | SSRF to internal VPC / AWS metadata endpoint → IAM key theft | `--network=none` or egress blocklist including `169.254.169.254` |
| Tenant `vite.config.ts` executed as-is | Arbitrary Node.js on build server | Replace with PageForge-controlled config |
| Tenant built bundle served on PageForge origin | Tenant JS reads PageForge session cookies → account takeover | Mandatory separate origin (subdomain/domain) for all tenant-built content |
| Preview iframe `sandbox="allow-scripts allow-same-origin"` on same origin | Script removes sandbox attribute → full DOM access | Cross-origin preview + `sandbox="allow-scripts"` only |
| `.env` not stripped before build | Tenant credentials in bundle; PageForge credentials if env inherited | Strip all `.env*` pre-build; scan bundle for credential patterns post-build |
| No per-tenant S3 path scoping for build artifacts | Cross-tenant artifact access (IDOR) | `{workspace_id}/{lp_id}/dist/` prefix; scoped IAM |
| Shared writable npm cache across tenant builds | Cache poisoning | Read-only shared cache; per-build isolated writeable cache |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Build fails with cryptic npm/Vite errors | User doesn't know if their project is supported | Pre-validate `package.json` before build; surface clear "this project type is supported / unsupported" |
| Build succeeds but LP is blank (Supabase backend not configured) | User thinks PageForge is broken | Pre-build audit detects runtime Supabase dependency; warn user upfront |
| LP preview shows Lovable-branded meta / OG tags | Looks unprofessional; wrong domain in OG | Post-build `index.html` rewrite step strips/replaces Lovable-specific meta |
| Multi-route Lovable project — user doesn't know which route is the LP | Confusion about which page is served | Upload flow asks: "Which route is this LP? (select from detected routes)" |
| Build takes 90 seconds with no feedback | User thinks it's broken and re-submits | Async build with real-time status (queued → installing → building → done); progress via polling or websocket |
| Preview != hosted LP (path/basename difference) | User approves a preview that looks broken on the live URL | Preview must use the exact same serving configuration (subdomain, base path) as the live LP |

---

## "Looks Done But Isn't" Checklist

- [ ] **Build isolation:** Build runs in a container — but does `npm ci --ignore-scripts` succeed? Verify no package legitimately needs postinstall (check `npm ls --depth=Infinity | xargs` for scripts).
- [ ] **Secret isolation:** Build container has resource limits — but does `spawn()` pass an explicit minimal `env`? Run `strings /proc/1/environ` inside the build container; assert no PageForge secrets present.
- [ ] **Network isolation:** Container has `--network=none` or egress rules — but can it actually reach `169.254.169.254`? Run a metadata probe test before launch.
- [ ] **vite.config.ts replacement:** Build pipeline replaces the config — but does the replaced config produce a working build for the reference project? Smoke-test with `renova-turismo-jornada-main`.
- [ ] **Origin separation:** Tenant bundle served on separate domain — but does the preview iframe also use a separate origin? Verify by checking `document.location.origin` inside the preview iframe differs from the dashboard.
- [ ] **iframe sandbox:** Preview uses `sandbox` — but is it `allow-scripts allow-same-origin`? That defeats sandboxing. Verify it is `sandbox="allow-scripts"` only with cross-origin hosting.
- [ ] **Session cookie protection:** Cookies are `HttpOnly` and `SameSite=Strict` — but verify by checking `document.cookie` from a console in a same-origin context; PageForge session cookie should be absent.
- [ ] **`.env` stripping:** Build ran — but does `find dist/ -name '.env*'` return empty? And does `grep -r 'supabase.co' dist/` show only tenant-intended references (not PageForge infra)?
- [ ] **Cross-tenant artifacts:** Build output is stored — but can a user from workspace B load workspace A's `dist/index.html` by guessing the S3 path? Run a cross-tenant access test against the artifact storage.
- [ ] **Resource limits enforced:** Container has `--memory=1536m` — but what happens when the build exceeds it? Verify build exits with code 137 and the queue job is marked as failed (not hung).
- [ ] **Type separation:** Both template types work — but does passing a v1 template ID to the v2 build pipeline raise an error (not attempt a build)? Test the boundary explicitly.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Postinstall RCE on build server | HIGH | Rotate all credentials exposed in build environment; audit what each build script accessed (network logs); notify security team; patch pipeline to `--ignore-scripts`; rebuild compromised images |
| Build credentials exfiltrated via inherited env | HIGH | Rotate `DATABASE_URL`, S3 keys, `BETTER_AUTH_SECRET` immediately; audit DB and S3 access logs for unauthorized activity; patch `spawn()` env isolation |
| Tenant built bundle served on PageForge origin | HIGH | Migrate all tenant build assets to separate origin (requires re-generating all tenant LP URLs, potential breaking change for users); rotate session cookies |
| Cross-tenant artifact access discovered | MEDIUM–HIGH | Apply workspace prefix to all artifact paths; audit S3 access logs for cross-tenant reads; notify affected tenants |
| Tenant `.env` credentials baked into bundle | MEDIUM | Notify affected tenant to rotate their Supabase/API keys; add pre-build stripping; re-build affected LPs |
| Build resource exhaustion (DoS) | MEDIUM | Kill runaway container; add `--memory`/`--cpus` limits; implement per-workspace build rate limiting; refund affected tenant |
| LP preview broken due to path/basename issue | LOW | Patch `vite.config.ts` template and `BrowserRouter basename`; re-build affected LPs |
| Lovable-specific meta in published LP | LOW | Add post-build `index.html` rewrite to pipeline; re-build affected LPs |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Postinstall RCE (V2-1) | Build pipeline security foundation (Phase 1 of v2.0) | `npm ci --ignore-scripts` succeeds; postinstall probe returns error |
| Build credential exfiltration (V2-2) | Build pipeline security foundation | `spawn()` env audit; no PageForge secrets in build container env |
| SSRF via build network (V2-3) | Build pipeline security foundation | Metadata endpoint probe fails from build container |
| Served-XSS on same origin (V2-4) | Hosting and serving architecture (Phase 2 of v2.0) | Preview iframe origin differs from dashboard origin; session cookie absent from preview context |
| Cross-tenant artifact leakage (V2-5) | Build + storage architecture | Cross-tenant artifact access test fails with 403 |
| `vite.config.ts` code execution (V2-6) | Build pipeline security foundation | Build uses PageForge-controlled config; tenant config discarded |
| Build resource exhaustion (V2-7) | Build pipeline operational hardening | Memory/CPU/timeout limits enforced; OOM test exits with 137 |
| SPA routing / base-path breaks (V2-8) | Build + hosting configuration | LP preview loads at correct path; all routes return correct content |
| Tenant `.env` credential exposure (V2-9) | Build pipeline security foundation (input sanitization) | No `.env*` files present before build; bundle scan clean |
| Lovable runtime dependencies (V2-10) | Ingestion and post-build audit | Pre-build audit warns on Supabase; post-build scan confirms |
| v1/v2 type conflation (V2-11) | Architecture and type system (before any render path) | Type boundary tests; v1 template cannot enter v2 build pipeline |

---

## Sources

- Real supply-chain attacks (HIGH): [Shai-Hulud supply-chain worm — 84 npm packages, May 2026](https://www.stepsecurity.io/blog/ctrl-tinycolor-and-40-npm-packages-compromised); [Malicious npm packages harvest CI secrets, Feb 2026](https://thehackernews.com/2026/02/malicious-npm-packages-harvest-crypto.html); [Microsoft: 33 npm packages abuse dependency confusion, May 2026](https://www.microsoft.com/en-us/security/blog/2026/05/29/33-malicious-npm-packages-abuse-dependency-confusion-profile-developer-environments/)
- npm `--ignore-scripts` (HIGH): [NPM ignore-scripts best practices (nodejs-security.com)](https://www.nodejs-security.com/blog/npm-ignore-scripts-best-practices-as-security-mitigation-for-malicious-packages); [Understanding and protecting against lifecycle scripts (Medium)](https://medium.com/@kyle_martin/understanding-and-protecting-against-malicious-npm-package-lifecycle-scripts-8b6129619d7c); [Endor Labs: defending against npm supply chain](https://www.endorlabs.com/learn/how-to-defend-against-npm-software-supply-chain-attacks)
- Secret exfiltration via build env (HIGH): [do not use secrets in environment variables (nodejs-security.com)](https://www.nodejs-security.com/blog/do-not-use-secrets-in-environment-variables-and-here-is-how-to-do-it-better); [Axios hijack post-mortem: audit, pin, automate defense](https://dev.to/smyekh/axios-hijack-post-mortem-how-to-audit-pin-and-automate-a-defense-481d); [Sprocket Security: Vite misconfiguration leads to CI/CD compromise](https://www.sprocketsecurity.com/blog/hunting-secrets-in-javascript-at-scale-how-a-vite-misconfiguration-lead-to-full-ci-cd-compromise)
- SSRF via build (HIGH): [Vite CVE-2025-30208 — file read via exposed dev server](https://iplogger.org/blog/attempts-to-exploit-exposed-vite-installs-cve-2025-30208-thu-apr-2nd/); [SSRF comprehensive guide (Medium)](https://medium.com/@okanyildiz1994/mastering-ssrf-vulnerabilities-an-ultra-extensive-guide-to-understanding-and-mitigating-43aa09a8df08)
- Same-origin XSS from served tenant JS (HIGH): [Kurtis Baron: file upload bypass + stored XSS chain](https://kurtisebear.com/2026/03/28/chaining-file-upload-xss-admin-compromise/); [PortSwigger: exploiting XSS to steal cookies lab](https://portswigger.net/web-security/cross-site-scripting/exploiting/lab-stealing-cookies); [Can I Take Your Subdomain — same-site attacks](https://canitakeyoursubdomain.name/)
- iframe sandbox `allow-scripts allow-same-origin` (HIGH): [Rocket Validator — sandboxing warning](https://rocketvalidator.com/html-validation/bad-value-x-for-attribute-sandbox-on-element-iframe-setting-both-allow-scripts-and-allow-same-origin-is-not-recommended-because-it-effectively-enables-an-embedded-page-to-break-out-of-all-sandboxing); [Mozilla Discourse: explanation of the rule](https://discourse.mozilla.org/t/can-someone-explain-the-issue-behind-the-rule-sandboxed-iframes-with-attributes-allow-scripts-and-allow-same-origin-are-not-allowed-for-security-reasons/110651); [Daniel Dušek: escaping improperly sandboxed iframes](https://danieldusek.com/escaping-improperly-sandboxed-iframes.html); [MDN: CSP sandbox directive](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/sandbox)
- Cross-tenant S3 leakage (HIGH): [AWS prescriptive guidance: S3 tenant isolation via Lambda token vending machine](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/implement-saas-tenant-isolation-for-amazon-s3-by-using-an-aws-lambda-token-vending-machine.html); [Agnite Studio: preventing cross-tenant data leakage](https://agnitestudio.com/blog/preventing-cross-tenant-leakage/)
- Docker resource limits for untrusted builds (HIGH): [OneUptime: Docker CPU & memory limits](https://oneuptime.com/blog/post/2026-01-16-docker-limit-cpu-memory/view); [phoenixNAP: Docker memory and CPU limit guide](https://phoenixnap.com/kb/docker-memory-and-cpu-limit)
- Supabase anon key exposure (MEDIUM): [Supabase exposed API keys security analysis](https://vibeappscanner.com/security-issue/supabase-exposed-api-keys); [Supabase anonymous key security guide](https://www.audityour.app/guides/supabase-anonymous-key-security-guide)
- React Router base path / SPA hosting (MEDIUM): [React Router basename docs](https://reactrouter.com/how-to/spa); [Hosting React app on subpath (Thomas Gauvin)](https://thomasgauvin.com/writing/react-swa-with-subpath/); [Vite `base` config option (vite.dev)](https://vite.dev/config/shared-options)
- Lovable project structure and limitations (MEDIUM): [How to export Lovable project (braingrid.ai)](https://www.braingrid.ai/blog/how-to-download-lovable-project); [Lovable 2.0 FAQ: export and hosting](https://flowith.io/blog/lovable-2-0-faq-database-authentication-deployment-code-export/)
- `gVisor` for container sandboxing in multi-tenant SaaS (MEDIUM): [gVisor (Wikipedia)](https://en.wikipedia.org/wiki/GVisor)

---
*Pitfalls research for: untrusted React/Vite project ingestion, build, and hosting in multi-tenant SaaS (PageForge v2.0)*
*Researched: 2026-06-17*
