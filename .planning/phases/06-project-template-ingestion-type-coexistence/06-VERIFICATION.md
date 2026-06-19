---
phase: 06-project-template-ingestion-type-coexistence
verified: 2026-06-19T11:30:00Z
status: passed
human_verification: approved 2026-06-19 (user)
score: 5/5
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "ZIPs exceeding 50 MB compressed or 200 MB total uncompressed are rejected with a clear error message (CR-02: parseMb() fail-closed guard, MAX_ZIP_MB interpolado na mensagem)"
    - "Scan findings (Supabase JWT, sk_live_, AWS AKIA key, *.lovable.app URL) são retornados como warnings após a criação — achados são avisados ao usuário antes de concluir (D6) (WR-01: router.push() movido para o bloco else, seção Security Warnings permanece visível)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Verificar que LIQUID templates e LPs existentes carregam sem erros após a migração de kind"
    expected: "O catálogo de LPs e a lista de templates exibem corretamente os registros LIQUID existentes, sem badges 'Vite SPA', sem erros de runtime"
    why_human: "Depende de dados reais no banco de dados de desenvolvimento que não podem ser inspecionados programaticamente sem uma conexão ativa ao Postgres"
  - test: "Verificar que o formulário de upload em /w/[slug]/project-templates/new é acessível e funciona end-to-end"
    expected: "Upload de ZIP válido cria template VITE_SPA, aparece no catálogo com badge 'Vite SPA'; upload de ZIP sem index.html rejeita com mensagem clara; upload de ZIP > 50 MB rejeita"
    why_human: "Requer servidor rodando + MinIO S3 local + banco de dados ativo; comportamento de upload de arquivo não verificável via grep"
  - test: "Verificar que a seção Security Warnings é exibida após upload de ZIP com credenciais embutidas"
    expected: "O formulário permanece montado, exibe a seção amber com os achados listados, e o botão 'I've reviewed these — continue to templates' navega para a lista de templates"
    why_human: "Comportamento condicional de UI pós-submit requer servidor e arquivo ZIP com credencial real embutida"
---

# Phase 06: Project-Template Ingestion + Type Coexistence — Relatório de Re-verificação

**Phase Goal:** Cadastrar um projeto Lovable como template VITE_SPA via upload do `dist/` pré-buildado (validado + escaneado + isolado por workspace), coexistindo com templates LIQUID no catálogo. (sem serving ainda)
**Verified:** 2026-06-19T11:30:00Z
**Status:** human_needed
**Re-verification:** Sim — após fechamento dos 2 gaps (commits 0f12e68 e bff03fe)

---

## Resultado Geral

**5 de 5 success criteria do ROADMAP verificados.** Os 2 gaps bloqueantes da verificação inicial foram corrigidos e verificados no código. Nenhuma regressão detectada nos 3 must-haves que já passavam. Itens de verificação humana permanecem da verificação inicial (requerem servidor ativo + banco de dados).

---

## Truths Observáveis (Success Criteria do ROADMAP)

| # | Truth (SC do ROADMAP) | Status | Evidência |
|---|----------------------|--------|-----------|
| 1 | Template e LandingPage têm discriminador kind (LIQUID\|VITE_SPA) via migração aditiva; LIQUID existentes funcionam sem alteração de código de leitura | VERIFICADO | migration.sql: 2 ADD COLUMN, 0 CREATE TYPE/ADD VALUE (regressão confirmada). schema.prisma linhas 217 e 259. renderLp() e listLpsAction usam `kind: lp.kind ?? 'LIQUID'` nos call sites. |
| 2 | ZIP sem index.html, com path traversal (../), ou acima do limite de tamanho é rejeitado com mensagem clara | VERIFICADO | **Gap fechado (commit 0f12e68).** zip-validate.ts linhas 32-36: parseMb() com Number.isFinite(n) && n > 0 — fail-closed para ambos os limites. Linha 38-41: MAX_ZIP_MB para interpolação. Linha 55: erro interpola `${MAX_ZIP_MB} MB`. path.normalize + isAbsolute para zip-slip. uncompressedSize acumulado para zip-bomb. |
| 3 | Upload escaneado por credenciais embutidas; achados avisados ao usuário antes de concluir (D6) | VERIFICADO | **Gap fechado (commit bff03fe).** ProjectTemplateForm.tsx linhas 43-54: router.push() está no bloco else (quando findings.length === 0). Quando findings.length > 0: toast.warning() + permanece na página. Linhas 111-130: seção Security Warnings renderizada com lista de achados + botão explícito para continuar. |
| 4 | dist/ armazenado em S3 sob prefixo tenant-scoped; catálogo e badge de tipo funcionam para ambos os kinds | VERIFICADO | s3-upload.ts linha 57: `workspaces/${workspaceId}/project-templates/${templateId}/dist/`. LpCatalogCard linha 288: `{lp.kind === "VITE_SPA" && <Badge>Vite SPA</Badge>}`. TemplateCard linhas 76-78: badge Vite SPA presente. (regressão confirmada — sem alterações nestes arquivos). |
| 5 | Separação estrita de tipo (V2-11): VITE_SPA → render LIQUID falha explicitamente; coberto por teste de fronteira | VERIFICADO | render.ts linha 52: "Type boundary violation" ainda presente. Vitest: 2 passed, exit 0 (regressão confirmada — rodado durante esta verificação). |

**Pontuação: 5/5 truths verificadas**

---

## Análise dos Gaps Fechados

### Gap 1 — CR-02 (fail-closed zip size caps) — FECHADO

**Commit:** 0f12e68 — `apps/web/src/lib/project-templates/zip-validate.ts`

**Antes:** `parseInt(process.env.PROJECT_TEMPLATE_MAX_ZIP_MB ?? "50")` sem guard. Se a env var fosse `"unlimited"` ou `""`, parseInt retornava NaN, e `zipBuffer.length > NaN` era always-false, desabilitando o controle de tamanho silenciosamente (fail-open).

**Depois:**
```typescript
function parseMb(value: string | undefined, fallbackMb: number): number {
  const n = Number(value);
  const mb = Number.isFinite(n) && n > 0 ? n : fallbackMb;
  return mb * 1024 * 1024;
}

const MAX_ZIP_MB = Number.isFinite(Number(process.env.PROJECT_TEMPLATE_MAX_ZIP_MB)) &&
  Number(process.env.PROJECT_TEMPLATE_MAX_ZIP_MB) > 0
  ? Number(process.env.PROJECT_TEMPLATE_MAX_ZIP_MB)
  : 50;
const MAX_COMPRESSED_BYTES = parseMb(process.env.PROJECT_TEMPLATE_MAX_ZIP_MB, 50);
const MAX_UNCOMPRESSED_BYTES = parseMb(process.env.PROJECT_TEMPLATE_MAX_UNCOMPRESSED_MB, 200);
```

`MAX_ZIP_MB` é usado para interpolar na mensagem de erro da linha 55: `"ZIP file exceeds the ${MAX_ZIP_MB} MB compressed size limit."` — resolve WR-05 parcialmente (apenas para o limite comprimido).

**Nota residual (WARNING, não blocker):** A mensagem de erro do zip-bomb na linha 102 ainda hardcoda `"200 MB"`. Se `PROJECT_TEMPLATE_MAX_UNCOMPRESSED_MB` for configurado com valor diferente, a mensagem divergirá do limite real. O SC-2 do ROADMAP ("rejected with a clear error message") está satisfeito para os valores padrão. Este é WR-05 residual de baixa prioridade.

**Status:** VERIFICADO — fail-closed está garantido; o risco de segurança original (NaN-bypass) está eliminado.

### Gap 2 — WR-01 (findings imediatamente descartados por navegação) — FECHADO

**Commit:** bff03fe — `apps/web/src/app/w/[slug]/project-templates/new/ProjectTemplateForm.tsx`

**Antes:** `router.push()` era chamado incondicionalmente após `setFindings()` e `toast.warning()`, mesmo quando `findings.length > 0`. O componente desmontava no mesmo tick que `setFindings()`, portanto a seção Security Warnings nunca era exibida.

**Depois:**
```typescript
if (result.ok) {
  setFindings(result.data.findings);
  if (result.data.findings.length > 0) {
    // Fica na página — seção Security Warnings renderiza
    toast.warning(`Template created with ${result.data.findings.length} security warning(s). Review the findings below before deploying.`);
  } else {
    toast.success("Project template created.");
    router.push(`/w/${slug}/templates`);  // Só navega quando sem achados
  }
}
```

Seção JSX nas linhas 111-130:
- `findings.length > 0` condicional renderiza a seção amber
- Lista cada achado com `{finding.type}` / `{finding.file}` / `{finding.description}`
- Botão explícito `"I've reviewed these — continue to templates"` chama `router.push()`

**Status:** VERIFICADO — o fluxo D6 está corretamente implementado. A seção Security Warnings é visível após upload com achados, e a navegação só ocorre por ação explícita do usuário.

---

## Artefatos Obrigatórios

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|---------|
| `apps/web/prisma/migrations/0006_kind_discriminator/migration.sql` | ADD COLUMN aditivo TEXT + CHECK | VERIFICADO | 2 ADD COLUMN, 0 CREATE TYPE/ADD VALUE, CHECK ('LIQUID','VITE_SPA') em ambas as tabelas |
| `apps/web/prisma/schema.prisma` | kind String @default("LIQUID") em Template e LandingPage | VERIFICADO | Linhas 217 e 259 |
| `apps/web/src/lib/lps/render.ts` | Type boundary guard — throws em kind === 'VITE_SPA' | VERIFICADO | Linha 52, "Type boundary violation" presente |
| `apps/web/src/lib/project-templates/zip-validate.ts` | validateAndExtractZip com parseMb() fail-closed | VERIFICADO | parseMb() com Number.isFinite guard (linhas 32-36); MAX_ZIP_MB para interpolação; zip-slip e zip-bomb checks presentes |
| `apps/web/src/lib/project-templates/secret-scan.ts` | scanDistFiles com todos os padrões de credencial | VERIFICADO | SUPABASE_JWT, SUPABASE_URL, STRIPE_LIVE_KEY, AWS_ACCESS_KEY, LOVABLE_APP_URL — todos presentes |
| `apps/web/src/lib/project-templates/s3-upload.ts` | uploadDistToS3 tenant-scoped | VERIFICADO | Key: `workspaces/${workspaceId}/project-templates/${templateId}/dist/${entry.fileName}` (linha 57) |
| `apps/web/src/lib/project-templates/actions.ts` | createProjectTemplateAction com pipeline completo | VERIFICADO | requireWorkspaceRole primeiro, kind='VITE_SPA' hardcoded, id=templateId para S3 key match |
| `apps/web/src/app/w/[slug]/project-templates/new/page.tsx` | RSC gate + ProjectTemplateForm mount | VERIFICADO | requireWorkspaceRole antes do mount, ProjectTemplateForm montado |
| `apps/web/src/app/w/[slug]/project-templates/new/ProjectTemplateForm.tsx` | Formulário com file input + exibição de findings antes de navegar | VERIFICADO | router.push() no bloco else; seção Security Warnings renderizada quando findings.length > 0; botão explícito para continuar |
| `apps/web/tests/type-boundary.test.ts` | Teste V2-11: VITE_SPA throws, LIQUID passes | VERIFICADO | 2 testes passam (exit 0, "2 passed") |
| `apps/web/src/components/catalog/LpCatalogCard.tsx` | Badge Vite SPA em VITE_SPA LPs | VERIFICADO | `{lp.kind === "VITE_SPA" && <Badge>Vite SPA</Badge>}` (linha 288) |
| `apps/web/src/components/templates/TemplateCard.tsx` | Badge Vite SPA + import Badge | VERIFICADO | import Badge (linha 24), badge nas linhas 76-78 |
| `apps/web/src/components/catalog/CatalogGrid.tsx` | CatalogLp interface com kind: string | VERIFICADO | Linha 41: `kind: string` |

---

## Verificação de Key Links

| From | To | Via | Status | Detalhes |
|------|----|-----|--------|---------|
| `lps/actions.ts` | `catalog/CatalogGrid.tsx` | `listLpsAction` return inclui kind | VERIFICADO | lps/actions.ts: `kind: lp.kind`; CatalogGrid: `kind: string` |
| `lps/render.ts` | `preview/page.tsx` | `renderLp()` recebe `lp.kind` do DB | VERIFICADO | preview/page.tsx: `kind: lp.kind ?? 'LIQUID'` |
| `project-templates/actions.ts` | `zip-validate.ts` | `validateAndExtractZip()` chamado antes de qualquer escrita | VERIFICADO | actions.ts: validação antes do S3 upload |
| `project-templates/actions.ts` | `secret-scan.ts` | `scanDistFiles()` chamado post-extraction (advisory) | VERIFICADO | actions.ts: `scanDistFiles(validation.entries!)` |
| `project-templates/actions.ts` | `s3-upload.ts` | `uploadDistToS3()` antes do DB write | VERIFICADO | actions.ts: upload antes da persist |
| `project-templates/actions.ts` | `tenant-db.ts` | `db.template.create({ id: templateId, kind: 'VITE_SPA' })` | VERIFICADO | actions.ts: withTenantDb com kind e id corretos |
| `type-boundary.test.ts` | `lps/render.ts` | `renderLp({ kind: 'VITE_SPA' })` rejects com "Type boundary violation" | VERIFICADO | Vitest exit 0, 2 tests passed |

---

## Data-Flow Trace (Level 4)

| Artefato | Variável de Dados | Fonte | Produz Dados Reais | Status |
|----------|-------------------|-------|--------------------|--------|
| `LpCatalogCard.tsx` | `lp.kind` | `listLpsAction` → DB query | Sim — `lp.kind` vem de `.findMany()` com `kind: lp.kind` no map | FLOWING |
| `TemplateCard.tsx` | `template.kind` | `listTemplatesAction` → DB query | Sim — `t.kind` vem de `.findMany()` com `kind: t.kind` no map | FLOWING |
| `ProjectTemplateForm.tsx` | `findings[]` | `createProjectTemplateAction` → `scanDistFiles()` | Sim — findings vem do scan real; `router.push()` só chamado quando findings.length === 0; seção JSX renderiza quando findings.length > 0 | FLOWING |

---

## Checks Comportamentais

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Type boundary test V2-11 | `cd apps/web && npx vitest run tests/type-boundary.test.ts` | "2 passed (2)" — exit 0 | PASS |
| TypeScript compilation | `cd apps/web && npx tsc --noEmit` | Sem saída (exit 0) | PASS |
| migration.sql tem 2 ADD COLUMN | `grep "ADD COLUMN" migration.sql \| wc -l` | `2` | PASS |
| migration.sql sem native enum | `grep -c "CREATE TYPE\|ADD VALUE" migration.sql` | `0` | PASS |
| parseMb() presente em zip-validate | `grep "parseMb\|Number.isFinite" zip-validate.ts` | Ambas presentes (linhas 32-36) | PASS |
| router.push() não incondicionalmente pós-findings | Leitura direta do arquivo | router.push() apenas no bloco `else` (linhas 51-54) | PASS |

---

## Anti-Padrões Encontrados

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| `zip-validate.ts` | 102 | Mensagem hardcoda "200 MB" no erro de zip-bomb em vez de interpolar o limite configurado | WARNING | Se `PROJECT_TEMPLATE_MAX_UNCOMPRESSED_MB` for redefinida, mensagem de erro diverge do limite real (WR-05 residual). SC-2 satisfeito para os valores padrão. |
| `lps/actions.ts` | 568 (pré-existente) | `validateUploadedImageAction` não valida prefixo de workspace em `input.key` | INFORMATIVO | Cross-tenant S3 deletion pré-existente de fases anteriores (Phase 4, CR-01). Não introduzido nem agravado pela Phase 6. |

**Sem novos anti-padrões** introduzidos pelos commits 0f12e68 e bff03fe.

---

## Cobertura de Requisitos

| Requisito | Descrição | Status | Evidência |
|-----------|-----------|--------|---------|
| PRJ-01 | Ingestão de template tipo projeto: upload do dist/ pré-buildado (ZIP) | SATISFEITO | Pipeline completo: validate (fail-closed) → scan → upload → persist. Zip size cap agora fail-closed (CR-02 fechado). |
| PRJ-02 | Validação + scan: estrutura, rejeição de path traversal e tamanho, aviso de credenciais | SATISFEITO | Path traversal, index.html, e tamanho: corretos e fail-closed. Scan implementado e findings agora exibíveis ao usuário (WR-01 fechado). |
| PRJ-03 | Discriminador kind (LIQUID\|VITE_SPA) + coexistência no catálogo com badge de tipo | SATISFEITO | Migração, schema, badges no catálogo — todos verificados e sem regressão. |
| PRJ-11 | Separação estrita de tipo: VITE_SPA nunca entra no caminho de render LIQUID | SATISFEITO | render.ts guard + type-boundary.test.ts (2/2 passam). |

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

### 3. Exibição de Security Warnings após upload com credenciais embutidas

**Test:** Fazer upload de um ZIP de dist/ que contenha uma string AKIA[A-Z0-9]{16} simulada num arquivo JS. Submeter o formulário.
**Expected:** (a) toast.warning é mostrado; (b) a seção "Security Warnings" amber é exibida na página com o achado listado; (c) o formulário não navega automaticamente; (d) o botão "I've reviewed these — continue to templates" navega para a lista de templates ao ser clicado.
**Why human:** Comportamento condicional de UI pós-submit requer servidor rodando + arquivo ZIP com credencial simulada embutida

### 4. Rejeições de ZIP inválido

**Test:** Fazer upload de (a) ZIP sem index.html, (b) ZIP com entrada ../etc/passwd, (c) ZIP > 50 MB
**Expected:** Cada caso retorna toast.error com mensagem clara, sem dados gravados no S3 ou no banco
**Why human:** Requer servidor rodando para testar fluxo FormData end-to-end

---

## Regressões Verificadas

Os commits de correção (0f12e68, bff03fe) tocaram exclusivamente:
- `apps/web/src/lib/project-templates/zip-validate.ts` (+20 linhas, -6)
- `apps/web/src/app/w/[slug]/project-templates/new/ProjectTemplateForm.tsx` (+10 linhas, -1)

Nenhum arquivo verificado nos SC-1, SC-4, SC-5 foi modificado. Verificações de regressão executadas:
- SC-1: migration.sql = 2 ADD COLUMN, 0 CREATE TYPE (PASS)
- SC-4: badges em LpCatalogCard e TemplateCard presentes (PASS), s3-upload.ts key prefix correto (PASS)
- SC-5: render.ts "Type boundary violation" presente (PASS), Vitest 2/2 passed (PASS)
- TypeScript: `tsc --noEmit` exit 0 (PASS)

---

_Verified: 2026-06-19T11:30:00Z_
_Verifier: Claude (gsd-verifier) — re-verificação após gap closure_
