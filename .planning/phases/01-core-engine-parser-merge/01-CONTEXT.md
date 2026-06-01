# Phase 1: Core Engine (Parser + Merge) - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

UI-less spike that proves the highest-risk component of PageForge: `parse(markup) → Schema`
and `render(markup, values, brand) → static HTML`, working correctly and **safely** against
the real reference travel landing page, with **zero UI**.

In scope:
- A token grammar (token type annotation, repeater blocks, global/brand tokens).
- A parser that emits a typed schema detecting all six field types (text, rich text, image,
  color, button+URL, repeater), repeater blocks, and global tokens.
- A merge/render engine that produces layout-faithful static HTML, iterating repeaters for
  0/1/N items, with context-aware escaping and rich-text sanitization.
- A test corpus proving SSTI/XSS payloads render inert.
- Deriving a tokenized fixture from the real reference LP and using it as the golden file.

Out of scope (other phases): any UI/dashboard, persistence, multi-tenancy/auth (Phase 2),
template authoring UI + brand config UI (Phase 3), the dynamic form, image upload, preview UI,
export/ZIP bundle, catalog (Phases 4–5). Engine work here is pure library + tests.
</domain>

<decisions>
## Implementation Decisions

### Token Grammar — Type Declaration
- **D-01:** Token type is declared via **inline annotation** — the type lives in the token itself,
  not by naming convention or a separate declaration block.
- **D-02:** Annotation format is a **colon suffix**: `{{ hero_title:text }}`, `{{ hero_img:image }}`,
  `{{ cor_destaque:color }}`. This is a custom micro-grammar that is **engine-agnostic** — the
  parser interprets/strips the annotation before handing anything to the rendering backend. This
  keeps the grammar independent of the still-open engine decision (D-08).
- **D-03:** Six field types: `text`, `richtext`, `image`, `color`, `button` (button+URL), and
  `repeater` (block-level, see D-05). Final keyword spelling is a planner detail; intent is fixed.
- **D-04:** Unknown/missing type behavior: a token with **no** type annotation (`{{ foo }}`) defaults
  to `text` and emits a **parse warning**; a token with an **unknown** type (`{{ foo:banana }}`)
  degrades to `text` **with a warning**. Tolerant parsing, never a hard crash. (Aligns with the
  "parse warnings" expectation already noted for Phase 3.)
- **D-05:** Emitted schema per token is **minimal** for this phase: token name, detected type, and
  which repeater/global it belongs to. Label defaults to the token name. Rich per-field metadata
  (label, required, default, ordering) is **deferred to Phase 3** (authoring).

### Repeaters and Global/Brand Tokens
- **D-06:** Repeatable blocks are delimited by **HTML-comment markers**:
  `<!-- repeat:itinerary --> ... <!-- /repeat:itinerary -->`. This keeps the source HTML valid,
  lets an author simply *wrap* an existing block of cards, and stays engine-agnostic — the parser
  compiles the loop to whatever rendering backend is chosen.
- **D-07:** Tokens **inside** a repeater use **implicit item scope** — the author writes just
  `{{ day_title:text }}`; the parser binds it to the current item of the enclosing repeater. No
  dotted `repeater.field` reference needed inside the block.
- **D-08 (constraint):** Repeaters are **flat only** in v1 (no nested repeaters). The reference LP
  needs no nesting. Nested repeaters are deferred.
- **D-09:** Global/brand tokens use a **reserved namespace prefix**: `{{ brand.logo:image }}`,
  `{{ brand.whatsapp:text }}`, `{{ brand.primary_color:color }}` resolve from the workspace brand
  config; any non-`brand.` token is a per-LP field. The distinction is visible at a glance, no
  extra declaration. (Brand config itself is Phase 3; here the engine only needs to **resolve**
  brand values passed into `render`.)

### Engine Decision (KEY DECISION GATE)
- **D-10 (DEFERRED — research mandate):** The LiquidJS vs. logic-less-substitution choice is
  **explicitly handed to the researcher** (`gsd-phase-researcher`). The researcher MUST benchmark
  **both** candidate backends against the **same SSTI/XSS payload corpus** (D-14) and recommend one;
  the user approves the choice at plan time. Because the grammar (D-01..D-09) is engine-agnostic and
  the parser owns the grammar + security model, the rendering backend is an **adapter detail** and
  swapping it later is cheap. This resolves the long-standing open gate from STATE.md / PROJECT.md.
  - LiquidJS path: parser compiles our markup to Liquid (strip `:type`, convert comment-repeaters to
    `{% for %}`), reuse Liquid's safe iteration + escaping.
  - Logic-less path: parser builds our own AST and substitutes values directly with context-aware
    escaping; no engine dependency; pure substitution (no `eval`) is safe by construction.
- **D-11:** Rich-text sanitization allowlist is **basic formatting only**: `p`, `strong`, `em`,
  `ul`/`ol`/`li`, `a` (href restricted to `http`/`https`/`mailto`), `br`. Explicitly **no**
  `script`/`style`/`on*` handlers/`iframe`. Server-side sanitization (e.g. `sanitize-html`) per
  CLAUDE.md. Final exact tag list can be tightened during planning but starts strict.
- **D-12 (constraint):** Escaping MUST be **context-aware** (HTML text vs. attribute vs. URL vs.
  color), per success criterion 4. This is a hard requirement on whichever backend wins.

### Fixture and Proof (UI-less)
- **D-13:** The reference LP source is the **React/Vite/shadcn/Tailwind SPA** at
  `renova-turismo-jornada-main/` (Lovable-generated). It contains **multiple campaign variants**;
  the acceptance anchor "Grécia" is one of them (`src/assets/grecia/...`). The fixture targets the
  **full Grécia landing page** (hero → sobre → roteiro → inclusos → diferenciais → depoimentos →
  CTA → footer) so it exercises all six field types and multiple repeaters at once.
- **D-14:** Tokenized fixture derivation: **render the Grécia route → capture the rendered HTML
  snapshot** (the project already has Playwright configured) **+ the compiled Tailwind CSS**, then
  tokenize — replace dynamic content with `:type` tokens and wrap the `.map()` sections in
  `<!-- repeat -->` blocks. The golden file is the **real rendered page**, maximizing layout fidelity.
- **D-15:** Proof is **automated via Vitest** (matches CLAUDE.md): (a) golden-file/snapshot of the
  rendered HTML, verifying repeaters iterate for **0, 1, and N** items; (b) explicit **schema
  assertions** (all six types detected, repeaters detected, globals detected); (c) an **SSTI/XSS
  payload corpus** proving inert output. Covers all four success criteria directly.
- **D-16:** Security corpus scope is **comprehensive**: roadmap-listed payloads
  (`{{constructor.constructor('return 1')()}}`, `{{__proto__}}`), per-field XSS
  (`"><img src=x onerror=...>`, `javascript:`, malformed color/URL), **and** prototype-pollution /
  polyglot payloads. Every one of the six field types is fuzzed.

### Claude's Discretion
- Exact keyword spelling for the six types and the precise rich-text tag list (start strict).
- Internal AST / schema data-structure shape, file/module layout, and the parser-to-engine adapter
  interface.
- How non-content head material in the snapshot (gtag, JSON-LD, meta/OG tags, favicon) is handled
  during tokenization (keep static vs. tokenize a subset) — a fixture-prep detail.
- How Vite `@/assets/...` image imports map to static `src` paths in the tokenized fixture (image
  upload/export is Phase 4; here image fields can stay as references/paths).
- Which campaign variant's components are canonical if the Grécia route reuses the shared
  `src/components/landing/*` structure.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 1: Core Engine (Parser + Merge)" — goal, 4 success criteria, and
  the KEY DECISION GATE wording.
- `.planning/REQUIREMENTS.md` — TPL-02 (parse→schema), TPL-04 (repeaters), GEN-05 (merge to static
  HTML), GEN-06 (sanitization/XSS-free); plus the "Acceptance Anchor" (Grécia end-to-end).
- `.planning/PROJECT.md` §"Key Decisions" — markup-with-tokens authoring, repeater in v1, static
  generation, brand globals.
- `.planning/STATE.md` §"Blockers/Concerns" — the unresolved engine choice now resolved as a
  research mandate (D-10).

### Tech stack & security guidance
- `CLAUDE.md` — recommended stack (LiquidJS, Zod, sanitize-html), the "Templating / Token Pipeline"
  notes, the "What NOT to Use" SSTI/XSS guidance, and the engine alternatives table. The engine
  recommendation (LiquidJS) is **input to**, not a substitute for, the D-10 research benchmark.

### Reference LP fixture (the real artifact)
- `renova-turismo-jornada-main/` — the Lovable React/Vite/Tailwind SPA that is the source of truth
  for the Grécia template.
  - `renova-turismo-jornada-main/src/components/landing/` — block components: `Hero.tsx`,
    `SobreViagem.tsx`, `Roteiro.tsx` (itinerary repeater), `Inclusos.tsx` (repeater),
    `PorQueRenova.tsx`, `Depoimentos.tsx`, `InscrevaSe.tsx` (CTA), `Footer.tsx`, `Navbar.tsx`.
  - `renova-turismo-jornada-main/src/data/campaigns.ts` — campaign variants incl. Grécia.
  - `renova-turismo-jornada-main/index.html`, `tailwind.config.ts`, `playwright.config.ts`,
    `vitest.config.ts` — build/render/test entry points used for snapshot derivation (D-14).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Reference LP project (`renova-turismo-jornada-main/`)** ships Playwright (`playwright.config.ts`)
  and Vitest (`vitest.config.ts`) already configured — usable to render the Grécia route and capture
  the HTML/CSS snapshot for the fixture (D-14).
- The repeater pattern already exists in the source as inline `array.map()` blocks
  (e.g. `cities.map(...)` in `Roteiro.tsx`) — these map 1:1 onto our `<!-- repeat -->` grammar and
  define exactly which content is per-item vs. static.

### Established Patterns
- This is a **greenfield** PageForge repo — only `CLAUDE.md` and `.planning/` exist; no app code,
  no codebase maps. The engine library + tests are net-new; no existing patterns constrain them.
- The recommended stack (Next.js 16 / TS / Prisma / Postgres / LiquidJS / Zod) is documented in
  `CLAUDE.md` but **not yet installed**. Phase 1 needs only the engine + test slice — keep the
  dependency surface minimal (engine candidate(s), Zod for schema validation, sanitize-html, Vitest).

### Integration Points
- The engine's public surface is two pure functions — `parse(markup) → Schema` and
  `render(markup, values, brand) → static HTML` — designed to be imported later by Phase 3
  (authoring persists parsed schema) and Phase 4 (form values merge; preview == export).
- `brand` is an input parameter to `render` here; the brand **config UI/persistence** is Phase 3.

</code_context>

<specifics>
## Specific Ideas

- The fixture must be the **real rendered Grécia page**, not a hand-built stand-in — fidelity to the
  actual Tailwind-compiled markup is the point (D-13, D-14).
- Grammar must be **engine-agnostic on purpose** so the D-10 engine benchmark can swap backends
  without touching template authors' markup.
- "Tolerant parser, strict renderer": parsing degrades gracefully with warnings (D-04), while
  rendering is uncompromising on escaping/sanitization (D-11, D-12, D-16).

</specifics>

<deferred>
## Deferred Ideas

- **Nested repeaters** — flat only in v1 (D-08); revisit if a future template needs nesting.
- **Rich per-field schema metadata** (label, required, default, ordering) — Phase 3 (authoring).
- **Image upload / asset handling / Vite asset-path rewriting for export** — Phase 4.
- **Brand config authoring & persistence** — Phase 3 (engine here only consumes a `brand` input).
- **Extended rich-text allowlist** (headings, blockquote, inline images, colored spans) — considered
  and rejected for v1 (D-11); could revisit when authors need richer content.
- **Campaign-variant / multi-route handling** — the reference SPA has many campaigns; Phase 1 uses
  only the Grécia landing as fixture.

None of the above blocks Phase 1.

</deferred>

---

*Phase: 1-Core Engine (Parser + Merge)*
*Context gathered: 2026-06-01*
