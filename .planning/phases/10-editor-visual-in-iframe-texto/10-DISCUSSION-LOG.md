# Phase 10: Editor visual in-iframe (texto) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 10-editor-visual-in-iframe-texto
**Areas discussed:** Modo edição, Seleção do elemento, Onde digitar o texto, Salvar e descartar, Escopo (tipos de elemento)

---

## Modo edição (EDIT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Barra acima da preview | Botão "Editar" ↔ "Concluir" em toolbar no dashboard (fora do iframe) + banner/borda | ✓ |
| Botão flutuante na preview | Controle flutuante no canto da preview | |
| Você decide | Critério do builder | |

**User's choice:** Barra acima da preview (Recomendado)
**Notes:** Coerente com o contexto cross-origin — toggle no parent, ativação via postMessage.

---

## Seleção do elemento (EDIT-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Só textos, com hover+realce | Apenas folhas de texto; outline no hover + realce no selecionado | (parcial) |
| Qualquer elemento clicável | Qualquer nó selecionável | |
| Você decide | Critério do builder | |

**User's choice:** Free-text — "texto, imagem, cor de lugar etc"
**Notes:** Apontou para um editor multi-tipo (texto/imagem/cor/reposicionar). Tratado como escopo: redirecionado — Fase 10 fica só texto; ver área "Escopo" abaixo. Seleção desta fase = elementos de texto (folhas) com hover+realce.

---

## Onde digitar o texto (EDIT-03)

| Option | Description | Selected |
|--------|-------------|----------|
| In-place no iframe | contentEditable no próprio elemento (script injetado); salvar via postMessage | ✓ |
| Painel lateral no dashboard | Campo de texto no dashboard edita o elemento selecionado | |
| Você decide | Critério do builder | |

**User's choice:** In-place no iframe (Recomendado)
**Notes:** WYSIWYG fiel ao layout.

---

## Salvar e descartar (EDIT-03 / EDIT-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Em lote + Descartar | Acumula edições, "Salvar alterações" persiste tudo; "Descartar" reverte não salvo | ✓ |
| Salvar por elemento | Cada edição persiste na hora | |
| Você decide | Critério do builder | |

**User's choice:** Em lote + Descartar (Recomendado)
**Notes:** Menos chamadas ao servidor; descarte claro (EDIT-07).

---

## Escopo (tipos de elemento)

| Option | Description | Selected |
|--------|-------------|----------|
| Texto agora, casca extensível | Fase 10 = texto; arquitetura pronta p/ imagem/link/cor depois | ✓ (via free-text) |
| Incluir cor já na Fase 10 | Adicionar controle de cor por LP (EDIT-06) | |
| Reposicionar elementos | Discutir mover elementos (não está no roadmap) | |

**User's choice:** Free-text — "deixa pra fase 11 mesmo então"
**Notes:** Confirma Fase 10 = só texto; imagem/link/cor → Fase 11; reposicionar → backlog. Casca do editor deve nascer extensível.

---

## Claude's Discretion

- Cálculo exato do `path` do nó e do `originalHash` (deve casar com o apply-shim da Fase 9).
- Protocolo `postMessage` (shape/eventos/handshake) e allowlist de origem.
- Como injetar o script de edição só em modo edição + papel autorizado, sem expor no host público/export.
- Reflexo da preview após salvar (reload do iframe vs reaplicação otimista).

## Deferred Ideas

- Imagem (EDIT-04) e link/href (EDIT-05) → Fase 11.
- Controle de UI de cor por LP (EDIT-06) → Fase 11 (dado já existe da Fase 9).
- Reposicionar/mover elementos → backlog (fora do roadmap).
- Hardening (MutationObserver, drift, sanitização, E2E) → Fase 12.
