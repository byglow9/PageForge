# Phase 4: LP Generation, Assets, Preview & Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 4-LP Generation, Assets, Preview & Export
**Areas discussed:** Armazenamento de imagens, Globals (snapshot vs live), Reconciliação de schema_version, Geração + export bundle

---

## Armazenamento de imagens (AST-01)

### Q1 — Backend de storage para o v1

| Option | Description | Selected |
|--------|-------------|----------|
| S3-compatível (MinIO/R2) | MinIO via Docker no dev, R2/S3 em prod; portável, escala, bytes fora do app server | ✓ |
| Disco local do servidor | Mais simples, mas quebra em serverless/efêmero e exige migração de paths depois | |
| Você decide | Deixar researcher/planner escolherem | |

**User's choice:** S3-compatível (MinIO/R2)

### Q2 — Mecanismo de upload

| Option | Description | Selected |
|--------|-------------|----------|
| Presigned direto ao bucket | Server gera presigned PUT, browser sobe direto; bytes fora do app server | ✓ |
| Via Server Action/route | Upload passa pelo servidor Next.js que valida e grava | |
| Você decide | Deixar para o planner alinhar | |

**User's choice:** Presigned direto ao bucket
**Notes:** Validação por magic bytes + cap de tamanho/pixels + path tenant-scoped já travada pelo critério 2 do roadmap.

---

## Globals: snapshot vs live

### Q1 — Marca congelada na LP ou BrandConfig atual

| Option | Description | Selected |
|--------|-------------|----------|
| Live (sempre o atual) | LP não guarda marca; cada preview/export resolve o BrandConfig atual | ✓ |
| Snapshot ao gerar | Valores copiados para a LP no momento da geração | |
| Você decide | Deixar researcher/planner pesarem | |

**User's choice:** Live (sempre o atual)

### Q2 — Campo de marca vazio/não preenchido

| Option | Description | Selected |
|--------|-------------|----------|
| Renderiza vazio/omitido | Token de marca ausente → string vazia (comportamento atual do engine) | ✓ |
| Avisa antes de gerar | Aviso não-bloqueante se template usa brand.* sem valor | |
| Você decide | Default: renderiza vazio | |

**User's choice:** Renderiza vazio/omitido

---

## Reconciliação de schema_version

### Q1 — Markup atual do template vs snapshot na LP

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot na LP | LP guarda markup + schema_version da geração; edições no template não afetam LPs existentes | ✓ |
| Live (markup atual) | LP só referencia o template; render usa markup atual | |
| Você decide | Default lean snapshot (layout fidelity) | |

**User's choice:** Snapshot na LP
**Notes:** Assimetria deliberada com a escolha de globals — markup é snapshot (estabilidade de layout), brand é live (propagação intencional).

### Q2 — Tratamento dos valores salvos quando o template muda de versão

| Option | Description | Selected |
|--------|-------------|----------|
| Reconciliar por nome | Mantém valores de campos existentes, descarta removidos, default para novos (padrão Fase 3 D-05) | ✓ |
| Fixar no schema antigo | LP continua na versão de geração; "atualizar" é ação opt-in explícita | |
| Você decide | Default: reconciliar por nome | |

**User's choice:** Reconciliar por nome

---

## Geração + export bundle

### Q1 — Forma do bundle de export

| Option | Description | Selected |
|--------|-------------|----------|
| ZIP com index.html + ./assets | Baixa imagens server-side, reescreve src relativo, streama ZIP (CLAUDE.md Mode b) | ✓ |
| HTML único com imagens inline | Um .html com imagens base64; arquivos grandes, sem cache | |
| Você decide | Default: ZIP com ./assets | |

**User's choice:** ZIP com index.html + ./assets

### Q2 — Identidade da LP ao gerar

| Option | Description | Selected |
|--------|-------------|----------|
| Usuário nomeia ao gerar | Campo de nome no form/save; catalogável por nome legível | ✓ |
| Default auto + editável | Nome auto tipo "Grécia — 06/06/2026", editável depois | |
| Você decide | Default: nome auto editável | |

**User's choice:** Usuário nomeia ao gerar

### Q3 — Semântica de duplicar (LP-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Cópia completa independente | Copia valores + snapshot markup/schema_version; nova LP independente | ✓ |
| Só valores, re-resolve template | Copia valores e re-aponta para o template atual | |
| Você decide | Default: cópia completa independente | |

**User's choice:** Cópia completa independente

---

## Claude's Discretion

- Interação de add/remover em repeaters (React Hook Form `useFieldArray`); blocos colapsáveis ou não.
- Surface do preview (iframe inline / nova aba / lado a lado) — deferido ao `/gsd-ui-phase`.
- Shape Prisma do modelo `LandingPage` (values jsonb, snapshot de markup, schemaVersion, name, workspaceId) e dos registros de asset.
- Interface de abstração de storage (swap MinIO/R2/S3) e shape da rota/Server Action de presigned URL.
- String exata da CSP estrita do HTML exportado.
- Persistir HTML gerado vs sempre regenerar (regeneração é barata; HTML é derivado de dado).

## Deferred Ideas

- Catálogo (pastas, categorias, browse/search) — Fase 5 (CAT-01..04).
- Aceitação end-to-end da Grécia — Fase 5.
- Validação avançada (regex, dimensões de imagem, ranges) — v2 VAL-01.
- Caps de imagem configuráveis pelo autor — v1 usa defaults fixos.
- Aviso "configure sua marca" para brand.* não preenchido — nice-to-have opcional.
- URLs hospedadas da LP — v2 HOST-01.
- Design visual de form/preview — `/gsd-ui-phase`.
