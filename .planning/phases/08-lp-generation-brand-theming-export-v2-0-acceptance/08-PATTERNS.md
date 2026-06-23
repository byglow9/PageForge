# Phase 8: LP Generation, Brand Theming, Export & v2.0 Acceptance — Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| Arquivo novo/modificado | Role | Data Flow | Analog mais próximo | Qualidade |
|-------------------------|------|-----------|---------------------|-----------|
| `apps/web/src/lib/brand/theme.ts` | utility | transform | `apps/web/src/lib/serve/serve-vite-spa.ts` | role-match (pure server util, sem "use server") |
| `apps/web/prisma/migrations/0007_vite_spa_lp_entry_route/migration.sql` | migration | — | `apps/web/prisma/migrations/0006_kind_discriminator/migration.sql` | exact |
| `apps/web/src/lib/lps/actions.ts` (EXTEND) | service | CRUD | si mesmo — estender branches VITE_SPA em generate/update/duplicate/getLp | exact |
| `apps/web/src/lib/lps/schema.ts` (EXTEND) | utility | transform | si mesmo — `GenerateLpSchema` + `UpdateLpSchema` existentes | exact |
| `apps/web/src/lib/db/tenant-db.ts` (EXTEND) | service | CRUD | si mesmo — interfaces `TenantLpHelpers` existente | exact |
| `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` (EXTEND) | middleware | request-response | si mesmo — path `isHtmlRequest` para injetar `<style>` | exact |
| `apps/web/src/app/api/lps/[lpId]/export/route.ts` (EXTEND) | middleware | streaming | si mesmo — branch VITE_SPA substitui 409 por ListObjectsV2 + archiver | exact |
| `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` (EXTEND) | component | request-response | `apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx` | exact |
| `apps/web/src/app/w/[slug]/lps/[lpId]/edit/page.tsx` (EXTEND) | component | request-response | si mesmo — branch VITE_SPA antes de `parse(lp.markupSnapshot)` | exact |
| `apps/web/src/app/w/[slug]/lps/new/[templateId]/page.tsx` (EXTEND) | component | request-response | si mesmo — branch VITE_SPA antes de `ParsedSchemaValidator.safeParse` | exact |
| `apps/web/src/components/lps/ViteSpaLpForm.tsx` (NEW) | component | request-response | `apps/web/src/components/lps/LpForm.tsx` (estrutura "use client" + RHF) | role-match |

---

## Pattern Assignments

### `apps/web/src/lib/brand/theme.ts` (utility, transform — NOVO)

**Analog:** `apps/web/src/lib/serve/serve-vite-spa.ts`

Regra de importação: sem `"use server"`. Arquivo server-only puro (sem diretiva); chamado de route handlers e RSC pages. Mesmo padrão de `serve-vite-spa.ts` (linhas 1–3):

```typescript
/**
 * server-only — no 'use server' directive; called from route handler, not Server Action.
 * ...
 */
```

**Imports pattern** (seguir o padrão de serve-vite-spa.ts — sem imports externos; pure function):
```typescript
// Sem imports de runtime externos.
// Apenas tipos TypeScript, se necessário.
```

**Core pattern — hexToHslTriplet** (algoritmo verificado no RESEARCH.md RQ-1):
```typescript
export function hexToHslTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
```

**Core pattern — buildBrandStyleTag e injectBrandStyle** (RESEARCH.md RQ-2):
```typescript
export function buildBrandStyleTag(primaryColor: string | null | undefined): string {
  if (!primaryColor) return "";
  const triplet = hexToHslTriplet(primaryColor);
  return `<style>:root{--primary:${triplet};}</style>`;
}

export function injectBrandStyle(html: string, styleTag: string): string {
  if (!styleTag) return html;
  // Prepend antes de </head>; fallback = prepend no topo
  if (html.includes("</head>")) {
    return html.replace("</head>", `${styleTag}\n</head>`);
  }
  return `${styleTag}\n${html}`;
}
```

**Sem error handling explícito** — funções puras sem I/O; callers lidam com null/undefined via short-circuit no `buildBrandStyleTag`.

---

### `apps/web/prisma/migrations/0007_vite_spa_lp_entry_route/migration.sql` (migration — NOVO)

**Analog:** `apps/web/prisma/migrations/0006_kind_discriminator/migration.sql`

**Padrão completo** (linhas 1–19 do analog — copiar cabeçalho + convenção TEXT):

```sql
-- Migration: 0006_kind_discriminator
-- Adds kind discriminator to template and landing_page tables.
-- ADDITIVE: existing LIQUID rows are unaffected (DEFAULT 'LIQUID').
-- Pattern: TEXT + CHECK constraint instead of native PG enum to avoid
-- Prisma error 55P04 ("new enum values must be committed before they can be used").
-- Postgres 11+ stores constant defaults in catalog — no table rewrite, no lock.

ALTER TABLE "template"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'LIQUID'
    CHECK ("kind" IN ('LIQUID', 'VITE_SPA'));
```

**Aplicação para Phase 8** (sem CHECK constraint — campo livre; sem DEFAULT pois NULL é semântico):
```sql
-- Migration: 0007_vite_spa_lp_entry_route
-- ADDITIVE: adds nullable entry_route column to landing_page.
-- LIQUID rows get NULL (correct — they don't use this column).
-- VITE_SPA rows: NULL = root '/'; non-null = '/grecia', '/turquia', etc.
-- No DEFAULT needed — NULL is the correct default semantics for VITE_SPA rows.
-- No CHECK constraint needed — free-form path; Zod validates at action boundary.
-- RLS policy on landing_page already covers all columns — no new policy needed.
ALTER TABLE "landing_page"
  ADD COLUMN "entry_route" TEXT;
```

**Prisma schema change correspondente** (seguir convenção da linha 259 de schema.prisma):
```prisma
model LandingPage {
  // ... campos existentes ...
  entryRoute     String?   // VITE_SPA only: null = '/' (root), non-null = '/grecia' etc.
  // ... resto ...
}
```

---

### `apps/web/src/lib/lps/actions.ts` (EXTEND — service, CRUD)

**Analog:** si mesmo — estender os 4 pontos abaixo sem tocar no caminho LIQUID.

**Padrão de gate + Zod validate** (linhas 151–164 do arquivo):
```typescript
export async function generateLpAction(slug, input) {
  // Step 1: Gate
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Step 2: Validate input
  const parsed = GenerateLpSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }
```

**Padrão de branch por kind** (converter guard existente nas linhas 179–184 em branch):
```typescript
// Atual (guard que bloqueia VITE_SPA — REMOVER este bloco):
if ((template.kind ?? "LIQUID") === "VITE_SPA") {
  return { ok: false, error: "This template type cannot generate LiquidJS landing pages." };
}

// Phase 8 — substituir pelo branch:
if (template.kind === "VITE_SPA") {
  const lp = await db.lp.create({
    templateId,
    name,
    entryRoute: entryRoute || null,  // null = root '/'
    markupSnapshot: "",              // sentinel — renderLp() guard já rejeita kind=VITE_SPA
    schemaVersion: 0,               // sentinel
    values: {},                      // sentinel
    kind: "VITE_SPA",
  });
  revalidatePath(`/w/${slug}/lps`);
  return { ok: true, data: { id: lp.id } };
}
// else: caminho LIQUID original (steps 4-8) — sem tocar
```

**Padrão de updateLpAction VITE_SPA branch** (baseado no padrão de update das linhas 284–293):
```typescript
// Em updateLpAction, ANTES do db.lp.update existente:
if (existing.kind === "VITE_SPA") {
  const updated = await db.lp.update(id, {
    ...(name !== undefined ? { name } : {}),
    ...(entryRoute !== undefined ? { entryRoute } : {}),
  });
  revalidatePath(`/w/${slug}/lps/${id}/preview`);
  revalidatePath(`/w/${slug}/lps`);
  return { ok: true, data: { id: updated.id } };
}
// else: caminho LIQUID original — sem tocar
```

**Padrão de duplicateLpAction VITE_SPA branch** (baseado no padrão das linhas 324–350):
```typescript
// Em duplicateLpAction, ANTES do db.lp.create existente:
if (origin.kind === "VITE_SPA") {
  const copy = await db.lp.create({
    templateId: origin.templateId ?? undefined,
    name: `Copy of ${origin.name}`,
    entryRoute: origin.entryRoute || null,  // novo campo
    markupSnapshot: "",
    schemaVersion: 0,
    values: {},
    kind: "VITE_SPA",
  });
  revalidatePath(`/w/${slug}/lps`);
  return { ok: true, data: { id: copy.id } };
}
// else: caminho LIQUID com cópia de LpAssets — sem tocar
```

**getLpAction — adicionar `kind` e `entryRoute` ao retorno** (estender linhas 469–478):
```typescript
return {
  ok: true,
  data: {
    id: lp.id,
    name: lp.name,
    markupSnapshot: lp.markupSnapshot,
    schemaVersion: lp.schemaVersion,
    values: lp.values as Record<string, unknown>,
    templateId: lp.templateId,
    kind: lp.kind,          // NOVO — necessário para branches no preview/edit
    entryRoute: lp.entryRoute ?? null,  // NOVO — necessário para VITE_SPA preview URL
  },
};
```

---

### `apps/web/src/lib/lps/schema.ts` (EXTEND — utility, transform)

**Analog:** si mesmo — acrescentar `GenerateViteSpaLpSchema` e estender `UpdateLpSchema`.

**Padrão de schema Zod** (linhas 18–35 do arquivo):
```typescript
export const GenerateLpSchema = z.object({
  templateId: z.string().cuid("Invalid template ID"),
  name: z.string().min(1, "...").max(128, "...").trim(),
  values: z.record(z.string(), z.unknown()),
});
```

**Novo schema para VITE_SPA** (mesmo padrão, campo `values` substituído por `entryRoute`):
```typescript
export const GenerateViteSpaLpSchema = z.object({
  templateId: z.string().cuid("Invalid template ID"),
  name: z.string().min(1, "Landing page name is required").max(128, "...").trim(),
  // entryRoute: opcional, normalizado para null se vazio
  entryRoute: z
    .string()
    .max(128)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
});

export type GenerateViteSpaLpInput = z.infer<typeof GenerateViteSpaLpSchema>;
```

**Extensão do UpdateLpSchema** (adicionar `entryRoute` ao schema existente linhas 43–64):
```typescript
export const UpdateLpSchema = z.object({
  id: z.string().cuid("Invalid LP ID"),
  name: z.string().min(1).max(128).trim().optional(),
  values: z.record(z.string(), z.unknown()).optional(),
  markupSnapshot: z.string().min(1).optional(),
  schemaVersion: z.number().int().positive().optional(),
  entryRoute: z.string().max(128).optional().or(z.literal("")).transform((v) => v || null), // NOVO
});
```

---

### `apps/web/src/lib/db/tenant-db.ts` (EXTEND — service, CRUD)

**Analog:** si mesmo — estender `TenantLpHelpers` com `entryRoute`.

**Interface create atual** (linhas 143–150):
```typescript
export interface TenantLpHelpers {
  create: (data: {
    templateId?: string;
    name: string;
    markupSnapshot: string;
    schemaVersion: number;
    values: Prisma.InputJsonValue;
    kind?: string;
  }) => Promise<LandingPage>;
```

**Extensão necessária** (adicionar `entryRoute` ao tipo de `create` e ao tipo de `update`):
```typescript
  create: (data: {
    templateId?: string;
    name: string;
    markupSnapshot: string;
    schemaVersion: number;
    values: Prisma.InputJsonValue;
    kind?: string;
    entryRoute?: string | null;  // NOVO
  }) => Promise<LandingPage>;

  update: (
    id: string,
    data: {
      name?: string;
      values?: Prisma.InputJsonValue;
      markupSnapshot?: string;
      schemaVersion?: number;
      folderId?: string | null;
      entryRoute?: string | null;  // NOVO
    }
  ) => Promise<LandingPage>;
```

---

### `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` (EXTEND — middleware, request-response)

**Analog:** si mesmo — modificar o path `isHtmlRequest` no Step 8 (linhas 200–214).

**Ponto de injeção** — apenas no path `isHtmlRequest` do HTML request flow. Substituir `transformToWebStream()` por `transformToString()` + inject + nova resposta:

```typescript
// ATUAL (linhas 209–214) — substituir este bloco para o path HTML:
// T-07-02-07: transformToWebStream() called exactly once — stream is consumed once
const webStream = s3Response.Body!.transformToWebStream();
return new NextResponse(webStream, {
  headers: buildSecurityHeaders(contentType),
});

// Phase 8 — path index.html apenas (isHtmlRequest === true):
// Nota: s3Response.Body!.transformToString() consome o stream como string.
// transformToWebStream() permanece inalterado para o path de assets.
const html = await s3Response.Body!.transformToString();
const brand = await prisma.brandConfig.findFirst({ where: { workspaceId } });
// prisma já importado na L48: import { prisma } from "@/lib/db/prisma"
// workspaceId é trusted — vem das claims HMAC (L114)
const styleTag = buildBrandStyleTag(brand?.primaryColor);
const themedHtml = injectBrandStyle(html, styleTag);
return new NextResponse(themedHtml, {
  headers: buildSecurityHeaders(contentType),
});
```

**Import pattern** (adicionar ao bloco de imports existente, depois dos imports já na L39–47):
```typescript
import { buildBrandStyleTag, injectBrandStyle } from "@/lib/brand/theme";
// prisma já importado na L48 — sem mudança
```

**Pitfall crítico (Pitfall 2 do RESEARCH.md):** NÃO importar de `"use server"` modules. `lib/brand/theme.ts` NÃO deve ter `"use server"`. O `prisma` bare client (L48) é usado diretamente — sem `withTenantDb` que exige session.

**Path de assets: sem mudança** — `transformToWebStream()` nas linhas 153/154 permanece inalterado.

---

### `apps/web/src/app/api/lps/[lpId]/export/route.ts` (EXTEND — middleware, streaming)

**Analog:** si mesmo — substituir o 409 placeholder (linhas 193–201) pela implementação VITE_SPA.

**Ponto de extensão** — o guard atual (linhas 193–200):
```typescript
// ATUAL — 409 placeholder (substituir inteiramente):
if ((lp.kind ?? "LIQUID") === "VITE_SPA") {
  return NextResponse.json(
    { error: "VITE_SPA landing pages cannot be exported via this endpoint. Use the project-template serving flow." },
    { status: 409 }
  );
}
```

**Imports novos** (adicionar ao bloco de imports existente após L28–35):
```typescript
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { buildBrandStyleTag, injectBrandStyle } from "@/lib/brand/theme";
// Readable já importado na L28: import { Readable } from "node:stream";
// ZipArchive já importado na L30: import { ZipArchive } from "archiver";
// prisma já importado na L33
```

**Padrão S3 ListObjectsV2 com paginação** (RESEARCH.md RQ-5):
```typescript
const prefix = `workspaces/${lp.workspaceId}/project-templates/${lp.templateId}/dist/`;
let continuationToken: string | undefined;
const s3Keys: string[] = [];

do {
  const listResult = await s3Client.send(new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET!,
    Prefix: prefix,
    ContinuationToken: continuationToken,
  }));
  for (const obj of listResult.Contents ?? []) {
    if (obj.Key) s3Keys.push(obj.Key);
  }
  continuationToken = listResult.NextContinuationToken;
} while (continuationToken);
```

**Padrão archiver VITE_SPA** (espelhar o padrão existente linhas 263–278, mas streaming por S3 key):
```typescript
const archive = new ZipArchive({ zlib: { level: 9 } });
const brandStyleTag = buildBrandStyleTag(brand?.primaryColor);

for (const s3Key of s3Keys) {
  const relativePath = s3Key.slice(prefix.length); // ex: 'index.html', 'assets/main.abc.js'
  const s3Obj = await s3Client.send(new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: s3Key,
  }));

  if (relativePath === "index.html") {
    // Materializar como string para injetar brand style (arquivo pequeno)
    const html = await s3Obj.Body!.transformToString();
    const themedHtml = injectBrandStyle(html, brandStyleTag);
    archive.append(Buffer.from(themedHtml, "utf-8"), { name: "index.html" });
  } else {
    // Stream direto para o ZIP (chunks JS/CSS podem ser grandes)
    const webStream = s3Obj.Body!.transformToWebStream();
    const nodeStream = Readable.fromWeb(webStream);
    archive.append(nodeStream, { name: relativePath });
  }
}

archive.finalize();
// Reusar o padrão de resposta existente (linhas 278–291):
const webStream = Readable.toWeb(archive as unknown as Readable);
const slug = slugify(lp.name, { lower: true, strict: true }) || "landing-page";
return new NextResponse(webStream as ReadableStream, {
  headers: {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${slug}.zip"`,
  },
});
```

**Pitfalls:**
- Sem CSP meta injection (D-12) — o `injectCsp()` existente NÃO é chamado para VITE_SPA.
- `lp.templateId` deve ser não-nulo — validar antes de construir o prefix (`if (!lp.templateId) return 400`).
- `brand` lido via `withTenantDb` ou `prisma.brandConfig.findFirst({ where: { workspaceId: lp.workspaceId } })` — ambos disponíveis neste route handler (tem session + `prisma` importado).

---

### `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` (EXTEND — component, request-response)

**Analog direto:** `apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx`

**Imports a adicionar** (espelhar linhas 27–30 do analog de template preview):
```typescript
import { mintServeToken } from "@/lib/serve/token";
// withTenantDb e requireWorkspace já importados
```

**Padrão de branch VITE_SPA** — inserir ANTES da chamada `renderLp()` existente (após o `if (!lp) redirect(...)`):

```typescript
// Phase 8: branch VITE_SPA ANTES de chamar renderLp() (que lança para kind=VITE_SPA)
if (lp.kind === "VITE_SPA") {
  // Token scoped to {workspaceId, templateId} — mesmo padrão do template preview (L57-66 do analog)
  const token = mintServeToken(ctx.workspaceId, lp.templateId!);

  // Construção da serveOrigin — copiar exatamente das linhas 64–66 do analog:
  const serveOrigin =
    process.env.NODE_ENV === "development"
      ? `http://${lp.templateId}.serve.localhost:${process.env.PORT ?? 3000}`
      : `https://${lp.templateId}.serve.${process.env.SERVE_DOMAIN}`;

  const entryPath = lp.entryRoute ?? "/";

  return (
    <div className="page-wrapper flex flex-col gap-6 px-8 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-gray-900">{lp.name}</h1>
        <p className="text-sm text-gray-500">
          Preview — served from isolated origin
        </p>
      </div>
      {/* sandbox="allow-scripts" apenas — copiar do analog linhas 77-88 */}
      <iframe
        src={`${serveOrigin}${entryPath}?t=${token}`}
        sandbox="allow-scripts"
        style={{ width: "100%", height: "80vh", border: "none" }}
        title={`Preview: ${lp.name}`}
      />
    </div>
  );
}
// else: caminho LIQUID existente com renderLp() — sem tocar
```

**Pitfall crítico (Pitfall 3 do RESEARCH.md):** Token scoped a `lp.templateId` (não ao `lp.id`). O serve handler verifica `claims.templateId !== tplId` — se usar o ID da LP, o 403 está garantido.

---

### `apps/web/src/app/w/[slug]/lps/[lpId]/edit/page.tsx` (EXTEND — component, request-response)

**Analog:** si mesmo — branch VITE_SPA antes da chamada `parse(lp.markupSnapshot)`.

**Ponto crítico (Pitfall 4 do RESEARCH.md):** O `parse(lp.markupSnapshot)` com sentinel `''` causa redirect loop. O kind check deve ser o PRIMEIRO passo depois de `if (!lp) redirect(...)`:

```typescript
// Inserir ANTES de const parsedSchema = parse(lp.markupSnapshot) (linha 49 atual):
if (lp.kind === "VITE_SPA") {
  // Branch: VITE_SPA edit = editar apenas entryRoute + name.
  // NÃO chamar parse() — markupSnapshot é sentinel '' para VITE_SPA.
  return (
    <div className="px-8 py-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Edit Landing Page
      </h1>
      <ViteSpaLpForm
        slug={slug}
        mode="edit"
        lpId={lp.id}
        lpName={lp.name}
        initialEntryRoute={lp.entryRoute ?? ""}
      />
    </div>
  );
}
// else: caminho LIQUID com parse() — sem tocar (linha 49 em diante)
```

**Padrão de requireWorkspaceRole** (linha 34 do arquivo atual — sem mudança):
```typescript
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);
```

---

### `apps/web/src/app/w/[slug]/lps/new/[templateId]/page.tsx` (EXTEND — component, request-response)

**Analog:** si mesmo — branch VITE_SPA depois do `if (!template) redirect(...)` e antes de `ParsedSchemaValidator.safeParse`.

```typescript
// Inserir APÓS if (!template) redirect — ANTES de ParsedSchemaValidator.safeParse (linha 46):
if (template.kind === "VITE_SPA") {
  // Branch: VITE_SPA generate = form simples (name + entryRoute opcional)
  // Não precisa de ParsedSchemaValidator, LpForm, ou metadataOverlay
  return (
    <div className="px-8 py-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Generate Landing Page
      </h1>
      <ViteSpaLpForm
        slug={slug}
        mode="generate"
        templateId={template.id}
        templateName={template.name}
        initialLpName={lpName ?? ""}
      />
    </div>
  );
}
// else: caminho LIQUID (ParsedSchemaValidator + LpForm) — sem tocar
```

---

### `apps/web/src/components/lps/ViteSpaLpForm.tsx` (NOVO — component, request-response)

**Analog:** `apps/web/src/components/lps/LpForm.tsx`

**Padrão "use client" + imports** (linhas 1–40 do LpForm.tsx):
```typescript
"use client";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { generateViteSpaLpAction, updateLpAction } from "@/lib/lps/actions";
import { GenerateViteSpaLpSchema } from "@/lib/lps/schema";
```

**Padrão de props** (simplificado vs. LpFormProps):
```typescript
interface ViteSpaLpFormProps {
  slug: string;
  mode: "generate" | "edit";
  templateId?: string;       // generate mode
  templateName?: string;     // generate mode
  lpId?: string;             // edit mode
  lpName?: string;           // generate initial value / edit initial name
  initialEntryRoute?: string; // edit mode
  initialLpName?: string;     // generate mode (from searchParams.name)
}
```

**Padrão de submit + useTransition** (espelhar padrão das linhas 120–160 do LpForm.tsx):
```typescript
const [isPending, startTransition] = useTransition();
const router = useRouter();

function onSubmit(values: ...) {
  startTransition(async () => {
    const result = await generateViteSpaLpAction(slug, { ...values });
    if (!result.ok) {
      toast.error(result.error ?? "Failed.");
      return;
    }
    toast.success("Landing page created!");
    router.push(`/w/${slug}/lps/${result.data.id}/preview`);
  });
}
```

**Form UI mínima** — apenas dois campos:
- `name` (obrigatório, igual ao LpForm)
- `entryRoute` (opcional, texto, placeholder `/grecia` — aparece com descrição "Leave empty for single-page projects (uses root /)")

---

## Shared Patterns

### Gate de autenticação + workspaceId server-side
**Fonte:** `apps/web/src/lib/lps/actions.ts` linhas 151–153
**Aplicar a:** todas as server actions VITE_SPA novas/estendidas
```typescript
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);
// workspaceId = ctx.workspaceId — NUNCA de input do cliente
```

### Guard bidirecional de kind
**Fonte:** `apps/web/src/lib/serve/serve-vite-spa.ts` linhas 51–58 + `apps/web/src/lib/lps/render.ts` (guard recíproco)
**Aplicar a:** todos os pontos de branch (preview, edit, export, generate)
```typescript
// Pattern: sempre branch por kind ANTES de qualquer operação kind-específica
if (lp.kind === "VITE_SPA") {
  // caminho VITE_SPA
}
// else: caminho LIQUID inalterado
```

### Pattern de ActionResult
**Fonte:** `apps/web/src/lib/lps/actions.ts` linhas 234–236 (try/catch externo)
**Aplicar a:** todos os novos branches em actions.ts
```typescript
try {
  return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
    // ...
    return { ok: true, data: { id: lp.id } };
  });
} catch {
  return { ok: false, error: "Failed. Please try again." };
}
```

### revalidatePath após mutação
**Fonte:** `apps/web/src/lib/lps/actions.ts` linhas 231, 292
**Aplicar a:** todos os branches de generate/update/duplicate VITE_SPA
```typescript
revalidatePath(`/w/${slug}/lps`);
// Para update: também
revalidatePath(`/w/${slug}/lps/${id}/preview`);
```

### Prisma bare client no serve route (sem withTenantDb)
**Fonte:** `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` linhas 47–48 + 119
**Aplicar a:** brand config lookup dentro do serve route handler (origem isolada = sem session)
```typescript
// No serve route — workspaceId confiável via HMAC claims:
const brand = await prisma.brandConfig.findFirst({ where: { workspaceId } });
// NÃO usar withTenantDb (requer session que o serve route não tem)
```

### iframe sandbox pattern (serving isolado)
**Fonte:** `apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx` linhas 83–88
**Aplicar a:** `lps/[lpId]/preview/page.tsx` branch VITE_SPA
```tsx
<iframe
  src={`${serveOrigin}${entryPath}?t=${token}`}
  sandbox="allow-scripts"
  style={{ width: "100%", height: "80vh", border: "none" }}
  title={`Preview: ${lp.name}`}
/>
// NÃO adicionar allow-same-origin — colapsaria a origem opaca
```

### serveOrigin construction
**Fonte:** `apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx` linhas 64–66
**Aplicar a:** `lps/[lpId]/preview/page.tsx` branch VITE_SPA (usando `lp.templateId`)
```typescript
const serveOrigin =
  process.env.NODE_ENV === "development"
    ? `http://${lp.templateId}.serve.localhost:${process.env.PORT ?? 3000}`
    : `https://${lp.templateId}.serve.${process.env.SERVE_DOMAIN}`;
```

### Re-throw Next.js internals
**Fonte:** `apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx` linhas 103–107
**Aplicar a:** todos os RSC pages com try/catch
```typescript
if (
  err instanceof Error &&
  (err.message.includes("NEXT_REDIRECT") || err.message.includes("NEXT_NOT_FOUND"))
) {
  throw err;
}
```

### ZIP streaming response
**Fonte:** `apps/web/src/app/api/lps/[lpId]/export/route.ts` linhas 263–291
**Aplicar a:** branch VITE_SPA do export route (mesmo padrão `Readable.toWeb(archive)`)
```typescript
archive.finalize();
const webStream = Readable.toWeb(archive as unknown as Readable);
const slug = slugify(lp.name, { lower: true, strict: true }) || "landing-page";
return new NextResponse(webStream as ReadableStream, {
  headers: {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${slug}.zip"`,
  },
});
```

---

## No Analog Found

Nenhum arquivo sem analog — todos têm correspondência direta ou role-match no codebase.

---

## Metadata

**Escopo de busca de analogs:** `apps/web/src/` (todo o monorepo web) + `apps/web/prisma/`
**Arquivos lidos:** 14 arquivos fonte + 2 contexto
**Data de extração:** 2026-06-22
