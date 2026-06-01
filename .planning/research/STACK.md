# Stack Research

**Domain:** Template-driven static-HTML landing-page generator SaaS (multi-tenant, RBAC, marketing agencies)
**Researched:** 2026-06-01
**Confidence:** HIGH (core stack + templating/sandbox + form gen verified via Context7 + official docs); MEDIUM (image storage variant choice, rich-text)

---

## TL;DR — The Load-Bearing Decision

The product's "motor" is the **token → schema → dynamic form → merge → static HTML** pipeline, fed by **author-written markup** (untrusted template code). That single fact drives the most important choice: the rendering engine must be **safe to run on attacker-controlled templates** AND support **loops / repeatable blocks** natively.

**→ Use LiquidJS** (`liquidjs@10.27.0`). It was explicitly designed to run untrusted template code (Shopify's threat model), it has no arbitrary JS/`eval`/filesystem access, and `{% for %}` gives you repeatable blocks for free. Do NOT use Handlebars, EJS, Pug, or Nunjucks for this — they either execute JS or have well-documented sandbox escapes (see "What NOT to Use").

---

## Recommended Stack

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

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **better-auth** | 1.6.13 | Auth + organizations/teams + RBAC | Has a first-class **organization plugin** (workspaces, members, invitations, roles/permissions) — covers the multi-tenant + RBAC requirement out of the box instead of hand-rolling. (Auth.js/NextAuth is the alternative; it has no built-in org model.) |
| **Tiptap** | 3.24.0 | Rich-text field editor (`@tiptap/react` + StarterKit) | For the `rich text` field type (paragraphs in the LP). Headless ProseMirror wrapper, mature, outputs HTML you control. More production-ready than Lexical (still pre-1.0). |
| **sanitize-html** | 2.17.4 | Server-side sanitization of rich-text HTML before it enters the LP | **Mandatory.** Rich-text values are user input that gets injected as raw HTML into the static output. Sanitize on the server with an allowlist before merge. (DOMPurify 3.4.7 is the client/JSDOM alternative; sanitize-html is purpose-built for Node server use.) |
| **@aws-sdk/client-s3** + **@aws-sdk/s3-request-presigner** | 3.1058.x | Image upload + storage (S3-compatible) | Generate presigned PUT URLs server-side; browser uploads directly to the bucket. Keeps large image bytes off your app server. Works with AWS S3, Cloudflare R2, Backblaze B2, MinIO. |
| **archiver** | 8.0.0 | Stream a ZIP of `index.html` + downloaded image assets for export | Streaming ZIP = constant memory, can pipe straight to the HTTP response. Best fit for "export LP as a self-contained folder/zip." |
| **@hookform/resolvers** | latest | Bridge Zod schema → React Hook Form | Connects the runtime form validation to the same Zod schema derived from tokens. |
| **shadcn/ui + Tailwind CSS** | latest / 4.x | Dashboard/catalog UI components | Standard 2025 component approach for Next.js SaaS; you own the code, fast to build the catalog/folders/forms UI. |
| **TanStack Query** | 5.x | Client cache for catalog/list views (optional) | Only if you find Server Actions + RSC insufficient for interactive catalog filtering. Don't add preemptively. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** | Package manager | Fast, disk-efficient; default for modern Next.js setups. |
| **Vitest** | Unit/integration tests | Critical for the parser → schema → render pipeline; test that known templates produce known HTML and that malicious templates are neutralized. |
| **Biome** or ESLint + Prettier | Lint/format | Biome is faster single-tool; ESLint if you need the broader plugin ecosystem. |
| **Docker Compose** | Local Postgres + MinIO (S3 emulation) | Reproduce S3 + DB locally without cloud accounts. |
| **Playwright** | E2E for the author→generate→export flow | Verify the full pipeline including ZIP download. |

---

## The Templating / Token Pipeline (detailed — this is the core)

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

- **Generation:** Server Action / route handler runs LiquidJS → produces the final `index.html` string. Store it (or regenerate on demand — regeneration is cheap and avoids stale HTML; PROJECT says re-editing means regenerate).
- **Image handling in export:** two modes — (a) reference S3 URLs directly (simplest, requires the bucket to stay public/CDN), or (b) **self-contained ZIP**: download the referenced images server-side, rewrite `src` to relative `./assets/...`, and stream `index.html` + `assets/` via `archiver`. Mode (b) matches "download a portable HTML LP" expectations best for v1.
- **Why streaming ZIP (archiver) over jszip/fflate:** archiver streams to the HTTP response with constant memory and is the standard for server-side ZIP-of-files. fflate is faster for pure in-memory buffers but archiver's file/stream API fits "bundle html + N images" more cleanly. jszip is more browser-oriented.

---

## Installation

```bash
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

---

## Stack Patterns by Variant

**If you want minimal infra / lowest ops (recommended for v1):**
- Vercel (Next.js) + Neon/Supabase Postgres + Cloudflare R2 (S3 API, no egress fees) + Prisma + better-auth.
- Because: managed everything, R2 egress-free is ideal when exporting/serving many images.

**If the team is SQL-first and wants edge/runtime flexibility:**
- Swap Prisma → Drizzle. Same Postgres, same everything else.

**If multi-tenant isolation needs to be enforced at the DB layer later:**
- Adopt Postgres **Row-Level Security** keyed on `workspace_id`, plus app-level scoping. v1 can be app-level scoping only (every query filtered by workspace), but design the schema with `workspace_id` on every tenant-owned table from day one.

**If export must be a portable, self-contained artifact:**
- Use archiver to bundle `index.html` + downloaded `/assets` images with rewritten relative paths (Mode b above).

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

---

## Sources

- `/harttle/liquidjs` (Context7) — confirmed LiquidJS is "simple, expressive and safe", Shopify/GitHub-Pages compatible, isomorphic; `{% for %}` loop + filter support — HIGH
- `npm view` (registry, 2026-06-01) — current versions for next 16.2.7, prisma 7.8.0, zod 4.4.3, react-hook-form 7.77.0, @tiptap/react 3.24.0, sanitize-html 2.17.4, dompurify 3.4.7, archiver 8.0.0, @aws-sdk/client-s3 3.1058.x, better-auth 1.6.13, drizzle-orm 0.45.2, liquidjs 10.27.0 — HIGH
- hacefresko.com — LiquidJS SSTI requires *concatenating user input into the template string*; passing values as render context (the recommended pattern) avoids it — MEDIUM (confirms the safe-usage pattern + the one anti-pattern to avoid)
- disse.cting.org — documented Nunjucks sandbox breakout (basis for avoiding Nunjucks as trust boundary) — MEDIUM
- arxiv.org/html/2405.01118v1 "A Survey of the Overlooked Dangers of Template Engines" — sandboxes are commonly relied upon but reliability is doubted → prefer engines with no code execution (Liquid) over sandboxed-JS engines — MEDIUM
- StackShare / npm-compare / Colorlib comparisons — LiquidJS recommended for user-generated/untrusted templates; Tiptap most well-rounded production rich-text vs pre-1.0 Lexical — MEDIUM
- dev.to / conermurphy.com / Neon guides — S3 presigned-URL direct upload is the standard Next.js pattern — MEDIUM
- npmtrends archiver/fflate/jszip — archiver = standard streaming server-side ZIP-of-files — MEDIUM

---
*Stack research for: template-driven static-HTML landing-page generator SaaS*
*Researched: 2026-06-01*
