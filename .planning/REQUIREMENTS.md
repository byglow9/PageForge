# Requirements: PageForge

**Defined:** 2026-06-01
**Core Value:** A partir de um template cadastrado uma vez, um usuário gera uma nova landing page completa e fiel ao layout apenas preenchendo um formulário — sem tocar em código.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Workspaces

- [ ] **WS-01**: User can sign up and log in
- [ ] **WS-02**: User can create a workspace
- [ ] **WS-03**: User can invite members to a workspace by email
- [ ] **WS-04**: Workspace members have roles (admin/editor/viewer) that control permitted actions
- [ ] **WS-05**: All templates, LPs, and assets are isolated per workspace (no cross-workspace access)

### Template Authoring

- [ ] **TPL-01**: User can create a template by writing markup with tokens
- [ ] **TPL-02**: System parses tokens into a typed field schema when the template is saved
- [ ] **TPL-03**: User can assign a type to each token (text, rich text, image, color, button+URL, repeater)
- [ ] **TPL-04**: User can define repeatable blocks (repeaters) that group multiple fields
- [ ] **TPL-05**: User can edit an existing template
- [ ] **TPL-06**: Templates are listed and selectable within the workspace

### Brand Settings

- [ ] **BRD-01**: User can configure global brand/contact values per workspace (e.g., logo, primary color, contact/WhatsApp)
- [ ] **BRD-02**: Templates can reference global brand values, and generated LPs use them automatically

### LP Generation

- [ ] **GEN-01**: Selecting a template opens a dynamic form generated from its schema
- [ ] **GEN-02**: Form supports all field types: text, rich text, image upload, color, and button+URL
- [ ] **GEN-03**: User can add and remove items in repeatable blocks within the form
- [ ] **GEN-04**: System validates required fields by type on submit (minimal validation)
- [ ] **GEN-05**: System generates a static HTML LP by merging the filled values into the template markup
- [ ] **GEN-06**: Rich-text and token values are sanitized so generated HTML is free of injected scripts (XSS)

### Assets

- [ ] **AST-01**: User can upload images for image fields, with stored asset management scoped to the workspace

### LP Management

- [ ] **LP-01**: User can preview a rendered LP at any time
- [ ] **LP-02**: User can reopen and edit an LP's data and regenerate its HTML
- [ ] **LP-03**: User can duplicate an existing LP to create a variation
- [ ] **LP-04**: User can export/download the LP as a self-contained HTML bundle

### Catalog

- [ ] **CAT-01**: Generated LPs are saved to a catalog
- [ ] **CAT-02**: User can organize LPs into folders
- [ ] **CAT-03**: User can categorize/tag LPs
- [ ] **CAT-04**: User can browse and search LPs in the catalog

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Hosting

- **HOST-01**: Each published LP gets a hosted URL served by the platform (subdomain or /slug)

### Validation

- **VAL-01**: Author can define advanced validations (regex, image dimensions/size, numeric ranges)

### Catalog

- **PERM-01**: Folders can have per-member access permissions within a workspace

### Templates

- **SHARE-01**: A global/shared template repository usable across workspaces
- **BUILD-01**: Visual field builder / upload+visual-mapping authoring mode

### Analytics

- **ANL-01**: A/B testing and analytics for generated LPs

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Platform-hosted LP URLs | v1 delivers export/download only; hosting deferred to keep operations simple |
| Advanced field validations | v1 uses minimal validation (type only) |
| Per-folder member permissions | Permissions live at the workspace level in v1 |
| Cross-workspace shared template repo | Templates are workspace-scoped in v1 |
| Visual field builder / visual mapping | Authoring is markup-with-tokens in v1 |
| A/B testing & analytics | Not core to the generation value in v1 |

## Acceptance Anchor

The real "Grécia" travel template (hero, repeatable highlight cards, "what's included" cards, day-by-day itinerary, differentiators, testimonials, CTA, footer) must be authorable end-to-end and used to generate, preview, edit, duplicate, and export a complete LP. This is the v1 acceptance test for the full pipeline. Verified in **Phase 5**.

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WS-01 | Phase 2 | Pending |
| WS-02 | Phase 2 | Pending |
| WS-03 | Phase 2 | Pending |
| WS-04 | Phase 2 | Pending |
| WS-05 | Phase 2 | Pending |
| TPL-01 | Phase 3 | Pending |
| TPL-02 | Phase 1 | Pending |
| TPL-03 | Phase 3 | Pending |
| TPL-04 | Phase 1 | Pending |
| TPL-05 | Phase 3 | Pending |
| TPL-06 | Phase 3 | Pending |
| BRD-01 | Phase 3 | Pending |
| BRD-02 | Phase 3 | Pending |
| GEN-01 | Phase 4 | Pending |
| GEN-02 | Phase 4 | Pending |
| GEN-03 | Phase 4 | Pending |
| GEN-04 | Phase 4 | Pending |
| GEN-05 | Phase 1 | Pending |
| GEN-06 | Phase 1 | Pending |
| AST-01 | Phase 4 | Pending |
| LP-01 | Phase 4 | Pending |
| LP-02 | Phase 4 | Pending |
| LP-03 | Phase 4 | Pending |
| LP-04 | Phase 4 | Pending |
| CAT-01 | Phase 5 | Pending |
| CAT-02 | Phase 5 | Pending |
| CAT-03 | Phase 5 | Pending |
| CAT-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 28 total (WS:5, TPL:6, BRD:2, GEN:6, AST:1, LP:4, CAT:4)
- Mapped to phases: 28
- Unmapped: 0 ✓

> Note: the previous header said "25 total"; the enumerated requirement list actually contains 28 distinct IDs. All 28 are mapped. Each requirement is assigned to exactly one phase. Phase 1 owns the engine-level requirements (TPL-02 parse-to-schema, TPL-04 repeater semantics, GEN-05 merge, GEN-06 sanitization); their authoring/UI counterparts (TPL-01/03/05/06) live in Phase 3 as distinct IDs — no duplication.

---
*Requirements defined: 2026-06-01*
*Last updated: 2026-06-01 after roadmap creation (traceability mapped)*
