# Phase 1: Core Engine (Parser + Merge) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 1-Core Engine (Parser + Merge)
**Areas discussed:** Token syntax + type, Repeater + global tokens, Engine decision, Grécia fixture + proof

---

## Token Syntax + Type Declaration

### How the type of each token is declared
| Option | Description | Selected |
|--------|-------------|----------|
| Inline annotation | Type lives in the token itself, e.g. `{{ hero_title:text }}` — single source, self-documenting | ✓ |
| Naming convention | Parser infers type from name prefix/suffix (`img_hero` → image) — fragile/ambiguous | |
| Separate declaration block | Frontmatter header listing each token + type — two places to keep in sync | |

**User's choice:** Inline annotation

### Exact inline annotation format
| Option | Description | Selected |
|--------|-------------|----------|
| Colon suffix | `{{ hero_title:text }}` — engine-agnostic micro-grammar, parser strips before engine | ✓ |
| Liquid filter style | `{{ hero_title \| text }}` — idiomatic for LiquidJS but couples grammar to engine | |
| Named attribute | `{{ hero_title type="image" }}` — verbose but extensible | |

**User's choice:** Colon suffix

### Behavior for missing / unknown type
| Option | Description | Selected |
|--------|-------------|----------|
| Default text + warning | No type → text; unknown type → warning + degrade to text. Tolerant. | ✓ |
| Strict parse error | Any token without valid type fails parse | |
| Default text, silent | Assume text, no warning | |

**User's choice:** Default text + warning

### What the emitted schema captures per token
| Option | Description | Selected |
|--------|-------------|----------|
| Type + name + repeater | Minimal: name, detected type, repeater/global membership; label defaults to name | ✓ |
| Rich schema now | Also label, required, default, order — anticipates form needs (Phase 4) | |

**User's choice:** Type + name + repeater (rich metadata deferred to Phase 3)

---

## Repeater + Global Tokens

### How a repeatable block is delimited
| Option | Description | Selected |
|--------|-------------|----------|
| HTML-comment markers | `<!-- repeat:itinerary -->...<!-- /repeat:itinerary -->` — keeps HTML valid, engine-agnostic | ✓ |
| Liquid-style loop tag | `{% for day in itinerary %}...{% endfor %}` — native to LiquidJS but couples grammar | |
| Custom brace delimiter | `{{#repeat itinerary}}...{{/repeat}}` — compact but not valid HTML | |

**User's choice:** HTML-comment markers

### How tokens inside a repeater reference the current item
| Option | Description | Selected |
|--------|-------------|----------|
| Implicit item scope | Author writes just `{{ day_title:text }}`; parser binds to current item | ✓ |
| Explicit dotted reference | `{{ itinerary.day_title:text }}` inside the block — verbose/redundant | |

**User's choice:** Implicit item scope

### How globals are distinguished from per-LP fields
| Option | Description | Selected |
|--------|-------------|----------|
| Reserved namespace | `{{ brand.logo:image }}` resolves from brand config; non-`brand.` = per-LP field | ✓ |
| Dedicated type | `{{ logo:global }}` — doesn't say which brand value | |
| Fixed name vocabulary | Reserved names always global — fragile, name collisions | |

**User's choice:** Reserved namespace prefix (`brand.`)

**Notes:** Claude noted (and user implicitly accepted) flat repeaters only for v1; nested repeaters deferred.

---

## Engine Decision (KEY DECISION GATE)

### Resolving LiquidJS vs. logic-less substitution
| Option | Description | Selected |
|--------|-------------|----------|
| Defer to research | gsd-phase-researcher benchmarks both against the same SSTI/XSS corpus; user approves at plan time | ✓ |
| Lock logic-less now | Own AST + context-aware escaping, no engine dependency | |
| Lock LiquidJS now | Compile our markup to Liquid, reuse mature iteration + escaping | |

**User's choice:** Defer to research
**Notes:** Enabled because areas 1–2 produced an engine-agnostic grammar — the parser owns grammar + security, so the backend is a swappable adapter.

### Rich-text sanitization allowlist scope
| Option | Description | Selected |
|--------|-------------|----------|
| Basic formatting | `p, strong, em, ul/ol/li, a[href http/https/mailto], br`; no script/style/on*/iframe | ✓ |
| Extended formatting | + headings, blockquote, inline images, colored spans | |
| Decide in plan | Leave exact list to planner/research, start strict | |

**User's choice:** Basic formatting

---

## Grécia Fixture + Proof

### Source of the Grécia markup
| Option | Description | Selected |
|--------|-------------|----------|
| User provides real HTML | (offered) drop in the real LP project | ✓ (free-text) |
| Build faithful stand-in | Hand-craft structural mirror, swap later | |
| Tokenize pasted raw HTML | User pastes raw HTML, we tokenize | |

**User's choice (free-text):** "consigo colocar a pasta com o projeto inteiro da lp que mostrei" — then "está na pasta atual renova turismo jornada main". Discovered the artifact is the React/Vite/Tailwind SPA `renova-turismo-jornada-main/` (Lovable), with multiple campaign variants incl. Grécia.

### How to derive the tokenized HTML template from the React SPA
| Option | Description | Selected |
|--------|-------------|----------|
| Render → snapshot → tokenize | Render Grécia route (Playwright already present) + compiled Tailwind CSS, then tokenize | ✓ |
| Author tokenized HTML by hand | Treat React as visual reference, write fresh HTML+CSS | |
| User delivers static HTML | User exports final static HTML, we only tokenize | |

**User's choice:** Render → snapshot → tokenize

### Fixture scope for this phase
| Option | Description | Selected |
|--------|-------------|----------|
| Full Grécia page | Whole landing — exercises all 6 types + multiple repeaters | ✓ |
| Critical-block subset | hero + roteiro + inclusos + CTA first | |

**User's choice:** Full Grécia page

### How to prove success (UI-less)
| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot + assertions + corpus | Vitest golden-file (0/1/N) + schema assertions + SSTI/XSS payload corpus | ✓ |
| Assertions only | Field/substring assertions, no snapshot | |
| CLI + human eyeball | Print schema, write HTML to disk for manual review | |

**User's choice:** Snapshot + assertions + corpus

### Security payload corpus breadth
| Option | Description | Selected |
|--------|-------------|----------|
| Listed + per-type + prototype | Roadmap examples + per-field XSS + prototype-pollution/polyglots, fuzz all 6 types | ✓ |
| Roadmap examples only | Only the cited payloads | |

**User's choice:** Listed + per-type + prototype-pollution/polyglots

---

## Claude's Discretion

- Exact keyword spelling for the six types and the precise rich-text tag list (start strict).
- Internal AST / schema data-structure shape, module layout, parser-to-engine adapter interface.
- Handling of non-content head material (gtag, JSON-LD, meta/OG, favicon) during tokenization.
- Mapping Vite `@/assets/...` image imports to static `src` paths in the fixture.
- Which campaign variant's components are canonical if Grécia reuses shared `landing/*` structure.

## Deferred Ideas

- Nested repeaters (flat-only in v1).
- Rich per-field schema metadata (label/required/default/order) → Phase 3.
- Image upload / asset handling / Vite asset-path rewriting → Phase 4.
- Brand config authoring & persistence → Phase 3.
- Extended rich-text allowlist → revisit post-v1.
- Campaign-variant / multi-route handling → only Grécia used as fixture in Phase 1.
