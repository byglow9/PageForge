# Pitfalls Research

**Domain:** Multi-tenant template-driven landing page generator (token markup + dynamic schema + static HTML export)
**Researched:** 2026-06-01
**Confidence:** HIGH (security pitfalls verified against OWASP, PortSwigger, published CVEs/advisories; some domain-specific rendering pitfalls MEDIUM, from framework issue trackers + reasoned analysis)

> The single biggest architectural risk in PageForge is treating **user-authored template markup** as if it were trusted developer code. The whole product is "users paste markup with tokens, we merge data and render/export HTML." That is, by definition, executing untrusted markup. Most critical pitfalls below stem from this. The second biggest is silent multi-tenant leakage. Both must be designed for from Phase 1 — they cannot be retrofitted cheaply.

## Critical Pitfalls

### Pitfall 1: Server-Side Template Injection (SSTI) → RCE via the token engine

**What goes wrong:**
PageForge lets workspace users author "markup with tokens (`{{token}}`)." The naive implementation is to feed that markup straight into a JS template engine (Handlebars, Nunjucks, EJS, Liquid, etc.) and render it server-side. But the author's markup IS the template. A malicious (or compromised) workspace member writes template syntax that the engine evaluates — `{{#with "constructor"}}…` in Handlebars, `{{range.constructor("return process")()}}` patterns, Nunjucks `{{range.constructor(...)}}`, etc. — escaping the sandbox to reach `process`, `require`, `child_process` and achieve **remote code execution on your render server**. This is the exact class of bug behind the Shopify Handlebars email-template SSTI and the bulk of PayloadsAllTheThings/SSTI.

**Why it happens:**
The mental model is "templates are written by trusted developers." Here templates are user content. Engines like EJS/Pug/Handlebars are designed to run trusted code and are *not* security sandboxes. Developers reach for a familiar engine because it makes `{{token}}` interpolation trivial — and inherit full expression evaluation, helpers, and prototype-chain access for free.

**How to avoid:**
- **Do not use a general-purpose, code-executing template engine on user-authored markup.** Treat tokens as a closed, custom mini-language: a regex/parser that recognizes ONLY a whitelisted token grammar (`{{name}}`, `{{#repeat block}}…{{/repeat}}`, `{{brand.whatsapp}}`) and substitutes pre-escaped values. No arbitrary expressions, no helpers, no filters that evaluate code, no property-path traversal into `constructor`/`__proto__`/`prototype`.
- If you must use an existing engine, pick a **logic-less / sandboxed** mode (e.g. Mustache, or Handlebars in a hardened config with no `allowProtoPropertiesByDefault`, no `allowProtoMethodsByDefault`) and still run rendering in an isolated process (see Pitfall 4).
- Parse the markup once at template-save time into a validated AST/schema; render by walking that AST, never by re-evaluating raw strings.

**Warning signs:**
- The codebase calls `engine.compile(userMarkup)` or `new Function`/`eval`/`vm.runInNewContext` on stored markup.
- Token resolution supports dotted paths and you never blocklisted `constructor`/`__proto__`/`prototype`.
- A test where a template containing `{{constructor.constructor('return 1')()}}` returns `1` instead of literal/empty.

**Phase to address:** **Phase: Token parser / template engine (the very first build phase).** This is the engine the whole product hangs on — get the security model right before anything else consumes it.

---

### Pitfall 2: Stored XSS in the generated/exported page (the "happy-path injection")

**What goes wrong:**
Even with a safe token engine (Pitfall 1), the *values* users fill into the form land in HTML. A "texto simples" value of `"><script>…` or an image-token value of `x" onerror=alert(document.cookie)` breaks out of its context and runs script in the preview, in other workspace members' browsers, and — critically — in the **exported HTML that the agency ships to the public**. Because the output is static HTML served to end customers, an XSS here becomes a defect in the *customer's* live campaign page, not just yours.

**Why it happens:**
Token substitution does naive string replacement (`markup.replace('{{title}}', value)`) with no context-aware escaping. Worse, escaping is applied uniformly while values are inserted into different contexts: HTML text, attribute values, URLs (`href`/`src`), inline `style`, and `<script>` — each needs *different* escaping.

**How to avoid:**
- **Context-aware output encoding** per token type and per insertion context. Text tokens → HTML-entity escape. Tokens inside attributes → attribute-escape. Button/URL tokens → validate scheme allowlist (`http`, `https`, `tel`, `mailto`, `#anchor`) and reject `javascript:`/`data:`. Color tokens → validate against `#rrggbb`/named-color regex, never free text into `style`.
- Bind each token in the schema to an explicit context so the renderer knows how to escape it (a token used inside `href="{{cta}}"` must be flagged as a URL context at parse time).
- Rich-text tokens are special — see Pitfall 3.

**Warning signs:**
- Escaping is a single global `escapeHtml()` applied everywhere regardless of context.
- URL/color/image tokens accept arbitrary strings.
- No test that fills every field type with a payload (`"><img src=x onerror=…>`, `javascript:alert(1)`, `#"><svg onload=…>`) and asserts the rendered + exported HTML is inert.

**Phase to address:** **Phase: LP generation / render pipeline.** Verified by a payload-fuzz test over the field-type matrix.

---

### Pitfall 3: Unsafe rich-text → mutation XSS (mXSS) and sanitizer misconfiguration

**What goes wrong:**
The "rich text" field type lets users author HTML (bold, paragraphs, links). You must store/render real HTML, so plain escaping isn't an option — you sanitize instead. Teams reach for DOMPurify and assume "done." But sanitization has two recurring failures: (a) **misconfiguration** (allowing `style`, `<svg>`/`<math>` namespaces, `data:` URIs, or running the wrong build server-side), and (b) **mutation XSS** — the browser "fixes up" sanitized-but-malformed HTML on render, reviving a dead payload into live script. Multiple DOMPurify bypasses (namespace confusion via SVG/MathML, the 2025 regex/comment bug CVE-2025-26791, CKEditor CDATA parsing interactions) exploit exactly this serialize→reparse gap.

**Why it happens:**
- Sanitizing on the **server** with a DOM that differs from the browser's, then the browser re-parses and mutates.
- Using an outdated sanitizer version (bypasses are a continuous arms race).
- Allowing too much (custom config to "support more formatting") which reopens vectors.

**How to avoid:**
- Sanitize rich text **at save time AND re-sanitize/encode at render time** (defense in depth), using a maintained library pinned and regularly updated (DOMPurify or the emerging Sanitizer API).
- Use a **strict allowlist** of tags/attributes that matches what the WYSIWYG actually needs (`p,strong,em,a,ul,ol,li,br,h2,h3` …). No `style`, no SVG/MathML, no event handlers, no `data:`/`javascript:` URLs.
- Avoid the serialize→reparse roundtrip where possible (DOMPurify `RETURN_DOM`/`RETURN_DOM_FRAGMENT`) and keep the library current.
- In exported HTML, prefer a strict CSP `<meta>` so even a missed vector is harder to weaponize on the customer's site.

**Warning signs:**
- Rich-text HTML is stored raw and only sanitized in one place.
- Sanitizer allowlist includes `style`, `svg`, `foreignObject`, or `*` attributes.
- No dependency-update cadence for the sanitizer; version is months/years old.

**Phase to address:** **Phase: Field types (rich-text specifically).** Re-verified whenever the WYSIWYG or sanitizer is upgraded.

---

### Pitfall 4: Unsandboxed render/preview engine (no process isolation, SSRF, resource exhaustion)

**What goes wrong:**
The render step runs in your main app process with full filesystem/network/env access. Combined with any SSTI gap (Pitfall 1) or an aggressive template (huge repeater counts, deeply nested blocks), a single malicious template can read env secrets, make outbound requests (SSRF), or hang/OOM the server. If preview uses a headless browser, it's an additional SSRF/file-read surface (`file://`, internal metadata endpoints).

**Why it happens:**
Performance/simplicity — rendering inline is easiest. The isolation cost feels unjustified "because templates are from our users." (They are exactly the untrusted input.)

**How to avoid:**
- Render in an **isolated worker/process** with: no env secrets, no outbound network (or strict egress allowlist), CPU/memory/time limits, and a hard cap on output size and repeater iterations.
- If using a headless browser for preview/screenshot, disable `file://`, block private IP ranges, and run it in a locked-down container.
- Make rendering deterministic and side-effect-free (pure function of markup + values).

**Warning signs:**
- Render code can `require()` arbitrary modules or read `process.env`.
- No timeout/memory cap on rendering; a template can loop or expand unbounded.
- Preview fetches arbitrary URLs supplied via image/URL tokens server-side.

**Phase to address:** **Phase: Render/preview infrastructure.** Pairs with Pitfall 1.

---

### Pitfall 5: Multi-tenant leakage — the dropped `workspace_id` (IDOR/BOLA)

**What goes wrong:**
A query, cache read, or storage path forgets to scope by workspace, so one agency reads/edits another's templates, LPs, brand config, or uploaded images. The classic vector is IDOR: `GET /lp/{id}` or `/template/{id}` loads by primary key and checks "is the user logged in?" but not "does this object belong to the caller's workspace?" Per OWASP, every query that drops the tenant filter is a leak; trusting a client-supplied `workspace_id` is the same failure delegated to the browser.

**Why it happens:**
Tenant scoping is enforced ad hoc in each handler, so one missed `WHERE workspace_id = ?` slips through. Object IDs are sequential/guessable. The JWT/session lacks a tenant claim, so code "infers" tenant at request time and gets it wrong under concurrency.

**How to avoid:**
- Enforce isolation at a layer that can't be forgotten: **DB row-level security (RLS)** or a mandatory query scope/middleware that injects `workspace_id` from the server-side session — never from the request body/params.
- Derive tenant from the authenticated session/JWT claim, set it once per request in a request-scoped context, and have the data layer require it.
- Use non-enumerable IDs (UUID/ULID) as defense in depth, not as the primary control.
- Scope **everything**: DB rows, cache keys (tenant-prefixed), object-storage paths/prefixes for images, and exported-file storage.
- If using a connection pool, ensure session/RLS context is reset between requests (`DISCARD ALL`) to avoid connection-pool contamination / async context leaks.

**Warning signs:**
- Any data-access call takes an ID without also taking/asserting workspace context.
- Cache keys or S3 paths built without a tenant prefix.
- Authorization tests only cover "logged out" vs "logged in," not "logged in as wrong workspace."

**Phase to address:** **Phase: Auth / workspaces / data model (foundational, before any feature CRUD).** Verified by per-endpoint cross-tenant access tests.

---

### Pitfall 6: Image-upload abuse — SVG XSS, MIME spoofing, polyglots, and bombs

**What goes wrong:**
The image field accepts uploads. If SVG is allowed and later served as `image/svg+xml`, the browser treats it as a live document and runs embedded `<script>`/`onload` — **stored XSS** (well-documented across Plane, Budibase, and many advisories). If validation trusts the `Content-Type` header or the file extension, attackers spoof MIME or use double extensions (`logo.png.svg`, `img.jpg.html`) or polyglots (valid PNG + valid HTML). Decompression/pixel bombs (tiny file, gigantic decoded image) can OOM the server during any thumbnailing/processing.

**Why it happens:**
Validation is done on the header/extension (easy, spoofable) rather than content. SVG is "an image" so it's allowed. Processing libraries (ImageMagick et al.) are powerful and have their own RCE history (ImageTragick).

**How to avoid:**
- **Disallow SVG** for the image field, or if required, sanitize it as untrusted HTML and serve it with `Content-Disposition: attachment` / a sandboxed/CDN domain, never inline from the app origin.
- Validate by **magic bytes / actual decode**, not Content-Type or extension; re-encode raster images through a safe pipeline to strip embedded payloads/metadata.
- Enforce max file size, max decoded dimensions/pixels, and timeouts to stop bombs.
- Serve user images from a **separate origin/CDN** (cookieless) so even a content bypass can't ride your app's session.
- Store with tenant-scoped, non-guessable paths (ties to Pitfall 5).

**Warning signs:**
- Allowed types checked via `req.file.mimetype` or filename only.
- SVG uploads served inline from the app domain.
- No size/dimension caps; image processing runs in the main process.

**Phase to address:** **Phase: Image field / upload pipeline.**

---

### Pitfall 7: Repeater (repeatable-block) schema & rendering bugs

**What goes wrong:**
The repeater is the product's keystone (9-day itinerary, 6 cards, 3 testimonials). Common defects:
- **Schema drift:** a template's repeater block is edited (a sub-field renamed/removed/reordered) after LPs already store data against the old shape → existing LPs render with missing/misaligned fields or crash on regenerate.
- **Empty/extreme cardinality:** 0 items collapses a section's wrapper/heading awkwardly; hundreds of items blow up render time/output size (ties to Pitfall 4).
- **Nested-token escaping bugs:** escaping/context rules from Pitfalls 2–3 must apply *inside* each repeated item, and it's easy to handle them only at the top level.
- **Index/ordering bugs:** add/remove/reorder in the dynamic form doesn't map cleanly back to stored array order; duplicating an LP duplicates stale repeater shape.

**Why it happens:**
Repeaters introduce a nested, variable-length sub-schema — harder to version, validate, and render than flat tokens. Teams model the schema as loose JSON with no versioning.

**How to avoid:**
- Give templates (and their repeater sub-schemas) an explicit **version**; store each LP's data against the schema version it was authored with; define a migration/compat strategy when a template changes (or freeze the schema of templates that already have LPs).
- Validate item shape on save and on regenerate; render defensively (missing sub-field → empty, not crash).
- Define rendering contracts for **0, 1, and N (large)** items; cap N.
- Reuse the same context-aware escaping inside repeated items as everywhere else.

**Warning signs:**
- Editing a template silently changes the meaning of existing LPs' data.
- No template/schema version stored on LPs.
- Repeater render path has separate (less strict) escaping than top-level tokens.

**Phase to address:** **Phase: Repeater field type + schema versioning.** This deserves its own deliberate design slice, not a corner of "field types."

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use a full template engine (Handlebars/EJS) on user markup | Fast `{{token}}` support, helpers for free | SSTI/RCE surface; near-impossible to fully sandbox later | **Never** — build a closed token grammar instead |
| Single global `escapeHtml()` for all tokens | One function, ships fast | Breaks for URL/attr/style/script contexts → XSS | Never for URL/color/rich-text; OK only for pure-text-context tokens |
| Render inline in the app process | No infra to build | One template can read secrets / SSRF / OOM the app | Only behind a hardened token grammar AND egress lockdown; isolate ASAP |
| Per-handler `WHERE workspace_id` scoping | Easy to start | One forgotten filter = cross-tenant leak | Acceptable only with a forced data-layer scope/RLS as backstop |
| Store LP data as loose JSON, no schema version | Flexible early | Template edits silently corrupt existing LPs | MVP only if templates with existing LPs are frozen |
| Serve uploaded images from the app origin | Simple URLs | SVG/polyglot stored XSS rides app session | Never for SVG; raster OK only if re-encoded |
| Skip CSP on exported HTML | Fewer headers to reason about | A single missed XSS becomes live on customer's public page | Never — ship a strict CSP in the export template |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Template engine library | Compiling stored user markup with default (unsafe) config | Custom token parser, or logic-less/hardened engine with proto-access disabled |
| HTML sanitizer (DOMPurify/Sanitizer API) | Set-and-forget, permissive allowlist, stale version | Strict allowlist, pinned+updated, `RETURN_DOM_FRAGMENT`, re-sanitize on render |
| Object storage (S3/GCS) for images | Public bucket, app-origin domain, guessable keys | Tenant-prefixed non-guessable keys, separate cookieless CDN origin, no inline SVG |
| Image processing (ImageMagick/sharp) | Run on raw upload in main process | Validate magic bytes first, pixel/size caps, re-encode in isolated worker |
| Headless browser (preview/thumbnail) | Default config can hit `file://` and internal IPs | Disable local file access, block private ranges, sandboxed container |
| DB connection pooler (PgBouncer) | Session state/RLS context leaks across pooled requests | `DISCARD ALL` reset query; set tenant context per transaction |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded repeater expansion | Slow render, large export, OOM | Cap item count; stream/limit output size | A template/LP with thousands of items |
| Synchronous render/preview on request thread | Preview latency spikes, request timeouts | Async render workers, caching of unchanged previews | Many concurrent previews or heavy templates |
| Image processing in main process | Upload spikes stall the app, OOM on bombs | Offload to worker, enforce decoded-pixel caps | First "tiny PNG, huge dimensions" upload |
| Regenerating full HTML on every keystroke/edit | Excess CPU, jittery preview | Debounce; regenerate on explicit save/preview | Heavy editing sessions |
| N+1 queries loading LP + all repeater/brand data | Slow catalog/preview loads | Eager-load/batch by workspace | Catalog with many LPs and large schemas |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating user markup as trusted template code | SSTI → RCE on render server | Closed token grammar; isolate render process |
| Naive string-replace token substitution | Stored XSS in preview + customer's live page | Context-aware encoding per token type/context |
| Permissive/stale rich-text sanitization | mXSS bypass → stored XSS | Strict allowlist, current lib, re-sanitize, CSP |
| Header/extension-based upload validation | Polyglot/MIME-spoof stored XSS | Magic-byte validation + re-encode; block/sanitize SVG |
| Inline-served user SVG from app origin | Session-stealing stored XSS | Separate origin, `attachment` disposition, sanitize |
| Client-supplied or inferred tenant ID | Cross-tenant data access (BOLA) | Tenant from server session/JWT claim only; RLS backstop |
| `javascript:`/`data:` in button/URL/color tokens | XSS via link/style context | Scheme + format allowlists, reject others |
| Exported HTML without CSP | Missed vector goes live publicly | Strict CSP `<meta>` baked into export template |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Layout breaks with variable-length content | Long titles overflow, empty fields leave gaps, the "fidelity promise" fails | Design template CSS for min/max content; truncation/wrap rules; render-time checks for empties collapsing sections |
| Empty repeater renders a stray heading/empty section | Published LP looks broken | Conditionally render section wrappers only when items exist |
| Preview differs from exported HTML | User ships a page that looks wrong | Preview must use the *exact same* render pipeline/output as export (no separate code path) |
| Template author gets no feedback on bad markup | Mystery failures, undefined tokens render literally | Validate markup at save; surface unknown tokens/unclosed repeater blocks with clear errors |
| Schema change orphans existing LPs silently | User reopens an LP and data is gone/shifted | Warn on template edits that affect existing LPs; version + migrate |
| Brand/global value change doesn't propagate to past LPs | Stale WhatsApp/logo on regenerate vs. export | Define + communicate whether globals are snapshotted or live at generate time |

## "Looks Done But Isn't" Checklist

- [ ] **Token engine:** Renders happy path — but does `{{constructor.constructor('return 1')()}}` / `{{__proto__}}` render literally/empty (not evaluate)? Verify SSTI payloads are inert.
- [ ] **Field escaping:** Each field type works in demo — but fuzz every type with `"><img src=x onerror=…>`, `javascript:alert(1)`, malformed color/URL; assert preview AND export are inert.
- [ ] **Rich text:** WYSIWYG round-trips — but does it survive known mXSS vectors and re-sanitize at render? Is the sanitizer version current?
- [ ] **Multi-tenant:** Owner can CRUD their LPs — but can a user from workspace B load/edit workspace A's template/LP/image by ID? Test cross-tenant explicitly.
- [ ] **Image upload:** PNG/JPG upload works — but is SVG/polyglot/MIME-spoof rejected? Are images served from a safe origin? Is there a size/pixel cap?
- [ ] **Repeater:** 3 items render — but do 0 items, 1 item, and 500 items render correctly without layout breakage or OOM?
- [ ] **Export integrity:** Download produces a file — but do asset paths (images/fonts/CSS) resolve when opened locally/offline? Run a broken-link/asset checker on the export.
- [ ] **Preview == Export:** Preview looks right — but is the exported HTML byte-equivalent in render logic (same pipeline)?
- [ ] **Schema versioning:** Editing a template works — but do existing LPs built on the old schema still open and regenerate correctly?

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SSTI via real template engine | HIGH | Replace engine with closed token grammar; audit all stored markup; rotate any exposed server secrets; re-render affected LPs |
| Stored XSS in field values | MEDIUM | Patch context-aware encoding; re-render/re-export ALL existing LPs; notify customers whose live pages shipped affected HTML |
| mXSS in rich text | MEDIUM | Upgrade/reconfigure sanitizer; re-sanitize stored rich-text; re-export |
| Cross-tenant leak (IDOR) | HIGH | Add RLS/forced scoping; audit access logs for prior cross-tenant access; breach-notify if data was exposed |
| Malicious image (SVG) served inline | MEDIUM | Block/sanitize SVG, move images to isolated origin, purge CDN, re-scan stored uploads |
| Repeater schema drift corrupted LPs | MEDIUM | Introduce versioning retroactively; write migration; restore affected LP data from backups if lost |
| Broken asset paths in exports | LOW | Switch export to relative paths/bundled assets; re-generate exports |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SSTI / RCE (Pitfall 1) | Token parser / template engine (Phase 1) | SSTI payloads render inert; no `eval`/`compile` on user markup |
| Stored XSS in values (Pitfall 2) | LP generation / render pipeline | Payload-fuzz over field-type matrix → inert preview + export |
| Rich-text mXSS (Pitfall 3) | Rich-text field type | Sanitizer current + strict allowlist; mXSS test corpus |
| Unsandboxed render (Pitfall 4) | Render/preview infrastructure | Render can't read env/network; time/memory/output caps enforced |
| Multi-tenant leak (Pitfall 5) | Auth / workspaces / data model (foundational) | Cross-tenant access tests per endpoint; RLS/forced scope present |
| Image upload abuse (Pitfall 6) | Image field / upload pipeline | SVG/polyglot/MIME-spoof rejected; magic-byte + re-encode; safe origin |
| Repeater schema/render bugs (Pitfall 7) | Repeater field + schema versioning | 0/1/N render tests; template-edit-vs-existing-LP compatibility test |
| Layout breakage / export integrity | Export + template CSS phase | Variable-content layout tests; asset/link checker on every export |

## Sources

- OWASP — [Testing for Server-Side Template Injection](https://owasp.org/www-project-web-security-testing-guide/v41/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server_Side_Template_Injection); [Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) (HIGH)
- [PayloadsAllTheThings — SSTI (JavaScript)](https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Template%20Injection/JavaScript.md); [HackTricks — SSTI](https://hacktricks.wiki/en/pentesting-web/ssti-server-side-template-injection/index.html) (HIGH)
- [Black Hat — SSTI: RCE for the Modern Web App (Kettle)](https://blackhat.com/docs/us-15/materials/us-15-Kettle-Server-Side-Template-Injection-RCE-For-The-Modern-Web-App-wp.pdf); [A Survey of the Overlooked Dangers of Template Engines](https://arxiv.org/html/2405.01118v1) (HIGH)
- PortSwigger — [Bypassing DOMPurify again with mutation XSS](https://portswigger.net/research/bypassing-dompurify-again-with-mutation-xss); [CVE-2025-26791 mXSS deep dive](https://www.cve.news/cve-2025-26791/); [When Purification Fails](https://shaheen.beaconred.net/research/2025/05/28/when-purification-fails.html) (HIGH)
- Multi-tenant leakage — [Row-Level Security fails in SaaS (InstaTunnel)](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c); [WorkOS multi-tenant guide](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture) (MEDIUM–HIGH)
- Image upload — [Stored XSS via SVG (Plane advisory)](https://github.com/makeplane/plane/security/advisories/GHSA-rcg8-g69v-x23j); [Budibase arbitrary upload → SSRF/XSS](https://github.com/Budibase/budibase/security/advisories/GHSA-2hfr-343j-863r); [File Upload to RCE (LazyHackers)](https://lazyhackers.in/article/file-upload-rce-polyglot-imagetragick-svg-xss); [Vaadata file upload best practices](https://www.vaadata.com/blog/file-upload-vulnerabilities-and-security-best-practices/) (HIGH)
- Static export — [Next.js static export asset-path issues #8158](https://github.com/vercel/next.js/issues/8158); [Static HTML export best practices (Docsie)](https://www.docsie.io/blog/glossary/static-html-export/) (MEDIUM)

---
*Pitfalls research for: multi-tenant template-driven landing page generator (PageForge)*
*Researched: 2026-06-01*
