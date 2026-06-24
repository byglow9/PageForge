# PageForge

## What This Is

PageForge é uma plataforma SaaS multi-tenant onde agências e times de marketing cadastram **templates de landing pages** (markup com tokens) e, a partir deles, **geram novas LPs** preenchendo um formulário dinâmico. Toda LP gerada fica organizada num catálogo com pastas e categorias, podendo ser editada, duplicada, pré-visualizada e exportada como HTML estático. O contexto inicial é o segmento de turismo (LPs de pacotes de viagem), mas o produto serve qualquer time que recria muitas LPs de campanha reaproveitando padrões de marca.

## Core Value

A partir de um template cadastrado uma vez, um usuário gera uma nova landing page completa e fiel ao layout apenas preenchendo um formulário — sem tocar em código.

## Current Milestone: v2.0 Suporte a LPs do Lovable (templates de projeto React)

**Goal:** Permitir cadastrar uma LP exportada do Lovable (pasta de projeto React/Vite multi-arquivo) e suportá-la no PageForge — gerar, organizar, pré-visualizar e exportar — coexistindo com o engine de template HTML+tokens (LiquidJS) atual.

**Target features (a refinar nos requisitos):**
- Ingestão de uma **pasta de projeto** React/Vite (não só uma string HTML+tokens)
- Pipeline para transformar o projeto em algo servível/exportável (provável: build → output estático)
- Modelo de **segurança** para aceitar/processar código de terceiros (reabre o vetor que a v1 evitou de propósito)
- Coexistência de **dois tipos de template** (Liquid+tokens vs projeto Lovable) no catálogo, preview e export
- Definir se/como a edição via formulário/tokens se aplica a esse formato (conteúdo Lovable hoje é hardcoded nos componentes)

**Key context / tensão:** v1.0 escolheu LiquidJS **sem execução de JS** + export HTML estático por segurança (SSTI/XSS) e fidelidade preview==export. Suportar projetos React de terceiros muda o modelo de confiança e exige build/sandbox — principal decisão de arquitetura do milestone. Referência concreta: `renova-turismo-jornada-main/` na raiz do repo.

## Requirements

### Validated

- **Engine core (Fase 1, 2026-06-02):** `parse(markup) → Schema` e `render(markup, values, brand) → HTML estático` provados contra o template Grécia real (UI-less). Detecção dos 6 tipos de campo, repeaters (0/1/N), e tokens globais `brand.*`; geração de HTML estático layout-fiel; segurança SSTI/XSS validada por corpus (118 testes). Cobre TPL-02, TPL-04, GEN-05, GEN-06 no nível de engine. A UI de authoring/form/persistência permanece hipótese (Fases 3-4).
- **Ingestão de projeto + coexistência de tipo (Fase 6, 2026-06-19):** discriminador `kind` (LIQUID|VITE_SPA) aditivo em Template/LandingPage com fluxos LIQUID intactos; ingestão VITE_SPA via upload do `dist/` ZIP (validação zip-slip/zip-bomb/index.html, secret-scan de 5 padrões, upload S3 tenant-scoped não-enumerável); badge de tipo no catálogo; separação estrita de tipo no render boundary (`renderLp()` rejeita VITE_SPA). Valida **PRJ-01, PRJ-02, PRJ-03, PRJ-11**. (Serving/preview isolados permanecem hipótese — Fase 7.)

### Active

<!-- Hipóteses até serem entregues e validadas. -->

- [ ] Workspaces multi-tenant com membros e papéis (RBAC), isolando templates e LPs por workspace
- [ ] Cadastro de templates via markup com tokens (`{{token}}`), onde cada token vira um campo tipado no schema
- [ ] Suporte aos tipos de campo: texto simples, rich text, imagem (upload), cor, botão+URL e bloco repetível (repeater)
- [ ] Configuração de marca/contato global por workspace (ex: WhatsApp, logo, cor primária) reutilizável nos tokens da LP
- [ ] Validações mínimas no v1 (apenas o tipo do campo; sem regras avançadas)
- [ ] Formulário dinâmico gerado automaticamente a partir do schema do template, incluindo adicionar/remover itens em blocos repetíveis
- [ ] Geração da LP final como HTML estático a partir do markup + valores preenchidos
- [ ] Preview da LP renderizada a qualquer momento
- [ ] Reabrir e editar os dados de uma LP, regenerando o HTML
- [ ] Duplicar uma LP existente para criar variações
- [ ] Exportar/baixar o HTML final da LP
- [ ] Catálogo de LPs com pastas e categorias para organização
- [ ] Template de referência inicial ("Grécia" — LP de turismo) cadastrável de ponta a ponta com seus blocos repetíveis

### Active — v2.0 (templates de projeto Lovable/Vite)

<!-- Hipóteses do milestone v2.0. Escopo travado pelas decisões D1-A/D2/D3/D4/D6 (ver Key Decisions). -->

- [x] **PRJ-01** Ingestão de template tipo projeto: upload do `dist/` **pré-buildado** (ZIP) de um projeto Lovable/Vite (sem build server-side no v2.0) — *validado na Fase 6*
- [x] **PRJ-02** Validação + scan no upload: estrutura (`index.html`/assets), rejeição de path traversal e tamanho excessivo, aviso de credenciais embutidas e meta Lovable — *validado na Fase 6*
- [x] **PRJ-03** Discriminador `kind` (LIQUID|VITE_SPA) em Template/LandingPage + coexistência no catálogo/pastas/tags com badge de tipo — *validado na Fase 6*
- [x] **PRJ-04** Serving do `dist/` do tenant a partir de **origem isolada** do dashboard (não compartilha cookies de sessão) — *validado na Fase 7*
- [x] **PRJ-05** Preview via `<iframe>` cross-origin + CSP `frame-ancestors` — *validado na Fase 7 (modelo de isolamento revisado: `allow-scripts allow-same-origin` + subdomínio cross-origin + cookies host-only, ver 08-SECURITY AR-08-08)*
- [x] **PRJ-06** Isolamento cross-tenant do `dist/` servido/armazenado (chaves não-enumeráveis, escopo por workspace) — *validado na Fase 7*
- [x] **PRJ-07** Geração de LP a partir de template VITE_SPA, com seleção de rota de entrada para projetos multi-rota — *validado na Fase 8*
- [x] **PRJ-08** Injeção de brand CSS vars no serve/preview/export (a "editabilidade grátis": cor/logo via `--primary` etc., sem rebuild) — *validado na Fase 8*
- [x] **PRJ-09** Export como ZIP da árvore `dist/` (branch por `kind`; sem CSP `script-src none` para VITE_SPA) — *validado na Fase 8*
- [x] **PRJ-10** Editar (rota/tema) e duplicar LPs VITE_SPA, reaproveitando catálogo/pastas/tags — *validado na Fase 8*
- [x] **PRJ-11** Separação estrita de tipo: VITE_SPA nunca entra no caminho de render LIQUID e vice-versa — *validado na Fase 6*
- [x] **PRJ-12** Aceitação v2.0: `renova-turismo` cadastrado, LP gerada por rota, prevista em origem isolada, tematizada e exportada — coexistindo com o template Liquid Grécia — *validado na Fase 8 (UAT Blocos A–E; Bloco B confirmado ao vivo 2026-06-24)*

### Out of Scope

<!-- Limites explícitos, com motivo, para evitar re-inclusão. -->

- Hospedagem/URL pública das LPs pela plataforma — v1 entrega só export/download de HTML; hospedagem fica para milestone futuro
- Validações avançadas (regex custom, dimensões/peso de imagem, faixas numéricas) — v1 usa validações mínimas
- Pastas com permissões granulares por membro — permissões ficam no nível do workspace; pastas são só organização
- Repositório global de templates compartilhado entre workspaces — templates são por workspace no v1
- Builder visual de campos / upload+mapeamento visual — autoria é via markup com tokens no v1
- A/B testing e analytics das LPs — fora do escopo inicial
- **(v2.0) Build server-side de projetos Lovable** — v2.0 aceita apenas `dist/` pré-buildado (D1-A); `npm install`/`vite build` em sandbox fica para v2.1, quando houver demanda. Remove toda a superfície de RCE de build do milestone
- **(v2.0) Editabilidade por formulário de conteúdo Lovable** — conteúdo é hardcoded nos componentes; v2.0 só oferece tema via brand CSS vars (D2). Manifesto/patch/rebuild dependem do build server-side → v2.1
- **(v2.0) Dependência de backend vivo (Supabase) em runtime** — PageForge só faz snapshot do build estático; LP que depende de backend externo pode quebrar no export (D6, fronteira declarada)
- **(v2.0) Ingestão por URL de Git** — v2.0 usa upload de ZIP; Git URL (OAuth/clone) fica para v2.x

## Context

- **Domínio inicial:** turismo. O template de referência é uma LP real de pacote de viagem (Renova Turismo — "Grécia"), com seções de hero, cards de destaques, "o que está incluso", itinerário dia a dia, diferenciais, depoimentos, CTA e footer.
- **Insight de arquitetura:** o template é `markup + schema de tokens`. O parser de tokens é o motor — ele gera o schema, que gera o formulário dinâmico; preencher os valores e fundir com o markup produz a LP estática. Os três pilares (autoria de template, geração de LP, catálogo) se conectam por esse schema.
- **Por que blocos repetíveis são críticos:** o template real tem seções com N itens (9 dias de itinerário, 6 cards de "incluso", 5 diferenciais, 3 depoimentos). Sem um tipo de campo repetível, seriam dezenas de tokens fixos e o template deixaria de ser reutilizável.
- **Valores globais:** no template real, o número de WhatsApp aparece em vários botões e a marca (logo/cor) se repete — daí a necessidade de uma config de marca/contato definida uma vez por workspace.
- **Tipos de campo cobrem o template real:** texto (títulos/labels), rich text (parágrafos), imagem (11 fotos), cor (tema), botão+URL (CTAs → WhatsApp/âncoras), e repeater (cards/dias/depoimentos).

## Constraints

- **Tech stack**: Indefinida — a ser decidida na fase de pesquisa/roadmap.
- **Arquitetura**: Multi-tenancy com isolamento por workspace desde o início (impacta modelo de dados e autorização).
- **Geração**: HTML estático — reeditar uma LP significa regenerar e reexportar o HTML.
- **Fidelidade de layout**: o layout do template deve se manter consistente mesmo com conteúdos de tamanhos variados nos campos.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-tenant com workspaces/times (RBAC) | Público-alvo são agências/times que colaboram em LPs | — Pending |
| Autoria via markup com tokens | Flexível e simples; o parser de tokens vira o motor do schema | — Pending |
| Incluir bloco repetível (repeater) no v1 | Sem ele o template real (9 dias, múltiplos cards) não é templatizável | — Pending |
| Config de marca/contato global por workspace | Evita repetição e erro em valores reusados (WhatsApp, logo, cor) | — Pending |
| Geração estática (HTML publicado) | Simples de servir e exportar; adequado para LPs de campanha | — Pending |
| Hospedagem só export/download no v1 | Simplifica muito a operação; URL hospedada fica para depois | — Pending |
| Validações mínimas no v1 | Reduz escopo inicial; regras avançadas podem vir depois | — Pending |
| Catálogo com pastas só de organização | Permissões ficam no workspace; menos complexidade | — Pending |
| **(v2.0 / D1) Aceitar `dist/` pré-buildado, sem build server-side** | Elimina toda a superfície de RCE de build (npm/vite) — a parte mais arriscada da v2.0; entrega valor já | ✅ Decidido 2026-06-18 |
| **(v2.0 / D2) Editabilidade só por brand CSS vars (template opaco)** | Form-driven editing depende de build server-side; manter v2.0 enxuto. Lovable já usa `hsl(var(--primary))` → troca de cor quase grátis | ✅ Decidido 2026-06-18 |
| **(v2.0 / D3) 1 projeto = 1 template; cada rota = 1 LP** | Único modelo que respeita o projeto Lovable real (SPA multi-rota); reaproveita o catálogo | ✅ Decidido 2026-06-18 |
| **(v2.0 / D4) Servir `dist/` em origem isolada + iframe sandbox** | Impede roubo de cookie de sessão do dashboard (PITFALLS V2-4); decisão não-retrofitável | ✅ Decidido 2026-06-18 |
| **(v2.0 / D6) Strip/scan de segredos + fronteira de backend declarada** | `.env` Lovable tem credenciais vivas; snapshot estático não substitui backend Supabase | ✅ Decidido 2026-06-18 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-24 — Milestone v2.0 completo: PRJ-01..12 validados (Fases 6-8). Auditoria tech_debt reconciliada (08-UAT Bloco B confirmado ao vivo). Pronto para arquivar v2.0; próximo milestone: editor visual de conteúdo VITE_SPA.*
