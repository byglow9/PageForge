---
phase: "08"
plan: "02"
subsystem: lp-generation
tags:
  - vite-spa
  - server-actions
  - react-hook-form
  - form
  - generation
dependency_graph:
  requires:
    - "Phase 08-01: entry_route migration + GenerateViteSpaLpSchema + Prisma regen"
  provides:
    - "generateViteSpaLpAction: creates LandingPage kind=VITE_SPA with entryRoute"
    - "ViteSpaLpForm: client component for generate/edit of VITE_SPA LPs"
    - "updateLpAction: VITE_SPA branch (name + entryRoute only)"
    - "duplicateLpAction: VITE_SPA branch (no LpAssets)"
    - "getLpAction: kind + entryRoute in return payload"
  affects:
    - "Phase 08-03: VITE_SPA preview/serve (uses getLpAction entryRoute)"
    - "Phase 08-04: VITE_SPA export"
tech_stack:
  added:
    - "components/lps/ViteSpaLpForm.tsx: React Hook Form + Zod resolver (pre-transform form type)"
  patterns:
    - "ViteSpaFormValues (raw input type) separate from GenerateViteSpaLpInput (post-transform) for useForm generic"
    - "VITE_SPA branch guard before LIQUID path in RSC page and server actions"
    - "Prisma client regenerated to expose entryRoute on LandingPage model"
key_files:
  created:
    - apps/web/src/components/lps/ViteSpaLpForm.tsx
  modified:
    - apps/web/src/lib/lps/actions.ts
    - apps/web/src/app/w/[slug]/lps/new/[templateId]/page.tsx
    - apps/web/src/generated/prisma/models/LandingPage.ts
    - apps/web/src/generated/prisma/internal/class.ts
    - apps/web/src/generated/prisma/internal/prismaNamespace.ts
    - apps/web/src/generated/prisma/internal/prismaNamespaceBrowser.ts
decisions:
  - "D-01 implementado: entryRoute assume null (raiz '/') por padrao; campo de texto opcional para multi-rota"
  - "D-02 implementado: sem parsing de bundle minificado — entrada manual de path pelo usuario"
  - "D-07 implementado: LP VITE_SPA referencia o template (nao copia o dist/); entryRoute armazenado como referencia"
  - "D-09 implementado: editar = atualiza nome/rota; duplicar = nova LandingPage com mesmo templateId/rota"
  - "ViteSpaFormValues (pre-transform) separado de GenerateViteSpaLpInput (pos-transform) para compatibilidade com useForm generics do RHF"
metrics:
  duration_minutes: 35
  completed_date: "2026-06-23"
  tasks_completed: 2
  files_created: 1
  files_modified: 6
---

# Phase 08 Plan 02: VITE_SPA Generate Action + Form Summary

**One-liner:** `generateViteSpaLpAction` + `ViteSpaLpForm` completam o slice vertical de geracao — usuario preenche nome + rota opcional e a LP VITE_SPA e criada no banco com sentinels e referencia ao template.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Branch VITE_SPA em generateLpAction + updateLpAction + duplicateLpAction + getLpAction | 053636a | actions.ts, LandingPage.ts (generated) |
| 2 | ViteSpaLpForm component + branch VITE_SPA na pagina new/[templateId] | 624c405 | ViteSpaLpForm.tsx, page.tsx, actions.ts |

## What Was Built

### Task 1: VITE_SPA branches em actions.ts + Prisma client regen

- **`generateViteSpaLpAction` (novo):** Export server action com `requireWorkspaceRole` → `GenerateViteSpaLpSchema.safeParse` → `db.template.findById` (verifica kind === 'VITE_SPA') → `db.lp.create` com sentinels (`markupSnapshot:"", schemaVersion:0, values:{}`) e `entryRoute` normalizado. Retorna `{ ok: true, data: { id } }`.

- **`generateLpAction` — guard convertido em branch:** O bloco `return { ok: false, error: "..." }` para VITE_SPA foi substituido por branch que cria LP com sentinels e `entryRoute: null`. Caminho LIQUID original permanece no else/fall-through.

- **`updateLpAction` — branch VITE_SPA:** Apos buscar o LP existente, verifica `existing.kind === 'VITE_SPA'` e atualiza apenas `name` e `entryRoute` sem tocar em `markupSnapshot`/`schemaVersion`/`values`. Assinatura da funcao estendida com `entryRoute?: string | null`.

- **`duplicateLpAction` — branch VITE_SPA:** Antes de copiar assets LIQUID, verifica `origin.kind === 'VITE_SPA'` e cria copia com sentinels, `templateId`, `entryRoute` originais — sem invocar o caminho de copia de `LpAssets`.

- **`getLpAction` — kind + entryRoute no retorno:** Payload de `data` estendido com `kind: lp.kind` e `entryRoute: lp.entryRoute ?? null`.

- **Prisma client regenerado:** `npx prisma generate` executado para expor `entryRoute` no tipo `LandingPage` gerado (estava ausente, causando erros TS).

### Task 2: ViteSpaLpForm + branch na pagina new/[templateId]

- **`ViteSpaLpForm.tsx`:** Componente client (`"use client"`) com `useForm<ViteSpaFormValues>` (tipo pre-transform) + `zodResolver(GenerateViteSpaLpSchema)` como `any` para compatibilidade de tipos. Dois campos: `name` (autoFocus em generate mode) e `entryRoute` (opcional com hint text conforme UI-SPEC). CTA: "Generate landing page" / "Save changes". Submit em `useTransition`: generate → `generateViteSpaLpAction` + redirect para preview; edit → `updateLpAction` + `router.refresh()`.

- **`new/[templateId]/page.tsx`:** Branch `if (template.kind === "VITE_SPA")` inserido apos o guard `if (!template)` e antes de `ParsedSchemaValidator.safeParse`. Retorna `ViteSpaLpForm` em generate mode. O bloco LIQUID original abaixo permanece sem alteracao.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma client desatualizado — entryRoute ausente nos tipos gerados**
- **Encontrado durante:** Task 1, ao rodar `tsc --noEmit` apos editar actions.ts
- **Causa:** O Plan 01 adicionou `entryRoute String?` ao `schema.prisma` mas nao executou `prisma generate`; os tipos gerados em `src/generated/prisma/` ainda nao tinham `entryRoute` no modelo `LandingPage`
- **Fix:** `npx prisma generate` no diretorio `apps/web` — regenerou cliente em 152ms
- **Arquivos:** `src/generated/prisma/models/LandingPage.ts`, `internal/class.ts`, `internal/prismaNamespace.ts`, `internal/prismaNamespaceBrowser.ts`
- **Commit:** 053636a

**2. [Rule 1 - Bug] Tipo errado no useForm — GenerateViteSpaLpInput e pos-transform**
- **Encontrado durante:** Task 2, ao rodar `tsc --noEmit`
- **Causa:** `GenerateViteSpaLpInput` e o tipo inferido da saida do schema Zod (pos-transform, com `entryRoute: string | null`), mas `useForm<T>` precisa do tipo pre-transform (onde `entryRoute?: string | undefined`). RHF reportou incompatibilidade de resolver
- **Fix:** Definir `ViteSpaFormValues` (interface local) com `entryRoute?: string` para o generic do `useForm`; usar `zodResolver(GenerateViteSpaLpSchema) as any` para silenciar o mismatch de tipos que ocorre entre o input-type e output-type do schema Zod
- **Arquivos:** `ViteSpaLpForm.tsx`
- **Commit:** 624c405

**3. [Rule 1 - Bug] updateLpAction — entryRoute ausente na assinatura da funcao**
- **Encontrado durante:** Task 2, ao referenciar `entryRoute` no `updateLpAction` call do ViteSpaLpForm
- **Causa:** A assinatura da funcao `updateLpAction` usava um objeto literal inline (nao `UpdateLpInput`) e nao incluia `entryRoute`
- **Fix:** Adicionar `entryRoute?: string | null` ao objeto de input da funcao com JSDoc explicando semantica (undefined=sem alteracao, null=limpar para raiz)
- **Arquivos:** `apps/web/src/lib/lps/actions.ts`
- **Commit:** 624c405

## Known Stubs

None — todos os outputs sao funcionais. `generateViteSpaLpAction` persiste dados reais no banco; `ViteSpaLpForm` submete para server action real; o redirect para `/preview` esta correto (a pagina de preview sera implementada no Plan 03).

## Threat Flags

Mitigacoes confirmadas conforme `<threat_model>` do plano:

| Mitigacao | Status |
|-----------|--------|
| T-08-02-01: workspaceId via requireWorkspaceRole (nao do cliente) | Implementado em generateViteSpaLpAction |
| T-08-02-02: entryRoute validado max(128) + normalizado por GenerateViteSpaLpSchema | Implementado — Zod faz transform antes da persistencia |
| T-08-02-03: template.findById usa TenantTemplateHelpers (workspaceId-scoped) | Implementado — cross-workspace retorna null |
| T-08-02-04: duplicateLpAction VITE_SPA sem assets | Aceito — nova linha com timestamps normais do Prisma |

## Self-Check: PASSED

- [x] `apps/web/src/components/lps/ViteSpaLpForm.tsx` existe
- [x] `apps/web/src/lib/lps/actions.ts` exporta `generateViteSpaLpAction`
- [x] Commits 053636a e 624c405 existem no git log
- [x] TypeScript compila sem erros (`tsc --noEmit`)
- [x] VITE_SPA branch em `generateLpAction` nao retorna mais `ok: false` para kind=VITE_SPA
- [x] `getLpAction` retorna `kind` e `entryRoute` no payload
- [x] `new/[templateId]/page.tsx` tem branch `if (template.kind === "VITE_SPA")`
- [x] Bloco LIQUID original abaixo do branch permanece sem alteracao
