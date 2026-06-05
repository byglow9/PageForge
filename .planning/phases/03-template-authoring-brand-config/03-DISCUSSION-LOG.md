# Phase 3: Template Authoring + Brand Config - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 3-Template Authoring + Brand Config
**Areas discussed:** Editor + parse feedback, Per-field metadata, Brand config + logo, schema_version + re-derive

---

## Editor + Parse Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Editor + painel ao vivo | Editor de código monospace + painel lateral com campos detectados e warnings ao vivo (debounced); parse autoritativo no save | ✓ |
| Só no salvar | Textarea simples; parse só ao salvar, feedback num banner pós-save | |
| Split com preview renderizado | Editor + preview HTML renderizado ao vivo (encosta na Fase 4) | |

**User's choice:** Editor + painel ao vivo
**Notes:** Feedback contínuo de campos/warnings cumpre o critério 2 de forma visível; parse de verdade no save (D-01, D-02).

---

## Per-Field Metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Label + obrigatório editáveis | Autor define label amigável e flag de obrigatório por campo; persistido junto ao schema para a Fase 4 | ✓ |
| Só label amigável | Apenas label editável, sem flag de obrigatório | |
| Só auto-derivado | Schema fica name=label, sem metadados; Fase 4 decide | |

**User's choice:** Label + obrigatório editáveis
**Notes:** Resolve o metadado adiado em Phase 1 D-05. Decisão derivada (sem re-perguntar): metadados ficam num overlay no app (engine permanece puro) e são reconciliados com o novo conjunto de campos a cada re-parse (D-04, D-05).

---

## Brand Config + Logo

| Option | Description | Selected |
|--------|-------------|----------|
| Campos fixos + logo por URL | Conjunto fixo (logo, primary_color, whatsapp) por workspace; logo como URL colada; upload fica para Fase 4 | ✓ |
| Chave-valor flexível | Mapa flexível casando com quaisquer tokens brand.*; logo por URL | |
| Antecipar upload do logo | Trazer upload de imagem (S3) para cá só para o logo (escopo da Fase 4) | |

**User's choice:** Campos fixos + logo por URL
**Notes:** Campos alinhados aos tokens brand.* da Fase 1 (brand.logo / brand.primary_color / brand.whatsapp). Logo-as-URL é atalho deliberado do v1; upload real é AST-01 na Fase 4 (D-07, D-08).

---

## schema_version + Re-derive

| Option | Description | Selected |
|--------|-------------|----------|
| Inteiro incremental por template | Cada save re-parseia e incrementa schema_version; persiste markup + schema; não migra LPs | ✓ |
| Hash do schema derivado | Versão = hash da forma do schema | |
| Timestamp / updatedAt | Sem campo dedicado; usa updatedAt | |

**User's choice:** Inteiro incremental por template
**Notes:** Carimbo de rastreabilidade, não sistema de migração. LPs são Fase 4; Phase 3 só versiona o template (D-10, D-11).

---

## Claude's Discretion

- Biblioteca de editor (textarea vs. CodeMirror/Monaco) e se o parse ao vivo roda client-side (parse não sanitiza, pode ser bundle-safe) ou via Server Action debounced.
- Forma exata do schema Prisma do Template e da tabela de brand config (jsonb único vs. separado, índices), sempre com workspaceId atrás do withTenantDb.
- Apresentação da lista de templates (tabela vs. cards) e empty states.
- Como surfacing dos tokens brand.* que um template depende (nice-to-have).

## Deferred Ideas

- Upload de imagem (logo e image fields) — Fase 4 (AST-01).
- Form dinâmico, preview, export — Fase 4.
- Migração de LPs em mudança de schema — Fase 4+; Phase 3 só carimba schema_version.
- Brand fields arbitrários/free-form — v1 é conjunto fixo.
- Validação avançada (regex, ranges, dimensões) — v2 (VAL-01).
- Duplicação de template / histórico de schema versionado — fora do escopo.
