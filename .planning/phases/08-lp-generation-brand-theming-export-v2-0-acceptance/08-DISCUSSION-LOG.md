# Phase 8: LP Generation, Brand Theming, Export & v2.0 Acceptance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 8-lp-generation-brand-theming-export-v2-0-acceptance
**Areas discussed:** Seleção de rota de entrada, Brand CSS vars (tema), Modelo de dados da LP VITE_SPA, Export ZIP + injeção do tema

---

## Seleção de rota de entrada (PRJ-07 / D3)

Primeiro round (usuário não entendeu o conceito de "rota" — re-explicado com o `renova-turismo` como exemplo de projeto multi-página).

| Option | Description | Selected |
|--------|-------------|----------|
| Digitar o endereço | Campo de texto onde o usuário escreve o path (ex: `/grecia`). Robusto, sem parsing do bundle. | ✓ (ver nota) |
| Digitar + sugestões quando der | Campo manual + sugestões best-effort extraídas do bundle. | |
| Tentar detectar rotas do dist/ | Parsing do JS minificado p/ dropdown — frágil. | |

**User's choice:** "normalmente vamos usar o lp forge para zips que são de uma lp só mesmo, não de uma lp que tem várias lps dentro" → reframe: rota assume `/` por padrão (caso comum single-LP), campo de path **opcional** para projetos multi-rota.
**Notes:** Caso multi-rota (renova-turismo, ~13 rotas em `src/App.tsx`) ainda deve funcionar para a aceitação v2.0. Sem parsing do bundle (D-02). Validação da rota é comportamental (carrega no preview), não estática.

---

## Brand CSS vars / Tema (PRJ-08 / D2)

Primeiro round (usuário não entendeu snapshot vs live — re-explicado com o exemplo de mudar a cor da marca).

| Option | Description | Selected |
|--------|-------------|----------|
| Live (re-tematiza) | serve/preview/export leem o BrandConfig atual; mudar a marca reflete em todas as LPs. | ✓ |
| Snapshot na geração | Congela as CSS vars no momento de gerar; mudar a marca não afeta LPs existentes. | |

**User's choice:** Mudam junto (ao vivo).
**Notes:** Alinhado ao value prop da D2 ("editabilidade grátis"). Contraste deliberado com LIQUID (snapshot via markupSnapshot).

### Escopo do tema (quais atributos viram CSS vars)

| Option | Description | Selected |
|--------|-------------|----------|
| Só `--primary` (cor) | Injeta apenas a cor primária como HSL triplet. MVP enxuto. | ✓ (Claude's discretion) |
| Paleta derivada de `--primary` | Deriva vars relacionadas por contraste. | |

**User's choice:** "Você decide" → MVP usa só `--primary`.

---

## Modelo de dados da LP VITE_SPA (PRJ-07 / PRJ-10)

| Option | Description | Selected |
|--------|-------------|----------|
| LP aponta pros arquivos do projeto | LP guarda templateId + rota; usa o `dist/` compartilhado. Leve. Apagar o projeto desativa as LPs. | ✓ |
| Cada LP faz cópia própria | Cada LP copia o `dist/` inteiro; sobrevive à deleção do projeto; duplica vários MB. | |

**User's choice:** LP aponta pros arquivos do projeto.
**Notes:** Consequência aceita: apagar o template/projeto desativa as LPs VITE_SPA dele (sem cópia de sobrevivência). Difere do LIQUID (markupSnapshot sobrevive à deleção). Reusar tabela `LandingPage` + coluna de rota de entrada via migration aditiva.

---

## Export ZIP + injeção do tema (PRJ-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Assar a marca no ZIP | index.html exportado já vem com a cor da marca; auto-contido. | ✓ |
| Export sem tema (original) | ZIP sai como o projeto foi buildado, sem a cor da marca. | |

**User's choice:** Assar a marca no ZIP.
**Notes:** Branch por `kind` na rota de export existente; ZIP leva a árvore `dist/` inteira; CSP estrita `script-src 'none'` do LIQUID NÃO se aplica ao VITE_SPA (runtime JS próprio). Plano de export apresentado pelo Claude e confirmado.

## Claude's Discretion

- Conjunto exato de CSS vars além de `--primary` (MVP só `--primary`).
- Conversão hex → HSL triplet e utilitário usado.
- Forma da coluna de rota na `LandingPage`; nullability de markupSnapshot/values para VITE_SPA.
- Estrutura/nomes internos do ZIP; mecânica de streaming.
- Local exato do prepend do `<style>` (helper compartilhado serve/preview/export).

## Deferred Ideas

- Detecção/sugestão automática de rotas a partir do bundle `dist/` — fora do MVP (fragilidade).
- Tema além de `--primary` (paleta completa, logo, WhatsApp) — v2.1.
- Edição por formulário do conteúdo Lovable (manifesto/patch/rebuild) — v2.1.
