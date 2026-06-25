---
phase: quick-260625-ihz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/app/w/[slug]/page.tsx
autonomous: true
requirements:
  - quick-260625-ihz

must_haves:
  truths:
    - "Os 4 cards de métricas (Templates, LPs, Members, LPs sem pasta) são links clicáveis"
    - "As 5 LPs mais recentes são listadas com nome, kind badge, pasta e tempo relativo em pt-BR"
    - "Cada LP recente tem ações Editar, Preview e Exportar inline"
    - "Até 6 templates recentes aparecem com link Gerar LP para quem pode criar LP"
    - "Alertas de brand não configurada e convites pendentes aparecem condicionalmente"
    - "O bloco Quick access foi completamente removido"
    - "O título <h1>Dashboard</h1> é mantido"
    - "pnpm typecheck passa sem erros"
  artifacts:
    - path: "apps/web/src/app/w/[slug]/page.tsx"
      provides: "Dashboard redesenhada com 4 seções úteis"
      min_lines: 150
      contains: "recentLps, recentTemplates, brandConfig, pendingInviteCount"
  key_links:
    - from: "apps/web/src/app/w/[slug]/page.tsx"
      to: "/api/lps/[lpId]/export"
      via: "<a href> anchor same-origin"
      pattern: "/api/lps"
    - from: "section 3 template cards"
      to: "/w/[slug]/lps/new/[templateId]"
      via: "Next.js Link"
      pattern: "/lps/new/"
---

<objective>
Redesenhar a página Dashboard do workspace substituindo o bloco "Quick access" (que duplica o menu lateral) por 4 seções de verdadeiro valor: métricas clicáveis, LPs recentes com ações, templates de acesso rápido e alertas de setup do workspace.

Purpose: A dashboard atual é inútil — duplica o menu. A nova versão permite o usuário retomar trabalho, iniciar LPs e monitorar saúde do workspace sem sair da tela inicial.
Output: apps/web/src/app/w/[slug]/page.tsx reescrito. Nenhum outro arquivo tocado. Nenhuma migração.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@apps/web/src/app/w/[slug]/page.tsx
@apps/web/src/app/w/[slug]/members/page.tsx
@apps/web/prisma/schema.prisma
@apps/web/src/lib/workspaces/guards.ts
</context>

<interfaces>
<!-- Tipos e contratos extraídos do codebase — executor não precisa explorar. -->

De apps/web/prisma/schema.prisma:
- model LandingPage: id, workspaceId, templateId?, name, markupSnapshot, schemaVersion, values, folderId?, kind (LIQUID|VITE_SPA), entryRoute?, createdAt, updatedAt
- model Folder: id, workspaceId, name, parentId?, createdAt, updatedAt
- model Template: id, workspaceId, name, markup, schema, metadataOverlay, schemaVersion, kind, createdAt, updatedAt
- model BrandConfig: id, workspaceId @unique, logoUrl?, primaryColor?, whatsapp?, createdAt, updatedAt
- model WorkspaceInvitation: id, workspaceId, email, role, expiresAt, status (default "pending"), createdAt

De apps/web/src/lib/workspaces/guards.ts:
- requireWorkspace(slug): Promise<WorkspaceContext>
- can(role: Role, resource: string, action: string): boolean
  - can(role, 'lp', 'create')     — owner/admin/editor
  - can(role, 'template', 'create') — owner/admin/editor
  - can(role, 'brand', 'update')  — owner/admin/editor
  - role !== 'viewer' para aviso de convites

Rota de export: GET /api/lps/[lpId]/export — retorna ZIP com header Content-Disposition: attachment.
Não exige client-side; um simples <a href="/api/lps/{id}/export" download> funciona.

Rota new/[templateId] confirmada: apps/web/src/app/w/[slug]/lps/new/[templateId]/page.tsx existe.

Rotas de LP confirmadas: apps/web/src/app/w/[slug]/lps/[lpId]/edit e /preview existem.
</interfaces>

<decisions>
**D-ihz-01: Queries Prisma diretas no page, não actions.**
A dashboard atual já usa `prisma.landingPage.count({ where: { workspaceId } })` diretamente (sem withTenantDb) em commit 7d496f5. `listLpsAction` não inclui nome de pasta e retorna todas as LPs — usar findMany com take:5 e include:folder é mais eficiente. `listTemplatesAction` usa withTenantDb desnecessariamente para um simples take:6 no server component. Manter consistência com o padrão já estabelecido na dashboard.

**D-ihz-02: Export via <a href> puro, sem client component.**
/api/lps/[lpId]/export é GET same-origin com Content-Disposition: attachment. Um anchor puro dispara o download do browser sem JS. Isso preserva o page.tsx como Server Component 100%. LpCatalogCard usa fetch programático para mostrar loading/toast, mas a dashboard não precisa desse estado.
</decisions>

<tasks>

<task type="auto">
  <name>Task 1: Reescrever WorkspacePage com as 4 seções</name>
  <files>apps/web/src/app/w/[slug]/page.tsx</files>
  <action>
    Substituir integralmente o conteúdo de apps/web/src/app/w/[slug]/page.tsx mantendo o cabeçalho de comentário existente. O componente deve permanecer `async function WorkspacePage` com `params: Promise<{ slug: string }>`. Todos os imports devem ser atualizados.

    **Imports necessários:** Link, Clock, Download, Eye, FileText, LayoutTemplate, Palette, Pencil, TriangleAlert, Users (lucide-react); requireWorkspace + can de @/lib/workspaces/guards; prisma de @/lib/db/prisma; Card/CardHeader/CardTitle/CardContent de @/components/ui/card.

    **Helper relativeTime** (função nomeada no módulo, fora do componente): recebe `date: Date`, calcula `diffMs = Date.now() - date.getTime()`, converte para minutos. Retorna: "agora" se < 1 min; "há N min" se < 60 min; "há N h" se diffH < 24; "há N dias" caso contrário.

    **Promise.all com 8 queries em paralelo** (variáveis em ordem):
    1. `templateCount` — `prisma.template.count({ where: { workspaceId: ctx.workspaceId } })`
    2. `lpCount` — `prisma.landingPage.count({ where: { workspaceId: ctx.workspaceId } })`
    3. `memberCount` — `prisma.member.count({ where: { organizationId: ctx.workspaceId } })`
    4. `lpWithoutFolderCount` — `prisma.landingPage.count({ where: { workspaceId: ctx.workspaceId, folderId: null } })`
    5. `recentLps` — `prisma.landingPage.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, name: true, kind: true, folderId: true, updatedAt: true, folder: { select: { name: true } } } })`
    6. `recentTemplates` — `prisma.template.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { updatedAt: 'desc' }, take: 6, select: { id: true, name: true, kind: true } })`
    7. `brandConfig` — `prisma.brandConfig.findUnique({ where: { workspaceId: ctx.workspaceId } })`
    8. `pendingInviteCount` — `prisma.workspaceInvitation.count({ where: { workspaceId: ctx.workspaceId, status: 'pending' } })`

    **Flags de permissão** (após Promise.all):
    - `canCreateLp = can(ctx.role, 'lp', 'create')`
    - `canCreateTemplate = can(ctx.role, 'template', 'create')`
    - `canEditBrand = can(ctx.role, 'brand', 'update')`
    - `showBrandAlert = canEditBrand && (!brandConfig || (!brandConfig.primaryColor && !brandConfig.logoUrl))`
    - `showInviteAlert = ctx.role !== 'viewer' && pendingInviteCount > 0`

    **Layout JSX** — div raiz: `className="px-8 py-6 space-y-8"`.

    **Header:** `<h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>`

    **Seção de alertas de setup** (logo abaixo do h1, antes das métricas) — só renderizar se `showBrandAlert || showInviteAlert`, dentro de `<div className="space-y-2">`:
    - Alert de brand (se showBrandAlert): div com `border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 flex items-center justify-between text-sm`. Ícone TriangleAlert `h-4 w-4 text-amber-600` à esquerda. Texto: "Configure a marca do workspace para personalizar suas LPs." à direita: Link `/w/${slug}/brand` com texto "Configurar marca", classe `text-amber-700 font-medium hover:underline`.
    - Alert de convites (se showInviteAlert): div com `border border-blue-200 bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between text-sm`. Ícone Users `h-4 w-4 text-blue-600`. Texto dinâmico: `{pendingInviteCount} convite{pendingInviteCount !== 1 ? 's' : ''} pendente{pendingInviteCount !== 1 ? 's' : ''}.` Link `/w/${slug}/members` texto "Ver convites", classe `text-blue-700 font-medium hover:underline`.

    **Seção 1 — Métricas clicáveis:** heading "Visão geral" em `<h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">`. Grid `grid grid-cols-2 sm:grid-cols-4 gap-4`. Cada Card envolto por `<Link href="..." className="group block">`. No hover do Link, o Card deve ter `className="h-full transition-shadow group-hover:shadow-md"`. Dentro: CardHeader com CardTitle `text-sm font-medium text-muted-foreground` e CardContent com `<p className="text-3xl font-bold text-gray-900">{count}</p>`. As 4 métricas:
    - "Templates" → `href={/w/${slug}/templates}`, ícone LayoutTemplate, count `templateCount`
    - "Landing Pages" → `href={/w/${slug}/lps}`, ícone FileText, count `lpCount`
    - "Membros" → `href={/w/${slug}/members}`, ícone Users, count `memberCount`
    - "LPs sem pasta" → `href={/w/${slug}/lps}`, sem ícone (ou FileText), count `lpWithoutFolderCount`; CardTitle com texto "Sem pasta" ou "LPs sem pasta"

    **Seção 2 — Continuar de onde parou:** heading "Continuar de onde parou". Se `recentLps.length === 0`, mostrar empty state: `<p className="text-sm text-muted-foreground">Nenhuma LP criada ainda.</p>` + se `canCreateLp`: Link `/w/${slug}/lps/new` texto "Gerar primeira LP" com classe `text-sm font-medium text-gray-900 underline`. Se há LPs, renderizar lista com `<div className="space-y-1">` e para cada LP um `<div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50 transition-colors">`. Lado esquerdo `<div className="min-w-0 flex-1">`: linha 1 com nome em `<span className="font-medium text-sm text-gray-900 truncate">` + se `lp.kind === 'VITE_SPA'` badge `<span className="ml-2 inline-flex items-center rounded text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5">SPA</span>`. Linha 2 `<div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">`: ícone Clock `h-3 w-3`, `relativeTime(lp.updatedAt)`, e se `lp.folder` → separador "·" e `lp.folder.name`. Lado direito `<div className="flex items-center gap-2 shrink-0 ml-4">`: três ações como links/anchors com classe `inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 rounded px-2 py-1 border border-gray-200 bg-white hover:bg-gray-50 transition-colors`:
      - Link `/w/${slug}/lps/${lp.id}/edit`: ícone Pencil `h-3 w-3`, texto "Editar"
      - Link `/w/${slug}/lps/${lp.id}/preview`: ícone Eye `h-3 w-3`, texto "Preview"
      - `<a href={/api/lps/${lp.id}/export} download>`: ícone Download `h-3 w-3`, texto "Exportar" (per D-ihz-02)

    **Seção 3 — Começar de um template:** só renderizar se `canCreateLp` (per D-ihz-01: quem não pode criar LP não vê a seção). Heading "Começar de um template". Se `recentTemplates.length === 0`, mostrar: "Nenhum template cadastrado." + se `canCreateTemplate`: Link `/w/${slug}/templates/new` texto "Criar primeiro template". Se há templates, grid `grid grid-cols-2 sm:grid-cols-3 gap-3` com até 6 items. Cada item: `<Link href={/w/${slug}/lps/new/${t.id}} className="group flex flex-col rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 hover:border-gray-300 transition-colors">`. Linha 1: `<span className="text-sm font-medium text-gray-900 truncate">` + se `t.kind === 'VITE_SPA'` badge SPA igual ao da seção 2. Linha 2: `<span className="mt-1 text-xs text-indigo-600 group-hover:underline">Gerar LP →</span>`.

    Após reescrever o arquivo, executar `cd apps/web && pnpm typecheck` e corrigir quaisquer erros de tipo antes de considerar a tarefa concluída.
  </action>
  <verify>
    <automated>cd /home/glow/Documentos/projetos/PageForge/apps/web && pnpm typecheck 2>&1 | tail -5</automated>
  </verify>
  <done>
    - apps/web/src/app/w/[slug]/page.tsx reescrito sem o bloco "Quick access"
    - Promise.all com 8 queries paralelas (templateCount, lpCount, memberCount, lpWithoutFolderCount, recentLps, recentTemplates, brandConfig, pendingInviteCount)
    - 4 seções renderizadas conforme especificado (alertas, métricas, LPs recentes, templates)
    - Export via anchor puro sem client component
    - pnpm typecheck passa sem erros de tipo no arquivo
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| URL slug → workspaceId | Slug é validado contra session membership via requireWorkspace; workspaceId vem do DB |
| Queries Prisma | Todas filtradas por ctx.workspaceId vindo da sessão; nenhum input de client afeta as queries |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ihz-01 | Information Disclosure | Alertas condicionais | mitigate | showBrandAlert gateado por can(role,'brand','update'); showInviteAlert por role !== 'viewer'. Viewers não veem dados internos de configuração |
| T-ihz-02 | Spoofing | Export anchor href | accept | /api/lps/[lpId]/export valida sessão e membership própria (T-04-04-01/02). O anchor passa somente o lpId; a rota rejeita IDs não pertencentes ao workspace do usuário |
| T-ihz-03 | Information Disclosure | recentLps query sem RLS context | accept | Filtro explícito WHERE workspaceId = ctx.workspaceId (vindo da sessão) isola por tenant. Padrão já estabelecido no page.tsx atual (commit 7d496f5) |
</threat_model>

<verification>
1. Acessar /w/{slug} no browser — deve mostrar h1 "Dashboard" sem bloco "Quick access"
2. Cards de métricas devem ser clicáveis (Links) e navegar para as rotas corretas
3. LPs existentes aparecem na seção 2 com tempo relativo em português
4. Link "Exportar" deve disparar download do ZIP ao clicar
5. Templates aparecem na seção 3 com link "Gerar LP" funcional
6. Como viewer, seção 3 não deve aparecer e alertas de brand/convites não devem aparecer
</verification>

<success_criteria>
- page.tsx compila sem erros TypeScript (pnpm typecheck)
- Bloco "Quick access" removido; 4 novas seções presentes
- Todas as queries com escopo workspaceId correto (sem cross-tenant leak)
- Exportar LP da dashboard dispara download sem JS client-side extra
- Alertas de setup visíveis apenas para roles com permissão
</success_criteria>

<output>
Após conclusão, criar `.planning/quick/260625-ihz-redesenhar-a-dashboard-do-workspace-com-/260625-ihz-SUMMARY.md` com o resumo da implementação.
</output>
