---
phase: 01
slug: core-engine-parser-merge
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-02
verified: 2026-06-02
---

# Phase 01 — Security

Per-phase security contract: threat register, accepted risks, and audit trail for the Core Engine (Parser + Merge) phase.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm dependencies -> engine code | Third-party libraries provide rendering, schema validation, and HTML sanitization behavior. | package versions and runtime library behavior |
| Zod schema -> TypeScript types | Zod schemas are the source of truth for field types and parsed schema shape. | schema definitions and inferred TS types |
| author markup -> parser/compiler | Template HTML with token annotations is parsed into a constrained schema and compiled into Liquid. | template markup, repeat markers, token declarations |
| caller values -> renderer | User-provided LP values are untrusted and must be escaped or sanitized by field type. | text, richtext, image URLs, button URLs, colors, repeater items |
| user richtext -> sanitizeRichText | Raw rich text is potentially hostile HTML and is gated by sanitize-html. | HTML fragments |
| user URLs -> sanitizeUrl | href/src values can contain active schemes such as javascript:, data:, or vbscript:. | URL strings |
| user CSS color -> sanitizeCssColor | CSS color values can contain expression(), url(), or malformed injection payloads. | CSS value strings |
| sanitized scope -> LiquidJS output | Preprocessed values are rendered by LiquidJS with output escaping as the final layer. | safe scope data to static HTML |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Tampering | package.json dependency versions | mitigate | `liquidjs` pinned at `^10.27.0`; `sanitize-html` pinned at `^2.17.4`; `pnpm test` and `pnpm run build` pass. | closed |
| T-01-02 | Tampering | tsconfig.json strictness | mitigate | `strict: true` is present in `tsconfig.json`; typecheck passes. | closed |
| T-01-03 | Information Disclosure | FieldTypeSchema enum | accept | Field type list is product documentation, not a secret. Accepted risk AR-01. | closed |
| T-01-04 | Tampering | parser/render stubs from Wave 1 | accept | Temporary RED stubs were replaced by real implementations in Waves 2 and 3. | closed |
| T-02-01 | Tampering | LiquidJS `ownPropertyOnly` config | mitigate | `renderer.ts` exports Liquid engine with `ownPropertyOnly: true`. | closed |
| T-02-02 | Tampering | SSTI via template compiled into Liquid | mitigate | `compileToLiquid()` only restores generated Liquid placeholders and neutralizes remaining `{{ }}` / `{% %}` delimiters. | closed |
| T-02-03 | Tampering | Prototype access through `__proto__` values | mitigate | LiquidJS uses `ownPropertyOnly: true`; security corpus includes SSTI/prototype payloads. | closed |
| T-02-04 | Tampering | Repeater tokens not rewritten as `item.field` | mitigate | `compileToLiquid()` maps schema repeater fields to `item.*`; parser/renderer tests cover repeaters. | closed |
| T-02-05 | Tampering | XSS via text/image HTML break-out | mitigate | LiquidJS `outputEscape: 'escape'`; image fields additionally pass through `sanitizeUrl()`. | closed |
| T-02-06 | Tampering | XSS via richtext with `| raw` | mitigate | `sanitizeRichText()` uses strict sanitize-html allowlist before `| raw` render. | closed |
| T-02-07 | Tampering | `javascript:` URL in button/image | mitigate | `sanitizeUrl()` rejects non-allowlisted schemes and protocol-relative URLs. | closed |
| T-02-08 | Denial of Service | Malformed author template causing renderer work | accept | Template authors are trusted internal users for v1; no render timeout in Phase 1. Accepted risk AR-02. | closed |
| T-03-01 | Tampering | Stored XSS via richtext tags/handlers | mitigate | `sanitize-html` allowlist permits only basic formatting and safe anchor hrefs. | closed |
| T-03-02 | Tampering | `javascript:` URL in href | mitigate | `sanitizeUrl()` returns `#` for disallowed schemes; corpus validates button context. | closed |
| T-03-03 | Tampering | `data:` URI in href/src | mitigate | `sanitizeUrl()` rejects `data:`; corpus validates URL contexts. | closed |
| T-03-04 | Tampering | CSS `expression()` injection | mitigate | `sanitizeCssColor()` validates against anchored allowlist and rejects dangerous keywords. | closed |
| T-03-05 | Tampering | CSS `url(javascript:)` polyglot | mitigate | `sanitizeCssColor()` rejects `url` and `javascript` even after format validation. | closed |
| T-03-06 | Tampering | HTML attribute break-out payloads | mitigate | LiquidJS output escaping converts quotes and angle brackets in text/image contexts. | closed |
| T-03-07 | Tampering | Null-byte HTML injection | mitigate | Text contexts are escaped; richtext is parsed and sanitized by sanitize-html. | closed |
| T-03-08 | Tampering | Protocol-relative richtext links | mitigate | `RICHTEXT_SANITIZE_OPTIONS.allowProtocolRelative` is explicitly `false`. | closed |
| T-03-09 | Elevation of Privilege | SSTI/prototype chain payloads in values | mitigate | Values are scope data, not re-parsed templates; `ownPropertyOnly: true`; corpus validates P1/P2. | closed |
| T-03-10 | Tampering | CSS color regex bypass | mitigate | `CSS_COLOR_PATTERN` is anchored and named colors use an explicit allowlist. | closed |
| T-03-11 | Tampering | XSS inside repeater item values | mitigate | `processRepeaterItems()` applies the same field-type sanitization inside repeaters; corpus covers repeater-text. | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-03 | Field type names are visible product behavior and useful documentation; disclosure has no confidentiality impact. | GSD security audit | 2026-06-02 |
| AR-02 | T-02-08 | Author markup is controlled by internal template authors in v1; render timeout/rate limits are deferred to later platform hardening. | GSD security audit | 2026-06-02 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-02 | 23 | 23 | 0 | Codex / gsd-secure-phase |

### Evidence

| Check | Result |
|-------|--------|
| `pnpm run build` | PASS |
| `pnpm test` | PASS — 6 files, 118 tests |
| `renderer.ts` Liquid config | PASS — `outputEscape: 'escape'`, `ownPropertyOnly: true` |
| `sanitizers.ts` richtext hardening | PASS — sanitize-html allowlist, `allowProtocolRelative: false`, no style parsing |
| `sanitizers.ts` URL hardening | PASS — rejects unknown schemes and protocol-relative URLs |
| `sanitizers.ts` CSS hardening | PASS — anchored format allowlist plus explicit dangerous-keyword rejection |
| `tests/engine/security.test.ts` | PASS — SSTI/XSS corpus across text, richtext, image, color, button, repeater-text |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-02
