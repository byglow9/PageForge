# Phase 11: Imagens + links - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 11-imagens-links
**Areas discussed:** Troca de imagem (upload vs URL), Edição de href do link, Validação de URL + erro, Imagem no export ZIP

---

## Troca de imagem: upload vs URL

| Option | Description | Selected |
|--------|-------------|----------|
| Painel único (upload + campo URL) | Botão "Enviar arquivo" + campo "ou cole uma URL" juntos; reusa ImageUploadField/presigned | ✓ |
| Duas abas (Upload \| URL) | Abas separadas para upload e URL | |
| Você decide | Researcher/planner escolhe | |

**User's choice:** Painel único (upload + campo URL)
**Notes:** Menos cliques, ambos os caminhos visíveis; reutiliza o mecanismo presigned existente no slot por-tipo reservado da toolbar (D-04 da Fase 10).

---

## Edição de href do link

| Option | Description | Selected |
|--------|-------------|----------|
| Campo de URL na toolbar (texto e href separados) | Selecionar `<a>` abre campo de href no slot; editar texto e destino são fluxos distintos | ✓ |
| Texto + href no mesmo fluxo | Edita texto inline e href ao mesmo tempo, salva juntos | |
| Você decide | Planner define | |

**User's choice:** Campo de URL na toolbar (texto e href separados)
**Notes:** Selecionável = apenas `<a href>` (inclui botões-âncora). Mantém os tipos de override separados e previsíveis.

---

## Validação de URL + erro

| Option | Description | Selected |
|--------|-------------|----------|
| href: http/https apenas | Bloqueia tudo que não for http(s); erro inline; cliente + servidor autoritativo | ✓ |
| href: http/https + mailto:/tel:/relativo | Allowlist mais ampla para botões ligar/email/links internos | |
| Você decide | Planner define allowlist seguindo SEC-02 | |

**User's choice:** href: http/https apenas
**Notes:** Imagem = http(s)/S3 (fixo). Allowlist deliberadamente mínima nesta fase. Pré-validação no cliente (UX) + validação server-side autoritativa (SEC-02); nenhum override inválido persistido.

---

## Imagem no export ZIP

| Option | Description | Selected |
|--------|-------------|----------|
| Upload S3 baixa p/ assets; URL externa fica absoluta | Upload → ./assets relativo (self-contained); URL externa mantém URL absoluta | ✓ |
| Baixar tudo (S3 + URL externa) p/ assets | Baixa também conteúdo de terceiros para ZIP totalmente self-contained | |
| Você decide | Planner alinha com export existente | |

**User's choice:** Upload S3 baixa p/ assets; URL externa fica absoluta
**Notes:** Consistente com o export atual (archiver + reescrita de assets); não baixa conteúdo de terceiros.

---

## Claude's Discretion

- Detecção de `<img>`/`<a>` no edit-script e geração de `path`/`originalHash` compatível com o apply-shim.
- Forma de aplicar `image`/`href` no apply-shim (`.src`/`.href`/`setAttribute`, nunca innerHTML) e reescrita de `src` no export.
- Posição exata do painel de imagem e campo href no slot da toolbar; shape das novas mensagens postMessage.
- Implementação concreta da validação de URL (lib vs URL parser) cliente/servidor.

## Deferred Ideas

- href com mailto:/tel:/relativo (allowlist mais ampla) — fora desta fase.
- Baixar imagens de URL externa para o ZIP (self-contained de terceiros) — fora desta fase.
- Reconfigurar ação de botões via JS (não-âncora) — fora do roadmap.
- MutationObserver / re-apply timing para SPA client-rendered — Fase 12.
