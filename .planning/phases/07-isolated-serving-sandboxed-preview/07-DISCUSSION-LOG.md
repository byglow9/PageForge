# Phase 7: Isolated Serving + Sandboxed Preview - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 7-isolated-serving-sandboxed-preview
**Areas discussed:** Origem isolada, Serving (origem dos bytes), Autorização, Preview UX + fallback

---

## Origem isolada (D4 — não-retrofitável)

| Option | Description | Selected |
|--------|-------------|----------|
| A) Subdomínio único + path por tenant | `serve.domínio/{wId}/{tplId}/...` — 1 cert simples, mas `base:'/'` quebra sob path (refs absolutas dos chunks Vite); exige reescrita frágil | |
| B) Subdomínio por template/tenant | `{tplHash}.serve.domínio/...` — SPA na raiz, `base:'/'` funciona limpo; isolamento mais forte; wildcard DNS/cert | ✓ |
| Decidir na pesquisa | Researcher avalia A vs B contra alvo de deploy | |

**User's choice:** B) Subdomínio por template.
**Notes:** O usuário não conhecia o conceito de "origem"/cross-origin e perguntou explicitamente o porquê da decisão e se precisaria comprar um domínio. Explicado: (1) origem = esquema+host+porta; a D4 exige host distinto do dashboard para o JS de terceiros não acessar o cookie de sessão; (2) o critério do roadmap "na raiz da origem para `base:'/'` funcionar" decide a favor de B, porque builds Lovable usam `base:'/'` e referenciam assets por caminho absoluto — só na raiz da própria origem resolvem sem remendo; (3) **não** é preciso comprar domínio extra — a origem isolada é um subdomínio do domínio do PageForge; em dev usa-se `*.localhost`/`lvh.me`/`nip.io`, e o wildcard cert é automático em Vercel/Cloudflare. Recomendação de Claude foi B; usuário confirmou B.

---

## Serving — origem dos bytes

| Option | Description | Selected |
|--------|-------------|----------|
| Route handler faz stream do S3 | Handler na origem isolada lê via `GetObject` e devolve bytes; isolamento e fallback 100% no servidor; bucket não exposto | ✓ |
| URLs assinadas / CDN direto do bucket | Serve direto do S3/CDN; menos carga no app, mas fallback SPA e isolamento difíceis no edge | |
| Decidir na pesquisa | — | |

**User's choice:** Route handler faz stream do S3.
**Notes:** Reusa o prefixo S3 e o `Template.id` == prefixo da Fase 6 para resolver a chave.

---

## Autorização da origem isolada

| Option | Description | Selected |
|--------|-------------|----------|
| Token assinado/efêmero do dashboard | Dashboard minta URL com token HMAC (escopo workspace+template, expira); origem valida sem sessão; cross-tenant → 403 | ✓ |
| Chave não-enumerável (sem token) | Confia só no prefixo S3 UUID; URL = credencial; cross-tenant vira 404-por-obscuridade | |
| Decidir na pesquisa | — | |

**User's choice:** Token assinado/efêmero do dashboard.
**Notes:** Atende "cross-tenant 403/404" com autorização real, não só obscuridade.

---

## Preview UX + fallback de rota/asset

| Option | Description | Selected |
|--------|-------------|----------|
| Rota/página dedicada de preview | Página no dashboard embute `<iframe>` cross-origin sandbox; fallback rota→`index.html`, asset ausente→404 | ✓ |
| Reusar padrão do LpPreview existente | Adaptar LpPreview (Fase 4) para embutir o iframe isolado | |
| Decidir na pesquisa | — | |

**User's choice:** Rota/página dedicada de preview.
**Notes:** `sandbox="allow-scripts"` sem `allow-same-origin`; CSP `frame-ancestors` restrita ao dashboard; consistente com a Fase 8.

---

## Claude's Discretion

- Mecânica de roteamento por host (middleware Next vs host-config) e setup cross-origin em dev (`*.localhost` vs `lvh.me`/`nip.io`) — researcher valida contra alvo de deploy.
- Algoritmo/segredo de assinatura do token (HMAC-SHA256), TTL e formato da URL — definir no PLAN.
- Inicialização/reuso do `S3Client` singleton e estrutura dos `Content-Type` (estender MIME de `s3-upload.ts`).

## Deferred Ideas

Nenhuma — a discussão permaneceu no escopo da fase. Geração por rota, tema por brand CSS vars e export ZIP já roteados para a Fase 8; build server-side / edição por formulário para v2.1.
