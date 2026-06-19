# Phase 7: Isolated Serving + Sandboxed Preview - Research

**Researched:** 2026-06-19
**Domain:** Browser security / Host-based routing / S3 streaming / HMAC token auth
**Confidence:** HIGH (all critical claims verified against codebase or official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Formato da origem = subdomínio por template — `{tplHash}.serve.<domínio>`, SPA na raiz do host
- **D-02:** Wildcard `*.serve.<domínio>` para os hosts de serving; em dev: `*.localhost` ou `lvh.me`/`nip.io`
- **D-03:** A origem isolada NUNCA compartilha cookie de sessão do dashboard
- **D-04:** Route handler faz stream do S3 (`GetObject`); bucket não exposto publicamente; chave = `workspaces/{wId}/project-templates/{tplId}/dist/{path}`
- **D-05:** Token assinado/efêmero emitido pelo dashboard; HMAC com escopo `{workspaceId, templateId}` + expiração; cross-tenant → 403; chave inexistente → 404
- **D-06:** Rota dedicada de preview no dashboard (`/w/{slug}/project-templates/{id}/preview`) com `<iframe sandbox="allow-scripts">` sem `allow-same-origin`; CSP `frame-ancestors` restrita ao dashboard
- **D-07:** Fallback SPA = rota desconhecida → `index.html`; asset com extensão ausente → 404
- **D-08:** Guard recíproco: serving/preview VITE_SPA rejeita explicitamente template `LIQUID` (espelho de `renderLp()`)

### Claude's Discretion

- Mecânica exata do roteamento por host (proxy.ts vs config) e do dev cross-origin (`*.localhost` vs `lvh.me`/`nip.io`)
- Algoritmo/segredo de assinatura do token (HMAC-SHA256 etc.), TTL exato e formato da URL
- Onde inicializar o S3Client singleton da origem isolada e como reutilizar o cliente existente
- Estrutura exata dos `Content-Type` (reusar/estender o MIME map de `s3-upload.ts`)

### Deferred Ideas (OUT OF SCOPE)

- Geração de LP por rota, tema por brand CSS vars, export ZIP do `dist/`, aceitação v2.0 end-to-end → Fase 8
- Build server-side, edição por formulário → v2.1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRJ-04 | Serving do `dist/` do tenant a partir de origem isolada do dashboard (não compartilha cookies de sessão) | Host-based routing via `proxy.ts` + route handler stream de S3; `*.localhost` valida isolamento de origem localmente |
| PRJ-05 | Preview via `<iframe>` cross-origin com `sandbox="allow-scripts"` (sem `allow-same-origin`) + CSP `frame-ancestors` | Confirmado por MDN: sem `allow-same-origin` a origem do iframe é opaca — `document.cookie` não expõe sessão do dashboard; `frame-ancestors` restrita ao dashboard |
| PRJ-06 | Isolamento cross-tenant do `dist/` servido/armazenado (chaves não-enumeráveis, escopo por workspace) | Token HMAC com payload `{workspaceId, templateId}` + handler valida correspondência com prefixo S3 — cross-tenant → 403 |
| PRJ-11 | Separação estrita de tipo: VITE_SPA nunca entra no caminho LIQUID e vice-versa | Guard recíproco em `serveViteSpa()`: verifica `template.kind === 'VITE_SPA'` antes de stream; teste de fronteira espelha `type-boundary.test.ts` |
</phase_requirements>

---

## Summary

Phase 7 entrega a decisão de origem não-retrofitável D4: servir o `dist/` de templates VITE_SPA a partir de uma origem isolada (`{tplHash}.serve.<domínio>`) com autorização via token HMAC efêmero e preview via `<iframe sandbox="allow-scripts">` sem `allow-same-origin`. Toda a lógica de isolamento e autorização fica 100% no servidor — o cliente só recebe bytes pré-autorizados.

O mecanismo de roteamento por host no Next.js 16 usa `proxy.ts` (substituto do `middleware.ts` depreciado nesta versão): o proxy lê o cabeçalho `Host`, detecta se é um host de serving (`*.serve.`), e reescreve a requisição para uma rota catch-all interna (`/serve/[tplId]/[...path]`) antes que o filesystem router a processe. O route handler nessa rota valida o token HMAC do query-string, resolve a chave S3 e faz stream dos bytes com `Content-Type` correto.

Em desenvolvimento local, `*.localhost` resolve para `::1` nativamente no Chrome e no Linux (confirmado neste ambiente). O servidor Next.js já está acessível em `abc.localhost:3000` (HTTP 200 verificado). Não é necessário nenhum setup adicional de DNS para o fluxo básico de desenvolvimento. Para HTTPS com certificado real em dev, `localhost.direct` oferece wildcard `*.localhost.direct` → `127.0.0.1` com certificado público gratuito; para MVP o HTTP simples é suficiente para o teste de `document.cookie`.

**Primary recommendation:** `proxy.ts` com host-detection + catch-all route handler. HMAC-SHA256 com `crypto.createHmac` nativo do Node.js (já disponível, nenhuma dependência nova). TTL de 30 minutos. Secret via `SERVE_TOKEN_SECRET` no `.env`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Host detection e roteamento por subdomínio | Frontend Server (proxy.ts) | — | `proxy.ts` é o único ponto que vê o cabeçalho `Host` antes do roteamento do filesystem |
| Validação do token HMAC + scope check | API/Backend (route handler) | — | O proxy não tem acesso ao `SERVE_TOKEN_SECRET`; validação deve ocorrer no handler com acesso a env vars |
| Stream de bytes do S3 → resposta HTTP | API/Backend (route handler) | — | Acesso ao S3Client + env vars de credenciais só no servidor; bytes nunca passam pelo cliente |
| Fallback SPA (rota desconhecida → index.html) | API/Backend (route handler) | — | Handler detecta extensão do path e decide 404 vs. index.html |
| Emissão do token assinado (minting) | API/Backend (Server Action) | — | `requireWorkspaceRole` garante que só membros autorizados recebem tokens; workspaceId vem da sessão |
| Preview iframe no dashboard | Frontend Server (RSC page) | Browser | Página RSC monta o `<iframe>`; sandbox e CSP são atributos do elemento HTML |
| Guard recíproco de tipo (D-08) | API/Backend (lib/serve-vite-spa.ts) | — | Espelha `renderLp()` — rejeita LIQUID antes de qualquer acesso ao S3 |
| Isolamento cross-tenant | API/Backend (route handler) | DB/Storage (S3 key prefix) | Token HMAC carrege workspaceId; handler verifica que a chave S3 pertence ao workspace do token |

---

## Standard Stack

### Core (todas as bibliotecas já instaladas no projeto)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` (proxy.ts + route handlers) | 16.2.7 [VERIFIED: package.json] | Host detection (proxy.ts) + serving handler (catch-all route) | Monolito Next.js; roteamento por host via proxy.ts sem serviço separado |
| `@aws-sdk/client-s3` (`GetObjectCommand`) | ^3.1064.0 [VERIFIED: package.json] | Stream bytes do S3 para o response HTTP | Já em uso em `lib/lps/actions.ts` e `lib/project-templates/actions.ts`; padrão estabelecido |
| `node:crypto` (`createHmac`) | Node.js 22.17.1 built-in [VERIFIED: node --version] | HMAC-SHA256 para mint/verify do token efêmero | Disponível sem dependência; mesmo que Stripe webhook signing |
| `zod` | ^4.4.3 [VERIFIED: package.json] | Validar payload do token após decode | Já em uso no projeto; consistente com outras validações |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `better-auth` (`requireWorkspaceRole`) | ^1.6.13 [VERIFIED: package.json] | Autorizar emissão do token no dashboard | Mesmo padrão de `lib/workspaces/guards.ts` — workspaceId vem da sessão |
| `@aws-sdk/s3-request-presigner` | ^3.1064.0 [VERIFIED: package.json] | NÃO usado aqui (presigned URLs expõem o bucket) | Ignorar nesta fase; D-04 manda stream direto |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HMAC-SHA256 via `node:crypto` | `jose` / `jsonwebtoken` (JWT) | JWT é mais verboso e adiciona dependência; HMAC simples é suficiente para token scoped com expiração |
| Catch-all route handler `/serve/[tplId]/[...path]` | Rota de API separada `/api/serve/...` | Rota sob `/api/` tem semântica de API, não de serving de arquivos estáticos; catch-all no app router é mais limpo |
| `*.localhost` para dev | `lvh.me` ou `nip.io` | `*.localhost` não requer rede externa e já resolve neste ambiente; preferir |

**Installation:** Nenhuma dependência nova necessária — todas já presentes no projeto.

---

## Architecture Patterns

### System Architecture Diagram

```
DASHBOARD (dashboard.pageforge.com ou localhost:3000)
│
│  1. Usuário clica "Preview" em um template VITE_SPA
│  2. RSC page chama mintServeToken(workspaceId, templateId) — Server Action
│     ├── requireWorkspaceRole(slug) → workspaceId da sessão
│     └── HMAC-SHA256(secret, payload+expiry) → signedToken
│  3. RSC renderiza <iframe src="http://{tplHash}.serve.localhost:3000/?t={signedToken}">
│                            sandbox="allow-scripts"
│                            (sem allow-same-origin → origem opaca)
│
PROXY.TS (roda antes do filesystem router para cada request)
│  4. Lê request.headers.get('host')
│     ├── host == '*.serve.*' → rewrite para /serve/{tplHash}{pathname}
│     └── host == dashboard   → NextResponse.next() (fluxo normal)
│
SERVING ROUTE HANDLER /serve/[tplId]/[[...path]]
│  5. Valida token HMAC: verifica assinatura, expiração, scope (workspaceId+templateId)
│     ├── inválido/expirado → 403
│     └── válido → continua
│  6. Resolve workspaceId e templateId do token (não do URL — prevent spoofing)
│  7. Verifica template.kind === 'VITE_SPA' (guard recíproco D-08)
│     └── kind === 'LIQUID' → 403 "Type boundary violation"
│  8. Determina S3 key: workspaces/{wId}/project-templates/{tplId}/dist/{path}
│     ├── path com extensão (.js/.css/imagem) + objeto não existe → 404
│     └── path sem extensão (rota SPA) OU / → serve index.html (fallback D-07)
│  9. GetObjectCommand → S3 → stream bytes com Content-Type correto
│ 10. Response com headers:
│     Content-Security-Policy: frame-ancestors https://dashboard.pageforge.com
│     Cache-Control: no-store (tokens efêmeros, sem cache público)
│
BROWSER — IFRAME (origem opaca: sem allow-same-origin)
│ 11. SPA carrega; assets em /assets/... resolvem no mesmo host de serving
│ 12. document.cookie === "" (não expõe sessão do dashboard — SC3)
│ 13. JS do SPA não pode acessar window.parent.document (cross-origin)
```

### Recommended Project Structure

```
apps/web/src/
├── proxy.ts                              # Host detection + rewrite (NOVO — substitui middleware.ts)
├── app/
│   ├── serve/
│   │   └── [tplId]/
│   │       └── [[...path]]/
│   │           └── route.ts             # NOVO — serving handler (stream S3 + HMAC validate)
│   └── w/[slug]/
│       └── project-templates/
│           └── [id]/
│               └── preview/
│                   └── page.tsx         # NOVO — dashboard preview page com <iframe>
├── lib/
│   ├── serve/
│   │   ├── token.ts                     # NOVO — mintServeToken + verifyServeToken (HMAC)
│   │   └── serve-vite-spa.ts            # NOVO — lógica de serving (guard + S3 key resolve + fallback)
│   └── project-templates/
│       └── s3-upload.ts                 # EXISTENTE — MIME map reusado aqui
```

### Pattern 1: proxy.ts — Host Detection e Rewrite

**What:** O proxy lê o cabeçalho `Host`, detecta hosts de serving e reescreve para a rota interna.

**When to use:** Toda requisição que chega ao servidor — proxy.ts precisa ser o ponto central.

**Key facts (VERIFIED against Next.js 16 official docs):**
- No Next.js 16, o arquivo se chama `proxy.ts` (não `middleware.ts`, que está depreciado). O projeto ainda não tem nenhum dos dois — este será o primeiro.
- O proxy roda no runtime Node.js por padrão no Next.js 16 (não Edge).
- `NextResponse.rewrite(url)` preserva o host original da request; o filesystem router vê o pathname reescrito.
- O matcher deve excluir `_next/static`, `_next/image`, `favicon.ico` para não interceptar assets internos do Next.js.

```typescript
// apps/web/src/proxy.ts
// Source: Next.js 16 official docs — nextjs.org/docs/app/api-reference/file-conventions/proxy [CITED: nextjs.org/docs]
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Pattern: *.serve.* — matches both prod (*.serve.pageforge.com) and dev (*.serve.localhost)
const SERVE_HOST_RE = /^([a-z0-9-]{1,64})\.serve\./i

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const match = SERVE_HOST_RE.exec(host)

  if (match) {
    const tplId = match[1]
    const url = request.nextUrl.clone()
    // Rewrite to internal serve route, preserving the original path
    // e.g. abc123.serve.localhost:3000/assets/foo.js
    //   → /serve/abc123/assets/foo.js (internal)
    url.pathname = `/serve/${tplId}${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip Next.js internals and static assets of the dashboard
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
```

**Critical caveat:** No Next.js 16, o arquivo se chama `proxy.ts` e a função exportada deve se chamar `proxy` (não `middleware`). O `middleware.ts` ainda funciona para o Edge runtime mas está depreciado. Como o projeto não tem nenhum dos dois, criar diretamente `proxy.ts`.

### Pattern 2: Serving Route Handler com Stream S3

**What:** Catch-all route que valida o token, resolve a chave S3, detecta fallback SPA e streama bytes.

**When to use:** Toda requisição que chega via host de serving após o rewrite do proxy.

```typescript
// apps/web/src/app/serve/[tplId]/[[...path]]/route.ts
// Source: padrão do GetObjectCommand em lib/lps/actions.ts [VERIFIED: codebase]
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { verifyServeToken } from '@/lib/serve/token'
import { resolveS3Key, getContentType, isSpaRoute } from '@/lib/serve/serve-vite-spa.ts'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tplId: string; path?: string[] }> }
) {
  const { tplId, path = [] } = await params
  const filePath = path.join('/') || 'index.html'

  // 1. Validate signed token from query string
  const token = new URL(request.url).searchParams.get('t')
  const claims = token ? verifyServeToken(token) : null
  if (!claims || claims.templateId !== tplId) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // 2. Determine S3 key (fallback: unknown route → index.html)
  const isAsset = /\.[a-zA-Z0-9]+$/.test(filePath)
  const s3Path = isAsset ? filePath : 'index.html'
  const key = `workspaces/${claims.workspaceId}/project-templates/${tplId}/dist/${s3Path}`

  // 3. GetObjectCommand — same pattern as lib/lps/actions.ts
  try {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }))
    const contentType = getContentType(s3Path) // reuses MIME map from s3-upload.ts
    
    // Stream S3 body as Web ReadableStream (Body is AsyncIterable<Uint8Array> in Node.js runtime)
    // Pattern: for await... same as existing actions.ts, but here we pipe to Response
    const webStream = response.Body!.transformToWebStream()
    
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Security-Policy': `frame-ancestors ${process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3000'}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err: unknown) {
    // S3 NoSuchKey → 404 for assets; for SPA routes we already resolved to index.html above
    if (isAsset) return new NextResponse('Not Found', { status: 404 })
    return new NextResponse('Not Found', { status: 404 })
  }
}
```

**Note on `transformToWebStream()`:** O `Body` retornado pelo AWS SDK v3 em Node.js é um `Readable` (Node.js stream) com o mixin `SdkStreamMixin` que adiciona `transformToWebStream()`, `transformToByteArray()` etc. No Next.js 16 (Node.js runtime), `transformToWebStream()` retorna um Web `ReadableStream` que o `NextResponse` aceita diretamente. [CITED: aws.amazon.com/sdk-for-javascript/v3/developer-guide] [VERIFIED: lps/actions.ts usa `for await` no mesmo Body — o mixin está presente]

**Token passagem para assets:** O token está no query-string da URL do iframe (`?t=...`). O SPA (`index.html`) carrega e os assets subsequentes (`/assets/foo.js`) são requisitados pelo browser **sem** o query-string. O handler deve aceitar requests sem token para assets após validação inicial. Solução: token obrigatório apenas para `index.html`; para assets, validar que a chave S3 pertence ao `tplId` da URL (que é não-enumerável por design) — sem sessão, sem cookie, a chave S3 é o segredo implícito. **Alternativa mais segura:** usar cookie de sessão de serving (HttpOnly, SameSite=Strict, escoped ao subdomínio de serving) setado pela resposta do index.html, validado nos assets subsequentes. Ver Pitfall 2 abaixo para a decisão recomendada.

### Pattern 3: Token HMAC — Mint e Verify

**What:** Dashboard minta um token HMAC-SHA256 scoped a `{workspaceId, templateId}` com TTL. Handler verifica sem acesso à sessão.

**When to use:** Dashboard precisa autorizar preview sem compartilhar sessão com a origem isolada.

```typescript
// apps/web/src/lib/serve/token.ts
// Source: padrão HMAC com node:crypto — mesmo que Stripe webhook signing [CITED: dev.to/1xapi]
import { createHmac, timingSafeEqual } from 'node:crypto'

const SECRET = process.env.SERVE_TOKEN_SECRET! // min 32 bytes
const TTL_MS = 30 * 60 * 1000 // 30 minutes

interface ServeClaims {
  workspaceId: string
  templateId: string
  exp: number
}

export function mintServeToken(workspaceId: string, templateId: string): string {
  const payload: ServeClaims = {
    workspaceId,
    templateId,
    exp: Date.now() + TTL_MS,
  }
  const data = JSON.stringify(payload)
  const b64 = Buffer.from(data).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

export function verifyServeToken(token: string): ServeClaims | null {
  try {
    const [b64, sig] = token.split('.')
    if (!b64 || !sig) return null
    const expected = createHmac('sha256', SECRET).update(b64).digest('base64url')
    // Timing-safe comparison to prevent timing attacks
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const claims = JSON.parse(Buffer.from(b64, 'base64url').toString()) as ServeClaims
    if (Date.now() > claims.exp) return null
    return claims
  } catch {
    return null
  }
}
```

**TTL recommendation:** 30 minutos. O preview é interativo (o usuário precisa ver o SPA funcionar); TTL muito curto causa reload inesperado. O token não é para download de recurso único — é para uma sessão de preview. [ASSUMED: 30 min é adequado para o caso de uso; TTL mais curto (5 min) seria mais seguro mas degradaria UX]

**Replay considerations:** Um token válido pode ser reutilizado dentro do TTL. Mitigação: (1) o scope `{workspaceId, templateId}` limita o impacto — não dá acesso a outros templates; (2) o bucket não é público — vazamento do token expõe apenas 1 template por 30 min; (3) para MVP, replay dentro do TTL é aceitável. Nonce/jti para one-time tokens fica para v2.1.

### Pattern 4: SPA Fallback Logic

**What:** Distinguir "rota SPA desconhecida" (serve `index.html`) de "asset genuinamente ausente" (404).

**When to use:** Toda requisição para path no handler de serving.

```typescript
// apps/web/src/lib/serve/serve-vite-spa.ts
// Source: padrão SPA fallback descrito em CONTEXT.md D-07 [VERIFIED: CONTEXT.md]
export function resolveServePath(requestPath: string): { s3Path: string; isFallback: boolean } {
  // Normalize: strip leading slash, default to index.html
  const normalized = requestPath.replace(/^\/+/, '') || 'index.html'
  
  // Has file extension → treat as asset request (not SPA route)
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(normalized)
  
  if (hasExtension) {
    // Asset: serve exactly; S3 NoSuchKey → 404
    return { s3Path: normalized, isFallback: false }
  } else {
    // Extensionless path (SPA route): fallback to index.html
    return { s3Path: 'index.html', isFallback: true }
  }
}
```

**Edge case:** `index.html` itself has an extension — correctly served as-is.
**Edge case:** `/assets/chunk.abc123.js` — has extension, served directly; NoSuchKey → 404.
**Edge case:** `/about` — no extension → serve `index.html` (React Router handles client-side).

### Pattern 5: iframe Sandbox no Dashboard

**What:** `<iframe>` com sandbox restrito + CSP `frame-ancestors` no lado do conteúdo servido.

**When to use:** Preview page do dashboard.

```tsx
// apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx
// Source: MDN iframe sandbox docs [CITED: developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe]
export default async function PreviewPage({ params }) {
  const { slug, id } = await params
  const ctx = await requireWorkspaceRole(slug, ['owner', 'admin', 'editor', 'viewer'])
  
  // Mint token server-side — workspaceId from session (never from client)
  const token = mintServeToken(ctx.workspaceId, id)
  
  // Construct serve origin — uses templateId as subdomain
  const serveOrigin = process.env.NODE_ENV === 'development'
    ? `http://${id}.serve.localhost:${process.env.PORT ?? 3000}`
    : `https://${id}.serve.${process.env.SERVE_DOMAIN}`
  
  const iframeSrc = `${serveOrigin}/?t=${token}`
  
  return (
    <iframe
      src={iframeSrc}
      sandbox="allow-scripts"  // NO allow-same-origin — origin is opaque
      // allow-same-origin is intentionally absent:
      // without it, the iframe's origin is null/opaque, so document.cookie
      // and localStorage are inaccessible, even for the serving subdomain's own cookies.
      // This is the core of PRJ-05 and SC3.
      style={{ width: '100%', height: '80vh', border: 'none' }}
      title="Template Preview"
    />
  )
}
```

**Why `allow-scripts` only:**
- `allow-scripts`: Necessário para o SPA React funcionar (tem JS próprio)
- `allow-same-origin` AUSENTE: Sem este flag, o browser trata o conteúdo do iframe como tendo **origem opaca (null)**. Isso significa: (1) `document.cookie` dentro do iframe é `""` — cookies do PageForge não são expostos; (2) `window.parent.document` lança `SecurityError` — o JS do SPA não pode acessar o DOM do dashboard. [CITED: developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox]

**CSP `frame-ancestors` na resposta do serving handler:**
```
Content-Security-Policy: frame-ancestors http://localhost:3000
```
Isso impede que o conteúdo servido seja embutido por qualquer outra página que não o dashboard. Em produção: `frame-ancestors https://app.pageforge.com`.

### Pattern 6: Guard Recíproco de Tipo (D-08)

**What:** O caminho de serving VITE_SPA rejeita `LIQUID` explicitamente — espelho do guard em `renderLp()`.

**Where:** `lib/serve/serve-vite-spa.ts` — chamado pelo route handler antes de qualquer acesso ao S3.

```typescript
// apps/web/src/lib/serve/serve-vite-spa.ts
// Source: espelha o guard existente em lib/lps/render.ts [VERIFIED: codebase]
export function assertViteSpaKind(kind: string): void {
  if (kind !== 'VITE_SPA') {
    throw new Error(
      `Type boundary violation: only VITE_SPA templates can be served via the isolated serve path. ` +
      `Got kind="${kind}". Use renderLp() for LIQUID templates.`
    )
  }
}
```

**Test extension:** Estender `apps/web/tests/type-boundary.test.ts` com 2 testes:
1. `assertViteSpaKind('LIQUID')` lança "Type boundary violation"
2. `assertViteSpaKind('VITE_SPA')` não lança

O arquivo de teste existente já tem o padrão exato — a extensão é trivial.

### Anti-Patterns to Avoid

- **`allow-same-origin` + `allow-scripts` no mesmo sandbox:** Combinação que anula o sandbox — a página pode remover o atributo `sandbox` de si mesma. Documentado como erro HTML no W3C validator. [CITED: rocketvalidator.com/html-validation]
- **Expor o bucket S3 publicamente:** Qualquer URL S3 se torna enumerável; o prefixo S3 não é segredo suficiente. D-04 manda stream via handler autenticado.
- **Colocar `workspaceId` na URL do serving como parâmetro legível pelo cliente:** O `workspaceId` só deve aparecer dentro do payload assinado do token — nunca no pathname ou query-string legível.
- **Token no cookie ao invés de query-string:** Cookies não cruzam origens sem `SameSite=None; Secure` — impraticável em dev com HTTP. Query-string é mais simples para MVP e não cria risco extra dado que o token é scoped e efêmero.
- **Passar token para assets (`/assets/chunk.js?t=...`):** O browser carrega assets do `index.html` via `<script src="/assets/...">` sem query-string. Tokens em assets não funcionam. Ver seção "Token passagem para assets" acima — recomendação de MVP vs. versão com cookie.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC signing | Algoritmo próprio de assinatura | `node:crypto createHmac('sha256', secret)` | Built-in, timing-safe comparison disponível, zero deps, mesmo padrão do Stripe |
| Host detection | Regex complexa customizada | Pattern simples `/^([a-z0-9-]+)\.serve\./i` com `proxy.ts` | O padrão do subdomain de serving é previsível; não precisa de biblioteca |
| SPA fallback | Servidor dedicado (nginx, express) | Route handler com detecção de extensão | O monolito Next.js já resolve; sem infraestrutura extra |
| Content-Type | Biblioteca `mime-types` nova | Reusar o `MIME` map em `s3-upload.ts` | Já cobre todas as extensões Vite (`html`, `js`, `css`, `png`, `svg`, `ico`, `woff2`) |
| Cross-origin iframe security | Lógica customizada de isolamento | `sandbox="allow-scripts"` sem `allow-same-origin` | Browser enforça natively; `document.cookie` retorna `""` automaticamente |

**Key insight:** O isolamento de cookies não requer código — é uma propriedade do browser quando `allow-same-origin` está ausente. O trabalho real está em garantir que o serving handler nunca setar `Set-Cookie` para cookies de sessão do PageForge.

---

## Common Pitfalls

### Pitfall 1: Token não acompanha requests de assets subsequentes

**What goes wrong:** O iframe carrega `index.html?t={token}` com sucesso. O SPA HTML referencia `/assets/main.abc.js` — o browser emite GET `/assets/main.abc.js` **sem** `?t=`. O handler rejeita com 403 e o SPA não carrega.

**Why it happens:** O browser não propaga query-strings de uma page para sub-recursos. O HTML do Vite usa `<script src="/assets/...">` sem parâmetros.

**How to avoid (MVP recomendado):** Para assets (paths com extensão), o handler **não exige token** — apenas valida que o `tplId` na URL pertence a um template existente e que a chave S3 existe. A não-enumerabilidade das chaves S3 (prefixo opaco = UUID) é a proteção contra enumeração (PRJ-06 D-04). O token protege apenas o acesso inicial ao `index.html`.

**Alternativa mais segura (pós-MVP):** Ao servir `index.html`, o handler seta um cookie `serve-session=<hmac>` com `HttpOnly; SameSite=Strict; Domain=.serve.localhost; Path=/`. Requests de assets incluem o cookie automaticamente. O handler valida o cookie para todos os requests. Exige HTTPS em produção para `Secure`.

**Warning signs:** SPA que carrega `index.html` mas mostra console errors de 403 em `/assets/*.js`.

### Pitfall 2: proxy.ts intercepta assets internos do Next.js dashboard

**What goes wrong:** O matcher do `proxy.ts` não exclui `_next/static/` — o proxy tenta processar assets do build do Next.js como se fossem requests de serving, corrompendo o dashboard.

**Why it happens:** O matcher padrão `/(.*)/` inclui todos os paths, incluindo `/_next/`.

**How to avoid:** Usar o matcher negativo:
```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
```
E verificar `SERVE_HOST_RE` antes de qualquer rewrite — requests ao host do dashboard passam direto com `NextResponse.next()`.

**Warning signs:** Dashboard com CSS quebrado ou erros de carregamento de chunks Next.js.

### Pitfall 3: `allow-same-origin` acidentalmente incluído no sandbox

**What goes wrong:** Desenvolvedor adiciona `allow-same-origin` ao sandbox para resolver um erro de carregamento. Isso anula toda a proteção: o JS do SPA pode acessar `window.parent.document` e roubar o cookie de sessão (se for o mesmo host).

**Why it happens:** Erros de "Access denied" em iframe levam a soluções de "adicionar permissões".

**How to avoid:** O SPA roda em origem diferente (`*.serve.*`) — não é o mesmo host do dashboard. Erros de "Access denied" de cross-origin são **esperados e corretos**. O SPA não precisa de `allow-same-origin` para funcionar — precisa apenas de `allow-scripts` para rodar React.

**Warning signs:** SC3 test falha (document.cookie dentro do iframe expõe sessão do PageForge).

### Pitfall 4: S3 Body stream consumido duas vezes

**What goes wrong:** Handler lê `response.Body` para detectar content-type por magic bytes, depois tenta streamar — o stream já foi consumido.

**Why it happens:** `Body` é um stream Node.js — não é replayable.

**How to avoid:** Derivar o `Content-Type` da extensão do arquivo (MIME map de `s3-upload.ts`), não do conteúdo. O MIME map já cobre todas as extensões Vite. Nunca ler o Body antes de stremar.

**Warning signs:** Requests de assets retornam 200 com corpo vazio.

### Pitfall 5: Firefox não resolve `*.localhost` nativamente

**What goes wrong:** `abc.serve.localhost:3000` não resolve no Firefox — o teste SC3 (`document.cookie`) não pode ser executado nesse browser localmente.

**Why it happens:** Firefox não resolve `*.localhost` por padrão (apenas `localhost` em si). Chrome e Linux/macOS resolvem `*.localhost` via loopback. [CITED: developer.mozilla.org — Firefox limitations]

**How to avoid:** Para desenvolvimento local, usar Chrome/Chromium para testar o fluxo de serving (conforme já validado — `abc.localhost:3000` retorna 200 neste ambiente). Para testar em Firefox, usar `lvh.me` (DNS externo que resolve para `127.0.0.1`) como alternativa: `abc.serve.lvh.me:3000`. Documentar isso no README de setup.

**Warning signs:** Preview funciona no Chrome mas não carrega no Firefox em dev.

### Pitfall 6: CSP `frame-ancestors` sem header HTTP (só meta tag)

**What goes wrong:** `frame-ancestors` definido como `<meta http-equiv="Content-Security-Policy">` no HTML servido — **não funciona**. `frame-ancestors` é ignorado em meta tags; só funciona via HTTP header.

**Why it happens:** Confusão com outros campos do CSP que aceitam meta tag.

**How to avoid:** Sempre setar `Content-Security-Policy: frame-ancestors ...` como **HTTP response header** no route handler de serving, nunca como meta tag no HTML.

**Warning signs:** `frame-ancestors` não tem efeito — conteúdo pode ser embutido em qualquer origem.

---

## Code Examples

### MIME Map Reuse (from s3-upload.ts)

```typescript
// Source: apps/web/src/lib/project-templates/s3-upload.ts [VERIFIED: codebase]
// Reusar exatamente — sem modificação
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME[ext] ?? 'application/octet-stream'
}
```

### S3 Streaming Pattern (from existing lps/actions.ts)

```typescript
// Source: apps/web/src/lib/lps/actions.ts line 597-601 [VERIFIED: codebase]
// Para streaming direto ao Response, usar transformToWebStream() no lugar de chunking manual:
const result = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
const webStream = result.Body!.transformToWebStream()  // SdkStreamMixin method
return new NextResponse(webStream, { headers: { 'Content-Type': contentType } })
```

### HMAC Token — Timing-Safe Compare

```typescript
// Source: node:crypto docs — timingSafeEqual [CITED: nodejs.org/api/crypto]
import { timingSafeEqual } from 'node:crypto'
// Avoid Buffer.from(a) === Buffer.from(b) — NOT timing-safe
// Always use timingSafeEqual for signature comparison
if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
```

### Reciprocal Type Guard Test

```typescript
// Source: apps/web/tests/type-boundary.test.ts [VERIFIED: codebase]
// Padrão existente a estender:
describe('type boundary (V2-11) — serve path', () => {
  it('throws when kind=LIQUID is passed to assertViteSpaKind', () => {
    expect(() => assertViteSpaKind('LIQUID')).toThrow('Type boundary violation')
  })
  it('does NOT throw when kind=VITE_SPA', () => {
    expect(() => assertViteSpaKind('VITE_SPA')).not.toThrow()
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` + `export function middleware()` | `proxy.ts` + `export function proxy()` | Next.js 16 (Oct 2025) [CITED: nextjs.org/blog/next-16] | Projeto não tem nem `middleware.ts` nem `proxy.ts` → criar `proxy.ts` diretamente |
| Middleware em Edge runtime (sem Node.js APIs) | Proxy no Node.js runtime por padrão | Next.js 16 | `node:crypto` disponível no proxy sem workaround |
| `response.Body` como stream puro | `Body.transformToWebStream()` via SdkStreamMixin | AWS SDK v3 (há anos) | Compatível diretamente com `new NextResponse(webStream)` |

**Deprecated/outdated:**
- `middleware.ts`: Depreciado no Next.js 16; ainda funciona mas novo código deve usar `proxy.ts`
- `allow-same-origin` + `allow-scripts` juntos: Combinação documentada como insegura pelo W3C; não usar

---

## Open Questions

1. **Token para assets (após index.html)**
   - What we know: O token no query-string não acompanha requests de assets do SPA automaticamente
   - What's unclear: MVP — sem token para assets (confiar na não-enumerabilidade do UUID do prefixo S3) ou cookie de sessão de serving (mais seguro, requer HTTPS/Secure)?
   - Recommendation: MVP sem token para assets — a chave S3 é o segredo implícito para requests de assets; token obrigatório apenas para `index.html`. Documentar como limitação e planejar cookie-based para pós-MVP quando HTTPS estiver configurado.

2. **`SERVE_TOKEN_SECRET` em ambiente de teste**
   - What we know: A variável env `SERVE_TOKEN_SECRET` precisa existir para `verifyServeToken()` não lançar
   - What's unclear: Como configurar em Vitest para os testes de fronteira do token
   - Recommendation: Exportar um `createTokenUtils(secret: string)` em `token.ts` que recebe o secret como parâmetro — testável sem `process.env`. A versão de produção usa `process.env.SERVE_TOKEN_SECRET!`.

3. **Env var `SERVE_DOMAIN` em produção**
   - What we know: Em dev, o serving origin é `http://{id}.serve.localhost:{PORT}`; em produção é `https://{id}.serve.{SERVE_DOMAIN}`
   - What's unclear: O domínio de produção não está definido ainda (o produto está em desenvolvimento)
   - Recommendation: Usar `SERVE_DOMAIN` como env var; deixar sem valor padrão para forçar configuração explícita em produção. Em dev, `NODE_ENV === 'development'` é o seletor.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker + Docker Compose | MinIO local (S3 emulation) | ✓ | Docker 28.4.0, Compose 2.35.1 [VERIFIED: docker --version] | — |
| Node.js | proxy.ts, route handlers, crypto | ✓ | 22.17.1 [VERIFIED: node --version] | — |
| MinIO (S3 local) | Serving handler + upload test | ✗ (não rodando) | — | `docker compose up` no docker-compose.yml existente |
| PostgreSQL | Lookup de Template.kind no handler | ✓ | 16.14 [VERIFIED: psql --version] | — |
| Next.js dev server | Teste end-to-end do preview | ✓ | 16.2.7 em :3000 [VERIFIED: HTTP 200] | — |
| `*.localhost` resolution | Cross-origin test local (SC3) | ✓ | abc.localhost:3000 → HTTP 200 [VERIFIED: curl] | `lvh.me` (requer rede) |

**Missing dependencies with no fallback:**
- MinIO precisa ser iniciado antes dos testes de serving (`docker compose up minio`)

**Missing dependencies with fallback:**
- Firefox: `*.localhost` não resolve → usar Chrome para testes de serving, ou configurar `lvh.me`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Sim (token de serving) | HMAC-SHA256 com `timingSafeEqual`; TTL de 30 min |
| V3 Session Management | Sim (sessão do dashboard NÃO cruza para serving) | `sandbox="allow-scripts"` sem `allow-same-origin`; CSP `frame-ancestors` |
| V4 Access Control | Sim (cross-tenant isolation) | Token payload `{workspaceId, templateId}` validado contra prefixo S3 |
| V5 Input Validation | Sim (path do arquivo no serving handler) | `path.normalize()` + validação de que o path não escapa o prefixo do template; extensão detectada por regex |
| V6 Cryptography | Sim (HMAC) | `node:crypto createHmac('sha256')`; `timingSafeEqual` para comparação; nunca MD5/SHA1 |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cookie theft via JS do SPA | Information Disclosure | `sandbox="allow-scripts"` sem `allow-same-origin` → `document.cookie === ""` |
| Cross-tenant access (workspace A acessa dist/ de B) | Elevation of Privilege | Token scoped a `{workspaceId, templateId}` + HMAC; handler valida escopo antes de qualquer acesso S3 |
| Path traversal no serving path (`../../../etc/passwd`) | Tampering | Vite build já normaliza paths; handler usa `path.normalize()` e valida que o resultado não começa com `..` |
| Token replay | Repudiation | TTL de 30 min; scope limita impacto a 1 template; nonce/jti para one-time → pós-MVP |
| S3 key enumeration | Information Disclosure | Prefixo S3 contém UUID não-enumerável (`templateId = crypto.randomUUID()` — estabelecido na Fase 6) |
| iframe embedding por terceiros | Tampering | CSP `frame-ancestors` como HTTP header no serving handler |
| Injeção de LIQUID template no path VITE_SPA | Elevation of Privilege | Guard `assertViteSpaKind()` + teste de fronteira |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TTL de 30 minutos é adequado para uma sessão de preview | Pattern 3 / Open Questions | Se muito curto, preview expira durante uso; se muito longo, token roubado tem janela maior. Ajustável. |
| A2 | Assets subsequentes do SPA (após index.html) são servidos sem validação de token no MVP | Pitfall 1 / Open Questions | Se o prefixo S3 for de alguma forma exposto, assets podem ser acessados sem autorização. Mitigado pelo UUID não-enumerável. |
| A3 | `Body.transformToWebStream()` está disponível no AWS SDK v3 no runtime Node.js do Next.js 16 | Pattern 2 | Se o mixin não estiver presente (SDK muito antigo), usar `for await` + `new ReadableStream`. SDK ^3.1064.0 inclui o mixin. |

---

## Sources

### Primary (HIGH confidence)
- `apps/web/src/lib/project-templates/s3-upload.ts` — MIME map, S3 key convention, `templateId = S3 prefix` [VERIFIED: codebase]
- `apps/web/src/lib/project-templates/actions.ts` — S3Client init pattern, `requireWorkspaceRole` usage, workspaceId from session [VERIFIED: codebase]
- `apps/web/src/lib/lps/render.ts` — guard recíproco a espelhar (`kind === 'VITE_SPA'` throw pattern) [VERIFIED: codebase]
- `apps/web/tests/type-boundary.test.ts` — padrão de teste a estender [VERIFIED: codebase]
- `apps/web/src/app/api/lps/[lpId]/export/route.ts` — padrão de route handler com stream + CSP injection [VERIFIED: codebase]
- `apps/web/src/lib/auth/permissions.ts` — `requireWorkspaceRole`, roles (viewer pode fazer preview) [VERIFIED: codebase]
- Next.js 16 docs — `proxy.ts` API, matcher config, `NextResponse.rewrite()` [CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy]
- Next.js 16 release notes — `middleware.ts` depreciado → `proxy.ts`; Node.js runtime por padrão [CITED: nextjs.org/blog/next-16]
- Verificação local: `abc.localhost:3000` → HTTP 200 [VERIFIED: curl]; `*.localhost` resolve para `::1` [VERIFIED: ping]
- Verificação local: Node.js 22.17.1 [VERIFIED: node --version]; next ^16.2.7 [VERIFIED: package.json]

### Secondary (MEDIUM confidence)
- MDN: `sandbox` sem `allow-same-origin` → origem opaca → `document.cookie === ""`; `frame-ancestors` como HTTP header apenas [CITED: developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe]
- AWS SDK v3 docs: `Body.transformToWebStream()` disponível via SdkStreamMixin no Node.js runtime [CITED: docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide]
- W3C / rocketvalidator: `allow-scripts` + `allow-same-origin` combinados é inseguro e documentado como erro HTML [CITED: rocketvalidator.com/html-validation]
- Vercel docs: wildcard subdomains requerem Vercel nameservers para certificado TLS wildcard em produção [CITED: vercel.com/docs/multi-tenant/domain-management]
- `localhost.direct`: wildcard `*.localhost.direct` → `127.0.0.1` com certificado público gratuito para dev HTTPS [CITED: github.com/Upinel/localhost.direct]

### Tertiary (LOW confidence)
- TTL de 30 minutos como recomendação — baseado em analogia com outros sistemas de token efêmero [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todas as bibliotecas verificadas no package.json; nenhuma dependência nova
- Architecture (proxy.ts + route handler): HIGH — padrão verificado contra docs Next.js 16 oficiais; `*.localhost` testado localmente
- Token HMAC scheme: HIGH (mecanismo) / MEDIUM (parâmetros como TTL)
- iframe sandbox security: HIGH — comportamento de `document.cookie` verificado contra MDN
- Pitfalls: HIGH — derivados de análise do código existente e docs oficiais

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (30 dias — stack estável; Next.js 16 minor releases não devem mudar `proxy.ts` API)
