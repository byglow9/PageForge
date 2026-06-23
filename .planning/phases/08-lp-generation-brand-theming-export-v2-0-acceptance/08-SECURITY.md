---
phase: 8
slug: lp-generation-brand-theming-export-v2-0-acceptance
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-23
---

# Phase 8 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all 5 PLAN.md files carried a `<threat_model>` block),
> so this audit **verifies mitigations exist** rather than scanning for new threats.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Cliente → generateViteSpaLpAction | `templateId` e `entryRoute` são input untrusted do cliente | template ref, path string |
| Server Action → banco | `workspaceId` derivado exclusivamente da sessão via `requireWorkspaceRole` | workspace scope |
| BrandConfig.primaryColor → hexToHslTriplet/CSS | cor salva por owner/admin, validada `/^#[0-9a-fA-F]{6}$/` antes de persistir | hex color → CSS var |
| Serve origin → index.html (HMAC claims) | `workspaceId`/`templateId` vêm das claims HMAC verificadas (`SERVE_TOKEN_SECRET`, exp 30min), não de sessão/URL | tenant scope via token |
| iframe sandbox (preview VITE_SPA) | `sandbox="allow-scripts"` sem `allow-same-origin` → origem opaca | isolamento de origem |
| Export route → S3 dist/ prefix | prefix de `lp.workspaceId` + `lp.templateId` (campos de banco, workspace-scoped), nunca input do cliente | S3 object keys |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-08-01-01 | Injection | `buildBrandStyleTag` / CSS | accept | primaryColor validado hex puro; triplet HSL só dígitos/`%`/espaço — sem vetor CSS injection | closed |
| T-08-01-02 | Injection (Tampering) | `entryRoute` coluna | mitigate | `GenerateViteSpaLpSchema.entryRoute` `.max(128)` + normaliza vazio→null; tratado como path, nunca concatenado a SQL/HTML — **verificado** em `lib/lps/schema.ts` | closed |
| T-08-01-03 | Information Disclosure | migration aditiva `entryRoute` | accept | `ALTER TABLE ADD COLUMN` DDL padrão; null default não vaza dado de tenant | closed |
| T-08-02-01 | Spoofing | generateViteSpaLpAction: workspaceId | mitigate | `requireWorkspaceRole(slug, [owner/admin/editor])` deriva workspaceId da sessão — **verificado** `lib/lps/actions.ts:153` | closed |
| T-08-02-02 | Tampering | entryRoute: path injection | mitigate | Zod `.max(128)`; serve handler trata path extensionless como SPA fallback→index.html — **verificado** `serve/[tplId]/route.ts` | closed |
| T-08-02-03 | Elevation of Privilege | VITE_SPA template de outro workspace | mitigate | `db.template.findById` dentro de `withTenantDb` (RLS workspace-scoped) — **verificado** `lib/lps/actions.ts:170-172` | closed |
| T-08-02-04 | Repudiation | duplicateLpAction VITE_SPA sem assets | accept | Duplicação = nova linha referenciando o mesmo template; auditoria via timestamps Prisma | closed |
| T-08-03-01 | Tampering | BrandConfig.primaryColor → CSS injection | accept | hex pré-validado; `buildBrandStyleTag` usa template literal com valor safe | closed |
| T-08-03-02 | Information Disclosure | serve route: BrandConfig via bare prisma | mitigate | workspaceId vem das claims HMAC verificadas (`verifyServeToken`); `claims.templateId !== tplId`→403 — **verificado** `serve/[tplId]/route.ts:15-16` | closed |
| T-08-03-03 | Information Disclosure | iframe sandbox breakout | mitigate | `sandbox="allow-scripts"` sem `allow-same-origin` → origem opaca — **verificado** `preview/page.tsx:84` + confirmado em UAT (document.cookie → SecurityError) | closed |
| T-08-03-04 | Elevation of Privilege | entryPath no iframe URL | accept | `lp.entryRoute ?? "/"` do banco (não URL param); SPA fallback não expõe arquivo inesperado | closed |
| T-08-03-05 | Tampering | stream S3 consumido duas vezes | mitigate | index.html via `transformToString()`, assets via `transformToWebStream()` — branch mutuamente exclusivo — **verificado** `export/route.ts` | closed |
| T-08-04-01 | Information Disclosure | S3 prefix para dist/ no export | mitigate | Prefix de workspaceId (campo banco); LP resolvida em contexto de workspace do usuário + IDOR colapsado no lookup (miss→404, sem vazar existência cross-tenant) — **verificado e reforçado** `export/route.ts` (ver Audit Trail) | closed |
| T-08-04-02 | Tampering | index.html no ZIP: injeção via brand CSS vars | accept | hex pré-validado; triplet HSL só dígitos/`%`/espaço — sem vetor de CSS injection | closed |
| T-08-04-03 | Denial of Service | ListObjectsV2 loop: dist/ grande | accept | LPs típicas têm dezenas de assets; loop termina em `IsTruncated=false`; assets streamados sem buffer completo | closed |
| T-08-04-04 | Elevation of Privilege | Export VITE_SPA sem CSP | accept | VITE_SPA tem runtime JS próprio (`script-src 'none'` quebraria — D-12 locked); ZIP é estático local; exportador é owner/admin | closed |
| T-08-04-05 | Tampering | edit page: parse(sentinel markupSnapshot) | mitigate | Branch VITE_SPA inserido antes de `parse(lp.markupSnapshot)` — **verificado** `lps/[lpId]/edit/page.tsx:49` (parse só em `:71`) | closed |
| T-08-05-01 | Information Disclosure | UAT: brand color no iframe | accept | Verificador é o dono do workspace; dados expostos são do próprio workspace | closed |
| T-08-05-02 | Repudiation | UAT aprovado sem evidência | mitigate | `08-UAT.md` documenta data, itens A1–E4, resultado e os 3 fixes aplicados — **verificado** (artefato existe) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-01-01 / T-08-03-01 / T-08-04-02 | CSS injection via brand color neutralizada na origem: primaryColor validado `/^#[0-9a-fA-F]{6}$/`; triplet HSL só contém dígitos/`%`/espaço | owner | 2026-06-23 |
| AR-08-02 | T-08-01-03 | Migration aditiva (ADD COLUMN, null default) não expõe dado de tenant | owner | 2026-06-23 |
| AR-08-03 | T-08-02-04 | Duplicação VITE_SPA é nova linha; auditoria via timestamps Prisma — sem impacto de segurança | owner | 2026-06-23 |
| AR-08-04 | T-08-03-04 | entryPath vem do banco (não URL param); SPA fallback nunca expõe arquivo inesperado | owner | 2026-06-23 |
| AR-08-05 | T-08-04-03 | DoS via dist/ gigante fora do perfil real (dezenas de assets); streaming bounded | owner | 2026-06-23 |
| AR-08-06 | T-08-04-04 | Ausência de CSP no export VITE_SPA é decisão locked (D-12); ZIP estático local; exportador é owner/admin | owner | 2026-06-23 |
| AR-08-07 | T-08-05-01 | UAT visual feito pelo dono do workspace sobre dados do próprio workspace | owner | 2026-06-23 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-23 | 19 | 19 | 0 | /gsd-secure-phase (inline verification) |

### Notas da auditoria 2026-06-23

- **Register authored at plan time:** todos os 5 PLAN.md (08-01..08-05) continham `<threat_model>` parseável → modo "verificar mitigações", não scan de novos threats.
- **9 mitigações verificadas no código** (T-08-01-02, 02-01, 02-02, 02-03, 03-02, 03-03, 03-05, 04-01, 04-05) + **10 riscos aceitos documentados**.
- **Achado positivo (reforço de T-08-04-01):** durante a UAT v2.0, o route `/api/lps/[lpId]/export` retornava 404 porque lia `landing_page`/`brand_config` com o client Prisma cru, sem contexto de workspace (ambas com FORCE RLS). O fix aplicado passou a resolver a LP **dentro do contexto de workspace do usuário** (via `member` table → `set_config('app.current_workspace_id')` por transação) e **colapsou o IDOR check no próprio lookup** — uma LP de outro tenant agora resulta em 404 sem revelar sua existência. Isso **mantém e fortalece** a mitigação de Information Disclosure prevista para o export.
- T-08-03-03 confirmado **empiricamente** na UAT: o iframe do preview VITE_SPA reportou `document.cookie → SecurityError (isolado)`, comprovando a origem opaca.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-23
