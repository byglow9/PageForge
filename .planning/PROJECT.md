# PageForge

## What This Is

PageForge é uma plataforma SaaS multi-tenant onde agências e times de marketing cadastram **templates de landing pages** (markup com tokens) e, a partir deles, **geram novas LPs** preenchendo um formulário dinâmico. Toda LP gerada fica organizada num catálogo com pastas e categorias, podendo ser editada, duplicada, pré-visualizada e exportada como HTML estático. O contexto inicial é o segmento de turismo (LPs de pacotes de viagem), mas o produto serve qualquer time que recria muitas LPs de campanha reaproveitando padrões de marca.

## Core Value

A partir de um template cadastrado uma vez, um usuário gera uma nova landing page completa e fiel ao layout apenas preenchendo um formulário — sem tocar em código.

## Requirements

### Validated

(None yet — ship to validate)

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

### Out of Scope

<!-- Limites explícitos, com motivo, para evitar re-inclusão. -->

- Hospedagem/URL pública das LPs pela plataforma — v1 entrega só export/download de HTML; hospedagem fica para milestone futuro
- Validações avançadas (regex custom, dimensões/peso de imagem, faixas numéricas) — v1 usa validações mínimas
- Pastas com permissões granulares por membro — permissões ficam no nível do workspace; pastas são só organização
- Repositório global de templates compartilhado entre workspaces — templates são por workspace no v1
- Builder visual de campos / upload+mapeamento visual — autoria é via markup com tokens no v1
- A/B testing e analytics das LPs — fora do escopo inicial

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
*Last updated: 2026-06-01 after initialization*
