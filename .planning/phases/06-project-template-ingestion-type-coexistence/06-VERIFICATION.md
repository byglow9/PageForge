---
phase: 06-project-template-ingestion-type-coexistence
verified: 2026-06-19T10:45:00Z
status: gaps_found
score: 3/5
overrides_applied: 0
gaps:
  - truth: "ZIPs exceeding 50 MB compressed or 200 MB total uncompressed are rejected with a clear error message"
    status: failed
    reason: "CR-02: parseInt() sem validação de NaN em zip-validate.ts linhas 29-32. Se PROJECT_TEMPLATE_MAX_ZIP_MB ou PROJECT_TEMPLATE_MAX_UNCOMPRESSED_MB forem configurados com valor não-numérico (ex: 'unlimited', ''), parseInt retorna NaN, NaN * 1024 * 1024 = NaN, e todas as comparações > NaN são false — os controles de tamanho ficam silenciosamente desabilitados (fail-open). Os defaults hardcoded '50' e '200' são parseados corretamente, mas a proteção não é fail-safe quando a env var é mal configurada."
    artifacts:
      - path: "apps/web/src/lib/project-templates/zip-validate.ts"
        issue: "Linhas 29-32: parseInt(process.env.X ?? 'N') sem Number.isFinite() guard. Linha 88: mensagem de erro hardcoda '200 MB' em vez de interpolar o limite configurado (WR-05)."
    missing:
      - "Substituir parseInt por uma função parseMb(value, fallback) que verifique Number.isFinite(n) && n > 0 antes de usar o resultado — conforme sugerido no CR-02 do code review"
      - "Interpolar o limite real na mensagem de erro da linha 88 para consistência com o valor configurável"

  - truth: "Scan findings (Supabase JWT, sk_live_, AWS AKIA key, *.lovable.app URL) são retornados como warnings após a criação — achados são avisados ao usuário antes de concluir (D6)"
    status: failed
    reason: "WR-01: ProjectTemplateForm.tsx linha 52 chama router.push() incondicionalmente após setFindings() e toast.warning() — mesmo quando findings.length > 0. O componente navega imediatamente, desmontando antes que a seção 'Security Warnings' (linhas 109-121) possa ser renderizada. O toast diz 'Review the findings below before deploying' mas não há 'below' visível porque a navegação acontece no mesmo tick. A seção JSX de findings existe no código mas nunca é exibida ao usuário quando há achados."
    artifacts:
      - path: "apps/web/src/app/w/[slug]/project-templates/new/ProjectTemplateForm.tsx"
        issue: "Linha 52: router.push() está fora do bloco if/else dos findings — navega independentemente de findings.length. O state setFindings() é atualizado mas o componente desmonta antes do re-render."
    missing:
      - "Mover router.push() para dentro do bloco else (quando não há findings): se findings.length > 0, permanecer na página e deixar o usuário ver e ler a seção Security Warnings; só navegar após o usuário tomar uma ação explícita (botão 'Continue') ou quando não há achados"
deferred: []
human_verification:
  - test: "Verificar que LIQUID templates e LPs existentes carregam sem erros após a migração de kind"
    expected: "O catálogo de LPs e a lista de templates exibem corretamente os registros LIQUID existentes, sem badges 'Vite SPA', sem erros de runtime"
    why_human: "Depende de dados reais no banco de dados de desenvolvimento que não podem ser inspecionados programaticamente sem uma conexão ativa ao Postgres"
  - test: "Verificar que o formulário de upload em /w/[slug]/project-templates/new é acessível e funciona end-to-end"
    expected: "Upload de ZIP válido cria template VITE_SPA, aparece no catálogo com badge 'Vite SPA'; upload de ZIP sem index.html rejeita com mensagem clara; upload de ZIP > 50 MB rejeita"
    why_human: "Requer servidor rodando + MinIO S3 local + banco de dados ativo; comportamento de upload de arquivo não verificável via grep"
---

# Phase 06: Project-Template Ingestion + Type Coexistence — Relatório de Verificação

**Phase Goal:** Cadastrar um projeto Lovable como template VITE_SPA via upload do `dist/` pré-buildado (validado + escaneado + isolado por workspace), coexistindo com templates LIQUID no catálogo. (sem serving ainda)
**Verified:** 2026-06-19T10:45:00Z
**Status:** gaps_found
**Re-verification:** Não — verificação inicial

## Resultado Geral

**3 de 5 success criteria do ROADMAP verificados.** Dois são bloqueados: a garantia de segurança do controle de tamanho de ZIP é fail-open (CR-02) e os scan findings não são exibíveis ao usuário (WR-01), contrariando o requisito D6 da fase.

---

## Truths Observáveis (Success Criteria do ROADMAP)

| # | Truth (SC do ROADMAP) | Status | Evidência |
|---|----------------------|--------|-----------|
| 1 | Template e LandingPage têm discriminador kind (LIQUID\|VITE_SPA) via migração aditiva; LIQUID existentes funcionam sem alteração de código de leitura | VERIFICADO | migration.sql tem 2 ADD COLUMN TEXT NOT NULL DEFAULT 'LIQUID' CHECK; schema.prisma linha 217 e 259; tipos gerados: `kind: string` no Template e LandingPage (linhas 215 e 228 respectivamente). renderLp() e listLpsAction usam `kind: lp.kind ?? 'LIQUID'` em call sites. |
| 2 | ZIP sem index.html, com path traversal (../), ou acima do limite de tamanho é rejeitado com mensagem clara | FALHOU | zip-validate.ts verifica zip-slip (path.normalize + isAbsolute) e index.html corretamente. MAS: parseInt() sem guard de NaN nas linhas 29-32 torna os controles de tamanho fail-open quando env var é não-numérica (CR-02). A proteção não é fail-safe. |
| 3 | Upload escaneado por credenciais embutidas; achados avisados ao usuário antes de concluir (D6) | FALHOU | secret-scan.ts implementa todos os 5 padrões (SUPABASE_JWT, SUPABASE_URL, STRIPE_LIVE_KEY, AWS_ACCESS_KEY, LOVABLE_APP_URL) e é advisory-only. Mas ProjectTemplateForm.tsx chama router.push() imediatamente após setFindings() e toast — findings nunca ficam visíveis ao usuário (WR-01). |
| 4 | dist/ armazenado em S3 sob prefixo tenant-scoped; catálogo e badge de tipo funcionam para ambos os kinds | VERIFICADO | s3-upload.ts linha 57: `workspaces/${workspaceId}/project-templates/${templateId}/dist/`. workspaceId vem de ctx (sessão). LpCatalogCard linha 288 e TemplateCard linha 75: badge `{kind === "VITE_SPA" && <Badge>Vite SPA</Badge>}`. CatalogGrid.CatalogLp tem `kind: string`. |
| 5 | Separação estrita de tipo (V2-11): VITE_SPA → render LIQUID falha explicitamente; coberto por teste de fronteira | VERIFICADO | render.ts linhas 50-54: guard `if (lp.kind === "VITE_SPA") throw new Error("Type boundary violation...")`. type-boundary.test.ts: 2 testes passam (exit 0, "2 passed"). |

**Pontuação: 3/5 truths verificadas**

---

## Artefatos Obrigatórios

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|---------|
| `apps/web/prisma/migrations/0006_kind_discriminator/migration.sql` | ADD COLUMN aditivo TEXT + CHECK | VERIFICADO | 2 ADD COLUMN, sem CREATE TYPE/ADD VALUE, CHECK ('LIQUID','VITE_SPA') em ambas as tabelas |
| `apps/web/prisma/schema.prisma` | kind String @default("LIQUID") em Template e LandingPage | VERIFICADO | Linhas 217 e 259 |
| `apps/web/src/lib/lps/render.ts` | Type boundary guard — throws em kind === 'VITE_SPA' | VERIFICADO | Linhas 50-54, mensagem "Type boundary violation" presente |
| `apps/web/src/lib/project-templates/zip-validate.ts` | validateAndExtractZip com zip-slip, zip-bomb, index.html | STUB PARCIAL | path.normalize presente; zip-bomb check presente; MAS parseInt sem NaN guard = controle de tamanho fail-open (CR-02) |
| `apps/web/src/lib/project-templates/secret-scan.ts` | scanDistFiles com todos os padrões de credencial | VERIFICADO | SUPABASE_JWT, SUPABASE_URL, STRIPE_LIVE_KEY, AWS_ACCESS_KEY, LOVABLE_APP_URL — todos presentes |
| `apps/web/src/lib/project-templates/s3-upload.ts` | uploadDistToS3 tenant-scoped | VERIFICADO | Key: `workspaces/${workspaceId}/project-templates/${templateId}/dist/${entry.fileName}` |
| `apps/web/src/lib/project-templates/actions.ts` | createProjectTemplateAction com pipeline completo | VERIFICADO | requireWorkspaceRole primeiro, kind='VITE_SPA' hardcoded, id=templateId para S3 key match |
| `apps/web/src/app/w/[slug]/project-templates/new/page.tsx` | RSC gate + ProjectTemplateForm mount | VERIFICADO | requireWorkspaceRole antes do mount, ProjectTemplateForm montado |
| `apps/web/src/app/w/[slug]/project-templates/new/ProjectTemplateForm.tsx` | Formulário com file input + aviso de findings | FALHOU | Formulário existe e funciona, MAS router.push() navega imediatamente mesmo com findings — seção Security Warnings nunca é exibida (WR-01) |
| `apps/web/tests/type-boundary.test.ts` | Teste V2-11: VITE_SPA throws, LIQUID passes | VERIFICADO | 2 testes passam (exit 0) |
| `apps/web/src/components/catalog/LpCatalogCard.tsx` | Badge Vite SPA em VITE_SPA LPs | VERIFICADO | `{lp.kind === "VITE_SPA" && <Badge>Vite SPA</Badge>}` (linha 288) |
| `apps/web/src/components/templates/TemplateCard.tsx` | Badge Vite SPA + import Badge | VERIFICADO | import Badge (linha 24), `{template.kind === "VITE_SPA" && <Badge>Vite SPA</Badge>}` (linha 75) |
| `apps/web/src/components/catalog/CatalogGrid.tsx` | CatalogLp interface com kind: string | VERIFICADO | Linha 41: `kind: string` |

---

## Verificação de Key Links

| From | To | Via | Status | Detalhes |
|------|----|-----|--------|---------|
| `lps/actions.ts` | `catalog/CatalogGrid.tsx` | `listLpsAction` return inclui kind | VERIFICADO | lps/actions.ts linha 416: `kind: lp.kind`; CatalogGrid.ts linha 41: `kind: string` |
| `lps/render.ts` | `preview/page.tsx` | `renderLp()` recebe `lp.kind` do DB | VERIFICADO | preview/page.tsx linha 50: `kind: lp.kind ?? 'LIQUID'` |
| `project-templates/actions.ts` | `zip-validate.ts` | `validateAndExtractZip()` chamado antes de qualquer escrita | VERIFICADO | actions.ts linhas 92-95: validação antes do S3 upload |
| `project-templates/actions.ts` | `secret-scan.ts` | `scanDistFiles()` chamado post-extraction (advisory) | VERIFICADO | actions.ts linha 99: `scanDistFiles(validation.entries!)` |
| `project-templates/actions.ts` | `s3-upload.ts` | `uploadDistToS3()` antes do DB write | VERIFICADO | actions.ts linha 107: upload antes da linha 118 (DB persist) |
| `project-templates/actions.ts` | `tenant-db.ts` | `db.template.create({ id: templateId, kind: 'VITE_SPA' })` | VERIFICADO | actions.ts linhas 118-130: withTenantDb com kind e id corretos |
| `type-boundary.test.ts` | `lps/render.ts` | `renderLp({ kind: 'VITE_SPA' })` rejects com "Type boundary violation" | VERIFICADO | Vitest exit 0, 2 tests passed |

---

## Data-Flow Trace (Level 4)

| Artefato | Variável de Dados | Fonte | Produz Dados Reais | Status |
|----------|-------------------|-------|--------------------|--------|
| `LpCatalogCard.tsx` | `lp.kind` | `listLpsAction` → DB query | Sim — `lp.kind` vem de `.findMany()` com `kind: lp.kind` no map | FLOWING |
| `TemplateCard.tsx` | `template.kind` | `listTemplatesAction` → DB query | Sim — `t.kind` vem de `.findMany()` com `kind: t.kind` no map | FLOWING |
| `ProjectTemplateForm.tsx` | `findings[]` | `createProjectTemplateAction` → `scanDistFiles()` | Tecnicamente real, mas HOLLOW — `setFindings()` é chamado e `router.push()` navega imediatamente, então a seção findings é desmontada antes de renderizar | HOLLOW |

---

## Checks Comportamentais (Step 7b)

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Type boundary test V2-11 | `cd apps/web && npx vitest run tests/type-boundary.test.ts` | "2 passed (2)" — exit 0 | PASS |
| TypeScript compilation | `cd apps/web && npx tsc --noEmit` | Sem saída (exit 0) | PASS |
| migration.sql tem 2 ADD COLUMN | `grep "ADD COLUMN" migration.sql \| wc -l` | `2` | PASS |
| migration.sql sem native enum | `grep -c "CREATE TYPE\|ADD VALUE" migration.sql` | `0` | PASS |

---

## Anti-Padrões Encontrados

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| `zip-validate.ts` | 29-32 | `parseInt()` sem NaN guard nos controles de tamanho | BLOCKER | Controles de tamanho de ZIP ficam fail-open se env var for não-numérica. Qualquer comprimento de arquivo passa as verificações de tamanho silenciosamente (CR-02). |
| `zip-validate.ts` | 88 | Mensagem hardcoda "200 MB" em vez de interpolar o limite configurado | WARNING | Se `PROJECT_TEMPLATE_MAX_UNCOMPRESSED_MB` for redefinida, mensagem de erro diverge do limite real (WR-05). |
| `ProjectTemplateForm.tsx` | 52 | `router.push()` incondicionalmente após `setFindings()` + toast | BLOCKER | Achados do scan nunca são exibíveis ao usuário; instrução "Review the findings below" no toast é enganosa (WR-01). |
| `lps/actions.ts` | 568 | `validateUploadedImageAction` não captura `ctx` de `requireWorkspaceRole`, usa `input.key` sem validar prefixo de workspace | BLOCKER | Cross-tenant S3 deletion — mas é pré-existente de fases anteriores (Phase 4), não introduzido pela Phase 6 (CR-01 do code review). |

---

## Cobertura de Requisitos

Os requisitos da Fase 6 são PRJ-01, PRJ-02, PRJ-03, PRJ-11 — definidos em PROJECT.md (v2.0), não em REQUIREMENTS.md (v1). Nota: REQUIREMENTS.md cobre apenas requisitos v1 (WS-*, TPL-*, etc.); os requisitos PRJ-* estão exclusivamente em PROJECT.md. Não é uma inconsistência — são dois arquivos de requisitos para dois milestones.

| Requisito | Descrição | Status | Evidência |
|-----------|-----------|--------|---------|
| PRJ-01 | Ingestão de template tipo projeto: upload do dist/ pré-buildado (ZIP) | PARCIALMENTE SATISFEITO | Pipeline completo implementado (validate → scan → upload → persist). Mas zip size cap fail-open (CR-02) compromete a garantia de validação. |
| PRJ-02 | Validação + scan: estrutura (index.html/assets), rejeição de path traversal e tamanho excessivo, aviso de credenciais embutidas e meta Lovable | PARCIALMENTE SATISFEITO | Path traversal e index.html: corretos. Tamanho: fail-open (CR-02). Scan/aviso: scan implementado mas findings não exibíveis (WR-01). |
| PRJ-03 | Discriminador kind (LIQUID\|VITE_SPA) em Template/LandingPage + coexistência no catálogo/pastas/tags com badge de tipo | SATISFEITO | Migração, schema, tipos gerados, badges no catálogo — todos verificados. |
| PRJ-11 | Separação estrita de tipo: VITE_SPA nunca entra no caminho de render LIQUID e vice-versa | SATISFEITO | render.ts guard + type-boundary.test.ts (2 tests pass). |

**PRJ-01 e PRJ-02 orphaned em REQUIREMENTS.md:** Não são orphaned — simplesmente vivem em PROJECT.md por serem requisitos v2.0. O ROADMAP corretamente os referencia pela fonte certa.

---

## Verificação Humana Necessária

### 1. Coexistência LIQUID no catálogo após migração

**Test:** Navegar até o catálogo de LPs e a lista de templates com dados LIQUID existentes no banco
**Expected:** Todos os cards existentes exibem corretamente sem badge "Vite SPA", sem erros de runtime; as ações de preview, edit, export continuam funcionando para LIQUID LPs
**Why human:** Requer banco de dados com dados reais e servidor rodando

### 2. Upload end-to-end de ZIP VITE_SPA

**Test:** Acessar /w/[slug]/project-templates/new, fazer upload de um ZIP de dist/ válido
**Expected:** Template criado com badge "Vite SPA" na lista; arquivo stored no S3 sob workspaces/{wId}/project-templates/{templateId}/dist/; viewer (sem editor role) é redirecionado
**Why human:** Requer servidor + MinIO S3 local + banco de dados ativo

### 3. Rejeições de ZIP inválido

**Test:** Fazer upload de (a) ZIP sem index.html, (b) ZIP com entrada ../etc/passwd, (c) ZIP > 50 MB
**Expected:** Cada caso retorna mensagem de erro clara (não toast genérico de erro), sem dados gravados
**Why human:** Requer servidor rodando para testar fluxo FormData end-to-end

---

## Resumo dos Gaps

**2 gaps bloqueiam o goal completo da fase:**

**Gap 1 — CR-02 (fail-open zip size caps):** O controle de segurança mais crítico do ZIP (rejeição de bombs e arquivos grandes) é fail-open quando env vars são mal configuradas. `parseInt("unlimited")` = NaN, e `zipBuffer.length > NaN` é sempre false, portanto qualquer ZIP passa os checks de tamanho silenciosamente. A fix é simples — uma função `parseMb(value, fallback)` com `Number.isFinite()` guard — mas sem ela o SC-2 do ROADMAP não tem garantia confiável.

**Gap 2 — WR-01 (findings imediatamente descartados por navegação):** O SC-3 do ROADMAP requer que achados do scan sejam "avisados ao usuário antes de concluir (D6)". O toast é mostrado mas diz "Review the findings below" — e não há "below" porque `router.push()` navega no mesmo tick que `setFindings()`. A seção `<section>` de Security Warnings existe no JSX mas nunca é visível quando há achados. O requisito de aviso não está sendo cumprido funcionalmente.

**Nota sobre CR-01** (`validateUploadedImageAction` cross-tenant deletion): esta é uma vulnerabilidade real, mas pré-existente de fases anteriores (Phase 4) e não introduzida pela Phase 6. Não bloqueia o goal desta fase especificamente.

**Itens verificados que passaram:**
- Migração aditiva TEXT+CHECK correta, sem native enum
- Prisma schema e tipos gerados com `kind: string` (não nullable)
- renderLp() type boundary guard ativo e testado
- Secret scan com todos os 5 padrões implementados (advisory-only)
- S3 upload com prefixo tenant-scoped correto
- createProjectTemplateAction com requireWorkspaceRole como primeiro await
- Badges no catálogo para VITE_SPA
- TypeScript compila sem erros (exit 0)
- V2-11 type boundary tests passam (2/2)
- Commits documentados existem no git

---

_Verified: 2026-06-19T10:45:00Z_
_Verifier: Claude (gsd-verifier)_
