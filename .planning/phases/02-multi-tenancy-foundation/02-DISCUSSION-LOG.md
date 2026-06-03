# Phase 2: Multi-Tenancy Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 2-Multi-Tenancy Foundation
**Areas discussed:** Métodos de auth, Modelo de workspace + convites, Matriz de papéis (RBAC), Camada de isolamento

---

## Métodos de auth

### Métodos de login no v1

| Option | Description | Selected |
|--------|-------------|----------|
| Email + senha apenas | Mais simples de entregar/testar; better-auth cobre nativamente; social/magic-link futuros sem retrabalho | ✓ |
| Email+senha + Google OAuth | Login social Google; mais um provider para configurar/testar | |
| Email+senha + magic-link | Login sem senha por link; depende de email transacional no v1 | |

**User's choice:** Email + senha apenas

### Verificação de email no cadastro

| Option | Description | Selected |
|--------|-------------|----------|
| Obrigatória antes de usar | Confirma email antes de criar/entrar em workspace; exige email transacional | ✓ |
| Opcional (lembrete) | Usa logo após signup com aviso; menos atrito | |
| Nenhuma no v1 | Pula verificação; risco de email inválido | |

**User's choice:** Obrigatória antes de usar

### MFA no v1

| Option | Description | Selected |
|--------|-------------|----------|
| Fora do v1 | Mantém foundation enxuta; MFA não bloqueia isolamento/RBAC | ✓ |
| Incluir TOTP no v1 | 2FA via app autenticador; amplia escopo de UI/testes | |

**User's choice:** Fora do v1
**Notes:** Verificação obrigatória implica email transacional já no v1, mesmo com convites por link.

---

## Modelo de workspace + convites

### Como o primeiro workspace surge

| Option | Description | Selected |
|--------|-------------|----------|
| Workspace pessoal auto-criado | Onboarding sem fricção; renomeia depois | |
| Criação explícita obrigatória | Usuário cria/nomeia o workspace antes de prosseguir | ✓ |

**User's choice:** Criação explícita obrigatória

### Multi-workspace e resolução do ativo

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-workspace, slug na URL | /w/{slug}/...; tenant visível, fácil validar contra membership | ✓ |
| Multi-workspace, seletor na sessão | Ativo na sessão, troca por seletor; URL não carrega tenant | |
| Multi-workspace, subdomínio | {slug}.pageforge.app; exige wildcard DNS/cookies cross-subdomain | |

**User's choice:** Multi-workspace, slug na URL

### Convite de membro por email no v1

| Option | Description | Selected |
|--------|-------------|----------|
| Email real + link de fallback | Dispara email de convite + link copiável; cobre WS-03 literal | |
| Só link copiável no v1 | Owner copia/envia link manualmente; sem disparo automático | ✓ |

**User's choice:** Só link copiável no v1

### Convidado sem conta

| Option | Description | Selected |
|--------|-------------|----------|
| Cria conta ao aceitar | Link leva ao signup; conclui já como membro com o papel | ✓ |
| Precisa existir antes | Só convida emails com conta; alta fricção | |

**User's choice:** Cria conta ao aceitar

---

## Matriz de papéis (RBAC)

### Conjunto de papéis no v1

| Option | Description | Selected |
|--------|-------------|----------|
| owner + admin + editor + viewer | owner único; admin gerencia membros/settings; editor conteúdo; viewer visualiza | ✓ |
| admin + editor + viewer | Sem owner separado; criador é admin; não distingue dono | |

**User's choice:** owner + admin + editor + viewer

### Quem gerencia membros/papéis

| Option | Description | Selected |
|--------|-------------|----------|
| owner + admin | Owner e admins gerenciam membros/settings | ✓ |
| Só owner | Apenas o dono gerencia membros/papéis | |

**User's choice:** owner + admin

### Capacidades do viewer

| Option | Description | Selected |
|--------|-------------|----------|
| Visualizar + preview/export | Vê, preview e baixa/exporta HTML; não cria/edita | ✓ |
| Só visualizar (read-only puro) | Vê catálogo e preview, sem export | |

**User's choice:** Visualizar + preview/export

### Editor mexe em settings?

| Option | Description | Selected |
|--------|-------------|----------|
| Não — só conteúdo | Editor cria/edita conteúdo e marca, mas não membros/settings | ✓ |
| Sim — conteúdo + settings | Editor também altera settings; menos separação | |

**User's choice:** Não — só conteúdo

---

## Camada de isolamento

### Estratégia de isolamento no v1

| Option | Description | Selected |
|--------|-------------|----------|
| App-scoping + RLS já no v1 | Filtro na app E RLS Postgres por workspace_id; defesa em profundidade; atende critério 4 | ✓ |
| Só app-scoping no v1, RLS depois | Só app garante filtro; não cumpre critério 4 como escrito | |

**User's choice:** App-scoping + RLS já no v1

### Como o workspace_id é injetado

| Option | Description | Selected |
|--------|-------------|----------|
| Camada de dados central + RLS | Helper/repository injeta workspace_id da sessão; RLS recebe via SET LOCAL | ✓ |
| Filtro manual por query | where workspace_id manual; fácil de esquecer | |

**User's choice:** Camada de dados central + RLS

### Origem do contexto de tenant

| Option | Description | Selected |
|--------|-------------|----------|
| Sessão do servidor, validada contra membership | Slug cruzado com membership server-side antes de qualquer acesso | ✓ |
| Slug da URL direto | Confia no slug sem revalidar; inseguro; rejeitado pelo critério 4 | |

**User's choice:** Sessão do servidor, validada contra membership

---

## Claude's Discretion

- TTL e formato do link de convite.
- Provider/transporte de email transacional e stub em dev (console/log vs MailHog/Mailpit).
- Layout do monorepo: onde o app Next.js fica em relação ao `pageforge-engine`.
- Shape exato do schema Prisma (users/sessions/workspaces/members/invitations), respeitando `workspace_id` em toda tabela tenant-owned.
- Mecânica do Prisma estendido por request + `SET LOCAL` do RLS.
- Duração/refresh de sessão (defaults do better-auth, salvo razão contrária na pesquisa).

## Deferred Ideas

- Social/OAuth (Google) e magic-link — futuro milestone.
- MFA / TOTP — futuro.
- Emails de convite automáticos — v1 usa link; reaproveita infra de email da verificação depois.
- Tenancy por subdomínio — rejeitada no v1 (DNS wildcard/cookies); escolhido slug-na-URL.
- Billing / exclusão de workspace / transferência de ownership — owner existe, poderes futuros.
- Permissões por pasta — v2 (PERM-01); permissões ficam no nível do workspace.
