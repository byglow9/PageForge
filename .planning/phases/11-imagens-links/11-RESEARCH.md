# Phase 11: Imagens + links — Research

**Researched:** 2026-06-26
**Domain:** Editor visual VITE_SPA — troca de imagem (S3 presigned + URL externa) + edição de href, validação de URL server-side, extensão do apply-shim e edit-script.
**Confidence:** HIGH — todos os hook points verificados diretamente no código-fonte.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-11-01 (imagem — painel único):** Troca de imagem usa um **painel único** com "Enviar arquivo" (upload S3 presigned, reutilizando `requestPresignedUploadAction`/`validateUploadedImageAction`) E um campo "ou cole uma URL". O painel abre a partir do slot D-04 da toolbar quando um `<img>` está selecionado.

**D-11-02 (href — campo separado):** Seleção de `<a>` → campo de URL na toolbar (slot D-04). Editar texto do link e destino são fluxos separados; não misturar. Apenas `<a href>` (com href) é selecionável.

**D-11-03 (validação URL):** Imagem: `http(s)` ou S3 apenas. href: `http/https` apenas. Bloqueados: `javascript:`, `data:`, `vbscript:`, qualquer não-http(s), URLs malformadas. Pré-validação no cliente (feedback instantâneo); validação server-side autoritativa em `updateLpAction`. Nenhum override inválido é persistido.

**D-11-04 (export):** Imagens de upload S3 → baixadas para `./assets/` no ZIP com src reescrito relativo. Imagens de URL externa → mantêm URL absoluta no HTML exportado (não baixar conteúdo de terceiros).

### Claude's Discretion

- Mecânica de detecção de `<img>` / `<a>` no edit-script e geração de `path`/`originalHash` compatível com o apply-shim (mesma convenção `pathToNode` da Fase 9/10).
- Forma exata de aplicar `image`/`href` no apply-shim (`pathToNode(path).setAttribute('src', value)` / `.setAttribute('href', value)`, NUNCA innerHTML).
- Onde plugar o painel de imagem e o campo href no slot da toolbar (`ViteSpaPreviewEditor`), e o shape das novas mensagens postMessage para imagem/href.
- Implementação concreta da validação de URL (built-in `URL` constructor + protocol check) no servidor e no cliente.

### Deferred Ideas (OUT OF SCOPE)

- href com `mailto:` / `tel:` / relativo — allowlist mínima nesta fase.
- Baixar imagens de URL externa para o ZIP (export 100% self-contained de terceiros).
- Reconfigurar ação de botões via JS (não-âncora).
- MutationObserver / re-apply timing para SPA client-rendered — Fase 12.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDIT-04 | Usuário pode trocar uma imagem (upload via S3 presigned ou URL) e salvar. | `ImageSwapPanel` (Popover) + extensão do `edit-script.ts` para detectar `<img>` + extensão do `apply-shim.ts` para aplicar `image` type + extensão do export route para D-11-04. |
| EDIT-05 | Usuário pode editar o destino (`href`) de um link/botão âncora e salvar. | Href URL input no slot D-04 + extensão do `edit-script.ts` para detectar `<a[href]>` + extensão do `apply-shim.ts` para aplicar `href` type. |
| SEC-02 | Valores de override sanitizados/validados no servidor: imagem/href por allowlist de URL http(s)/S3; bloquear `javascript:`. | Adição de loop de validação em `updateLpAction` após `SaveViteSpaOverridesSchema`; utilitário `validate-url.ts` compartilhado cliente/servidor. |
</phase_requirements>

---

## Summary

A Fase 11 é uma extensão pura da infraestrutura existente das Fases 9 e 10. Não há migração de banco de dados, novo schema ou nova rota de API: o enum `type` em `PfOverrideSchema` já inclui `"image"` e `"href"`; o modelo `ViteSpaValues.overrides[]` já persiste esses tipos; `updateLpAction` já processa o payload de overrides. O trabalho consiste em quatro extensões e dois arquivos novos.

**Extensões nos arquivos existentes:** (1) `apply-shim.ts` — adicionar ramos `image`/`href` no bloco JavaScript embarcado; (2) `edit-script.ts` — estender a detecção de elementos de `isTextLeaf` para também capturar `<img>` e `<a[href]>`, e tratar a nova mensagem `PREVIEW_OVERRIDE`; (3) `ViteSpaPreviewEditor.tsx` — estender handler de `ELEMENT_SELECTED`, mover o slot D-04 para fora do branch dirty, plugar `ImageSwapPanel` e href input; (4) `updateLpAction` em `actions.ts` — acrescentar loop de validação de URL para overrides `image`/`href` antes do persist.

**Arquivos novos:** (1) `validate-url.ts` — utilitário de validação de URL compartilhado cliente/servidor; (2) `ImageSwapPanel.tsx` — Popover com upload S3 + campo de URL externa.

**Ponto de atenção para o export:** A branch VITE_SPA do export route (`/api/lps/[lpId]/export/route.ts`) atualmente não processa overrides de imagem para o ZIP. Para satisfazer D-11-04, é preciso adicionar, após `injectOverrides`, um loop que lê `lpValues.overrides` buscando entradas `{type:'image', value: <s3Url>}`, baixa cada imagem S3 server-side e reescreve a URL na string HTML (o JSON blob dentro do `<script id="pf-overrides">` contém a URL em plain text, sem escape HTML, portanto substituição direta de string é segura) e adiciona o arquivo baixado ao ZIP como `assets/{filename}`.

**Primary recommendation:** Implementar na ordem: validate-url.ts → apply-shim extension → edit-script extension → updateLpAction validation → ImageSwapPanel → ViteSpaPreviewEditor extension → export route extension. Essa sequência garante que os blocos de segurança estejam prontos antes das UIs que dependem deles.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detecção de `<img>` / `<a>` clicáveis | Iframe (inline IIFE) | — | O edit-script roda no contexto da LP servida (cross-origin), único lugar com acesso direto ao DOM. |
| Aplicação visual imediata de imagem/href (antes de salvar) | Iframe (inline IIFE via `PREVIEW_OVERRIDE`) | — | `PREVIEW_OVERRIDE` enviado pelo parent instrui o iframe a aplicar a mudança visualmente sem persistir. |
| Persistência de overrides imagem/href | API / Backend (Server Action `updateLpAction`) | — | Validação autoritativa de URL e escrita no DB sempre server-side. |
| Reaplicação de overrides na preview/export | Server (apply-shim injetado no HTML) | — | O shim roda no browser da LP servida, lê o JSON injetado e aplica via atributo. |
| Upload S3 presigned (ImageSwapPanel) | Frontend → S3 direto via XHR | Backend (Server Action presigned URL) | App server só gera URL; bytes vão direto para S3. |
| Reescrita de src no export ZIP | API / Backend (export route) | — | O route handler baixa as imagens S3 e reescreve o HTML antes de montar o ZIP. |
| Validação de URL client-side (UX) | Browser / Client | — | Feedback instantâneo no campo; não é a fronteira de confiança. |
| Validação de URL server-side (autoritativa) | API / Backend | — | A única validação que conta. Cliente pode ser contornado. |

---

## Standard Stack

### Core (já instalado — sem mudanças)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `shadcn/ui + Tailwind CSS 4.x` | já instalado | Componentes de UI do dashboard | Já em uso; apenas `npx shadcn add popover` necessário |
| Zod | 4.4.3 | Validação do schema de overrides | Já em uso |
| `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | 3.1058.x | Upload presigned S3 | Já em uso |

### Novo componente shadcn a adicionar

```bash
npx shadcn add popover
```

`Popover` é do registry oficial do shadcn — sem vetting gate adicional (UI-SPEC Registry Safety).

---

## Architecture Patterns

### Sistema de dados do Phase 11

```
Usuário clica <img> no iframe
        │
        ▼
edit-script.ts (IIFE in-iframe)
  isImage(el) → computePath → fnv1a(el.getAttribute('src'))
        │
        ▼ postMessage ELEMENT_SELECTED { elementType:'image', currentValue, path, originalHash }
        │
        ▼
ViteSpaPreviewEditor.tsx (parent dashboard)
  selectedElementType = 'image'
  slot D-04 → <ImageSwapPanel>
        │
  Usuário escolhe arquivo OU URL
        │
  onConfirm(finalUrl)
        │
  pendingEdits.push({ type:'image', path, originalHash, value: finalUrl })
        │
  sendToIframe(PREVIEW_OVERRIDE { path, elementType:'image', value: finalUrl })
        │
        ▼ iframe aplica img.setAttribute('src', value)
        │
  Usuário clica "Salvar alterações"
        │
  sendToIframe(REQUEST_SAVE)
        │
        ▼ iframe → PENDING_EDITS { overrides: [...text+image+href] }
        │
        ▼
updateLpAction (server-side)
  URL validation loop (SEC-02)
  SaveViteSpaOverridesSchema → persist in LandingPage.values.overrides[]
        │
  router.refresh() → RSC re-render → mintServeToken
        │
  serve route → buildOverrideInjection → injectOverrides
        │
  apply-shim.ts (IIFE in browser)
    type==='image' → pathToNode(path).setAttribute('src', value)
    type==='href'  → pathToNode(path).setAttribute('href', value)
```

### Estrutura de arquivos (mudanças)

```
apps/web/src/
├── lib/overrides/
│   ├── apply-shim.ts           # MODIFY: add image/href branches to shimScript string
│   ├── edit-script.ts          # MODIFY: extend click/hover for img+a, PREVIEW_OVERRIDE handler
│   └── validate-url.ts         # NEW: shared URL validation utility (client + server)
├── components/lps/
│   └── ImageSwapPanel.tsx      # NEW: Popover with upload zone + URL field
└── app/
    ├── w/[slug]/lps/[lpId]/preview/
    │   └── ViteSpaPreviewEditor.tsx    # MODIFY: new state, slot D-04, image/href handlers
    ├── api/lps/[lpId]/export/
    │   └── route.ts            # MODIFY: VITE_SPA branch — download S3 override images into ZIP
    └── lib/lps/
        └── actions.ts          # MODIFY: updateLpAction — add URL validation loop (SEC-02)
```

---

## Hook Points — Código Existente (VERIFICADO)

### 1. `apply-shim.ts` — onde adicionar ramos image/href

**Localização exata:** dentro de `buildOverrideInjection()`, na constante `shimScript`, no loop `for (var i = 0; i < overrides.length; i++)`, linhas 150–157.

**Código atual:**
```javascript
// (linhas 150-157 em apply-shim.ts)
if (ov.type === 'text') {
  var node = pathToNode(ov.path);
  if (node) node.textContent = ov.value;
} else if (ov.type === 'color') {
  document.documentElement.style.setProperty('--primary', hexToHslTripletShim(ov.value));
}
// image / href and any other unknown types: silently skipped (T-09-02-05)
```

**Extensão necessária (Phase 11):**
```javascript
if (ov.type === 'text') {
  var node = pathToNode(ov.path);
  if (node) node.textContent = ov.value;
} else if (ov.type === 'color') {
  document.documentElement.style.setProperty('--primary', hexToHslTripletShim(ov.value));
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

**Nota crítica:** `pathToNode` retorna o node no índice do path. Para `<img>` e `<a>`, o próprio elemento está no path (não um text node filho). A verificação `tagName === 'IMG'` / `tagName === 'A'` previne aplicar `src`/`href` em nós errados caso o DOM tenha sido modificado (defesa em profundidade — T-09-02-05). `setAttribute` em vez de `.src =` / `.href =` garante consistência com o padrão de override por atributo.

[VERIFIED: leitura direta de `/apps/web/src/lib/overrides/apply-shim.ts`]

---

### 2. `edit-script.ts` — o que estender

**isTextLeaf atual (linhas 106-113):** Inclui `'img'` em `skipTags` — confirma que `<img>` é explicitamente excluído hoje.

**Click handler atual (linha 223):** `if (!editMode || !isTextLeaf(e.target)) return;` — só reage a text-leaf.

**Phase 11 requer três extensões no IIFE:**

**A. Funções de predicado para os novos tipos:**
```javascript
function isSelectableImage(el) {
  if (el.nodeType !== Node.ELEMENT_NODE) return false;
  return el.tagName === 'IMG';
}

function isSelectableHref(el) {
  if (el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.tagName !== 'A') return false;
  return el.hasAttribute('href'); // bare <a> sem href = NÃO selecionável (UI-SPEC)
}
```

**B. Hover/mouseout — estender para img e a:**
```javascript
document.body.addEventListener('mouseover', function(e) {
  if (!editMode) return;
  var el = e.target;
  if (!isTextLeaf(el) && !isSelectableImage(el) && !isSelectableHref(el)) return;
  var path = computePath(el);
  if (!path) return;
  saveStyles(path, el);
  el.style.outline = '2px dashed #3b82f6';
  el.style.outlineOffset = '2px';
  el.style.cursor = 'pointer';
});
```

**C. Click — prioridade de seleção (innermost wins):**
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
  // ...resto do handler...
```

**Regra de prioridade img-dentro-de-a:** Como o browser dispara `click` com `e.target` sendo o elemento mais interno clicado, e a verificação de `isSelectableImage` vem ANTES de `isSelectableHref`, clicar no `<img>` filho de um `<a>` naturalmente seleciona a imagem. Clicar na área do `<a>` fora do filho `<img>` (i.e., `e.target === <a>`) seleciona o href. [VERIFIED: UI-SPEC Precedence rule]

**D. Novo shape de ELEMENT_SELECTED:**
```javascript
// Capturar currentValue por tipo:
var currentValue;
if (elementType === 'image') {
  currentValue = el.getAttribute('src') || '';
} else if (elementType === 'href') {
  currentValue = el.getAttribute('href') || '';
} else {
  currentValue = el.textContent || '';
}

var originalHash = fnv1a(currentValue);

// Salvar em originalMap ANTES de qualquer modificação de estilos:
if (!originalMap[path]) {
  originalMap[path] = { elementType: elementType, value: currentValue };
}

sendToParent({
  type: 'ELEMENT_SELECTED',
  path: path,
  originalHash: originalHash,
  elementType: elementType,
  currentValue: currentValue
});
```

**E. Handler da nova mensagem PREVIEW_OVERRIDE:**
```javascript
} else if (msg.type === 'PREVIEW_OVERRIDE') {
  var ovEl = pathToNode(msg.path);
  if (!ovEl) return;
  if (msg.elementType === 'image' && ovEl.tagName === 'IMG') {
    ovEl.setAttribute('src', msg.value);
  } else if (msg.elementType === 'href' && ovEl.tagName === 'A') {
    ovEl.setAttribute('href', msg.value);
  }
  // Adicionar ao pendingMap para que REQUEST_SAVE inclua na PENDING_EDITS:
  var originalEntry = originalMap[msg.path];
  var origHash = originalEntry ? fnv1a(originalEntry.value) : fnv1a('');
  pendingMap[msg.path] = { path: msg.path, originalHash: origHash, type: msg.elementType, value: msg.value };
```

**F. REQUEST_DISCARD — restaurar img.src e a.href:**
```javascript
// Estender o handler REQUEST_DISCARD:
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
originalMap = {};
```

[VERIFIED: leitura direta de `/apps/web/src/lib/overrides/edit-script.ts`]

---

### 3. `ViteSpaPreviewEditor.tsx` — extensões

**Slot D-04 atual (linha 383-384):**
```tsx
{/* D-04: reserved slot for Phase 11 per-type control (image/link) */}
<div />
```
Este `<div />` está DENTRO do branch `pendingEdits.length > 0` (branch dirty).

**Mudança necessária (UI-SPEC linha 245):** Mover o slot para FORA do branch clean/dirty. O slot deve ser renderizado quando `isEditMode && (selectedElementType === 'image' || selectedElementType === 'href')`, independentemente do estado dirty.

**Novos estados a adicionar:**
```tsx
// Tipo do elemento atualmente selecionado
const [selectedElementType, setSelectedElementType] = useState<'text' | 'image' | 'href' | null>(null);
// Valor atual do elemento selecionado (src para img, href para a)
const [selectedCurrentValue, setSelectedCurrentValue] = useState<string | null>(null);
// Controla abertura do ImageSwapPanel (Popover)
const [imagePanelOpen, setImagePanelOpen] = useState(false);
// Valor controlado do href input
const [hrefValue, setHrefValue] = useState('');
// Erro de validação de URL do href input
const [hrefInputError, setHrefInputError] = useState<string | null>(null);
```

**Handler de ELEMENT_SELECTED (estender o existente):**
```tsx
case 'ELEMENT_SELECTED':
  setSelectedPath(msg.path as string);
  setSelectedElementType(msg.elementType as 'text' | 'image' | 'href');
  setSelectedCurrentValue(msg.currentValue as string);
  // Pré-preencher href input com valor atual:
  if (msg.elementType === 'href') {
    setHrefValue((msg.currentValue as string) || '');
    setHrefInputError(null);
  }
  break;
```

**Enviar PREVIEW_OVERRIDE após confirmação de imagem:**
```tsx
// Chamado por ImageSwapPanel.onConfirm(finalUrl):
const handleImageConfirm = useCallback((finalUrl: string) => {
  // Adicionar ao pendingEdits (dirty count)
  setPendingEdits(prev => {
    const next = prev.filter(e => e.path !== selectedPath);
    next.push({ path: selectedPath!, originalHash: '', type: 'image', value: finalUrl });
    return next;
  });
  // Enviar PREVIEW_OVERRIDE ao iframe (aplica visualmente)
  sendToIframe({ type: 'PREVIEW_OVERRIDE', path: selectedPath, elementType: 'image', value: finalUrl });
  setImagePanelOpen(false);
}, [selectedPath, sendToIframe]);
```

**Confirmar href no input (Enter ou blur):**
```tsx
const handleHrefConfirm = useCallback(() => {
  const result = validateOverrideUrl(hrefValue);
  if (!result.ok) return; // não confirmar URL inválida
  setPendingEdits(prev => {
    const next = prev.filter(e => e.path !== selectedPath);
    next.push({ path: selectedPath!, originalHash: '', type: 'href', value: hrefValue });
    return next;
  });
  sendToIframe({ type: 'PREVIEW_OVERRIDE', path: selectedPath, elementType: 'href', value: hrefValue });
}, [hrefValue, selectedPath, sendToIframe]);
```

**Limpeza de estado ao sair do modo edição / descartar:**
Ao receber `EDIT_DISCARDED`, limpar `selectedElementType`, `selectedCurrentValue`, `hrefValue`, `hrefInputError`, `imagePanelOpen`.

**Banner — 4 estados (UI-SPEC):**
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

**Texto do dialog de discard (UI-SPEC — atualizar):**
```tsx
// Antes (Phase 10):
// "o texto original será restaurado"
// Depois (Phase 11):
`As ${pendingEdits.length} alterações não salvas serão perdidas e o conteúdo original será restaurado.`
```

[VERIFIED: leitura direta de `ViteSpaPreviewEditor.tsx`]

---

### 4. `updateLpAction` em `actions.ts` — validação SEC-02

**Branch VITE_SPA atual (linhas 380-427):** Após `SaveViteSpaOverridesSchema.safeParse()` bem-sucedido, persiste overrides diretamente. `PfOverrideSchema.value` é `z.string()` sem validação de URL.

**Extensão necessária — loop de validação de URL após schema parse:**
```typescript
// Depois de overridesParsed.success === true:
if (overridesParsed.data.overrides) {
  for (const ov of overridesParsed.data.overrides) {
    if (ov.type === 'image' || ov.type === 'href') {
      // Validação autoritativa de URL (SEC-02)
      // URL constructor lança para URLs malformadas
      let parsed: URL;
      try {
        parsed = new URL(ov.value);
      } catch {
        return { ok: false, error: 'URL de override inválida ou malformada.' };
      }
      // Allowlist de protocolo: apenas http/https
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, error: 'URL de override com protocolo não permitido.' };
      }
      // Bloquear explicitamente protocolos perigosos (double-check)
      // javascript: e data: são bloqueados pelo check de protocol acima,
      // mas tornamos o bloqueio explícito para clareza e auditabilidade.
    }
  }
}
```

**Nota:** `new URL()` está disponível em Node.js 18+ sem dependência externa. A validação usa exatamente a mesma lógica do utilitário cliente `validate-url.ts`, garantindo paridade cliente/servidor. [VERIFIED: Node.js built-in URL API]

---

### 5. Export route (VITE_SPA branch) — extensão para D-11-04

**Situação atual:** A branch VITE_SPA do export route (`route.ts` linhas 259-298) chama `buildOverrideInjection(lpValues)` → `injectOverrides(themedHtml, injection)`. O resultado `finalHtml` contém um JSON blob em `<script id="pf-overrides">` com os overrides, incluindo possíveis `{type:'image', value:'https://s3...'}`. O blob está em plain text (S3 URLs não contêm `<>&` portanto `escapeJsonForHtml` não as altera — verificado na implementação de `escapeJsonForHtml`).

**Extensão necessária (D-11-04):**
```typescript
// Após: const finalHtml = injectOverrides(themedHtml, injection);
// Antes: viteSpaArchive.append(Buffer.from(finalHtml, 'utf-8'), { name: 'index.html' });

const s3BaseUrl = process.env.S3_PUBLIC_BASE_URL ?? '';
let processedHtml = finalHtml;

// 1. Coletar overrides de imagem com URLs S3 (apenas S3 — SSRF prevention, mesmo filtro do LIQUID path)
const imageOverrides = (lpValues.overrides ?? []).filter(
  ov => ov.type === 'image' && s3BaseUrl && ov.value.startsWith(s3BaseUrl)
);

// 2. Baixar imagens S3 e reescrever no JSON blob
const assetMap = new Map<string, string>(); // url → filename
const usedFilenames = new Set<string>();

for (const ov of imageOverrides) {
  try {
    const resp = await fetch(ov.value, { redirect: 'error' }); // anti-SSRF
    if (!resp.ok) continue;
    const buf = Buffer.from(await resp.arrayBuffer());
    const urlObj = new URL(ov.value);
    let filename = urlObj.pathname.split('/').at(-1) || `asset-${assetMap.size}`;
    if (usedFilenames.has(filename)) filename = `${assetMap.size}-${filename}`;
    usedFilenames.add(filename);
    assetMap.set(ov.value, filename);
    // Adicionar ao ZIP como assets/{filename}
    viteSpaArchive.append(buf, { name: `assets/${filename}` });
    // Reescrever no HTML (plain string replace — URL não tem chars HTML-escaped)
    processedHtml = processedHtml.split(ov.value).join(`./assets/${filename}`);
  } catch { /* skip — URL inválida ou rede indisponível */ }
}

// 3. Usar processedHtml (não finalHtml) no append:
viteSpaArchive.append(Buffer.from(processedHtml, 'utf-8'), { name: 'index.html' });
```

**Nota sobre URLs externas:** Overrides `{type:'image', value: <url-externa>}` onde a URL NÃO começa com `S3_PUBLIC_BASE_URL` são filtrados pelo predicado `.startsWith(s3BaseUrl)` e permanecem com URL absoluta no HTML exportado (D-11-04). O filtro é o mesmo padrão anti-SSRF já usado no LIQUID path (linhas 99-149 do export route).

[VERIFIED: leitura direta de `/apps/web/src/app/api/lps/[lpId]/export/route.ts`]

---

### 6. `requestPresignedUploadAction` e `validateUploadedImageAction` — reuso em ImageSwapPanel

**Localização:** `apps/web/src/lib/lps/actions.ts` (linhas 669-802). Ambas são Server Actions importadas por `ImageUploadField.tsx` (linha 28).

**`requestPresignedUploadAction(slug, { filename, contentType, fileSize, firstBytes })`:**
- Recebe: `slug` (workspace), metadados do arquivo, primeiros 4100 bytes (para magic-bytes validation).
- Retorna: `ActionResult<{ presignedUrl: string; publicUrl: string; key: string }>`.
- Segurança: magic-bytes via `file-type`, size cap 5 MB, S3 key tenant-scoped (`workspaces/{workspaceId}/lps/assets/{uuid}.ext`).

**`validateUploadedImageAction(slug, { key })`:**
- Recebe: `slug`, `key` do S3 (verifica prefixo `workspaces/{workspaceId}/lps/assets/` — CR-01).
- Retorna: `ActionResult<{ width: number; height: number }>`.
- Efeito colateral: DELETE no S3 se dimensões > 5000×5000 px.

**Padrão de reuso em `ImageSwapPanel.tsx`:**
```typescript
// NÃO usar RHF Controller (UI-SPEC: "Do NOT wrap in RHF Controller")
// Gerenciar estado diretamente com useState:
const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>('idle');
const [uploadProgress, setUploadProgress] = useState(0);
const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
const xhrRef = useRef<XMLHttpRequest | null>(null);

// Fluxo upload (extraído de ImageUploadField, linha 89-198):
// 1. Client-side pre-validation (MIME + size) → UX guard
// 2. file.slice(0, 4100).arrayBuffer() → firstBytes
// 3. requestPresignedUploadAction(slug, {...}) → { presignedUrl, publicUrl, key }
// 4. XHR PUT com progress → xhrRef para cancel
// 5. validateUploadedImageAction(slug, { key }) → { width, height }
// 6. setUploadedUrl(publicUrl); setUploadState('uploaded')
```

O `ImageUploadField.tsx` existente usa `Controller` de RHF e não pode ser reutilizado como componente. A lógica de upload (steps 1-6) PODE ser extraída diretamente.

[VERIFIED: leitura direta de `ImageUploadField.tsx` e `actions.ts`]

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez disso | Por quê |
|----------|---------------|-------------------|---------|
| Validação de URL | Regex caseiro para URL | `new URL(raw)` + `.protocol` check | O construtor URL do WHATWG (built-in Node.js 18+ e browser) lida com edge cases (espaços, percent-encoding, IPv6) que regex manual erra. `javascript:alert(1)` é bloqueado pela checagem de `.protocol`. |
| Upload direto para S3 | Proxy de upload via servidor | `requestPresignedUploadAction` + XHR PUT | Já implementado e auditado; o servidor nunca recebe bytes da imagem (D-02). |
| Hash de conteúdo | SHA-x com crypto | `fnv1a` (já inline no edit-script) | fnv1a é zero-dep, já existe no código, serve para Phase 12 drift detection. |
| Aplicar overrides via innerHTML | `node.innerHTML = value` | `setAttribute('src'/'href', value)` | innerHTML introduz XSS. Atributos são seguros para src/href quando a URL é validada server-side. |
| Sanitização de rich text | Parser HTML caseiro | `sanitize-html` (já no stack) | Já definido no CLAUDE.md; não reintroduzir para o caso de URL. |

---

## validate-url.ts — spec do utilitário compartilhado

**Caminho:** `apps/web/src/lib/overrides/validate-url.ts`
**Usado em:** `ImageSwapPanel.tsx` (client), `ViteSpaPreviewEditor.tsx` (client), e como lógica de referência em `updateLpAction` (server).

**Contrato exato (da UI-SPEC — LOCKED):**
```typescript
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

**Mapeamento de erro para copy (UI-SPEC Copywriting Contract):**

Para o campo URL no ImageSwapPanel:
- `'invalid-protocol'` → `"URL inválida — apenas http:// e https:// são permitidos."`
- `'malformed'` → `"URL inválida — verifique o endereço."`

Para o href input na toolbar:
- `'invalid-protocol'` → `"Apenas http:// e https:// são permitidos."`
- `'malformed'` → `"URL inválida."`

[VERIFIED: UI-SPEC, seção "URL Validation Contract"]

---

## ImageSwapPanel.tsx — especificação do componente

**Props (UI-SPEC):**
```typescript
interface ImageSwapPanelProps {
  slug: string
  currentSrc: string          // pré-preenche campo de URL
  onConfirm: (value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}
```

**Estado interno:** `uploadState: 'idle'|'uploading'|'uploaded'|'error'`, `uploadProgress: number`, `uploadedUrl: string | null`, `urlValue: string`, `urlError: string | null`.

**Lógica de "Aplicar imagem":**
```typescript
// uploadState === 'uploaded' → finalUrl = uploadedUrl
// else urlValue válido → finalUrl = urlValue
// onConfirm(finalUrl) → parent adiciona override + PREVIEW_OVERRIDE ao iframe → fecha Popover
```

**Fechar sem confirmar:** Abortar upload em curso (`xhrRef.current.abort()`); não criar override; `urlValue` descartado; `uploadState` resetado.

**Botão remover imagem (uploaded state):** icon-only com `aria-label="Remover imagem"`.

**Não usar RHF Controller** (estado direto com `useState`).

---

## Common Pitfalls

### Pitfall 1: childNodes vs children no computePath (HERDADO — crítico)
**O que dá errado:** Usar `parent.children` (só elementos) em vez de `parent.childNodes` (todos os nós, incluindo text nodes) em `computePath`. O índice calculado é diferente do índice usado por `pathToNode`, que usa `childNodes`. Override aplicado no nó errado.
**Causa raiz:** `children` vs `childNodes` têm índices incompatíveis quando há text nodes ou comment nodes irmãos.
**Como evitar:** `Array.prototype.indexOf.call(parent.childNodes, current)` — exatamente como já está em `edit-script.ts` linha 95.
**Verificação:** `computePath(img) → "/2/0"` deve decodificar via `pathToNode("/2/0")` e retornar o mesmo `<img>`.

[VERIFIED: edit-script.ts line 95]

### Pitfall 2: PREVIEW_OVERRIDE sem pendingMap no iframe
**O que dá errado:** O parent envia `PREVIEW_OVERRIDE` e atualiza seu `pendingEdits` para o dirty count, mas o iframe NÃO adiciona ao seu `pendingMap`. Em `REQUEST_SAVE`, o iframe envia `PENDING_EDITS` com apenas os overrides de texto (de `pendingMap`). As overrides de imagem/href são perdidas na persistência.
**Causa raiz:** O parent mantém `pendingEdits` apenas para o badge. A fonte de verdade para o save é o `pendingMap` do iframe.
**Como evitar:** O handler de `PREVIEW_OVERRIDE` no iframe DEVE adicionar o override ao `pendingMap`: `pendingMap[msg.path] = { path, originalHash, type: msg.elementType, value: msg.value }`.

### Pitfall 3: img.src (propriedade IDL) vs getAttribute('src') (atributo)
**O que dá errado:** Usar `el.src` para capturar o currentValue em vez de `el.getAttribute('src')`. `el.src` em um `<img>` retorna a URL **absoluta e resolvida** (incluindo protocolo e host). `el.getAttribute('src')` retorna o valor exato do atributo (pode ser relativo). Se o original for relativo e o override for absoluto, o originalHash não bate ao reverter.
**Como evitar:** Usar `el.getAttribute('src') || el.src || ''` para capturar o valor original — pegar o atributo primeiro, fallback para a propriedade resolvida.

### Pitfall 4: script tag breakout via URL na pf-overrides JSON
**O que dá errado:** Uma URL de imagem externa como `https://evil.com/</script><script>alert(1)` é persistida como override value. `escapeJsonForHtml` já escapa `<` → `<` nos valores JSON. A URL com `</script>` seria escapada como `</script>` e não fecharia a tag.
**Como evitar:** `escapeJsonForHtml` já implementado em `apply-shim.ts` (linha 70-75). A validação de URL server-side (SEC-02) bloqueia qualquer URL malformada. Nenhuma ação adicional necessária — a cadeia de defesas está completa.
**Verificação:** Confirmar que `buildOverrideInjection` chama `escapeJsonForHtml(rawJson)` — VERIFICADO na linha 109.

### Pitfall 5: Substituição de URL no export route (string.split+join)
**O que dá errado:** Usar `html.replace(url, './assets/filename')` quando a URL pode aparecer múltiplas vezes no HTML. `String.prototype.replace` com string (não regex) só substitui a primeira ocorrência.
**Como evitar:** Usar `.split(url).join(...)` para substituição global — mesmo padrão já usado em `rewriteImageSrcs` do export route LIQUID (linha 164). O JSON blob em `pf-overrides` pode ter a mesma URL repetida se dois `<img>` foram trocados para a mesma imagem S3.

### Pitfall 6: selectedElementType persiste ao sair do modo edição
**O que dá errado:** `selectedElementType` não é limpo no `EDIT_DISCARDED` ou no `handleDiscard`. O slot D-04 reaparece com o painel do tipo errado ao entrar em edição novamente.
**Como evitar:** No handler de `EDIT_DISCARDED`, limpar: `setSelectedElementType(null)`, `setSelectedCurrentValue(null)`, `setHrefValue('')`, `setHrefInputError(null)`, `setImagePanelOpen(false)`.

### Pitfall 7: imagePanelOpen permanece aberto após save
**O que dá errado:** Usuário abre o painel de imagem, confirma, salva. O `imagePanelOpen` não é resetado no fluxo de save. Na próxima vez que entrar em edição, o Popover abre sozinho.
**Como evitar:** Fechar o painel (`setImagePanelOpen(false)`) ao completar save com sucesso em `handleSaveWithEdits`.

### Pitfall 8: Apply-shim timing (LIMITAÇÃO CONHECIDA — não resolver na Fase 11)
**O que ocorre:** O apply-shim executa em `DOMContentLoaded`. Para SPAs Vite com React, o React pode sobrescrever os atributos `src`/`href` durante a hidratação, que ocorre após DOMContentLoaded. Overrides de imagem/href podem ser apagados pelo React.
**Status:** Limitação herdada da Fase 10 para overrides de texto (documentada em `10-HUMAN-UAT.md` como Bug C). O fix (`MutationObserver`) é Fase 12. A Fase 11 apenas REGISTRA que imagem/href têm o mesmo limite.
**Não investigar nem resolver nesta fase.**

---

## Code Examples

### validate-url.ts (completo)
```typescript
// apps/web/src/lib/overrides/validate-url.ts
// Source: UI-SPEC Phase 11, "URL Validation Contract" — LOCKED
type UrlValidResult =
  | { ok: true }
  | { ok: false; error: 'invalid-protocol' | 'malformed' }

export function validateOverrideUrl(raw: string): UrlValidResult {
  if (!raw) return { ok: true }
  let parsed: URL
  try { parsed = new URL(raw) } catch { return { ok: false, error: 'malformed' } }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'invalid-protocol' }
  }
  return { ok: true }
}
```

### Ramos image/href no shimScript (apply-shim.ts)
```javascript
// Source: extensão de apply-shim.ts — verificado no contexto do loop existente
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

### Slot D-04 no toolbar (ViteSpaPreviewEditor.tsx)
```tsx
{/* D-04: slot por tipo — renderizado quando image ou href está selecionado */}
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
            if (e.key === 'Escape') { setHrefValue(selectedCurrentValue ?? ''); setHrefInputError(null); }
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

---

## State of the Art

| Abordagem Anterior | Abordagem Atual | Impacto |
|-------------------|-----------------|---------|
| Override por atributo direto (`el.src = value`) | `el.setAttribute('src', value)` (consistência) | Idêntico em comportamento mas explicitamente via API de atributo |
| `ELEMENT_SELECTED` com `currentText` | `ELEMENT_SELECTED` com `elementType` + `currentValue` (breaking change no shape) | Parent deve lidar com novo shape; edit-script deve emitir novos campos |

**Sem deprecações na Fase 11.** O enum `type` em `PfOverrideSchema` já incluía `"image"` e `"href"` desde a Fase 9 — Phase 11 ativa o que já estava reservado.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `escapeJsonForHtml` não escapa URLs `https://` (sem `<>&  `) — portanto a URL S3 aparece em plain text no JSON blob e pode ser substituída via `string.split().join()` no export route. | Hook Point 5 (export) | Se uma URL S3 contiver `<`, `>` ou `&` (não deveria, mas possível via path encoding), a substituição falhará silenciosamente. Risco baixo. |
| A2 | `new URL()` disponível no browser e Node.js 18+ sem dependência. | validate-url.ts spec | Se o runtime for Node.js < 18 (não é o caso — CLAUDE.md menciona Node 18+). |

---

## Open Questions

1. **Shape de `ELEMENT_SELECTED` — retrocompatibilidade com texto**
   - O que sabemos: a Fase 10 espera `msg.path as string` em `ELEMENT_SELECTED`. O novo shape adiciona `elementType` e `currentValue`.
   - O que é claro: já que ambos (iframe edit-script e parent ViteSpaPreviewEditor) são atualizados na mesma fase, não há consumidor legado a preservar.
   - Recomendação: emitir o novo shape (com `elementType: 'text'`, `currentValue: el.textContent`) também para seleção de texto — isso consolida o handler.

2. **s3Key não está disponível para override de imagem — apenas publicUrl**
   - O que sabemos: `ImageSwapPanel` recebe `publicUrl` do upload flow, não o `s3Key`. O override armazenado tem `value = publicUrl` (string URL).
   - O que é claro: para o export ZIP, o `extractS3ImageUrls` pattern do LIQUID path usa a URL pública para baixar a imagem — funciona igualmente para overrides VITE_SPA.
   - Recomendação: armazenar `value = publicUrl` no override (já é o que acontece); o export route usa a URL para baixar via `fetch`.

---

## Environment Availability

> Step 2.6: Dependências externas desta fase já em uso pelo projeto.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `requestPresignedUploadAction` / `validateUploadedImageAction` | ImageSwapPanel upload flow | ✓ | já em produção (actions.ts) | — |
| S3 bucket (`S3_PUBLIC_BASE_URL`, `S3_BUCKET`) | Upload + export rewrite | ✓ (Docker MinIO em dev) | configurado | — |
| `new URL()` (WHATWG) | validate-url.ts | ✓ | Node.js 18+ / browser | — |
| `shadcn Popover` | ImageSwapPanel | ✗ (não instalado) | — | `npx shadcn add popover` (shadcn oficial) |
| `archiver` (ZipArchive) | export route extensão | ✓ | 8.0.0 (já em uso) | — |

**Missing dependencies with no fallback:**
- nenhuma

**Missing dependencies with fallback:**
- `shadcn Popover` — não instalado; instalar com `npx shadcn add popover` como Wave 0.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não (herdado — já implementado) | better-auth + requireWorkspaceRole |
| V4 Access Control | sim (edição gated owner/admin/editor) | requireWorkspaceRole em updateLpAction — já implementado |
| V5 Input Validation | **sim — foco da Fase 11** | `validateOverrideUrl()` + `new URL()` allowlist; server-side autoritativo |
| V6 Criptografia | não | — |

### Threat Patterns Relevantes

| Pattern | STRIDE | Mitigação Padrão |
|---------|--------|-----------------|
| Override `href=javascript:alert(1)` | Tampering + Spoofing | `validateOverrideUrl` bloqueia protocolo não-http(s) — server-side autoritativo (SEC-02) |
| Override `src=data:text/html,...` (XSS em img) | Tampering | Mesmo controle: `data:` bloqueado pelo check de `parsed.protocol` |
| SSRF via URL externa no export | Elevation of Privilege | Export route: `redirect: 'error'` + filtro `startsWith(s3BaseUrl)` — apenas S3 próprio é baixado (D-11-04) |
| Injeção via JSON blob em `<script>` | XSS | `escapeJsonForHtml` unicode-escape `<>&` — já implementado (T-09-02-01) |
| Cross-tenant image key forgery | Tampering | `validateUploadedImageAction` verifica prefixo `workspaces/{workspaceId}/lps/assets/` — já implementado (CR-01) |
| Overrides persistidos sem validação | Tampering | Loop de validação URL em `updateLpAction` ANTES do persist (SEC-02) |

---

## Sources

### Primary (HIGH confidence)
- Leitura direta: `apps/web/src/lib/overrides/apply-shim.ts` — loop shimScript, linhas exatas 150-157
- Leitura direta: `apps/web/src/lib/overrides/edit-script.ts` — isTextLeaf, click handler, ELEMENT_SELECTED shape
- Leitura direta: `apps/web/src/app/w/[slug]/lps/[lpId]/preview/ViteSpaPreviewEditor.tsx` — slot D-04 (linha 383), handlers postMessage
- Leitura direta: `apps/web/src/lib/lps/actions.ts` — updateLpAction VITE_SPA branch, requestPresignedUploadAction, validateUploadedImageAction
- Leitura direta: `apps/web/src/lib/lps/schema.ts` — PfOverrideSchema (type enum já inclui image/href), SaveViteSpaOverridesSchema
- Leitura direta: `apps/web/src/components/lps/ImageUploadField.tsx` — fluxo completo de upload S3 presigned
- Leitura direta: `apps/web/src/app/api/lps/[lpId]/export/route.ts` — VITE_SPA branch, extractS3ImageUrls, rewriteImageSrcs
- Leitura direta: `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` — edit mode injection, buildEditScript
- Leitura direta: `.planning/phases/11-imagens-links/11-CONTEXT.md`, `11-UI-SPEC.md`
- Leitura direta: `.planning/REQUIREMENTS.md` (EDIT-04, EDIT-05, SEC-02)
- Leitura direta: `.planning/config.json` (`nyquist_validation: false`)

### Secondary (MEDIUM confidence)
- CLAUDE.md (projeto): padrões S3 presigned, sanitize-html, LiquidJS safety, anti-innerHTML
- `.planning/phases/10-editor-visual-in-iframe-texto/10-PATTERNS.md`: padrões de implementação da Fase 10

---

## Metadata

**Confidence breakdown:**
- Hook points (apply-shim, edit-script, ViteSpaPreviewEditor, actions, export route): HIGH — código lido diretamente
- Validate-url.ts spec: HIGH — contratos literais da UI-SPEC
- ImageSwapPanel spec: HIGH — props e lógica da UI-SPEC
- Export route extensão (D-11-04): HIGH — padrão idêntico ao LIQUID path já implementado
- Segurança SEC-02: HIGH — built-in `URL` constructor, sem dependência externa

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (30 dias — stack estável, sem dependências de terceiros novas)
