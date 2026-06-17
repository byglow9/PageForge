---
phase: 03-template-authoring-brand-config
verified: 2026-06-05T22:00:00Z
status: verified
human_verified: 2026-06-08T13:10:00Z
human_verification_result: "6/6 passed — see 03-HUMAN-UAT.md"
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Criar template com {{ title:text }} {{ description:rich_text }} e salvar"
    expected: "Schema panel mostra 2 campos com badges coloridos; toast 'Template saved — schema v1' aparece; template persiste ao recarregar"
    why_human: "Requer browser e banco de dados ao vivo para verificar a pipeline completa create → parse → persist → display"
  - test: "Editar o mesmo template — alterar markup e salvar novamente"
    expected: "Schema panel atualiza em tempo real com debounce 400ms; toast 'Template saved — schema v2' aparece (schemaVersion incrementado)"
    why_human: "Comportamento de increment de versão requer interação real com DB e UI"
  - test: "Excluir template via dialog de confirmação"
    expected: "Dialog exibe nome do template, botão 'Delete template' (destructive), card some otimisticamente após confirmação, toast 'Template deleted.'"
    why_human: "Fluxo de interação UI + ação de servidor ao vivo"
  - test: "Navegar para /w/[slug]/brand, preencher cor '#ff6600', verificar swatch"
    expected: "Swatch de 24x24px muda para laranja em tempo real ao digitar; ao salvar, toast 'Brand settings saved.' aparece; bloco de tokens brand.* mostra valores resolvidos"
    why_human: "Comportamento visual (swatch live) requer browser; persistência requer DB"
  - test: "Testar conta com role viewer no formulário de brand"
    expected: "Todos os campos estão disabled, botão 'Save Brand Settings' não aparece (renderizado condicionalmente via canEdit=false)"
    why_human: "Requer autenticação com conta viewer real e navegação"
  - test: "Inserir 'http://insecure.com' no campo logoUrl e perder foco"
    expected: "Mensagem de erro inline 'Enter a valid URL starting with https://.' aparece sem submeter o formulário"
    why_human: "Comportamento de validação onBlur requer interação de browser"
---

# Phase 3: Template Authoring + Brand Config — Verification Report

**Phase Goal:** Let users author and edit token-markup templates with all six field types and configure reusable global brand/contact values, persisting markup + parsed schema scoped to the workspace.
**Verified:** 2026-06-05T22:00:00Z
**Status:** verified (human UAT 6/6 passed em 2026-06-08 — ver 03-HUMAN-UAT.md)
**Re-verification:** No — verificação inicial

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Usuário pode criar template com tokens; ao salvar é parseado em schema tipado e persistido com schema_version scoped ao workspace | ✓ VERIFIED | `createTemplateAction` chama `parse(markup)` server-side, salva via `db.template.create` com `workspaceId` da sessão. Migration 0004 cria tabela com `schemaVersion INTEGER NOT NULL DEFAULT 1`. Fluxo RSC: `/w/[slug]/templates/new` gatea com `requireWorkspaceRole` + monta `<TemplateEditor mode="create" />` |
| 2 | Cada token recebe um dos seis tipos (text, rich text, image, color, button+URL, repeater), com warnings para tipos desconhecidos ou repeaters não fechados | ✓ VERIFIED | `SchemaPanel.tsx` renderiza badges coloridos por tipo (`text-blue-700` para tipos base, `text-purple-700` para repeater, `text-green-700` para brand/global). `TemplateEditor` debounce 400ms chama `parse()` client-side. Warnings renderizados como `<Alert>` (D-03: não bloqueiam save). Engine do Phase 1 provê o parsing. |
| 3 | Usuário pode editar template existente; schema é re-derivado; templates são listados e selecionáveis no workspace | ✓ VERIFIED | `updateTemplateAction` re-parseia markup se fornecido; `schemaVersion: { increment: 1 }` em `TenantClient.template.update`. `/w/[slug]/templates` lista via `listTemplatesAction`. `/w/[slug]/templates/[id]/edit` busca via `db.template.findById(id)`. `TemplateCard` com links de edit. |
| 4 | Usuário pode configurar brand/contact values (logo, primary color, WhatsApp) uma vez por workspace; templates podem referenciar esses globais | ✓ VERIFIED | `saveBrandConfigAction` usa `db.brandConfig.upsert({ where: { workspaceId } })`. `BrandConfigForm` exibe bloco de tokens `brand.logo`, `brand.primary_color`, `brand.whatsapp`. `SchemaPanel` marca campos `field.global === true` com badge verde "brand". |

**Score:** 4/4 critérios de sucesso do roadmap verificados

### Critérios das Must-Haves do Plan (Todos os 4 Planos)

| # | Must-Have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `pageforge-engine` importável em `apps/web` | ✓ VERIFIED | `apps/web/package.json` tem `"pageforge-engine": "workspace:*"`. `next.config.ts` tem `transpilePackages: ["pageforge-engine"]`. `TemplateEditor.tsx` importa `parse` de `"pageforge-engine"`. |
| 2 | Modelos Template e BrandConfig com workspaceId em schema.prisma | ✓ VERIFIED | `schema.prisma` linhas 204–236 contém ambos os modelos com `workspaceId String`, relações com `Workspace`, `@@map("template")` / `@@map("brand_config")`. Back-refs `templates Template[]` e `brandConfig BrandConfig?` em `Workspace`. |
| 3 | TenantClient expõe `template` e `brandConfig` helpers | ✓ VERIFIED | `tenant-db.ts` linhas 129–138: `TenantClient` interface com `readonly template: TenantTemplateHelpers` e `readonly brandConfig: TenantBrandHelpers`. Implementações em `withTenantDb` nas linhas 205–274. |
| 4 | `reconcileMetadataOverlay` pura existe e testes passam | ✓ VERIFIED | `metadata.ts` linhas 56–77: função pura conforme D-05. `metadata.test.ts` cobre 4 casos (defaults, preserva, descarta, exclui globals). |
| 5 | Zod schemas CreateTemplate, UpdateTemplate, SaveBrandConfig definidos e validados | ✓ VERIFIED | `templates/schema.ts`: `CreateTemplateSchema` + `UpdateTemplateSchema`. `brand/schema.ts`: `SaveBrandConfigSchema` com regex `/^#[0-9a-fA-F]{6}$/` e `.startsWith("https://")`. Testes cobrem hex inválido `#gg0000`, `http://`, vazio aceito. |
| 6 | shadcn/ui inicializado com preset neutro e 13 componentes instalados | ✓ VERIFIED | `components.json` confirma `baseColor: neutral`, `cssVariables: true`. `src/components/ui/` contém: alert, badge, button, card, dialog, input, label, separator, skeleton, sonner, switch, textarea, tooltip (13 componentes). |
| 7 | Tabelas `template` e `brand_config` com RLS em PostgreSQL | ✓ VERIFIED | `migration.sql` (0004) contém `CREATE TABLE "template"` com `schemaVersion INTEGER NOT NULL DEFAULT 1`, `CREATE TABLE "brand_config"` com `workspaceId UNIQUE`. Blocos RLS: `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, `CREATE POLICY tenant_isolation` com `current_setting('app.current_workspace_id', true)` para ambas as tabelas. |

**Score:** 7/7 must-haves verificados

### Deferred Items

Não há itens diferidos — todos os critérios do Phase 3 estão cobertos. Nota: BRD-02 aparece também em Phase 4 (Requirements do ROADMAP), mas o aspecto Phase 3 (persistência dos valores, referência via tokens `brand.*`) está completo. A fase 4 consome esses valores no render do LP.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/templates/metadata.ts` | `reconcileMetadataOverlay`, `FieldMeta`, `MetadataOverlay` | ✓ VERIFIED | Exporta todos os 3. Função pura, sem "use server". |
| `apps/web/src/lib/templates/schema.ts` | `CreateTemplateSchema`, `UpdateTemplateSchema`, tipos | ✓ VERIFIED | Exporta todos. Zod v4 com `z.record(z.string(), ...)`. |
| `apps/web/src/lib/brand/schema.ts` | `SaveBrandConfigSchema`, `SaveBrandConfigInput` | ✓ VERIFIED | Regex hex + https:// validações presentes. |
| `apps/web/src/lib/db/tenant-db.ts` | TenantClient com template + brandConfig helpers | ✓ VERIFIED | Interfaces e implementações completas. `schemaVersion: { increment: 1 }` em `update`. |
| `apps/web/src/lib/templates/actions.ts` | createTemplateAction, updateTemplateAction, deleteTemplateAction, listTemplatesAction | ✓ VERIFIED | "use server", `requireWorkspaceRole(["owner","admin","editor"])`, `parse(markup)` server-side, `reconcileMetadataOverlay`. |
| `apps/web/src/lib/brand/actions.ts` | saveBrandConfigAction, getBrandConfigAction | ✓ VERIFIED | `requireWorkspaceRole` para save, `requireWorkspace` para read, `db.brandConfig.upsert`. |
| `apps/web/src/app/w/[slug]/templates/page.tsx` | Template list RSC | ✓ VERIFIED | `requireWorkspace` + `listTemplatesAction` + grid ou empty state com `FileCode`. |
| `apps/web/src/app/w/[slug]/templates/new/page.tsx` | New template RSC | ✓ VERIFIED | `requireWorkspaceRole(["owner","admin","editor"])` + `<TemplateEditor mode="create">`. |
| `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx` | Edit template RSC | ✓ VERIFIED | `requireWorkspaceRole` + `withTenantDb` + `ParsedSchemaValidator` + redirect se null. |
| `apps/web/src/components/templates/TemplateEditor.tsx` | Client island com editor + SchemaPanel | ✓ VERIFIED | "use client", `parse` (não `render`), debounce 400ms, `useTransition` + actions, metadata overlay. |
| `apps/web/src/components/templates/SchemaPanel.tsx` | Live parse results panel | ✓ VERIFIED | `aria-live="polite"`, badges coloridos para todos os tipos, warnings amber. |
| `apps/web/src/components/templates/TemplateCard.tsx` | Card para lista | ✓ VERIFIED | Card com nome, vN badge, field summary, edit link, delete dialog. |
| `apps/web/src/components/templates/DeleteTemplateDialog.tsx` | Dialog de confirmação | ✓ VERIFIED | Dialog com texto correto, `deleteTemplateAction`, toast em sucesso/erro. |
| `apps/web/src/app/w/[slug]/brand/page.tsx` | Brand Settings RSC | ✓ VERIFIED | `requireWorkspace` + `db.brandConfig.findFirst()` server-side + `canEdit` derivado do role. |
| `apps/web/src/components/brand/BrandConfigForm.tsx` | Client island de brand | ✓ VERIFIED | Swatch live, validação onBlur, token reference block, save disabled para viewer. |
| `apps/web/tests/metadata.test.ts` | Testes unitários de reconcileMetadataOverlay | ✓ VERIFIED | 4 testes cobrindo D-05 completo. |
| `apps/web/tests/templates.test.ts` | Testes de schemas e source assertions | ✓ VERIFIED | 13 testes de schema + 3 source assertions (require/actions/increment). |
| `apps/web/tests/brand.test.ts` | Testes de SaveBrandConfigSchema + permissões | ✓ VERIFIED | 14 testes de schema + 5 permission tests + 1 source assertion. |
| `apps/web/prisma/migrations/0004_add_template_brand_config/migration.sql` | CREATE TABLE + RLS blocks | ✓ VERIFIED | Ambas as tabelas com `schemaVersion`, `workspaceId UNIQUE` (brand_config), 6 statements RLS. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `metadata.ts` | `pageforge-engine TokenField` | `import type { TokenField } from "pageforge-engine"` | ✓ WIRED | Linha 10 do metadata.ts confirmada. |
| `tenant-db.ts` | `TenantTemplateHelpers` | `readonly template: TenantTemplateHelpers` em `TenantClient` | ✓ WIRED | Linha 135 do tenant-db.ts confirmada. |
| `TemplateEditor.tsx` | `actions.ts` | `createTemplateAction` / `updateTemplateAction` via `useTransition` | ✓ WIRED | Linha 32: `import { createTemplateAction, updateTemplateAction }`. Linha 127/130: chamadas em `startTransition`. |
| `edit/page.tsx` | `tenant-db.ts` | `withTenantDb → db.template.findById(id)` | ✓ WIRED | Linhas 31–33 de edit/page.tsx confirmadas. |
| `actions.ts` | `parse()` de pageforge-engine | `import { parse } from "pageforge-engine"` server-side | ✓ WIRED | Linha 30 de actions.ts; chamada `parse(markup)` na linha 81. Sem import de `render`. |
| `BrandConfigForm.tsx` | `brand/actions.ts` | `saveBrandConfigAction` via `useTransition` | ✓ WIRED | Linha 33: `import { saveBrandConfigAction }`. Linha 102: chamada em `startTransition`. |
| `brand/page.tsx` | `tenant-db.ts` | `withTenantDb → db.brandConfig.findFirst()` | ✓ WIRED | Linhas 31–34 de brand/page.tsx confirmadas. |
| `brand/actions.ts` | `brand_config` PostgreSQL | `withTenantDb → db.brandConfig.upsert` | ✓ WIRED | Linhas 69–77 de brand/actions.ts com `db.brandConfig.upsert`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `TemplateEditor.tsx` | `liveSchema` (advisory) | `parse(markup)` client-side via debounce | Parse do engine no browser | ✓ FLOWING |
| `TemplateEditor.tsx` | `savedSchemaVersion` | Retorno de `createTemplateAction` / `updateTemplateAction` | DB via `db.template.create/update` | ✓ FLOWING |
| `templates/page.tsx` | `templates[]` | `listTemplatesAction(slug)` → `db.template.list()` | `tx.template.findMany({ where: { workspaceId } })` | ✓ FLOWING |
| `edit/page.tsx` | `template` (inicial) | `db.template.findById(id)` em RSC | `tx.template.findFirst({ where: { id, workspaceId } })` | ✓ FLOWING |
| `BrandConfigForm.tsx` | `logoUrl`, `primaryColor`, `whatsapp` | `initial` prop do RSC (server-fetched) | `db.brandConfig.findFirst()` → `tx.brandConfig.findFirst` | ✓ FLOWING |
| `SchemaPanel.tsx` | `schema` prop | `liveSchema` de `TemplateEditor` | `parse()` do engine (real parse, não mock) | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED para UI/client components (requerem browser). A suíte de testes unitários substitui os spot-checks para lógica de negócio pura.

Verificações de código verificáveis:

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `render` não importado em components | `grep -rE "import.*\brender\b.*pageforge-engine" apps/web/src/components/` | 0 linhas | ✓ PASS |
| Badges coloridos no SchemaPanel | `grep -E "text-blue-700\|text-purple-700\|text-green-700\|text-amber-800" SchemaPanel.tsx` | 4+ matches encontrados | ✓ PASS |
| Migration SQL com 6+ statements RLS | migration.sql tem `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, `CREATE POLICY` × 2 tabelas | 6 statements confirmados | ✓ PASS |
| schemaVersion `{ increment: 1 }` em update | `grep "increment" tenant-db.ts` | Linha 240 confirmada | ✓ PASS |
| shadcn 13 componentes instalados | `ls src/components/ui/` | 13 arquivos confirmados | ✓ PASS |

### Probe Execution

Step 7c: Não aplicável — nenhum probe convencional `scripts/*/tests/probe-*.sh` identificado. A fase não declara probes em PLAN frontmatter.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TPL-01 | 03-01, 03-03 | User can create template by writing markup with tokens | ✓ SATISFIED | `createTemplateAction` + `/w/[slug]/templates/new` + `TemplateEditor` create mode |
| TPL-03 | 03-03 | User can assign type to each token (text, rich text, image, color, button+URL, repeater) | ✓ SATISFIED | `SchemaPanel` badges por tipo; engine detecta todos os 6 tipos via `parse()`; `TemplateEditor` live debounce |
| TPL-05 | 03-03 | User can edit an existing template | ✓ SATISFIED | `updateTemplateAction` + `/w/[slug]/templates/[id]/edit` + `TemplateEditor` edit mode + schemaVersion increment |
| TPL-06 | 03-03 | Templates are listed and selectable within the workspace | ✓ SATISFIED | `/w/[slug]/templates` com `listTemplatesAction` + `TemplateCard` grid + empty state + link para edit |
| BRD-01 | 03-04 | User can configure global brand/contact values per workspace | ✓ SATISFIED | `/w/[slug]/brand` + `saveBrandConfigAction` com upsert semântico + `BrandConfigForm` com 3 campos |
| BRD-02 | 03-01, 03-04 | Templates can reference global brand values | ✓ SATISFIED (Phase 3 scope) | `brand.*` tokens exibidos como green badges no `SchemaPanel`; valores `brand.logo/primary_color/whatsapp` persistidos no `BrandConfig`; Phase 4 consomirá esses valores em `render()` |

**Note:** BRD-02 aparece também em Phase 4 Requirements — o aspecto "generated LPs use them automatically" é de Phase 4 (render). O aspecto Phase 3 (persistência + referência de token) está satisfeito.

**Observação sobre TPL-04:** TPL-04 ("User can define repeatable blocks") está mapeado ao Phase 1 (engine-level) no REQUIREMENTS.md, não ao Phase 3. A UI do Phase 3 suporta repeaters via `SchemaPanel` (badge purple) e `reconcileMetadataOverlay` (filtra campos de repeaters por nome), mas a *definição* de repeater é engine-level (Phase 1). Sem gap — escopo correto.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `BrandConfigForm.tsx` | 192 | `style={{ width: "24px", height: "24px", backgroundColor: swatchColor }}` | ℹ️ Info | `style={{}}` inline para swatch de cor é justificado — o backgroundColor é computado dinamicamente do valor hex validado. Não é um anti-pattern real; Tailwind não suporta cores dinâmicas arbitrárias sem classes geradas. |

Nenhum `TBD`, `FIXME`, `XXX`, `return null` indevido, ou implementação stub encontrado nos arquivos principais da fase.

### Human Verification Required

#### 1. Create template end-to-end

**Test:** Navegar para `/w/[slug]/templates/new`, escrever `<h1>{{ hero:text }}</h1> {{ desc:rich_text }}` no textarea
**Expected:** SchemaPanel exibe 2 campos com badges azuis após 400ms; salvar mostra toast "Template saved — schema v1"; template aparece na lista como card
**Why human:** Pipeline create → parse → persist → UI update requer browser + DB ao vivo

#### 2. Edit template e schema version increment

**Test:** Abrir template criado, adicionar `{{ img:image }}`, salvar
**Expected:** SchemaPanel atualiza com 3 campos; toast "Template saved — schema v2"
**Why human:** Verificação de increment de schemaVersion requer round-trip ao DB

#### 3. Delete template via dialog

**Test:** Clicar em kebab menu do TemplateCard, selecionar "Delete template", confirmar no dialog
**Expected:** Dialog mostra "This will permanently delete '{name}' and cannot be undone."; card desaparece otimisticamente; toast "Template deleted."
**Why human:** Interação de UI multi-step + ação ao vivo

#### 4. Brand Settings — live color swatch

**Test:** Navegar para `/w/[slug]/brand`, digitar `#ff6600` no campo Primary Color
**Expected:** Swatch de 24×24px muda para laranja em tempo real; bloco brand tokens atualiza para `brand.primary_color = #ff6600`
**Why human:** Comportamento visual em tempo real requer browser

#### 5. Brand Settings — viewer RBAC

**Test:** Fazer login com conta com role viewer; navegar para `/w/[slug]/brand`
**Expected:** Todos os 3 campos estão disabled; botão "Save Brand Settings" não aparece; página carrega normalmente
**Why human:** Requer conta viewer real + sessão autenticada

#### 6. Brand Settings — URL validation on blur

**Test:** Digitar `http://insecure.com` no campo Logo URL e clicar fora do campo
**Expected:** Erro inline "Enter a valid URL starting with https://." aparece abaixo do campo sem submeter o formulário
**Why human:** Comportamento de validação onBlur requer interação de browser

### Gaps Summary

Nenhum gap de implementação identificado. Todos os 7 must-haves, 4 critérios de sucesso do roadmap, 6 IDs de requisito e todos os artefatos e links-chave estão VERIFIED no código-fonte.

O status `human_needed` reflete que 6 verificações de comportamento de UI e fluxo de usuário (interações de browser, comportamento visual em tempo real, autenticação de roles) não podem ser confirmadas por análise estática. A arquitetura, a lógica e as conexões estão todas corretas e completas.

---

*Verified: 2026-06-05T22:00:00Z*
*Verifier: Claude (gsd-verifier)*
