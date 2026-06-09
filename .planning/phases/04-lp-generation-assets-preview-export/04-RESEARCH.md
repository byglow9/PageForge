# Phase 4: LP Generation, Assets, Preview & Export — Research

**Researched:** 2026-06-09
**Domain:** Schema-driven dynamic form, S3-compatible image upload, LP data model, preview/export pipeline, ZIP generation
**Confidence:** HIGH

---

## Summary

Phase 4 delivers the core product promise: a stored template schema (Phase 3) drives a React Hook Form dynamic form whose submitted values are merged by the Phase 1 LiquidJS engine into a static HTML LP that can be previewed, edited, duplicated, and exported as a self-contained ZIP. Every piece of the stack is already chosen and locked in CLAUDE.md and CONTEXT.md; this research confirms implementation patterns, integration points, and pitfalls so the planner can write precise tasks.

The five vertical slices are: (1) form→merge→preview, (2) image upload, (3) LP data model + regenerate, (4) duplicate, (5) ZIP export. The preview==export guarantee is satisfied by a shared `renderLp()` utility that both paths call identically — no deviation is permitted between them.

The most complex sub-problem is building the dynamic form from the stored `ParsedSchema + MetadataOverlay`. React Hook Form's `useFieldArray` handles repeater blocks. Every field type needs a dedicated input component, and the Tiptap rich-text editor must be wired via `Controller` (not `register`). The second-hardest sub-problem is the ZIP export route handler: it must download S3 images server-side, rewrite `src` attributes to `./assets/...`, inject a strict CSP `<meta>` tag, then stream the archive with `archiver`.

**Primary recommendation:** Build a `lib/lps/` feature module mirroring `lib/templates/` and `lib/brand/`, add `LandingPage` + `LpAsset` Prisma models, wire a new `TenantLpHelpers` interface into `TenantClient`, and implement five focused components: `LpForm`, `ImageUploadField`, `RichTextField`, `LpPreview` (iframe srcdoc), and a `/api/lps/[id]/export` route handler.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Image storage = S3-compatible (MinIO local, R2/S3 production). Bytes stay off app server. Tenant-scoped paths.
- **D-02:** Browser uploads directly to bucket via server-generated presigned PUT URLs.
- **D-03:** Server-side validation: magic-bytes check, size cap (5 MB), pixel cap. Fixed defaults in v1.
- **D-04:** Brand globals are LIVE — resolved from current `BrandConfig` at every preview/export.
- **D-05:** Missing `brand.*` field → renders empty (`strictVariables: false`). No hard error.
- **D-06:** Each LP stores a snapshot of template `markup` + `schema_version` at generation time. Edit renders against snapshot markup, not live template.
- **D-07:** Asymmetry by design: markup/schema snapshotted (layout stability), brand globals live (intentional propagation).
- **D-08:** Reopening an LP whose source template has a newer `schema_version` reconciles values by field name (keep matching, drop removed, default new). Surface diff to user. Pulling new version refreshes the snapshot.
- **D-09:** Export = self-contained ZIP (`index.html` + `./assets/`) via `archiver`: download referenced images server-side, rewrite src to relative paths, stream ZIP.
- **D-10:** Exported HTML has a strict CSP baked in (no inline-script execution).
- **D-11:** User names the LP at generation time (LP name field in the form/picker).
- **D-12:** Duplicate = full independent copy (values + markup snapshot + schema_version → new LP). Editing copy never affects origin.

### Upstream Locked (not re-decided here)

- LP = values as data, HTML derived (regenerate on demand).
- Preview == export — same `render()` pipeline for both.
- Validation = type + `required` only on submit (GEN-04).
- `BrandConfig` fixed field set: `logoUrl`, `primaryColor`, `whatsapp`.

### Claude's Discretion

- Repeater add/remove form interaction (React Hook Form `useFieldArray` is canonical).
- Whether repeater blocks render as collapsible sections.
- Preview surface (inline iframe — decided in UI-SPEC as `srcdoc`).
- Exact Prisma shape for `LandingPage` model and asset records.
- The storage abstraction interface (MinIO/R2/S3 swap) and presigned-URL route shape.
- Exact strict-CSP policy string for exported HTML.
- Whether to persist generated HTML or always regenerate.

### Deferred Ideas (OUT OF SCOPE)

- Catalog organization (folders, categories, browse/search) — Phase 5.
- Grécia end-to-end acceptance — Phase 5.
- Advanced field validation (regex, image dimensions/ranges, numeric) — v2 VAL-01.
- Author-configurable image caps — v2.
- "Configure your brand" advisory warning — optional planner nice-to-have.
- Platform-hosted LP URLs — v2 HOST-01.
- Form/preview visual design — `/gsd-ui-phase` (already completed: 04-UI-SPEC.md).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GEN-01 | Selecting a template opens a dynamic form generated from its schema | Form builder reads `Template.schema` (ParsedSchema) + `metadataOverlay` from DB; React Hook Form `useForm` + Zod resolver derived from schema |
| GEN-02 | Form supports all field types: text, rich text, image upload, color, button+URL | Per-type input components: `<Input>`, `<RichTextField>` (Tiptap), `<ImageUploadField>`, color+swatch, button+URL pair |
| GEN-03 | User can add and remove items in repeatable blocks within the form | `useFieldArray` with `append()` and `remove(index)` — maps to `schema.repeaters[]` |
| GEN-04 | System validates required fields by type on submit | Zod schema derived at runtime from `metadataOverlay.required` flags; `zodResolver` on RHF |
| AST-01 | User can upload images for image fields, workspace-scoped, magic-byte validated | Presigned PUT via `@aws-sdk/s3-request-presigner`; `file-type` (v22) for magic-bytes server-side; tenant-scoped S3 key prefix |
| LP-01 | User can preview a rendered LP at any time | `render(snapshotMarkup, values, liveBrand)` → HTML string → iframe `srcdoc`; same path as export |
| LP-02 | User can reopen and edit an LP's data and regenerate its HTML | Form pre-populated from `LandingPage.values` jsonb; on save → `render()` again; schema version reconciliation on mismatch |
| LP-03 | User can duplicate an existing LP | Server Action copies `LandingPage` row (values + markupSnapshot + schemaVersion) → new row with "Copy of {name}" |
| LP-04 | User can export/download the LP as a self-contained HTML bundle | Route handler: `render()` → HTML; parse `<img src>` + background-image; fetch images from S3; `archiver` ZIP with `./assets/`; inject CSP `<meta>`; stream response |
| BRD-02 | Templates can reference global brand values; generated LPs use them automatically | `db.brandConfig.findFirst()` → `{ logoUrl, primaryColor, whatsapp }` → passed as `brand` arg to `render()` at every preview/export |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dynamic form rendering | Browser / Client | — | RHF state is client-side; schema-to-Zod derivation happens at component init |
| LP form Zod schema derivation | API / Backend | Browser | Schema derived from DB data in Server Component, passed as serialized config to client form |
| Presigned URL generation | API / Backend | — | Must be server-side; AWS credentials never reach browser |
| Magic-bytes + pixel cap validation | API / Backend | — | Server Action receives file metadata + partial buffer; never trust client content-type |
| Image upload to S3 | Browser / Client | — | Direct PUT to bucket via presigned URL; bytes never transit app server |
| `render(markup, values, brand)` call | API / Backend | — | LiquidJS engine is server-only; never render untrusted templates client-side |
| Preview iframe rendering | Browser / Client | API / Backend | Client receives HTML string from server; iframe uses `srcdoc` (no separate URL needed) |
| ZIP assembly + streaming | API / Backend | — | Route handler streams `archiver` output; server downloads S3 images and rewrites paths |
| LP data persistence | Database / Storage | API / Backend | `LandingPage` + `LpAsset` in PostgreSQL; accessed via `withTenantDb` |
| CSP injection | API / Backend | — | Injected into HTML string before ZIP assembly; server controls the policy |
| Brand globals resolution | API / Backend | — | `BrandConfig` fetched from DB on server at every preview/export call |
| Schema version reconciliation | API / Backend | Browser | Reconciliation logic runs server-side in the edit action; result surfaced to client as amber alert |

---

## Standard Stack

### Core (all already installed or confirmed in CLAUDE.md)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | 7.78.0 | Form state, `useFieldArray` for repeaters | CLAUDE.md locked; `useFieldArray` is the canonical solution for add/remove repeater items [VERIFIED: npm registry] |
| @hookform/resolvers | 5.4.0 | Zod 4 bridge for RHF | Required to connect runtime Zod schema to RHF; supports Zod v4 [VERIFIED: npm registry] |
| zod | 4.4.3 | Runtime schema derivation + Server Action input validation | Already installed; CLAUDE.md locked [VERIFIED: package.json] |
| @tiptap/react | 3.26.0 | Rich-text field editor | CLAUDE.md locked; `useEditor` + `EditorContent` + `StarterKit` [VERIFIED: npm registry] |
| @tiptap/starter-kit | 3.26.0 | StarterKit extension (Bold, Italic, Lists, Link) | Installed alongside @tiptap/react [VERIFIED: npm registry] |
| @tiptap/pm | 3.26.0 | ProseMirror peer dependency for Tiptap | Required by Tiptap 3.x [VERIFIED: npm registry] |
| @aws-sdk/client-s3 | 3.1064.0 | S3-compatible client (presigned URLs, delete) | CLAUDE.md locked [VERIFIED: npm registry] |
| @aws-sdk/s3-request-presigner | 3.1064.0 | `getSignedUrl()` for presigned PUT | Companion package to client-s3; same version [VERIFIED: npm registry] |
| archiver | 8.0.0 | Streaming ZIP assembly for export | CLAUDE.md locked; Transform stream that pipes to HTTP response [VERIFIED: npm registry] |
| @types/archiver | 8.0.0 | TypeScript types for archiver | Required for TS usage [VERIFIED: npm registry] |
| file-type | 22.0.1 | Magic-bytes file type detection | `fileTypeFromBuffer()` → `{ ext, mime }`; ESM-only in v22+ [VERIFIED: npm registry] |
| sanitize-html | 2.17.4 | Rich-text sanitization | Already in engine (`sanitizeRichText`); also used server-side before LP merge [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @hello-pangea/dnd | 18.0.1 | Drag-to-reorder in repeater blocks | UI-SPEC mandates drag reorder; `@hello-pangea/dnd` is the maintained DnD Kit / react-beautiful-dnd fork [VERIFIED: npm registry] |
| slugify | 1.6.9 | Generate URL-safe filename for ZIP download | `{lp-name-slug}.zip` filename from LP name [VERIFIED: npm registry] |
| node-fetch | 3.3.2 | Server-side image download for ZIP assembly | Fetch S3 images during export; already in Node 22 via global `fetch`, but explicit import for clarity [ASSUMED] |

> Note: `node-fetch` may not be needed — Node 22 has native `fetch`. The planner should use the native global `fetch` in the route handler unless there is a known limitation. [ASSUMED]

### shadcn/ui Components for This Phase

Per 04-UI-SPEC.md — new components to install:

| Component | shadcn Command | Used In |
|-----------|---------------|---------|
| select | `npx shadcn@latest add select` | Template picker dropdown |
| progress | `npx shadcn@latest add progress` | Image upload progress bar |

Already installed (do not re-install): alert, badge, button, card, dialog, input, label, separator, skeleton, sonner, switch, textarea, tooltip.

### Installation

```bash
# From apps/web directory
pnpm add react-hook-form @hookform/resolvers @tiptap/react @tiptap/starter-kit @tiptap/pm
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
pnpm add archiver file-type slugify
pnpm add -D @types/archiver

# New shadcn components
npx shadcn@latest add select progress
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser                        Next.js App Server             PostgreSQL         S3-Compatible
  |                                  |                            |                  |
  |-- GET /w/[slug]/lps/new -------->|                            |                  |
  |<-- (RSC) template list ---------|-- withTenantDb list() ---->|                  |
  |                                  |<-- templates[] ------------|                  |
  |                                  |                            |                  |
  |-- GET /w/[slug]/lps/new/[tId] -->|                            |                  |
  |<-- (RSC) LpForm(schema) ---------|-- findById(templateId) --->|                  |
  |                                  |<-- Template (markup,schema)|                  |
  |                                  |-- brandConfig.findFirst() ->                  |
  |                                  |<-- BrandConfig ------------|                  |
  |                                  |                            |                  |
  |  [User fills form]               |                            |                  |
  |-- requestPresignedUrl(Server Action)->                        |                  |
  |<- presignedPutUrl <-------------|-- getSignedUrl(PutCmd) --->|                  |-- (S3 key: w/{wId}/lps/temp/{uuid}.jpg)
  |-- PUT image directly -------------------------------------------------->|       |
  |<-- 200 OK ----------------------------------------------------|       |
  |  [Image URL stored in RHF field value]                        |       |
  |                                                               |       |
  |-- handleSubmit → generateLpAction(Server Action) ----------->|       |
  |                                  |-- requireWorkspaceRole() ->|       |
  |                                  |-- render(snapshotMarkup,   |       |
  |                                  |         values, liveBrand) |       |
  |                                  |-- db.lp.create() --------->|       |
  |<-- redirect /preview ------------|<-- { ok, lpId } -----------|       |
  |                                  |                            |       |
  |-- GET /w/[slug]/lps/[id]/preview->                            |       |
  |<-- (RSC) renders → HTML string --|-- db.lp.findById() ------->|       |
  |  [iframe srcdoc=html]            |-- render(snapshot...) ---->|       |
  |                                  |                            |       |
  |-- GET /api/lps/[id]/export ------>                            |       |
  |                                  |-- db.lp.findById() ------->|       |
  |                                  |-- brandConfig.findFirst() ->       |
  |                                  |-- render() → html          |       |
  |                                  |-- parse img srcs           |       |
  |                                  |-- fetch(s3Url) ---------------------------------------->|
  |                                  |<-- image buffer -----------------------------------|     |
  |                                  |-- archiver.append(html, "index.html")             |     |
  |                                  |-- archiver.append(imgBuf, "assets/x.jpg")         |     |
  |                                  |-- archiver.finalize() → pipe(res)                 |     |
  |<-- ZIP stream (Content-Type: application/zip) ----------|     |                      |     |
```

### Recommended Project Structure

```
apps/web/src/
├── lib/lps/
│   ├── actions.ts          # Server Actions: generate, update, duplicate, delete, listLps, getLp
│   ├── schema.ts           # Zod: GenerateLpSchema, UpdateLpSchema
│   ├── render.ts           # renderLp(lpId, db) → HTML string (shared by preview + export)
│   └── schema-derive.ts    # deriveZodSchema(fields, overlay) → ZodObject for RHF resolver
├── app/w/[slug]/
│   ├── lps/
│   │   ├── page.tsx                    # LP list (RSC)
│   │   ├── new/
│   │   │   ├── page.tsx                # Template picker (RSC)
│   │   │   └── [templateId]/
│   │   │       └── page.tsx            # Dynamic form (RSC shell + client LpForm)
│   │   └── [lpId]/
│   │       ├── preview/
│   │       │   └── page.tsx            # Preview (RSC: renders HTML, passes to LpPreview)
│   │       └── edit/
│   │           └── page.tsx            # Edit form (RSC shell + client LpForm)
├── app/api/lps/[lpId]/export/
│   └── route.ts                        # ZIP export route handler (streaming)
├── components/lps/
│   ├── LpForm.tsx                      # "use client" — main dynamic form
│   ├── LpCard.tsx                      # LP card for list page
│   ├── LpPreview.tsx                   # "use client" — iframe srcdoc component
│   ├── RepeaterBlock.tsx               # "use client" — collapsible repeater section
│   ├── ImageUploadField.tsx            # "use client" — presigned PUT upload component
│   ├── RichTextField.tsx               # "use client" — Tiptap controller wrapper
│   └── BrandGlobalsPanel.tsx           # "use client" or server — read-only brand display
```

### Pattern 1: Dynamic Zod Schema Derivation from ParsedSchema + MetadataOverlay

**What:** At LP form render time, derive a `z.ZodObject` from the stored `ParsedSchema.fields` and `MetadataOverlay`. This is the runtime Zod schema passed to `zodResolver`.

**When to use:** When building `LpForm`; the schema is derived once per form mount from the data fetched by the RSC parent.

```typescript
// Source: Context7 /react-hook-form/documentation + codebase inspection
// apps/web/src/lib/lps/schema-derive.ts

import { z } from "zod";
import type { TokenField } from "pageforge-engine";
import type { MetadataOverlay } from "@/lib/templates/metadata";

/**
 * Derive a Zod schema from ParsedSchema fields + MetadataOverlay.
 * Used as the resolver for React Hook Form in LpForm.
 *
 * Field types → Zod shapes:
 *  - text       → z.string()
 *  - richtext   → z.string() (HTML from Tiptap)
 *  - image      → z.string().url() (S3 URL after upload) — optional unless required
 *  - color      → z.string().regex(/^#[0-9a-fA-F]{6}$/)
 *  - button     → z.object({ label: z.string(), url: z.string().url() })
 *  - repeater   → z.array(z.object({ ...itemFields }))
 *  - global     → excluded (pre-bound, not user-editable)
 */
export function deriveZodSchema(
  fields: TokenField[],
  overlay: MetadataOverlay
): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};

  // Top-level non-repeater, non-global fields
  for (const field of fields) {
    if (field.global || field.repeater) continue;

    const meta = overlay[field.name] ?? { required: false };
    let fieldSchema: z.ZodTypeAny;

    if (field.type === "text") {
      fieldSchema = meta.required
        ? z.string().min(1, "This field is required.")
        : z.string();
    } else if (field.type === "richtext") {
      // Tiptap outputs HTML; treat as string
      fieldSchema = meta.required
        ? z.string().min(1, "This field is required.")
        : z.string();
    } else if (field.type === "image") {
      // After upload, field value = the S3 URL
      fieldSchema = meta.required
        ? z.string().url("Enter a valid image URL.")
        : z.string().url("Enter a valid image URL.").or(z.literal(""));
    } else if (field.type === "color") {
      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      fieldSchema = meta.required
        ? z.string().regex(hexRegex, "Enter a valid hex color (e.g. #0f172a).")
        : z.string().regex(hexRegex, "Enter a valid hex color (e.g. #0f172a).").or(z.literal(""));
    } else if (field.type === "button") {
      fieldSchema = z.object({
        label: meta.required
          ? z.string().min(1, "This field is required.")
          : z.string(),
        url: z.string().url("Enter a valid URL starting with https://.").or(z.literal("")),
      });
    } else {
      fieldSchema = z.string();
    }

    shape[field.name] = fieldSchema;
  }

  // Repeater blocks → z.array(z.object({...}))
  const repeaterNames = [...new Set(fields.filter(f => f.repeater).map(f => f.repeater!))];
  for (const repeaterName of repeaterNames) {
    const itemFields = fields.filter(f => f.repeater === repeaterName);
    const itemShape: z.ZodRawShape = {};
    for (const f of itemFields) {
      const meta = overlay[f.name] ?? { required: false };
      // Apply same type logic as above
      itemShape[f.name] = meta.required
        ? z.string().min(1, "This field is required.")
        : z.string();
    }
    shape[repeaterName] = z.array(z.object(itemShape));
  }

  return z.object(shape);
}
```

### Pattern 2: useFieldArray for Repeater Blocks

**What:** Each `schema.repeaters[]` entry maps to a `useFieldArray` invocation. The form shape places each repeater as a top-level array key.

**When to use:** Inside `RepeaterBlock.tsx` or directly in `LpForm.tsx` per repeater.

```tsx
// Source: Context7 /react-hook-form/documentation — useFieldArray basic setup
// [VERIFIED: Context7]

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// In LpForm — for a repeater named "roteiro":
const { fields, append, remove, move } = useFieldArray({
  control,
  name: "roteiro", // matches schema.repeaters[] entry name
});

// Render:
fields.map((item, index) => (
  <div key={item.id}>
    {/* Each repeater-item field registered as "roteiro.{index}.{fieldName}" */}
    <input {...register(`roteiro.${index}.titulo`)} />
    <button type="button" onClick={() => remove(index)}>Remove</button>
  </div>
));

// Add button:
<button type="button" onClick={() => append({ titulo: "", descricao: "" })}>
  + Add Day
</button>
```

### Pattern 3: Tiptap Rich Text via Controller (not register)

**What:** Tiptap's `useEditor` manages its own internal state; it cannot use `register`. Use `Controller` to bridge Tiptap to RHF.

**When to use:** Any `type === "richtext"` field in `RichTextField.tsx`.

**Critical:** Set `immediatelyRender: false` to avoid React hydration mismatch in Next.js SSR.

```tsx
// Source: Context7 /ueberdosis/tiptap-docs — Next.js integration + Controller pattern
// [VERIFIED: Context7]

"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Controller, type Control } from "react-hook-form";

interface RichTextFieldProps {
  name: string;
  control: Control<any>;
  defaultValue?: string;
  label: string;
}

export function RichTextField({ name, control, defaultValue = "", label }: RichTextFieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      defaultValue={defaultValue}
      render={({ field }) => {
        const editor = useEditor({
          extensions: [StarterKit],
          content: field.value,
          immediatelyRender: false, // REQUIRED for Next.js SSR
          onUpdate: ({ editor }) => {
            field.onChange(editor.getHTML());
          },
        });
        return (
          <div aria-label={`${label} rich text editor`}>
            {/* Toolbar: Bold, Italic, BulletList, OrderedList, Link */}
            <EditorContent editor={editor} />
          </div>
        );
      }}
    />
  );
}
```

**Warning:** `useEditor` must not be called inside the `render` prop (hooks-in-callbacks rule). Extract the inner component.

### Pattern 4: Presigned PUT Upload Flow

**What:** Server generates a presigned PUT URL scoped to the tenant. Browser uploads directly to the bucket. Server never handles the image bytes.

**When to use:** `ImageUploadField.tsx` — when user selects/drops a file.

```typescript
// Source: Context7 /aws/aws-sdk-js-v3 — presigned PUT with signableHeaders
// [VERIFIED: Context7]

// SERVER SIDE — Server Action (apps/web/src/lib/lps/actions.ts)
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,       // http://localhost:9000 for MinIO
  forcePathStyle: true,                     // Required for MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export async function requestPresignedUploadAction(
  slug: string,
  input: { filename: string; contentType: string; fileSize: number }
) {
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Server-side size cap (D-03)
  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  if (input.fileSize > MAX_BYTES) {
    return { ok: false, error: "File exceeds the 5 MB limit." };
  }

  // Tenant-scoped path (D-01)
  const ext = input.filename.split(".").pop() ?? "bin";
  const key = `workspaces/${ctx.workspaceId}/lps/assets/${crypto.randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.fileSize,
  });

  const presignedUrl = await getSignedUrl(s3, command, {
    expiresIn: 3600,
    signableHeaders: new Set(["content-type"]),
  });

  const publicUrl = `${process.env.S3_PUBLIC_BASE_URL}/${key}`;

  return { ok: true, data: { presignedUrl, publicUrl, key } };
}

// CLIENT SIDE — ImageUploadField.tsx
async function uploadFile(file: File, presignedUrl: string, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => xhr.status < 300 ? resolve() : reject());
    xhr.addEventListener("error", reject);
    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}
```

### Pattern 5: Magic-Bytes Validation (Server Action)

**What:** After the client sends the file metadata to request a presigned URL, but before issuing it, validate the file's magic bytes. The client sends the first N bytes (or the full buffer for small files < 5 MB) as a Base64 payload.

**When to use:** `requestPresignedUploadAction` — before generating the presigned URL.

```typescript
// Source: Context7 /sindresorhus/file-type — fileTypeFromBuffer
// [VERIFIED: Context7]
// Note: file-type v22+ is ESM-only. Use dynamic import in a CJS context,
// or configure Next.js transpilePackages if needed.

import { fileTypeFromBuffer } from "file-type"; // ESM package

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// In requestPresignedUploadAction, after receiving firstBytes (Buffer):
const detected = await fileTypeFromBuffer(firstBytes);
if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
  return { ok: false, error: "File does not appear to be a valid image." };
}
```

**ESM caveat:** `file-type` v22+ is pure ESM. In Next.js (App Router, Node runtime), add it to `transpilePackages` in `next.config.ts` OR use `await import("file-type")` dynamic import. [VERIFIED: npm registry metadata / ASSUMED for the exact Next.js config line]

### Pattern 6: renderLp() — Shared Preview + Export Pipeline

**What:** A server-side utility function that encapsulates the full render pipeline. Both the preview RSC and the export route handler call this function identically — this is the preview==export guarantee.

**When to use:** In `lib/lps/render.ts`; called from preview page RSC and `/api/lps/[id]/export/route.ts`.

```typescript
// Source: codebase inspection of src/engine/renderer.ts + lib/brand/actions.ts
// [VERIFIED: codebase]

// apps/web/src/lib/lps/render.ts
import { render } from "pageforge-engine";
import type { TenantClient } from "@/lib/db/tenant-db";
import { ParsedSchemaValidator } from "@/lib/templates/parsed-schema-validator";

/**
 * Render an LP's HTML from its stored snapshot markup and live brand config.
 *
 * IMPORTANT: Import only { render } from "pageforge-engine" — importing the full
 * engine module in a Server Action can cause build errors (Pitfall 1 from Phase 3).
 * This utility is server-only (called from RSC or route handler, never from Client Component).
 */
export async function renderLp(
  lp: { markupSnapshot: string; values: Record<string, unknown> },
  db: TenantClient
): Promise<string> {
  const brand = await db.brandConfig.findFirst();
  const brandScope: Record<string, unknown> = {
    logo: brand?.logoUrl ?? "",
    primary_color: brand?.primaryColor ?? "",
    whatsapp: brand?.whatsapp ?? "",
  };
  return render(lp.markupSnapshot, lp.values, brandScope);
}
```

**Note:** Brand field name mapping — the engine uses `brand.logo`, `brand.primary_color`, `brand.whatsapp` in the scope object, which maps to `BrandConfig.logoUrl`, `BrandConfig.primaryColor`, `BrandConfig.whatsapp`. Verify the exact key names match the token grammar in Phase 1 parser (e.g., `brand.logo` vs `brand.logoUrl`). [ASSUMED — requires codebase cross-check during planning against Phase 1 grammar]

### Pattern 7: ZIP Export Route Handler

**What:** A Next.js App Router route handler (`GET`) that renders the LP, extracts image URLs, downloads them from S3, rewrites src attributes to `./assets/`, injects a strict CSP `<meta>`, and streams a ZIP.

**When to use:** `/api/lps/[lpId]/export/route.ts`.

```typescript
// Source: Context7 /archiverjs/node-archiver — pipe to HTTP response
// [VERIFIED: Context7]

import archiver from "archiver";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: { lpId: string } }) {
  // 1. Auth + fetch LP
  // ... requireWorkspace + db.lp.findById(lpId)

  // 2. Render HTML (same path as preview)
  const html = await renderLp(lp, db);

  // 3. Extract image src URLs (regex or html parser)
  // 4. Download each image, assign ./assets/{filename}
  // 5. Rewrite src attributes in html
  // 6. Inject CSP <meta> into <head>

  // 7. Stream ZIP
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("data", (chunk) => writer.write(chunk));
  archive.on("end", () => writer.close());
  archive.on("error", (err) => writer.abort(err));

  archive.append(rewrittenHtml, { name: "index.html" });
  for (const asset of assets) {
    archive.append(asset.buffer, { name: `assets/${asset.filename}` });
  }
  archive.finalize();

  const slug = slugify(lp.name, { lower: true, strict: true });
  return new NextResponse(readable, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}.zip"`,
    },
  });
}
```

**Alternative pattern:** Use Node.js `Readable` stream piped to `NextResponse` stream. Archiver's `pipe(res)` works in Express but for Next.js App Router route handlers the `TransformStream` + `ReadableStream` approach is required. [ASSUMED — the exact streaming bridge for Next.js 16 route handlers needs verification at implementation time]

### Pattern 8: LandingPage Prisma Model

**What:** The new `LandingPage` model follows the same tenant-owned pattern as `Template` and `BrandConfig`.

```prisma
// To be added to apps/web/prisma/schema.prisma
// Source: codebase inspection of existing schema patterns + CONTEXT.md D-06, D-09, D-11

model LandingPage {
  id              String   @id @default(cuid())
  workspaceId     String
  templateId      String?  // soft ref — LP survives template deletion
  name            String   // D-11: user-provided at generation time
  markupSnapshot  String   @db.Text        // D-06: snapshot at generation time
  schemaVersion   Int                      // D-06: template schemaVersion at generation time
  values          Json                     // LP field values (jsonb)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace       Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@map("landing_page")
}

model LpAsset {
  id            String   @id @default(cuid())
  workspaceId   String
  landingPageId String
  s3Key         String   // e.g. workspaces/{wId}/lps/assets/{uuid}.jpg
  publicUrl     String
  filename      String
  mimeType      String
  fileSize      Int      // bytes
  createdAt     DateTime @default(now())

  workspace     Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  landingPage   LandingPage  @relation(fields: [landingPageId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@index([landingPageId])
  @@map("lp_asset")
}
```

**Note:** `templateId` is a soft reference (`String?` without FK constraint, or with `onDelete: SetNull`) so deleting a template does not cascade-delete its generated LPs. The LP's `markupSnapshot` makes it self-sufficient (D-06). Confirm constraint approach during planning.

### Pattern 9: TenantClient Extension for LandingPage

**What:** Add `TenantLpHelpers` and `TenantAssetHelpers` interfaces to `tenant-db.ts`, following the established pattern for `TenantTemplateHelpers`.

```typescript
// Source: codebase inspection of apps/web/src/lib/db/tenant-db.ts
// [VERIFIED: codebase]

export interface TenantLpHelpers {
  create: (data: { templateId?: string; name: string; markupSnapshot: string; schemaVersion: number; values: Prisma.InputJsonValue }) => Promise<LandingPage>;
  findById: (id: string) => Promise<LandingPage | null>;
  list: () => Promise<LandingPage[]>;
  update: (id: string, data: { name?: string; values?: Prisma.InputJsonValue; markupSnapshot?: string; schemaVersion?: number }) => Promise<LandingPage>;
  delete: (id: string) => Promise<LandingPage | null>;
}
```

### Pattern 10: Strict CSP for Exported HTML

**What:** Inject a strict CSP `<meta>` tag into the generated HTML before it enters the ZIP. The policy must block inline script execution in the exported artifact (D-10).

**When to use:** In the export route handler, after `renderLp()`, before feeding the string to `archiver`.

```typescript
// Source: CONTEXT.md D-10 + CSP standard [CITED: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP]

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'none';">`;

function injectCsp(html: string): string {
  // Inject into <head> if present, else prepend to document
  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>\n  ${CSP_META}`);
  }
  return `${CSP_META}\n${html}`;
}
```

**Policy rationale:**
- `default-src 'none'` — blocks everything not explicitly allowed.
- `img-src 'self' data:` — local assets (`./assets/`) are same-origin; data URIs allowed for inline images.
- `style-src 'self' 'unsafe-inline'` — LP templates typically use inline styles.
- `font-src 'self'` — local fonts only.
- `object-src 'none'` — blocks plugins.
- `base-uri 'none'` — blocks `<base>` tag manipulation.
- `script-src` is intentionally OMITTED, which defaults to `none` via `default-src 'none'` → no inline or external scripts in the exported LP.

[ASSUMED — the exact policy string may need adjustment if LP templates legitimately use inline scripts or external CDN resources. The planner should flag this for user confirmation if the Grécia template requires external scripts.]

### Anti-Patterns to Avoid

- **Never import `render` from `pageforge-engine` inside a Server Action** — only import `{ render }` in server-only utilities (RSC, route handlers, dedicated `render.ts` modules). Mixing it with Server Actions triggers "sanitize-html is not a browser module" build errors. [VERIFIED: codebase — template `actions.ts` comment explicitly documents this Pitfall 1]
- **Never build a `useEditor` call inside a `Controller` `render` prop** — React's rules of hooks prohibit calling hooks inside callbacks. Extract a separate component that receives `field.value` and `field.onChange` as props.
- **Never pass `workspaceId` from client input to DB queries** — always derive from `requireWorkspace` / `requireWorkspaceRole`. All LP + asset Server Actions must follow this pattern established in Phase 2/3.
- **Never render LP templates client-side** — preview uses `srcdoc` on an iframe fed by a server-rendered HTML string. The merge pipeline runs exclusively on the server.
- **Never trust client-provided `contentType` for image upload** — server must verify magic bytes independently of the MIME type the client claims.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Field array add/remove/reorder | Custom React state array | `useFieldArray` (react-hook-form) | Handles focus management, key stability, dirty/touched state, form reset — all edge cases |
| Form validation | Manual `if (value === '')` checks | `zodResolver` + derived Zod schema | Type-safe, composable, handles nested objects (button+URL), coercion |
| Rich text editing | `<textarea>` + markdown | Tiptap `StarterKit` | Outputs clean HTML; handles paste normalization, link handling, toolbar state |
| File type detection | Checking `file.type` string | `file-type` `fileTypeFromBuffer` | MIME type from client is untrusted; magic bytes are ground truth |
| ZIP assembly | `Buffer` concatenation | `archiver` | Handles streaming; no memory spike; handles > N files reliably |
| Image src rewriting in HTML | Manual regex replace | Targeted regex + URL normalization | Only replace `src` attributes that point to absolute S3 URLs; don't break relative paths |
| CSP policy | ad-hoc `<meta>` string per LP | Single `injectCsp(html)` utility | Consistent policy across all exports; testable in isolation |
| Drag-to-reorder in repeater | Custom HTML5 drag API | `@hello-pangea/dnd` | Accessibility (keyboard alternative), touch support, smooth animation |

**Key insight:** The "hard" problems in this phase (repeater form state, file validation, ZIP streaming) are each solved by a dedicated, well-tested library. The custom code in this phase is the integration glue, not the primitives.

---

## Common Pitfalls

### Pitfall 1: `render` imported in Server Action breaks build

**What goes wrong:** Next.js 16 / webpack bundles `sanitize-html` as a Node-only module. If `render()` is imported in a `"use server"` file, the build fails with "sanitize-html is not a browser module."

**Why it happens:** Server Actions can be referenced by Client Components, which causes the bundler to include the action module in the client bundle — but `sanitize-html` has no browser build.

**How to avoid:** Keep `render` in a dedicated `lib/lps/render.ts` (no `"use server"` directive). Server Actions in `lib/lps/actions.ts` call `renderLp(...)` from `render.ts` — they don't import from `pageforge-engine` directly. [VERIFIED: codebase — existing comment in `templates/actions.ts`]

**Warning signs:** Build error mentioning `sanitize-html` or `node:` modules in a client bundle.

### Pitfall 2: Tiptap `useEditor` inside `Controller` render prop

**What goes wrong:** React throws "Invalid hook call" or silently creates stale closure.

**Why it happens:** `Controller`'s `render` prop is a callback, not a component. Hooks cannot be called inside callbacks.

**How to avoid:** Extract a separate `RichTextEditor` component that accepts `value` and `onChange` props, then use `Controller` to connect it.

**Warning signs:** "Invalid hook call" at runtime during rich text field mount.

### Pitfall 3: `file-type` v22 ESM import in Next.js 16 webpack build

**What goes wrong:** `import { fileTypeFromBuffer } from "file-type"` fails with "require() of ES Module not supported."

**Why it happens:** `file-type` v22+ ships only ESM. Next.js with webpack can have trouble with pure-ESM packages.

**How to avoid:** Add `file-type` to `transpilePackages` in `next.config.ts`:
```typescript
const nextConfig = {
  transpilePackages: ["file-type"],
  // ...
};
```
Or use a dynamic import: `const { fileTypeFromBuffer } = await import("file-type")`.

**Warning signs:** Build or runtime error about `require()` of ES Module.

### Pitfall 4: archiver streaming in Next.js App Router route handlers

**What goes wrong:** `archive.pipe(res)` works in Express but `res` in Next.js App Router route handlers is not a Node.js `WritableStream` — it is a Web Streams `ReadableStream`.

**Why it happens:** Next.js App Router uses Web APIs, not Node.js HTTP APIs. `archiver` emits Node.js streams.

**How to avoid:** Bridge via `TransformStream` or convert archiver's output to a `ReadableStream`:
```typescript
import { Readable } from "node:stream";

// archiver emits 'data'; collect into ReadableStream manually or use pipeline
const nodeStream = archive as unknown as NodeJS.ReadableStream;
const webStream = Readable.toWeb(nodeStream);
return new NextResponse(webStream as ReadableStream, { headers });
```
Alternatively, use `new Response(nodeStream, ...)` after verifying Next.js 16's stream compatibility. [ASSUMED — exact bridge pattern should be validated at implementation; test the export route first in Wave isolation]

**Warning signs:** TypeError in the route handler about incompatible stream types, or the ZIP download starting but containing 0 bytes.

### Pitfall 5: Brand token key name mismatch between engine and BrandConfig

**What goes wrong:** Template uses `{{ brand.logo }}` but `renderLp()` passes `brand.logoUrl` → renders empty.

**Why it happens:** `BrandConfig.logoUrl` is the DB column name; the engine token is `brand.logo` (short form used in LiquidJS scope).

**How to avoid:** Map explicitly in `renderLp()`:
```typescript
const brandScope = {
  logo: brand?.logoUrl ?? "",
  primary_color: brand?.primaryColor ?? "",
  whatsapp: brand?.whatsapp ?? "",
};
```
Cross-check the Phase 1 compiler/renderer to confirm which token names are valid. [VERIFIED: codebase — renderer.ts maps `brand.*` prefix via `field.name.replace(/^brand\./,'')`; the actual token grammar needs confirmation]

**Warning signs:** Brand globals showing as empty string in preview even though BrandConfig is configured.

### Pitfall 6: Schema version reconciliation — values for removed fields

**What goes wrong:** When applying a new template version (D-08), old `values` may contain keys for fields that no longer exist. If those values are passed directly to `render()`, they are harmless (rendered as empty by `strictVariables: false`), but they pollute the stored JSON and may cause confusion.

**Why it happens:** Reconciliation is explicit: keep values for fields that still exist, drop removed ones, default new ones.

**How to avoid:** Implement `reconcileLpValues(oldValues, newFields, overlay)` mirroring `reconcileMetadataOverlay` from `lib/templates/metadata.ts`. Run it in the `updateLpAction` when a schema version upgrade is applied.

**Warning signs:** `LP.values` grows unboundedly across version upgrades; old field keys not in current schema remain in the JSON.

### Pitfall 7: Image src extraction for ZIP assembly — absolute vs. relative URLs

**What goes wrong:** The export route tries to download every `<img src="...">` in the rendered HTML — but some may be data URIs (`data:image/...`) or external CDN URLs that are not S3 assets.

**Why it happens:** Template authors may embed arbitrary image sources; only S3 assets owned by this workspace should be downloaded and rewritten.

**How to avoid:** Filter by URL prefix — only rewrite URLs that start with the workspace's S3 public base URL. Leave external URLs (external CDN, brand logo URL if not from S3) as absolute URLs in the exported HTML. Document this policy in the export route handler.

**Warning signs:** Export ZIP contains broken assets for external image URLs, or the export handler fails trying to fetch CDN URLs with auth requirements.

---

## Code Examples

### Complete presigned upload Server Action

```typescript
// Source: Context7 /aws/aws-sdk-js-v3 + codebase pattern [VERIFIED: Context7 + codebase]
// apps/web/src/lib/lps/actions.ts

"use server";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireWorkspaceRole } from "@/lib/workspaces/guards";

const s3Client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export async function requestPresignedUploadAction(
  slug: string,
  input: { filename: string; contentType: string; fileSize: number; firstBytes: number[] }
) {
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Server-side size cap (D-03: fixed default 5 MB)
  if (input.fileSize > 5 * 1024 * 1024) {
    return { ok: false, error: "File exceeds the 5 MB limit. Compress or resize the image and try again." };
  }

  // Magic-bytes validation (D-03)
  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(new Uint8Array(input.firstBytes));
  const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!detected || !ALLOWED.has(detected.mime)) {
    return { ok: false, error: "File does not appear to be a valid image. Try a different file." };
  }

  const ext = detected.ext;
  const key = `workspaces/${ctx.workspaceId}/lps/assets/${crypto.randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.fileSize,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600,
    signableHeaders: new Set(["content-type"]),
  });

  const publicUrl = `${process.env.S3_PUBLIC_BASE_URL}/${key}`;
  return { ok: true, data: { presignedUrl, publicUrl, key } };
}
```

### Schema version reconciliation for LP values

```typescript
// Source: pattern from lib/templates/metadata.ts reconcileMetadataOverlay [VERIFIED: codebase]
// apps/web/src/lib/lps/actions.ts (helper)

function reconcileLpValues(
  oldValues: Record<string, unknown>,
  newFields: TokenField[],
  repeaters: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Top-level fields
  for (const field of newFields) {
    if (field.global || field.repeater) continue;
    result[field.name] = oldValues[field.name] ?? defaultForType(field.type);
  }

  // Repeater arrays
  for (const rName of repeaters) {
    const oldItems = Array.isArray(oldValues[rName]) ? oldValues[rName] as unknown[] : [];
    const itemFields = newFields.filter(f => f.repeater === rName);
    result[rName] = oldItems.map((item) => {
      const obj = (typeof item === "object" && item !== null) ? item as Record<string, unknown> : {};
      const newItem: Record<string, unknown> = {};
      for (const f of itemFields) {
        newItem[f.name] = obj[f.name] ?? defaultForType(f.type);
      }
      return newItem;
    });
  }

  return result;
}

function defaultForType(type: FieldType): unknown {
  if (type === "button") return { label: "", url: "" };
  return "";
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual form state with `useState` per field | React Hook Form with `useFieldArray` | RHF v7 | No manual array management; built-in field ID stability for React key |
| Custom sandbox template engines (EJS, Nunjucks) | LiquidJS (no code execution) | Phase 1 decision | SSTI-safe by design — no `eval`, no FS access |
| Server-side image storage (app FS) | S3-compatible object storage + presigned URLs | Industry standard 2020+ | Scalable; bytes never transit app server; works on serverless |
| `jszip` for ZIP in Node | `archiver` with streaming | — | `archiver` streams to HTTP response with constant memory; `jszip` buffers everything in RAM |
| `dangerouslySetInnerHTML` for preview | `iframe srcdoc` with `sandbox="allow-same-origin"` | — | Scripts blocked in preview; XSS contained to iframe |

**Deprecated / outdated for this project:**
- `react-beautiful-dnd`: archived; replaced by `@hello-pangea/dnd` (maintained fork) [VERIFIED: npm registry — @hello-pangea/dnd 18.0.1]
- `multer` / `formidable` for uploads: not needed — presigned PUT means bytes never hit the app server

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Native `fetch` in Node 22 is sufficient for server-side image download during ZIP export; `node-fetch` not needed | Standard Stack | Low — can add `node-fetch` if fetch behaves unexpectedly with S3 presigned GET URLs |
| A2 | Exact brand token key mapping: `brand.logo` in template → `brand?.logoUrl` in BrandConfig | Pattern 6 + Pitfall 5 | Medium — if mismatch, brand globals render empty in all LPs; verify against Phase 1 parser output |
| A3 | `file-type` v22 ESM import in Next.js 16 webpack requires `transpilePackages` or dynamic import | Pattern 5 + Pitfall 3 | Medium — build will fail; fix is one config line or dynamic import |
| A4 | Archiver can be streamed to Next.js App Router `NextResponse` via `Readable.toWeb()` bridge | Pattern 7 + Pitfall 4 | Medium — if bridge doesn't work, alternative is collect ZIP into Buffer then return; impacts memory |
| A5 | Strict CSP `style-src 'unsafe-inline'` is required for LP templates | Pattern 10 | Low — if templates don't use inline styles, can tighten to `style-src 'self'`; backward safe |
| A6 | `templateId` on `LandingPage` should be a soft reference (nullable FK) so LP survives template deletion | Pattern 8 | Medium — if hard FK with cascade, deleting a template would cascade-delete all generated LPs |
| A7 | `@hello-pangea/dnd` is the right choice for repeater drag reorder | Standard Stack | Low — alternative is native HTML5 drag or keyboard-only move buttons; @hello-pangea/dnd has WCAG keyboard support |

---

## Open Questions (RESOLVED)

1. **Brand token name mapping in Phase 1 grammar** (RESOLVED)
   - What we know: `BrandConfig.logoUrl` / `primaryColor` / `whatsapp` in DB. Engine receives `brand` scope object.
   - **Resolution:** Confirmed from `src/engine/renderer.ts` line 127: the renderer strips the `brand.` prefix via `field.name.replace(/^brand\./, '')`, then reads `(brand)[localName]`. Therefore the scope keys are `logo`, `primary_color`, and `whatsapp` — mapping `BrandConfig.logoUrl → logo`, `BrandConfig.primaryColor → primary_color`, `BrandConfig.whatsapp → whatsapp`. See Pattern 6 and Pitfall 5 — `renderLp()` must pass `{ logo: brand?.logoUrl ?? "", primary_color: brand?.primaryColor ?? "", whatsapp: brand?.whatsapp ?? "" }`.

2. **LpAsset record policy — track assets separately or store URLs in values jsonb?** (RESOLVED)
   - What we know: CONTEXT.md D-09 says image URLs are stored in LP values; assets are downloaded at export time from those URLs.
   - **Resolution:** `LpAsset` IS tracked as a separate table (per D-06 + RESEARCH.md Pattern 8). Cleanup on LP delete is handled via the `onDelete: Cascade` FK from `LpAsset` to `LandingPage` in Prisma schema — no manual delete action needed. Phase 4 includes bulk-creating `LpAsset` records server-side inside `generateLpAction` (and `duplicateLpAction`) AFTER `db.lp.create()` using the `s3Key` values extracted from submitted image field values.

3. **Generate HTML immediately and store, or always regenerate on demand?** (RESOLVED)
   - What we know: CONTEXT.md says "re-edit = regenerate" (PROJECT constraint). Regeneration is cheap.
   - **Resolution:** Do NOT store generated HTML. Always regenerate from `markupSnapshot + values + liveBrand` (CONTEXT.md D-06 + CLAUDE.md). This keeps brand globals live (D-04), avoids cache invalidation, and is consistent with the project constraint. No `htmlCache` column is added to the `LandingPage` model.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | MinIO local S3 emulation | ✓ | 28.4.0 | — |
| Node.js | App server runtime | ✓ | v22.17.1 | — |
| pnpm | Package manager | ✓ | 11.5.1 | — |
| PostgreSQL | Database (via local install or container) | ✓ (local) | running (db accessible per .env) | — |
| MinIO container | Local S3 emulation for image upload | ✗ not running | — | Must be started via `docker compose up minio` — docker-compose.yml needs MinIO service added |
| S3-compatible bucket (production) | Image storage | ✗ (R2/S3 not configured) | — | Use MinIO for dev; production config via env vars |

**Missing dependencies with no fallback:**
- MinIO (local): Docker is available but no docker-compose.yml with MinIO service exists in the project root. Wave 0 must add a `docker-compose.yml` with MinIO service and add `S3_*` env vars to `.env.example`.

**Missing dependencies with fallback:**
- Production S3/R2: Not needed for Phase 4 development — MinIO is the designated local emulator.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | better-auth (already wired); LP actions gated by `requireWorkspaceRole` |
| V3 Session Management | yes | better-auth sessions; workspaceId always from server session |
| V4 Access Control | yes | `can(role, "lp", "create/read/update/delete/export")` — permissions.ts already defines lp resource |
| V5 Input Validation | yes | Zod schema derived from ParsedSchema; magic-bytes server-side; `sanitize-html` in engine |
| V6 Cryptography | partial | S3 presigned URLs use AWS SigV4 (handled by SDK); no custom crypto |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSTI via template markup injection | Tampering / Elevation | LiquidJS with `outputEscape:'escape'` + `ownPropertyOnly:true` (Phase 1 — already implemented) |
| XSS via rich-text field value | Tampering | `sanitizeRichText()` in engine renderer before merge (Phase 1 — already implemented) |
| IDOR — accessing other workspace's LP by ID | Elevation of Privilege | `findById` always includes `workspaceId` filter; RLS backstop active |
| Upload of malicious file disguised as image | Tampering | Magic-bytes validation via `file-type`; MIME type allowlist |
| SSRF via image URL in export download | Tampering | Restrict image download to URLs starting with `process.env.S3_PUBLIC_BASE_URL`; do not follow arbitrary redirects |
| Stored XSS in LP preview iframe | Spoofing | `sandbox="allow-same-origin"` on iframe blocks script execution in preview |
| Script injection in exported HTML | Spoofing | CSP `<meta>` with `default-src 'none'` (no `script-src`) injected into all exports (D-10) |
| Brand globals leaking cross-workspace | Elevation | `brandConfig.findFirst()` is scoped to `workspaceId` via `withTenantDb`; RLS backstop |
| Client-supplied `workspaceId` | Elevation | Never accepted — always derived from `requireWorkspace` |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/engine/renderer.ts`, `src/engine/schema.ts`, `src/engine/index.ts` — engine public API, field types, render signature
- Codebase: `apps/web/src/lib/db/tenant-db.ts` — `withTenantDb`, `TenantClient`, RLS pattern
- Codebase: `apps/web/src/lib/templates/metadata.ts` — `reconcileMetadataOverlay` pattern (reused for LP values reconciliation)
- Codebase: `apps/web/src/lib/auth/permissions.ts` — `lp` resource already defined with all required actions
- Codebase: `apps/web/prisma/schema.prisma` — existing model pattern (`Template`, `BrandConfig`) for new models
- Context7 `/react-hook-form/documentation` — `useFieldArray` API, `Controller`, `zodResolver` integration
- Context7 `/aws/aws-sdk-js-v3` — `getSignedUrl`, `PutObjectCommand`, `S3Client` with custom endpoint
- Context7 `/archiverjs/node-archiver` — `archiver.pipe()`, `append()`, `finalize()` streaming API
- Context7 `/sindresorhus/file-type` — `fileTypeFromBuffer()` magic-bytes detection
- Context7 `/ueberdosis/tiptap-docs` — `useEditor`, `EditorContent`, `StarterKit`, `immediatelyRender: false` for Next.js

### Secondary (MEDIUM confidence)
- npm registry: verified package versions (react-hook-form 7.78.0, @hookform/resolvers 5.4.0, @tiptap/react 3.26.0, @aws-sdk/* 3.1064.0, archiver 8.0.0, @types/archiver 8.0.0, file-type 22.0.1, @hello-pangea/dnd 18.0.1) on 2026-06-09
- CLAUDE.md — locked technology decisions and "What NOT to Use" constraints
- CONTEXT.md — all D-0x decisions (locked, cited as authoritative)
- MDN Web Docs (cited) — CSP meta tag syntax and policy directives

### Tertiary (LOW confidence)
- A1-A7 assumptions in Assumptions Log — all flagged as ASSUMED

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from npm registry 2026-06-09; most already in CLAUDE.md
- Architecture: HIGH — patterns derived from existing codebase (Phase 1/2/3) plus verified Context7 docs
- Pitfalls: HIGH for 1/2/3/5/6 (codebase evidence); MEDIUM for 4/7 (partially assumed)
- Security: HIGH — ASVS categories mapped; threat patterns confirmed against existing codebase controls

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (stable libraries; all locked by CLAUDE.md)
