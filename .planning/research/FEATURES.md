# Feature Research

**Domain:** Template-based landing page generator SaaS (multi-tenant, for marketing/travel agencies)
**Researched:** 2026-06-17 (v2.0 update — Lovable/React project template support)
**Confidence:** HIGH (PROJECT.md scope is explicit; reference project inspected directly; competitor patterns verified via multiple sources)

---

## SECTION A — v1.0 Feature Landscape (Already Built — Retained for Reference)

> All v1.0 features are built and validated. See the 2026-06-01 FEATURES.md snapshot for full rationale.
> Summary: token parser (LiquidJS), dynamic form (6 field types incl. repeater), static HTML merge/preview/export,
> catalog with folders/tags, multi-tenant workspaces + RBAC, global brand config.

---

## SECTION B — v2.0 Feature Research: Lovable-Exported React Projects as Templates

### Positioning Note (read first)

The v1.0 differentiator was *"a marketer fills a form and gets layout-identical HTML without touching code."*
v2.0 extends that to cover a different template authoring path: **a developer imports a Lovable-exported
React/Vite project (multi-file, hardcoded content) as the template instead of a Liquid markup string.**

This creates a fundamental product tension that every feature decision below must resolve:

> **The core tension:** Lovable content is hardcoded in TSX component files. There is no token layer,
> no schema, no data separation. Making it editable for a non-developer requires inserting that layer
> somehow. Every editability approach below is a solution to this one problem.

**Reference project anatomy (renova-turismo-jornada-main):**
- 13 campaign pages in `src/pages/`, each a flat composition: `<Navbar><Hero><SobreViagem><Inclusos><Roteiro><PorQueRenova><Depoimentos><InscrevaSe><Footer>`
- Each campaign has its own component folder (`src/components/campaigns/grecia/`, `/turquia/`, etc.) with fully hardcoded content
- A `CampaignTemplate/` folder exists with `// EDITAR:` comments marking what to change — this is the developer's "token convention" today
- Content is hardcoded as JSX string literals and in-module arrays (`const slides = [...]`, `const items = [...]`)
- Design tokens live in CSS variables (`hsl(var(--primary))`) driven by `tailwind.config.ts` — the theme is swappable without touching components
- Images are imported as ES module static assets: `import heroImage from "@/assets/..."` — bound at build time
- The contact form calls Supabase Edge Functions and constructs WhatsApp URLs with hardcoded phone numbers
- A `campaigns.ts` data file exists but is used only for the index listing, not for the campaign pages themselves (the pages do NOT consume `campaigns.ts` — they are fully standalone components)

The project is a React/Vite SPA. Building it produces a `dist/` folder of static files (HTML + JS bundles + assets).

---

### How Comparable Products Handle "Import a Coded Page, Let a Marketer Edit It"

**Webflow:** Cannot import HTML/CSS into the canvas editor. This is a long-standing wish-list item with no native support. Workaround: paste into "Custom Code" embed block, which is uneditable in the Webflow UI. Verdict — they gave up on import; they own the authoring from scratch.

**Framer:** On-page editing (CMS 2.0) lets marketers click editable text/images on the live published site. But this works only for Framer-authored pages; imported raw HTML/code gets no on-page editing. Code Components (JSX in Framer's editor) can be made editable via `addPropertyControls` — a developer-authored convention, not automatic. Verdict — editability requires developer opt-in per component; not automatic from an exported project.

**Builder.io:** Closest model. Register existing React components as Builder "registered components," expose their props as controls in the visual editor. Marketers drag pre-registered blocks and fill props. But this requires wrapping each component with Builder's registration API — it does not read an arbitrary codebase and extract editable fields automatically.

**Plasmic:** Similar to Builder.io. Developers register code components with prop metadata; Plasmic generates UI controls from the metadata. Non-developer "content creator mode" restricts editing to content only (text/image). Import of an arbitrary React project is not supported — a community forum question confirmed this as unsupported.

**Storybook Knobs / Controls:** Developer-facing pattern where component props are exposed as interactive controls in a sidebar. Not marketer-facing; requires explicit story authoring per component. Useful as an internal reference for the "sidebar form + live preview" UX pattern.

**ReactBricks:** Inline visual editing for React. Developers define editable fields directly in JSX using `<Text>`, `<RichText>`, `<Image>` wrapper components. The CMS extracts content from those wrappers. Verdict — requires developer-authored wrapper instrumentation; does not work on arbitrary hardcoded TSX.

**Lovable / Bolt themselves:** Lovable's "cross-project referencing" allows copying patterns across projects; Bolt has "team templates" (fork-and-fill, not data-driven). Neither has a native mechanism for a non-developer to edit content without going through the AI chat or re-running the code generator.

**Conclusion from survey:** No tool automatically extracts editable fields from an arbitrary React project. All solutions require one of: (a) developer instrumentation before import, (b) a data-driven convention the project must follow, or (c) accepting the project as opaque (no content editing).

---

### The Four Editability Approaches (concrete analysis)

#### Approach 1: Register-as-Opaque ("no editing — deploy as-is, swap brand globals only")

The project is built (`vite build`) as-is and the `dist/` folder is stored and served. The only "editing" available is swapping CSS custom properties (the `--primary`, `--secondary`, etc. color tokens) via workspace brand config. Content editing is not supported.

- **What users get:** a faithful pixel-perfect copy of the Lovable design, served/previewed/exported, with brand color injection
- **What users do NOT get:** ability to change titles, body text, itinerary days, WhatsApp number, images without a developer
- **Complexity:** LOW (build + store dist; inject brand CSS vars at serve time via `<style>` prepend)
- **When appropriate:** projects where the visual design is the template value, content is already campaign-specific and was correctly set by the developer who submitted the project, and "new LPs" means "new campaigns with new builds" not "same build, different content"
- **Assessment for PageForge v2.0:** Appropriate as the **baseline** (guaranteed delivery) but insufficient as the sole offering — the user still needs a developer to create each campaign LP from scratch

#### Approach 2: Data File Convention ("campaigns.ts becomes the form")

Require the imported project to follow a convention: all campaign-specific content lives in one or more data files (e.g., `src/data/campaign.ts` with a typed object). PageForge parses that data file, generates a form from its shape (similar to the existing token schema approach), lets the marketer fill the form, patches the data file with the new values, rebuilds the project.

- **What users get:** a form-driven experience identical to v1.0 (fill form → get output), but for a React project
- **What developers must do:** export the project with content in a data file, not hardcoded in components
- **Complexity:** MEDIUM (file patching at build time; TypeScript type inference to derive form schema; rebuild pipeline)
- **Assessment:** This is the **right long-term direction** but requires the Lovable project to be structured this way. The reference project (`renova-turismo-jornada-main`) is **not** structured this way — `campaigns.ts` exists but campaign pages don't consume it. A migration/refactoring of the source project would be needed.

#### Approach 3: AST-Based Content Extraction ("auto-tokenize the code")

Use a Babel/TypeScript AST parser to scan the uploaded project's TSX files, extract JSX string literals annotated with `// EDITAR:` comments or matching patterns, and derive a schema. The marketer fills a form; PageForge patches the AST and rebuilds.

- **What users get:** automatic extraction of editable fields without developer instrumentation
- **Complexity:** HIGH — AST parsing of TSX is complex; distinguishing "editable content" from "structural code" requires heuristics or annotation; JSX has multiple content forms (string children, template literals, array literals like `const items = [...]`); image imports are module references not strings
- **Reliability:** LOW for untrusted/arbitrary projects — fragile heuristics, breaks when project structure changes
- **Assessment:** The `// EDITAR:` comment convention in the reference project is promising as an annotation scheme (it already exists as a dev habit), but full auto-extraction is v3+ scope. For v2.0, it's an anti-feature — the complexity vs. reliability tradeoff is unfavorable.

#### Approach 4: Developer-Authored Content Manifest ("the smart middle ground")

Require the developer who registers the project to provide a companion manifest (a JSON or TypeScript file, e.g., `pageforge.config.ts`) that declares which variables/strings are editable and their types. PageForge uses this manifest to generate the form; patching and rebuild follow the data-file convention. This is the "opt-in instrumentation" pattern that Builder.io, Plasmic, Framer, and ReactBricks all converged on — they just built proprietary wrappers; PageForge uses a config file.

Example manifest:
```ts
export default {
  fields: [
    { key: "hero.title", label: "Hero Title", type: "text", source: "src/components/campaigns/template/Hero.tsx", line: 15 },
    { key: "hero.subtitle", label: "Subtitle", type: "text", source: "...", line: 13 },
    { key: "whatsapp", label: "WhatsApp Number", type: "text", source: "src/components/campaigns/template/InscrevaSe.tsx", line: 6 },
    { key: "hero.image", label: "Hero Image", type: "image", source: "src/components/campaigns/template/Hero.tsx", line: 7 },
    { key: "roteiro.slides", label: "Itinerary Slides", type: "repeater", itemSchema: [...], source: "src/components/campaigns/template/Roteiro.tsx", line: 37 },
  ]
}
```

- **What users get:** form experience identical to v1.0; form schema is explicit and reliable
- **What developers must do:** author the manifest once when registering the project (guided by a CLI or UI scaffold)
- **Complexity:** MEDIUM (manifest validation, file patching by key→source location, rebuild)
- **Assessment:** The **recommended approach for v2.0** — it follows the same pattern established by every comparable tool, requires developer work only once per template project, and is reliable because it is explicit not inferred.

---

### Preview and Export Model for React/Vite Projects (vs. v1.0 HTML model)

**v1.0 model:** LiquidJS render → HTML string → `srcdoc` iframe. Preview = export. Pure server-side, no build step.

**v2.0 model differences:**

1. **Build required:** `vite build` must run server-side after content patching. This takes 10–60 seconds for a project of this size (React + shadcn + Tailwind). This is not a real-time operation like LiquidJS render.
2. **Output is a dist folder, not a string:** `dist/` contains `index.html` + JS chunks + CSS + static assets. This is a folder, not a self-contained HTML file.
3. **Preview delivery options:**
   - Serve the `dist/` folder from a path on the PageForge server (e.g., `/preview/{lp-id}/`) and embed in an iframe — straightforward but requires a static file serving route per LP
   - Store `dist/` in object storage (S3/R2) with a preview URL — cleaner for production, adds complexity
   - For the EDIT/REGENERATE flow: rebuild triggers an async job; the user gets a "building..." state with a progress indicator (required — this is a UX table-stakes item for build-based preview)
4. **Export:** ZIP of the `dist/` folder (or just `dist/index.html` + assets). This is already a complete static site — simpler than v1.0's "inline assets" because Vite bundles them. The `archiver` streaming ZIP approach from v1.0 stack applies here too.
5. **Cross-origin iframe security:** `dist/` served from a different origin (or same origin subdirectory) can be iframed. The project has no `X-Frame-Options` restrictions (it's a plain Vite SPA). CSP `frame-ancestors` should be set explicitly to the PageForge origin. The existing v1.0 iframe preview infrastructure can be reused if the dist is served from the same origin.

---

### Build Pipeline Security (new risk vs. v1.0)

**v1.0 deliberately avoided JS execution in templates** (LiquidJS, no eval, no FS). v2.0 accepting user-supplied React projects runs `npm install` and `vite build` on untrusted code — a materially different threat model.

**Risks:**
- Malicious `package.json` with supply-chain-compromised deps or postinstall hooks
- Build scripts that exfiltrate environment variables
- Infinite loops / resource exhaustion in build

**Required mitigations (not optional for v2.0):**
- Run `npm install` + `vite build` in an isolated container (Docker) with no network access after package download, no access to host secrets, CPU/memory limits, and a build timeout
- Pin Node and package versions; use `--ignore-scripts` or a lock-file-only install
- Treat the submitted project as untrusted code — same model as GitHub Actions sandboxed runners or CodeSandbox VM sandboxes
- Audit `package.json` dependencies before build (lightweight allowlist or blocklist of known-dangerous packages)

This is the **highest new security risk in v2.0** and was deliberately avoided in v1.0. It must be addressed in the architecture design before any build pipeline feature is scoped.

---

## v2.0 Feature Table

### Table Stakes for v2.0 (Users Expect These)

| Feature | Why Expected | Complexity | Dependency on v1.0 | Notes |
|---------|--------------|------------|---------------------|-------|
| ZIP/folder upload of a Lovable project | The ingestion UX — users have a downloaded project folder | MEDIUM | Catalog, Storage | Accept `.zip`; unzip server-side to a temp workspace. The primary ingestion method. Git URL is a v2.x enhancement. |
| Project validation on upload | User needs to know if the project is valid (has `package.json`, `vite.config.ts`, src files) | LOW | — | Validate before storing. Reject obvious non-Vite projects early. |
| Content manifest authoring UI (or guided CLI) | Without this, developers can't declare editable fields | MEDIUM | Template authoring | Provide a scaffold tool or in-app editor for `pageforge.config.ts`. This is the "register fields" step. Without it, v2.0 has zero editability. |
| Form generated from manifest fields (text, image, repeater) | Same core UX as v1.0 — fill a form, get a campaign LP | MEDIUM | Dynamic form (v1.0) | Reuse the v1.0 form rendering infrastructure; manifest schema maps to the same field types. |
| Async build pipeline (patch content → `vite build` → dist) | The mechanism that actually produces the output | HIGH | — | Sandboxed container, async job with status feedback. The hardest new infrastructure piece. |
| Build status / progress indicator | Users must know the build is running (10–60 sec) | LOW | — | "Building your LP…" state with spinner/progress. Required UX for async builds. |
| Serve/preview built dist folder | Users need to see the rendered output | MEDIUM | Preview (v1.0 iframe) | Serve the dist from a static file path or object storage. Embed in iframe in the PageForge UI. |
| Export as ZIP of dist folder | The v2.0 delivery mechanism | LOW | Export (v1.0 ZIP) | `archiver` ZIP of the `dist/` folder. Simpler than v1.0's HTML+asset bundling because Vite already bundles. |
| LP record in catalog (same catalog as v1.0) | Users expect all LPs in one place, regardless of template type | LOW | Catalog (v1.0) | Store a `templateType: "lovable"` discriminator. The catalog UI must render both types without special-casing. |
| Template type indicator in catalog/template UI | Users need to distinguish Liquid templates from React project templates | LOW | Catalog (v1.0) | A badge or icon is sufficient. |
| Brand CSS variable injection | The one "free" editability that requires zero manifest work | LOW | Brand config (v1.0) | Prepend a `<style>` block to the generated `index.html` setting `--primary`, `--secondary`, etc. from workspace brand config. Maps directly to the Tailwind CSS variable convention already in the reference project. |
| Re-edit and regenerate LP | Campaign content revisions are standard | MEDIUM | Edit/regenerate (v1.0) | Store the manifest field values; re-patch and rebuild on save. Same data model as v1.0 (values → artifact). |
| Duplicate a React-project LP | Variations (same template, different destination, different dates) | LOW | Duplicate (v1.0) | Deep-copy stored field values into a new LP record. Rebuild async. |
| Sandboxed build execution | Security baseline — user code must not touch host secrets or escape | HIGH | — | Isolated container/VM per build. Non-negotiable. This gates the entire v2.0 scope. |

### Differentiators for v2.0

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Coexistence of Liquid templates and React project templates in one catalog | Agencies can mix template types without switching tools | LOW (schema/model) | The key UX differentiator vs. forcing a hard v2.0 cutover. Agencies using the Grécia Liquid template continue unaffected. |
| Manifest-driven editability (same form UX as v1.0) | Non-developer fills a form and gets a new campaign LP from a Lovable design — the v1.0 promise extended to coded projects | MEDIUM | This is the product extension that no comparable tool offers without a heavy proprietary SDK. The manifest convention is lightweight by comparison. |
| Brand CSS variable injection across both template types | Change the workspace brand color/logo once → applies to all LP types | LOW | The Lovable project already uses CSS custom properties (`hsl(var(--primary))`). This is a near-free win. |
| WhatsApp number as a first-class brand field (for the travel/tourism segment) | Travel agencies change WhatsApp numbers per campaign or per consultant — this is a pain point in the reference project | LOW | The reference project has hardcoded WhatsApp URLs in 5+ places. A `brand.whatsapp` field that patches all occurrences via manifest is immediately valuable. |
| "Template guide" from `// EDITAR:` comments | Scaffold the manifest automatically from developer-placed `// EDITAR:` comment annotations | MEDIUM | A developer-experience feature: parse `// EDITAR:` comments in the uploaded project to suggest manifest fields. Reduces manifest authoring effort. NOT a full auto-extraction (which is unreliable); suggestions that the developer confirms/edits. |

### Anti-Features for v2.0

| Feature | Why Requested | Why It's an Anti-Feature for v2.0 | Alternative |
|---------|---------------|-----------------------------------|-------------|
| Automatic content extraction without manifest (full AST auto-tokenization) | "Just read the code and make it editable" | AST parsing of arbitrary TSX to reliably distinguish "editable content" from "structural code" is unreliable and brittle. The reference project alone has at least 4 content forms: JSX children, template literals, module-level const arrays, and import paths. Heuristics break when Lovable changes code patterns. | Manifest convention with `// EDITAR:` suggestion scaffold as a developer assist |
| On-canvas visual editing of the React SPA | "Like Framer or Webflow" | Requires either (a) running the SPA in an editable mode (postMessage bridge between editor and iframe app, instrumented components) — a massive SDK surface — or (b) a proxy-based DOM editor (Grapes.js/Pintura pattern) which breaks React event handling and is unreliable on SPAs. Framer/Builder.io build entire platforms on this; it is not a v2.0 feature. | Form-driven editing from the manifest (same UX as v1.0) |
| Git URL ingestion as primary ingestion path | "More professional than ZIP upload" | Requires GitHub OAuth, webhook infrastructure, and branch management. Adds significant auth surface for a workflow that ZIP upload covers perfectly for the target user (Lovable already exports as ZIP). | ZIP upload for v2.0; git URL for v2.x after ZIP is validated |
| Real-time preview (preview updates as you type) | "Instant feedback" | Real-time preview requires hot-module replacement or a live Vite dev server running per LP — a server resource nightmare for a multi-tenant SaaS. vite build is a batch operation. | Async build with progress indicator; "Preview" button triggers rebuild |
| Inline editing on the preview iframe (click text in preview → edit) | "Like Contentful live preview or Sanity studio" | Requires postMessage communication between PageForge and the SPA iframe, plus instrumented components. The reference project is not instrumented. This is essentially rebuilding what Builder.io's SDK does. | Sidebar form editing (same v1.0 UX pattern); preview updates after rebuild |
| Hosting Lovable LPs on a public URL | "Let me share the LP with the client" | v1.0 deferred hosting for the same reason: DNS, SSL, CDN, abuse, uptime. This does not become simpler for React projects (it becomes more complex because dist must be served, not just a file). | Export ZIP and host externally; hosting = future milestone |
| npm/package modifications by the marketer | "Let me add a library" | User-supplied package.json changes in an untrusted build pipeline dramatically expand the attack surface | Developers modify the project source; marketers only fill the form |
| Supporting non-Vite React projects (CRA, Next.js, Remix) | "My project uses Next.js" | Each bundler has a different build command, output structure, and routing model. Supporting multiple bundlers multiplies the build pipeline complexity. | v2.0 scopes to Vite only (Lovable exports are Vite); other bundlers = v2.x |

---

## Feature Dependencies for v2.0

```
Sandboxed build execution  [PREREQUISITE — gates all v2.0]
    └──required by──> Async build pipeline (patch + vite build)
                          └──required by──> Preview of built dist
                          └──required by──> Export ZIP of dist
                          └──required by──> Regenerate LP after edit

Content manifest (pageforge.config.ts)
    └──required by──> Form generation from manifest fields
                          └──required by──> LP creation from form values
                          └──required by──> Content patching before build
                          └──required by──> Re-edit / regenerate flow

ZIP upload + project validation
    └──required by──> Content manifest authoring UI (manifest references project files)
    └──required by──> Any build pipeline (need source files)

Brand CSS variable injection
    └──enhances──> Preview (apply brand before serving dist)
    └──enhances──> Export (brand vars baked into dist HTML)

v1.0 Catalog + LP record model
    └──extended by──> v2.0 LP records (templateType discriminator)

v1.0 Dynamic form (React Hook Form + Zod)
    └──reused by──> Manifest-driven form (same field types: text, image, repeater)

v1.0 Image upload + storage
    └──reused by──> Image fields in manifest (presigned upload, same pipeline)

v1.0 Export ZIP (archiver)
    └──reused by──> Export dist ZIP (same archiver, different source folder)
```

### Dependency Notes

- **Sandboxed build is the hard gate:** No build pipeline feature can be scoped until the sandboxed execution environment is designed and validated. This should be the first architecture decision of v2.0, not an implementation detail.
- **Manifest is the editability enabler:** Without a manifest, the only editable surface is brand CSS variables. The manifest unlocks the full form-driven experience. A phase that delivers build pipeline but defers manifests delivers half the value.
- **v1.0 infrastructure is heavily reused:** form rendering, image upload, ZIP export, catalog, RBAC, and brand config are all reused without modification. v2.0 is primarily new build pipeline + new ingestion + manifest convention on top of v1.0.
- **Register-as-Opaque first:** Deliver the build pipeline and preview before manifests. This gives teams a working end-to-end path (opaque LP from uploaded project) that they can use while manifest tooling is built.

---

## MVP Definition for v2.0

### Launch With (v2.0 milestone)

- [ ] Sandboxed build execution environment (Docker container, isolated, timeout, resource limits) — gates everything
- [ ] ZIP upload + project validation (package.json, vite.config.ts, src/ presence) — ingestion
- [ ] Opaque LP from build (no manifest, no content editing) — baseline delivery; proves pipeline works
- [ ] Brand CSS variable injection into built dist — "free" editability for color/logo theming
- [ ] Async build job with status/progress UI — required UX for 10–60s builds
- [ ] Serve/preview built dist in iframe — preview
- [ ] Export ZIP of dist folder — delivery
- [ ] LP record in catalog with templateType discriminator — catalog coexistence
- [ ] Content manifest authoring UI (scaffold from `// EDITAR:` comments, edit/confirm fields) — editability
- [ ] Manifest-driven form (reusing v1.0 form infrastructure) with text, image, and repeater field support
- [ ] Content patching + rebuild on form submit — connects form to build pipeline
- [ ] Re-edit and regenerate LP from stored field values — campaign revision
- [ ] Duplicate LP — variations
- [ ] WhatsApp field as a standard brand config field (patch all occurrences via manifest) — immediate travel-segment value

### Add After Validation (v2.x)

- [ ] Git URL ingestion (GitHub OAuth, clone, branch select) — trigger: users complain ZIP upload is inconvenient for actively developed projects
- [ ] `// EDITAR:` auto-suggestion improvements (richer AST heuristics) — trigger: developer feedback on manifest authoring friction
- [ ] Build caching (skip rebuild if source + values unchanged) — trigger: rebuild latency complaints
- [ ] Support for additional Vite-based frameworks (SvelteKit, Vue + Vite) — trigger: non-React Lovable alternatives gain adoption
- [ ] Hosting / public preview URL for React project LPs — trigger: hosting milestone (same dependency as v1.0 hosting)

### Future Consideration (v3+)

- [ ] On-canvas visual editing for React SPAs — requires instrumentation SDK; massive surface
- [ ] Full AST auto-tokenization (no manifest needed) — requires reliable heuristics across arbitrary projects
- [ ] Support for non-Vite bundlers (Next.js, CRA, Remix)

---

## Feature Prioritization Matrix (v2.0 only)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Sandboxed build execution | HIGH | HIGH | P1 (gate) |
| ZIP upload + validation | HIGH | LOW | P1 |
| Opaque LP from build (no manifest) | HIGH | MEDIUM | P1 |
| Brand CSS variable injection | HIGH | LOW | P1 |
| Async build job + progress UI | HIGH | MEDIUM | P1 |
| Preview of built dist in iframe | HIGH | MEDIUM | P1 |
| Export ZIP of dist | HIGH | LOW | P1 |
| Catalog coexistence (templateType) | HIGH | LOW | P1 |
| Content manifest authoring UI | HIGH | MEDIUM | P1 |
| Manifest-driven form | HIGH | MEDIUM | P1 (reuses v1.0) |
| Content patching + rebuild | HIGH | HIGH | P1 |
| Re-edit / regenerate | HIGH | MEDIUM | P1 |
| WhatsApp as brand field | MEDIUM | LOW | P1 |
| Duplicate LP | MEDIUM | LOW | P1 |
| Git URL ingestion | MEDIUM | HIGH | P2 |
| Build caching | MEDIUM | MEDIUM | P2 |
| `// EDITAR:` auto-suggestion | LOW | MEDIUM | P2 |
| On-canvas visual editing | HIGH | VERY HIGH | P3 |
| Non-Vite bundler support | MEDIUM | HIGH | P3 |
| Hosting / public URL | HIGH | HIGH | P3 |

**Priority key:** P1 = must have for v2.0 launch · P2 = add when possible · P3 = future milestone

---

## Competitor Feature Analysis (v2.0 context)

| Capability | Webflow | Framer | Builder.io | Plasmic | ReactBricks | PageForge v2.0 |
|------------|---------|--------|------------|---------|-------------|----------------|
| Import arbitrary React project | No (wishlist) | No (own editor only) | No (requires SDK registration) | No (confirmed unsupported) | No (requires wrapper components) | Yes (ZIP upload) |
| Edit content without developer per LP | Yes (canvas) | Yes (on-page edit) | Yes (visual editor on registered components) | Yes (content mode) | Yes (inline edit on instrumented bricks) | Yes (manifest-driven form) |
| Edit requires developer one-time setup | No (built in their tool) | No | Yes (register components) | Yes (register components) | Yes (wrap with RichText/Text components) | Yes (author manifest once per template project) |
| Non-developer autonomy after setup | Full canvas | Full on-page | Full visual editor | Content-only mode | Inline edit within brick constraints | Form-fill only (no canvas) |
| Layout fidelity guarantee | Low (free canvas) | Low (free canvas) | Medium | Medium | High (brick-bound) | High (form-bound, same as v1.0) |
| Static export quality | Weak (noted industry complaint) | Good | Headless API | Headless API | Headless | Strong (Vite-built dist) |
| Multi-tenant SaaS architecture | Yes | No | No | No | No | Yes (workspace isolation from v1.0) |
| Build pipeline security | N/A (they author code) | N/A | N/A | N/A | N/A | Required (user-submitted code) — sandboxed container |

---

## Sources

- Direct inspection of `renova-turismo-jornada-main/` source (pages, components, tailwind.config.ts, vite.config.ts, campaigns.ts) — HIGH confidence
- Webflow import capability: community forum (discourse.webflow.com) + wishlist.webflow.com — confirmed unsupported — MEDIUM confidence
- Framer on-page editing: framer.com/updates/on-page-editing, framer.com/help/articles/on-page-editing — HIGH confidence (official)
- Framer Code Components (addPropertyControls): framer.com/developers/components-introduction — HIGH confidence (official)
- Builder.io registered components: builder.io/c/docs/devtools-manual-react, forum.builder.io — MEDIUM confidence
- Plasmic code components registration: docs.plasmic.app/learn/registering-code-components — HIGH confidence (official); "import React app" unsupported: forum.plasmic.app/t/how-to-import-a-react-app-into-plasmic — MEDIUM confidence (forum confirmation)
- ReactBricks inline editing model: reactbricks.com/features/visual-editing-cms, docs.reactbricks.com/bricks/introduction — HIGH confidence (official)
- Lovable export as ZIP, project structure: rapidevelopers.com, vibecodingwithfred.com, braingrid.ai — MEDIUM confidence (third-party guides, consistent)
- Bolt team templates: bolt.new/blog/introducing-team-templates-on-bolt — HIGH confidence (official)
- Vite build → dist folder, static deploy: vite.dev/guide/static-deploy — HIGH confidence (official)
- iframe sandbox + CSP origin security: MDN Web Docs (developer.mozilla.org) — HIGH confidence (authoritative)
- npm supply-chain attack postinstall hooks: dev.to/fathulands — MEDIUM confidence; consistent with documented 2024-2025 incidents
- AST-based JSX content extraction: jsx-ast-utils npm, Babel parse/JSX, eslint-plugin-react-i18n-extractor — MEDIUM confidence (technical feasibility confirmed; reliability for arbitrary projects LOW)

---
*Feature research for: template-based LP generator SaaS — v2.0 Lovable/React project template support*
*Researched: 2026-06-17*
