# Phase 11: Imagens + links — Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 8 (2 novos, 6 modificações)
**Analogs found:** 7 / 8 (1 sem analog — validate-url.ts é trivialmente especificado em UI-SPEC)

---

## File Classification

| Arquivo Novo/Modificado | Role | Data Flow | Analog Mais Próximo | Match Quality |
|------------------------|------|-----------|---------------------|---------------|
| `src/lib/overrides/validate-url.ts` (NEW) | utility | transform | `src/lib/lps/schema.ts` linhas 239-242 (regex hex) | partial — lógica de validação de valor, mas URL != hex |
| `src/components/lps/ImageSwapPanel.tsx` (NEW) | component | request-response | `src/components/lps/ImageUploadField.tsx` | role-match (mesmo fluxo S3 presigned, mesmos estados, sem RHF) |
| `src/lib/overrides/apply-shim.ts` (MODIFY) | utility/runtime | transform | Si mesmo (extensão do loop interno) | exact |
| `src/lib/overrides/edit-script.ts` (MODIFY) | utility/runtime | event-driven | Si mesmo (extensão de predicados + handlers) | exact |
| `src/app/w/[slug]/lps/[lpId]/preview/ViteSpaPreviewEditor.tsx` (MODIFY) | component | event-driven | Si mesmo (extensão de state + message handler + toolbar slot) | exact |
| `src/lib/lps/actions.ts` — `updateLpAction` (MODIFY) | service | CRUD | Si mesmo — VITE_SPA branch linhas 380-427 | exact |
| `src/lib/lps/schema.ts` (MODIFY) | model | CRUD | Si mesmo — `PfOverrideSchema` linhas 198-207 | exact |
| `src/app/api/lps/[lpId]/export/route.ts` — VITE_SPA branch (MODIFY) | route handler | file-I/O | Si mesmo — LIQUID branch (`extractS3ImageUrls` + `rewriteImageSrcs`) linhas 99-164 | role-match |

---

## Pattern Assignments

### `src/lib/overrides/validate-url.ts` (NEW — utility, transform)

**Analog:** Não há analog direto no código. A lógica de validação de valor mais próxima está em `src/lib/lps/schema.ts` (regex hex para `primaryColorOverride`) e nos comentários de segurança de `apply-shim.ts`. O contrato exato está literalmente especificado na UI-SPEC e RESEARCH.md — copiar diretamente.

**Nota:** Este arquivo não deve ter dependências externas. `new URL()` é built-in no Node.js 18+ e no browser.

**Contrato completo (UI-SPEC "URL Validation Contract" — LOCKED, copiar literalmente):**
```typescript
// apps/web/src/lib/overrides/validate-url.ts
type UrlValidResult =
  | { ok: true }
  | { ok: false; error: 'invalid-protocol' | 'malformed' }

export function validateOverrideUrl(raw: string): UrlValidResult {
  if (!raw) return { ok: true } // campo vazio = sem erro (ainda não preenchido)
  let parsed: URL
  try { parsed = new URL(raw) } catch { return { ok: false, error: 'malformed' } }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'invalid-protocol' }
  }
  return { ok: true }
}
```

**Referência de validação de valor por tipo** em `src/lib/lps/schema.ts` linhas 239-242:
```typescript
primaryColorOverride: z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a #RRGGBB hex color")
  .optional(),
```
O padrão `try { new URL(raw) } catch { return error }` segue a mesma filosofia: validação síncrona, sem deps externas, retorno de erro tipado.

---

### `src/components/lps/ImageSwapPanel.tsx` (NEW — component, request-response)

**Analog:** `src/components/lps/ImageUploadField.tsx`

**Por que é o analog:** Usa o mesmo fluxo de upload S3 presigned (5 steps: pre-validate → firstBytes → requestPresignedUploadAction → XHR PUT → validateUploadedImageAction), os mesmos estados (`idle | uploading | uploaded | error`), o mesmo `xhrRef` para cancelamento, o mesmo `Progress` de shadcn. A diferença é que `ImageSwapPanel` NÃO usa RHF `Controller` e adiciona um campo de URL externa.

**Imports pattern** (`ImageUploadField.tsx` linhas 25-29):
```typescript
import { useRef, useState, useCallback, useEffect } from "react";
import { UploadCloud, AlertCircle, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { requestPresignedUploadAction, validateUploadedImageAction } from "@/lib/lps/actions";
```
Para `ImageSwapPanel.tsx`: remover `Controller, type Control` do react-hook-form. Adicionar `Separator` de shadcn. Adicionar `validateOverrideUrl` de `@/lib/overrides/validate-url`.

**State pattern** (`ImageUploadField.tsx` linhas 71-81):
```typescript
const [uploadState, setUploadState] = useState<UploadState>("idle");
const [uploadProgress, setUploadProgress] = useState(0);
const [errorMessage, setErrorMessage] = useState("");
const [previewUrl, setPreviewUrl] = useState("");
const [filename, setFilename] = useState("");
const [isDragOver, setIsDragOver] = useState(false);

const fileInputRef = useRef<HTMLInputElement>(null);
const xhrRef = useRef<XMLHttpRequest | null>(null);
```
Para `ImageSwapPanel.tsx`: adicionar `urlValue: string` e `urlError: string | null` ao state. Renomear `previewUrl` para `uploadedUrl`. Remover `filename` e `fileSize` (não expostos na UI do painel compacto — apenas thumbnail 48×48 conforme UI-SPEC).

**Core upload flow** (`ImageUploadField.tsx` linhas 89-202 — `handleFile` callback):
```typescript
const handleFile = useCallback(
  async (file: File, onChange: ...) => {
    // 1. Client pre-validate MIME + size (UX guard)
    if (!ALLOWED_MIME_TYPES.includes(file.type)) { setUploadState("error"); ... return; }
    if (file.size > MAX_FILE_SIZE) { setUploadState("error"); ... return; }

    setUploadState("uploading");
    setUploadProgress(0);

    // 2. Read first 4100 bytes for magic-bytes validation
    const buffer = await file.slice(0, 4100).arrayBuffer();
    const firstBytes = Array.from(new Uint8Array(buffer));

    // 3. requestPresignedUploadAction → { presignedUrl, publicUrl, key }
    const presignResult = await requestPresignedUploadAction(slug, {
      filename: file.name, contentType: file.type, fileSize: file.size, firstBytes,
    });
    if (!presignResult.ok) { setUploadState("error"); ... return; }
    const { presignedUrl, publicUrl, key } = presignResult.data;

    // 4. XHR PUT diretamente ao S3
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener("load", () => { if (xhr.status < 300) resolve(); else reject(...); });
      xhr.addEventListener("error", () => reject(new Error("Network error")));
      xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
      xhr.open("PUT", presignedUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    }).catch(...).then(async (result) => {
      if (result === null) return;
      xhrRef.current = null;

      // 5. validateUploadedImageAction (pixel cap)
      const validateResult = await validateUploadedImageAction(slug, { key });
      if (!validateResult.ok) { setUploadState("error"); ... return; }

      // 6. Success
      setUploadState("uploaded");
      setUploadedUrl(publicUrl); // Em ImageSwapPanel: guardar publicUrl para onConfirm
    });
  },
  [slug]
);
```

**Cancel pattern** (`ImageUploadField.tsx` linhas 248-258):
```typescript
function handleCancel(...) {
  if (xhrRef.current) {
    xhrRef.current.abort();
    xhrRef.current = null;
  }
  setUploadState("idle");
  setUploadProgress(0);
}
```

**Remove pattern** (`ImageUploadField.tsx` linhas 264-272):
```typescript
function handleRemove(...) {
  setUploadState("idle");
  setPreviewUrl("");
  ...
}
```

**Uploaded state UI** (`ImageUploadField.tsx` linhas 393-421 — green-50, thumbnail 48×48, remove button):
```tsx
{uploadState === "uploaded" && (
  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
    <img src={previewUrl} alt={filename} className="object-cover rounded shrink-0"
      style={{ width: 48, height: 48 }} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 truncate">{filename}</p>
      <p className="text-sm text-gray-500">Uploaded · {formatBytes(fileSize)}</p>
    </div>
    <button type="button" onClick={() => handleRemove(onChange)}
      aria-label="Remove image" className="text-gray-400 hover:text-red-500 ...">
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
)}
```
Para `ImageSwapPanel.tsx`: usar label PT-BR `"Imagem enviada"` e `aria-label="Remover imagem"`. Substituir `<button>` nativo pelo shadcn `<Button variant="ghost" size="icon">`.

**Error state pattern** (`ImageUploadField.tsx` linhas 424-449):
```tsx
{uploadState === "error" && (
  <div className="bg-red-50 border border-red-300 rounded-lg p-3">
    <div className="flex items-start gap-2">
      <AlertCircle className="text-red-500 ..." aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-red-600">{errorMessage}</p>
        <button type="button" className="text-sm text-red-500 underline mt-1"
          onClick={() => { setUploadState("idle"); setErrorMessage(""); }}>
          Try again
        </button>
      </div>
    </div>
  </div>
)}
```

**Drag-over state** (`ImageUploadField.tsx` linhas 208-228, 331-334):
```tsx
// idle state: aplica classe condicional
className={`... ${isDragOver ? "border-blue-300 bg-blue-50" : "border-gray-200 ..."}` }
onDragOver={handleDragOver}
onDragLeave={handleDragLeave}
onDrop={(e) => handleDrop(e, onChange)}
```

**Diferença principal — sem RHF Controller:** `ImageSwapPanel.tsx` gerencia estado diretamente com `useState` em vez de `<Controller name={name} control={control} render={...}>`. O callback de resultado é `onConfirm(finalUrl: string)` em vez de `field.onChange(...)`.

**Lógica de "Aplicar imagem" (resolve finalUrl):**
```typescript
// Chamado ao clicar "Aplicar imagem"
function handleConfirm() {
  let finalUrl: string | null = null;
  if (uploadState === 'uploaded' && uploadedUrl) {
    finalUrl = uploadedUrl; // Prioridade: imagem enviada
  } else {
    const validation = validateOverrideUrl(urlValue);
    if (validation.ok && urlValue) finalUrl = urlValue; // Fallback: URL externa
  }
  if (!finalUrl) return;
  onConfirm(finalUrl);
}
```

**Fechar Popover sem confirmar:** ao receber `open === false` via `onOpenChange`, se `uploadState === 'uploading'`: `xhrRef.current?.abort()`. Resetar: `setUploadState('idle')`, `setUploadProgress(0)`, `setUploadedUrl(null)`, `setUrlValue(currentSrc)` (não `''` — pré-preencher com src original).

---

### `src/lib/overrides/apply-shim.ts` (MODIFY — utility/runtime, transform)

**Analog:** Si mesmo. Hook point exato: `shimScript` string, linhas 150-156.

**Código atual** (linhas 150-156):
```javascript
if (ov.type === 'text') {
  var node = pathToNode(ov.path);
  if (node) node.textContent = ov.value;
} else if (ov.type === 'color') {
  document.documentElement.style.setProperty('--primary', hexToHslTripletShim(ov.value));
}
// image / href and any other unknown types: silently skipped (T-09-02-05)
```

**Extensão a adicionar** (inserir após linha 155, antes do comentário "silently skipped"):
```javascript
} else if (ov.type === 'image') {
  var imgNode = pathToNode(ov.path);
  if (imgNode && imgNode.tagName === 'IMG') {
    imgNode.setAttribute('src', ov.value);
  }
} else if (ov.type === 'href') {
  var aNode = pathToNode(ov.path);
  if (aNode && aNode.tagName === 'A') {
    aNode.setAttribute('href', ov.value);
  }
}
```

**Padrão de segurança a manter:**
- `setAttribute` (NUNCA `.src =` ou `.href =` diretamente via IDL) — consistência com T-09-02-02
- `tagName === 'IMG'` / `tagName === 'A'` — defesa em profundidade, previne aplicar em nó errado se DOM mudou
- Bloco dentro do `try/catch` per-override já existente (linha 148) — T-09-02-05

**Atualizar o JSDoc** do buildOverrideInjection (linhas 96-99): mudar "unknown type (image, href, etc.): silently skipped" para documentar o comportamento ativo de `image` e `href`.

---

### `src/lib/overrides/edit-script.ts` (MODIFY — utility/runtime, event-driven)

**Analog:** Si mesmo. Extensões em 6 pontos dentro do IIFE.

**A. isTextLeaf atual (linhas 106-113) — NÃO modificar (manter `img` em skipTags):**
```javascript
function isTextLeaf(el) {
  if (el.nodeType !== Node.ELEMENT_NODE) return false;
  var tag = el.tagName.toLowerCase();
  var skipTags = ['script', 'style', 'noscript', 'head', 'meta', 'link', 'br', 'hr', 'input', 'img', 'svg'];
  if (skipTags.includes(tag)) return false;
  if (el.children.length > 0) return false;
  return (el.textContent || '').trim().length > 0;
}
```
`<img>` permanece em `skipTags` (correto — `isTextLeaf` não deve selecioná-lo; o novo `isSelectableImage` cuida disso).

**B. Novos predicados a adicionar** (após `isTextLeaf`, antes de `sendToParent`):
```javascript
function isSelectableImage(el) {
  if (el.nodeType !== Node.ELEMENT_NODE) return false;
  return el.tagName === 'IMG';
}

function isSelectableHref(el) {
  if (el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.tagName !== 'A') return false;
  return el.hasAttribute('href'); // <a> sem href = NÃO selecionável (UI-SPEC)
}
```

**C. Hover mouseover** — atual (linha 203-211):
```javascript
document.body.addEventListener('mouseover', function(e) {
  if (!editMode || !isTextLeaf(e.target)) return;
  var path = computePath(e.target);
  if (!path) return;
  saveStyles(path, e.target);
  e.target.style.outline = '2px dashed #3b82f6';
  e.target.style.outlineOffset = '2px';
  e.target.style.cursor = 'pointer';
});
```
Extensão: substituir `!isTextLeaf(e.target)` por `!isTextLeaf(e.target) && !isSelectableImage(e.target) && !isSelectableHref(e.target)`.

**D. Hover mouseout** — atual (linha 214-220):
```javascript
document.body.addEventListener('mouseout', function(e) {
  if (!editMode || !isTextLeaf(e.target)) return;
  if (e.target === selectedEl) return;
  ...
});
```
Extensão: mesma substituição da condição de guarda.

**E. Click handler** — atual (linha 223-287, guarda na linha 224):
```javascript
document.body.addEventListener('click', function(e) {
  if (!editMode || !isTextLeaf(e.target)) return;
  ...
  sendToParent({ type: 'ELEMENT_SELECTED', path: path, originalHash: originalHash, currentText: el.textContent || '' });
  el.setAttribute('contenteditable', 'true');
  ...
});
```
Extensão necessária:
```javascript
document.body.addEventListener('click', function(e) {
  if (!editMode) return;
  var el = e.target;
  var elementType;
  if (isSelectableImage(el)) {
    elementType = 'image';
  } else if (isSelectableHref(el)) {
    elementType = 'href';
  } else if (isTextLeaf(el)) {
    elementType = 'text';
  } else {
    return; // não selecionável
  }
  e.stopPropagation();
  var path = computePath(el);
  if (!path) return;

  if (selectedEl && selectedEl !== el) deselectCurrent();
  selectedEl = el;
  selectedPath = path;
  saveStyles(path, el);

  // Capturar currentValue por tipo
  var currentValue;
  if (elementType === 'image') {
    currentValue = el.getAttribute('src') || el.src || '';
  } else if (elementType === 'href') {
    currentValue = el.getAttribute('href') || '';
  } else {
    currentValue = el.textContent || '';
  }

  // Lazy capture no originalMap
  if (!originalMap[path]) {
    originalMap[path] = { elementType: elementType, value: currentValue };
  }
  var originalHash = fnv1a(originalMap[path].value || originalMap[path]);

  // Aplicar highlight de seleção (igual ao texto)
  el.style.outline = '2px solid #2563eb';
  el.style.outlineOffset = '2px';
  el.style.backgroundColor = 'rgba(37,99,235,0.08)';

  sendToParent({
    type: 'ELEMENT_SELECTED',
    path: path,
    originalHash: originalHash,
    elementType: elementType,
    currentValue: currentValue
  });

  if (elementType === 'text') {
    // Fluxo contentEditable existente (linhas 253-286 — manter intacto)
    el.setAttribute('contenteditable', 'true');
    el.style.cursor = 'text';
    el.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.25)';
    el.focus();
    // blur/keydown handlers existentes...
  }
  // image e href: sem contenteditable — controle fica no parent (toolbar)
});
```

**Nota crítica sobre o originalMap:** A Fase 10 armazenava `originalMap[path] = string` (textContent). A Fase 11 muda para `originalMap[path] = { elementType, value }`. Verificar se o `REQUEST_DISCARD` handler e o filtro de `REQUEST_SAVE` (linha 171-174) são atualizados para o novo shape:
```javascript
// REQUEST_SAVE — filtro atual (linha 171-174):
var overrides = Object.values(pendingMap).filter(function(ov) {
  return ov.value !== originalMap[ov.path]; // originalMap[p] era string; agora é objeto
});
// Atualizar para: ov.value !== (originalMap[ov.path] && originalMap[ov.path].value)
```

**F. Novo handler de mensagem PREVIEW_OVERRIDE** (adicionar no switch de `window.addEventListener('message', ...)`, após REQUEST_DISCARD):
```javascript
} else if (msg.type === 'PREVIEW_OVERRIDE') {
  var ovEl = pathToNode(msg.path);
  if (!ovEl) return;
  if (msg.elementType === 'image' && ovEl.tagName === 'IMG') {
    ovEl.setAttribute('src', msg.value);
  } else if (msg.elementType === 'href' && ovEl.tagName === 'A') {
    ovEl.setAttribute('href', msg.value);
  }
  // CRÍTICO (Pitfall 2): adicionar ao pendingMap para que REQUEST_SAVE inclua este override
  var origEntry = originalMap[msg.path];
  var origHash = origEntry ? fnv1a(origEntry.value) : fnv1a('');
  pendingMap[msg.path] = {
    path: msg.path,
    originalHash: origHash,
    type: msg.elementType,
    value: msg.value
  };
}
```

**G. REQUEST_DISCARD** — extensão para restaurar src/href (linhas 175-195):
```javascript
} else if (msg.type === 'REQUEST_DISCARD') {
  // Restaurar todos os valores originais por tipo
  for (var p in originalMap) {
    var entry = originalMap[p];
    var node = pathToNode(p);
    if (!node) continue;
    if (entry.elementType === 'text') {
      node.textContent = entry.value;
    } else if (entry.elementType === 'image' && node.tagName === 'IMG') {
      node.setAttribute('src', entry.value);
    } else if (entry.elementType === 'href' && node.tagName === 'A') {
      node.setAttribute('href', entry.value);
    }
  }
  pendingMap = {};
  // Restaurar estilos + remover contenteditable (código existente)
  for (var sp in savedStylesMap) { ... }
  document.querySelectorAll('[contenteditable]').forEach(...);
  editMode = false; selectedEl = null; selectedPath = null;
  sendToParent({ type: 'EDIT_DISCARDED' });
}
```

**Padrão de path a preservar** — `computePath` (linhas 90-102): NÃO modificar. Usa `parent.childNodes` (Pitfall 1 crítico). `pathToNode` (linhas 74-85): NÃO modificar, deve permanecer idêntico ao apply-shim.ts:128-138.

---

### `src/app/w/[slug]/lps/[lpId]/preview/ViteSpaPreviewEditor.tsx` (MODIFY — component, event-driven)

**Analog:** Si mesmo. Extensão em 5 áreas.

**Imports atuais** (linhas 25-46) — adicionar:
```typescript
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils"; // para className condicional no Input
import { validateOverrideUrl } from "@/lib/overrides/validate-url";
import { ImageSwapPanel } from "@/components/lps/ImageSwapPanel";
```

**State pattern atual** (linhas 87-112) — adicionar 5 novos campos:
```typescript
// Tipo do elemento atualmente selecionado (de ELEMENT_SELECTED.elementType)
const [selectedElementType, setSelectedElementType] = useState<'text' | 'image' | 'href' | null>(null);

// Valor atual do elemento selecionado (src para img, href para a)
const [selectedCurrentValue, setSelectedCurrentValue] = useState<string | null>(null);

// Controla abertura do ImageSwapPanel (Popover)
const [imagePanelOpen, setImagePanelOpen] = useState(false);

// Valor controlado do href input (pré-preenchido a partir de selectedCurrentValue)
const [hrefValue, setHrefValue] = useState('');

// Erro de validação de URL do href input (client-side)
const [hrefInputError, setHrefInputError] = useState<string | null>(null);
```

**handleSaveWithEdits** — limpeza adicional após sucesso (linhas 163-169):
```typescript
setIsEditMode(false);
setPendingEdits([]);
setSelectedPath(null);
setIframeReady(false);
setSelectedElementType(null);   // ← novo
setSelectedCurrentValue(null);  // ← novo
setImagePanelOpen(false);       // ← novo (Pitfall 7)
setHrefValue('');               // ← novo
setHrefInputError(null);        // ← novo
router.refresh();
```

**postMessage listener** — extensão do case ELEMENT_SELECTED (linha 200-202):
```typescript
case "ELEMENT_SELECTED":
  setSelectedPath(msg.path as string);
  setSelectedElementType(msg.elementType as 'text' | 'image' | 'href'); // ← novo
  setSelectedCurrentValue(msg.currentValue as string);                   // ← novo
  if (msg.elementType === 'href') {
    setHrefValue((msg.currentValue as string) || '');
    setHrefInputError(null);
  }
  break;
```

**Case EDIT_DISCARDED** — limpeza adicional (linhas 237-241):
```typescript
case "EDIT_DISCARDED":
  setIsEditMode(false);
  setPendingEdits([]);
  setSelectedPath(null);
  setSaveError(null);
  setSelectedElementType(null);   // ← novo (Pitfall 6)
  setSelectedCurrentValue(null);  // ← novo
  setImagePanelOpen(false);       // ← novo
  setHrefValue('');               // ← novo
  setHrefInputError(null);        // ← novo
  break;
```

**Novos callbacks** (adicionar após `confirmDiscard`):
```typescript
const handleImageConfirm = useCallback((finalUrl: string) => {
  setPendingEdits(prev => {
    const next = prev.filter(e => e.path !== selectedPath);
    next.push({ path: selectedPath!, originalHash: '', type: 'image', value: finalUrl });
    return next;
  });
  sendToIframe({ type: 'PREVIEW_OVERRIDE', path: selectedPath, elementType: 'image', value: finalUrl });
  setImagePanelOpen(false);
}, [selectedPath, sendToIframe]);

const handleHrefConfirm = useCallback(() => {
  const result = validateOverrideUrl(hrefValue);
  if (!result.ok) return;
  setPendingEdits(prev => {
    const next = prev.filter(e => e.path !== selectedPath);
    next.push({ path: selectedPath!, originalHash: '', type: 'href', value: hrefValue });
    return next;
  });
  sendToIframe({ type: 'PREVIEW_OVERRIDE', path: selectedPath, elementType: 'href', value: hrefValue });
}, [hrefValue, selectedPath, sendToIframe]);
```

**Slot D-04 — mover para fora do branch dirty** (atual: linha 383-384, dentro do `pendingEdits.length > 0` branch):
```tsx
{/* ANTES (Phase 10 — dentro do branch dirty): */}
{/* D-04: reserved slot for Phase 11 per-type control (image/link) */}
<div />

{/* DEPOIS (Phase 11 — fora do branch clean/dirty, no nível do canEdit wrapper): */}
{isEditMode && selectedElementType === 'image' && (
  <Popover open={imagePanelOpen} onOpenChange={setImagePanelOpen}>
    <PopoverTrigger asChild>
      <Button variant="outline" className="font-semibold" size="sm">
        Trocar imagem
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-80 p-4">
      <ImageSwapPanel
        slug={slug}
        currentSrc={selectedCurrentValue ?? ''}
        onConfirm={handleImageConfirm}
        open={imagePanelOpen}
        onOpenChange={setImagePanelOpen}
      />
    </PopoverContent>
  </Popover>
)}

{isEditMode && selectedElementType === 'href' && (
  <div className="flex items-center gap-2">
    <Tooltip>
      <TooltipTrigger asChild>
        <Input
          type="url"
          aria-label="Destino do link (href)"
          placeholder="https://..."
          value={hrefValue}
          onChange={e => {
            setHrefValue(e.target.value);
            const r = validateOverrideUrl(e.target.value);
            setHrefInputError(r.ok ? null : (r.error === 'invalid-protocol'
              ? 'Apenas http:// e https:// são permitidos.'
              : 'URL inválida.'));
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !hrefInputError) handleHrefConfirm();
            if (e.key === 'Escape') {
              setHrefValue(selectedCurrentValue ?? '');
              setHrefInputError(null);
              setPendingEdits(prev => prev.filter(e => e.path !== selectedPath));
            }
          }}
          onBlur={() => { if (!hrefInputError && hrefValue) handleHrefConfirm(); }}
          className={cn('w-60 h-9', hrefInputError && 'border-destructive')}
        />
      </TooltipTrigger>
      {hrefInputError && <TooltipContent>{hrefInputError}</TooltipContent>}
    </Tooltip>
  </div>
)}
```

**Banner — extensão do copy** (linhas 404-409, de 2 para 4 estados):
```tsx
{isEditMode && (
  <div className="bg-[#eff6ff] border-b border-[#bfdbfe] text-[#1d4ed8] text-sm h-8 px-4 py-1 flex items-center">
    {!selectedPath
      ? 'Modo de edição ativo — clique em um texto, imagem ou link para editar'
      : selectedElementType === 'image'
        ? 'Imagem selecionada — escolha um arquivo ou cole uma URL para substituir'
        : selectedElementType === 'href'
          ? 'Link selecionado — edite o destino no campo da barra de ferramentas'
          : 'Editando texto — Enter para confirmar, Esc para cancelar'}
  </div>
)}
```

**Dialog discard — atualizar copy** (linha 447-449):
```tsx
// Antes:
"...serão perdidas e o texto original será restaurado."
// Depois:
`As ${pendingEdits.length} alterações não salvas serão perdidas e o conteúdo original será restaurado.`
```

---

### `src/lib/lps/actions.ts` — `updateLpAction` VITE_SPA branch (MODIFY — service, CRUD)

**Analog:** Si mesmo. Hook point: após `overridesParsed.success === true` (linha ~403), antes da construção de `valuesUpdate`.

**Padrão atual de validação** (linhas 389-403):
```typescript
const overridesParsed = SaveViteSpaOverridesSchema.safeParse({
  id: input.id,
  overrides: input.overrides,
  primaryColorOverride: input.primaryColorOverride,
});
if (!overridesParsed.success) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of overridesParsed.error.issues) {
    const field = issue.path[0] as string;
    fieldErrors[field] = fieldErrors[field] ?? [];
    fieldErrors[field].push(issue.message);
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}
// ← INSERIR AQUI a validação de URL (SEC-02)
```

**Extensão a inserir** (após linha 403, antes de `const existingValues = ...`):
```typescript
// SEC-02: validação autoritativa de URL para overrides image/href
// new URL() é built-in Node.js 18+; sem dependência externa
if (overridesParsed.data.overrides) {
  for (const ov of overridesParsed.data.overrides) {
    if (ov.type === 'image' || ov.type === 'href') {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(ov.value);
      } catch {
        return { ok: false, error: 'URL de override inválida ou malformada.' };
      }
      // Allowlist: apenas http/https (bloqueia javascript:, data:, vbscript:, etc.)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return { ok: false, error: 'URL de override com protocolo não permitido.' };
      }
    }
  }
}
```

**Padrão de retorno de erro** a seguir (igual ao de `!overridesParsed.success` — retorno `{ ok: false, error: string }` sem `fieldErrors`): o `saveError` Alert existente no `ViteSpaPreviewEditor` já exibe esse erro ao usuário (comportamento herdado, sem nova surface necessária).

---

### `src/lib/lps/schema.ts` (MODIFY — model, CRUD)

**Analog:** Si mesmo. Mudança mínima: atualizar comentário do `PfOverrideSchema` (linhas 190-193).

**Atual (linhas 190-193):**
```typescript
 * - type: override type enum. 'text' and 'color' are applied by the Phase 9 shim;
 *   'image' and 'href' are reserved for Phase 11 (enum already extensible).
 * - value: the override value (text: raw string applied via textContent; color:
 *   #RRGGBB hex validated separately; image/href: reserved).
```

**Depois (Phase 11):**
```typescript
 * - type: override type enum. 'text' and 'color' applied by Phase 9 shim;
 *   'image' (set <img src>) and 'href' (set <a href>) applied by Phase 11 shim.
 * - value: the override value (text: raw string via textContent; color: #RRGGBB hex;
 *   image/href: http(s) URL validated server-side by updateLpAction — SEC-02).
```

**Nota:** O enum `type: z.enum(["text", "color", "image", "href"])` (linha 204) e o campo `value: z.string()` (linha 206) NÃO mudam — a validação de URL é responsabilidade de `updateLpAction` (SEC-02), não do schema Zod de persistência. Manter `value: z.string()` sem `.url()` para não bloquear outros usos.

---

### `src/app/api/lps/[lpId]/export/route.ts` — VITE_SPA branch (MODIFY — route handler, file-I/O)

**Analog:** A própria branch LIQUID do mesmo arquivo. Padrões `extractS3ImageUrls` (linhas 99-157) e `rewriteImageSrcs` (linhas 159-170) são a referência direta para o loop da branch VITE_SPA.

**Padrão atual da branch LIQUID** (linhas 99-170) para extrair e reescrever imagens S3:
```typescript
// extractS3ImageUrls: encontra todas as URLs S3 no HTML
function extractS3ImageUrls(html: string, s3BaseUrl: string): string[] { ... }

// rewriteImageSrcs: substitui URLs S3 por paths relativos ./assets/
function rewriteImageSrcs(html: string, urlToFilename: Map<string, string>): string {
  // Usa .split(url).join(replacement) — NÃO .replace() para garantir substituição global
  ...
}
```

**Hook point exato na branch VITE_SPA** (linha 284-286):
```typescript
const injection = buildOverrideInjection(lpValues);
const finalHtml = injectOverrides(themedHtml, injection);
// ← INSERIR AQUI o processamento de imagens de override antes do append
viteSpaArchive.append(Buffer.from(finalHtml, "utf-8"), {
  name: "index.html",
});
```

**Extensão a inserir** (substituir o append existente):
```typescript
const injection = buildOverrideInjection(lpValues);
const finalHtml = injectOverrides(themedHtml, injection);

// D-11-04: baixar imagens S3 de overrides e reescrever src no ZIP
const s3BaseUrl = process.env.S3_PUBLIC_BASE_URL ?? '';
let processedHtml = finalHtml;

if (s3BaseUrl && lpValues.overrides?.length) {
  // Filtrar apenas overrides de imagem com URL S3 (anti-SSRF: só S3 próprio)
  const imageOverrides = lpValues.overrides.filter(
    ov => ov.type === 'image' && ov.value.startsWith(s3BaseUrl)
  );

  const assetMap = new Map<string, string>(); // url → filename
  const usedFilenames = new Set<string>();

  for (const ov of imageOverrides) {
    try {
      // redirect: 'error' = anti-SSRF (mesmo padrão da branch LIQUID)
      const resp = await fetch(ov.value, { redirect: 'error' });
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      const urlObj = new URL(ov.value);
      let filename = urlObj.pathname.split('/').at(-1) || `asset-${assetMap.size}`;
      if (usedFilenames.has(filename)) filename = `${assetMap.size}-${filename}`;
      usedFilenames.add(filename);
      assetMap.set(ov.value, filename);
      viteSpaArchive.append(buf, { name: `assets/${filename}` });
      // .split().join() para substituição global (Pitfall 5 — NÃO usar .replace())
      processedHtml = processedHtml.split(ov.value).join(`./assets/${filename}`);
    } catch { /* skip — URL inválida ou rede indisponível */ }
  }
}

// Usar processedHtml (com srcs reescritos) no lugar de finalHtml
viteSpaArchive.append(Buffer.from(processedHtml, "utf-8"), {
  name: "index.html",
});
```

**Padrão anti-SSRF a manter:** `.startsWith(s3BaseUrl)` garante que apenas URLs do bucket próprio são baixadas. URLs externas (`type:'image'` que não começam com s3BaseUrl) ficam com URL absoluta no HTML exportado (D-11-04).

---

## Shared Patterns

### postMessage — origin validation (cross-cutting, `edit-script.ts` e `ViteSpaPreviewEditor.tsx`)

**Source:** `ViteSpaPreviewEditor.tsx` linhas 189-191 e `edit-script.ts` linhas 159-161

```typescript
// Parent (ViteSpaPreviewEditor.tsx):
if (event.origin !== serveOrigin) return;

// Iframe (edit-script.ts):
if (event.origin !== dashboardOrigin) return;
```
Aplicar a TODOS os handlers de postMessage. Novos handlers (`PREVIEW_OVERRIDE` no iframe, novos cases no parent) devem estar dentro dos blocos de validação de origem existentes — não criar novos `addEventListener` separados.

### targetOrigin explícito no sendToIframe/sendToParent

**Source:** `ViteSpaPreviewEditor.tsx` linha 140 e `edit-script.ts` linha 118

```typescript
// Parent:
iframeRef.current.contentWindow.postMessage(msg, serveOrigin); // nunca '*'

// Iframe:
parent.postMessage(msg, dashboardOrigin); // nunca '*'
```

### setAttribute vs propriedade IDL

**Source:** `edit-script.ts` e comentários de T-09-02-02

```javascript
// CORRETO: via atributo
node.setAttribute('src', ov.value);
node.setAttribute('href', ov.value);

// ERRADO: via propriedade IDL (resolve URL, inconsistente com getAttribute na captura)
node.src = ov.value;
node.href = ov.value;
```
Aplicar em: `apply-shim.ts` extensão, `edit-script.ts` handler PREVIEW_OVERRIDE, `edit-script.ts` REQUEST_DISCARD restauração.

### computePath usa childNodes, nunca children

**Source:** `edit-script.ts` linha 95

```javascript
var idx = Array.prototype.indexOf.call(par.childNodes, current);
// NÃO: par.children — índices incompatíveis com text nodes (Pitfall 1 crítico)
```
Este padrão é preservado — não tocar em `computePath` nem em `pathToNode`.

### ActionResult retorno padronizado

**Source:** `actions.ts` padrão geral

```typescript
return { ok: false, error: "mensagem de erro" };
return { ok: true, data: { id: updated.id } };
```
O loop de validação SEC-02 em `updateLpAction` deve seguir exatamente o mesmo shape `{ ok: false, error: string }`.

### .split(url).join(replacement) para substituição global

**Source:** `export/route.ts` `rewriteImageSrcs` (branch LIQUID)

```typescript
// NÃO: html.replace(url, newPath) — substitui apenas a PRIMEIRA ocorrência
// SIM:
processedHtml = processedHtml.split(ov.value).join(`./assets/${filename}`);
```
Aplicar na branch VITE_SPA do export route (Pitfall 5).

---

## No Analog Found

| Arquivo | Role | Data Flow | Razão |
|---------|------|-----------|-------|
| `validate-url.ts` | utility | transform | Não há utilitário de validação de URL no codebase; o contrato exato está na UI-SPEC/RESEARCH.md — implementar literalmente sem adaptar de código existente |

---

## Metadata

**Scope de busca de analogs:** `apps/web/src/lib/overrides/`, `apps/web/src/components/lps/`, `apps/web/src/lib/lps/`, `apps/web/src/app/api/lps/`, `apps/web/src/app/w/`
**Arquivos lidos:** 8 arquivos de código + 3 arquivos de planejamento
**Data:** 2026-06-26
