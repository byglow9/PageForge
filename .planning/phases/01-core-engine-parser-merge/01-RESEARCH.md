# Fase 1: Core Engine (Parser + Merge) — Pesquisa

**Pesquisado:** 2026-06-01
**Domínio:** Motor de template seguro (parser de tokens + motor de renderização HTML estático)
**Confiança geral:** HIGH

---

<user_constraints>
## Restrições do Usuário (de 01-CONTEXT.md)

### Decisões Travadas

- **D-01/D-02:** Tipo do token via anotação inline com sufixo de dois-pontos: `{{ hero_title:text }}`, `{{ hero_img:image }}`, `{{ cor_destaque:color }}`. Gramar engine-agnostic — o parser strip a anotação antes de entregar ao backend de renderização.
- **D-03:** Seis tipos de campo: `text`, `richtext`, `image`, `color`, `button`, `repeater`.
- **D-04:** Tolerância: token sem tipo → `text` + parse warning; tipo desconhecido → `text` + parse warning. Nunca crash.
- **D-05:** Schema emitido mínimo: nome do token, tipo detectado, qual repeater/global pertence. Metadados ricos (label, required, default) diferidos para Fase 3.
- **D-06:** Delimitadores de bloco repetível via HTML comment: `<!-- repeat:itinerary --> ... <!-- /repeat:itinerary -->`.
- **D-07:** Tokens dentro de repeater usam escopo implícito de item — o autor escreve `{{ day_title:text }}`, não `itinerary.day_title:text`.
- **D-08:** Repeaters são flat-only no v1 (sem aninhamento).
- **D-09:** Tokens globais/brand usam prefixo reservado: `{{ brand.logo:image }}`, `{{ brand.whatsapp:text }}`, `{{ brand.primary_color:color }}`. Qualquer token sem `brand.` é campo por-LP.
- **D-10 (DEFERRED — mandato de pesquisa):** Escolha do backend de renderização (LiquidJS vs. substituição logic-less) **explicitamente delegada ao researcher**. Ver seção "Benchmark D-10" abaixo.
- **D-11:** Allowlist de sanitização rich-text: `p`, `strong`, `em`, `ul`/`ol`/`li`, `a` (href apenas `http`/`https`/`mailto`), `br`. Sem `script`/`style`/`on*`/`iframe`.
- **D-12:** Escaping DEVE ser context-aware (texto HTML vs. atributo vs. URL vs. cor CSS). Requisito duro.
- **D-13/D-14:** Fixture é a página Grécia real renderizada (via Playwright + snapshot HTML + CSS compilado do Tailwind), depois tokenizada.
- **D-15/D-16:** Prova via Vitest: golden-file snapshot, asserções de schema, corpus de payloads SSTI/XSS contra todos os seis tipos.

### Discrição de Claude

- Ortografia exata das seis palavras-chave de tipo e lista exata de tags rich-text (começar estrito).
- Shape interno do AST / schema, layout de arquivo/módulo e interface parser→adapter.
- Como material de cabeça não-conteúdo no snapshot (gtag, JSON-LD, meta/OG, favicon) é tratado durante tokenização.
- Como imports Vite `@/assets/...` mapeiam para caminhos `src` estáticos no fixture tokenizado.
- Qual variante de componente é canônica se a rota Grécia reutiliza a estrutura compartilhada.

### Ideias Diferidas (FORA DO ESCOPO)

- Repeaters aninhados — flat-only no v1.
- Metadados de schema por campo (label, required, default, ordering) — Fase 3.
- Upload de imagem / reescrita de asset-path para export — Fase 4.
- Autoria e persistência de brand config — Fase 3.
- Allowlist de rich-text estendida (headings, blockquote, imagens inline) — considerado e rejeitado no v1.
- Handling de múltiplas rotas/variantes da SPA de referência — Fase 1 usa só Grécia como fixture.
</user_constraints>

---

<phase_requirements>
## Requisitos da Fase

| ID | Descrição | Suporte da Pesquisa |
|----|-----------|---------------------|
| TPL-02 | Sistema parseia tokens em schema de campos tipados quando o template é salvo | D-01..D-09 documentados; shape Zod recomendado em §Schema; LiquidJS `parseAndAnalyze` para extração |
| TPL-04 | Usuário pode definir blocos repetíveis (repeaters) que agrupam múltiplos campos | D-06/D-07 (sintaxe HTML comment); loop `{% for %}` do LiquidJS ou loop AST próprio; fixture Grécia tem 3+ repeaters |
| GEN-05 | Sistema gera HTML estático fundindo valores preenchidos no markup do template | `parseAndRender` do LiquidJS ou substituição direta de AST; seção §Padrões de Arquitetura |
| GEN-06 | Rich-text e valores de token são sanitizados → HTML gerado livre de scripts injetados (XSS) | sanitize-html v2.17.4 com allowlist estrita; escaping context-aware por tipo de campo; corpus de testes D-16 |
</phase_requirements>

---

## Sumário

Esta fase prova o componente de maior risco do PageForge — `parse(markup) → Schema` e `render(markup, values, brand) → HTML estático` — contra o template real Grécia, sem UI. O único entregável tangível são dois módulos TypeScript (`parser.ts`, `renderer.ts`) e uma suite Vitest com fixture derivada da SPA de referência.

**A decisão central (D-10)** é o backend de renderização. A pesquisa examinou ambos os candidatos com o mesmo corpus de ameaças. A **recomendação é LiquidJS** (detalhes em §Benchmark D-10), mas a gramática do autor (D-01..D-09) é intencionalmente engine-agnostic, de modo que o swap de backend é barato se o usuário preferir a rota logic-less.

**Ponto crítico de segurança descoberto:** LiquidJS teve duas CVEs recentes que afetam `ownPropertyOnly` (o mecanismo central de defesa contra prototype pollution). Ambas estão corrigidas — CVE-2022-25948 em v10.0.0, CVE-2026-39412 (bypass via `sort_natural`) em v10.25.4, e um terceiro bypass via `Context.spawn()` corrigido na v10.25.4. O npm atualmente distribui v10.27.0 (verificado via `npm view liquidjs version`). Usar v10.27.0 com `ownPropertyOnly: true` (default) e `outputEscape: 'escape'` é seguro para o modelo de ameaças desta fase.

**Recomendação primária:** Usar LiquidJS v10.27.0 com `outputEscape: 'escape'` + `ownPropertyOnly: true` para renderização; sanitize-html v2.17.4 para rich-text; Zod v4.4.3 para validação do schema; Vitest v4.1.8 para testes — sem Next.js, Prisma ou banco de dados nesta fase.

---

## Mapa de Responsabilidade Arquitetural

| Capability | Tier Primário | Tier Secundário | Rationale |
|------------|--------------|-----------------|-----------|
| Parsing de tokens (D-01..D-09) | Biblioteca Node pura | — | Função pura, sem I/O; importável por qualquer consumidor |
| Emissão de schema | Biblioteca Node pura | — | Schema como valor de dados; validado por Zod |
| Renderização / merge | Biblioteca Node pura | — | Servidor-only (nunca cliente); mesma função para preview e export |
| Sanitização rich-text | Biblioteca Node pura | — | sanitize-html é Node-first por design |
| Escaping context-aware | Biblioteca Node pura | — | Parte do pipeline de renderização, não do cliente |
| Testes de fixture/snapshot | Vitest (Node) | — | Sem browser/jsdom nesta fase (nenhum componente React) |
| Snapshot da SPA de referência | Playwright + Vite dev | — | Para gerar o fixture HTML; não parte do engine em si |

---

## Stack Standard

### Core (Fase 1 — sem Next, Prisma, DB)

| Biblioteca | Versão | Propósito | Por Que Standard |
|------------|--------|-----------|-----------------|
| **liquidjs** | 10.27.0 | Motor de template seguro para render/merge | [VERIFIED: npm registry] — sem execução de código, escaping automático, loop nativo, isomórfico |
| **zod** | 4.4.3 | Validação do schema emitido e dos valores de entrada | [VERIFIED: npm registry] — tipos gerados servem todo o pipeline |
| **sanitize-html** | 2.17.4 | Sanitização server-side de rich-text antes de entrar no HTML final | [VERIFIED: npm registry] — Node-first, allowlist configurável |
| **vitest** | 4.1.8 | Framework de testes | [VERIFIED: npm registry] — `toMatchFileSnapshot` para golden-file HTML |
| **typescript** | 5.x | Tipagem estática | [ASSUMED] — já definido em CLAUDE.md como não-negociável |

### Ferramentas de Desenvolvimento

| Ferramenta | Propósito | Notas |
|-----------|-----------|-------|
| **pnpm** | Package manager | [ASSUMED] — padrão para setups Next.js modernos per CLAUDE.md |
| **tsx / ts-node** | Executar scripts TS no Node | Para scripts auxiliares de fixture |
| **@types/sanitize-html** | Tipos TypeScript | Incluído no pacote desde v2.x |

### Instalação (só Fase 1)

```bash
pnpm add liquidjs zod sanitize-html
pnpm add -D vitest typescript tsx @types/node
```

---

## Benchmark D-10: LiquidJS vs. Substituição Logic-Less

> Esta seção é o entregável central da pesquisa (D-10). Ambos os candidatos são avaliados contra o mesmo corpus de ameaças.

### Corpus de Ameaças (D-16)

Payloads avaliados contra CADA tipo de campo (text, richtext, image, color, button, e dentro de repeater):

| # | Payload | Categoria |
|---|---------|-----------|
| P1 | `{{constructor.constructor('return process.env')()}}` | SSTI / RCE via prototype |
| P2 | `{{__proto__.polluted}}` | Prototype pollution read |
| P3 | `"><img src=x onerror=alert(1)>` | XSS via HTML break-out |
| P4 | `javascript:alert(1)` | XSS via URL scheme em href/src |
| P5 | `expression(alert(1))` | CSS injection via IE legacy |
| P6 | `#fff; background:url(javascript:alert(1))` | CSS injection polyglot |
| P7 | `<script>alert(1)</script>` | Unicode-bypass XSS |
| P8 | `" onmouseover="alert(1)` | Attribute break-out |
| P9 | `data:text/html,<script>alert(1)</script>` | data: URI XSS |
| P10 | `\x00<script>alert(1)</script>` | Null-byte injection |

### Caminho A — LiquidJS

**Mecanismo:** O parser da PageForge converte o markup engine-agnostic para Liquid puro:
- `{{ hero_title:text }}` → `{{ hero_title }}`
- `<!-- repeat:roteiro -->...<!-- /repeat:roteiro -->` → `{% for item in roteiro %}...{% endfor %}`
- Tokens brand (`{{ brand.whatsapp:text }}`) → variável `{{ brand.whatsapp }}`

O engine LiquidJS então renderiza com:
```typescript
// Source: Context7 /harttle/liquidjs
const engine = new Liquid({
  outputEscape: 'escape',   // auto-escapa {{ }} para HTML
  ownPropertyOnly: true,    // bloqueia acesso a prototype (default = true)
  strictVariables: false,   // undefined → '' (sem crash)
  strictFilters: false,
});
```

**Análise de segurança por payload:**

| Payload | Contexto: text | Contexto: atributo | Contexto: URL (href) | Contexto: color (CSS) | Resultado |
|---------|---------------|-------------------|---------------------|----------------------|-----------|
| P1 `{{constructor...}}` | LiquidJS não parseia `{{constructor...}}` como token válido — `constructor` não é uma variável no scope fornecido; `ownPropertyOnly: true` bloqueia acesso a propriedades de prototype | `{{constructor...}}` no valor de atributo seria escapado pelo escaping de saída | Não aplicável (URL vem do campo `button`) | Não aplicável | INERTE — `{{...}}` de autoria Liquid é compilado pelo parser PageForge; no contexto de valor de campo, o valor é passado como dado, não como template Liquid adicional [VERIFIED: Context7 + CVE history] |
| P2 `{{__proto__...}}` | Mesmo mecanismo: `__proto__` não é variável no scope; `ownPropertyOnly: true` bloqueia mesmo que estivesse | Escapado | N/A | N/A | INERTE [VERIFIED: CVE-2022-25948 patched em v10.0.0; v10.27.0 inclui patches de v10.25.4] |
| P3 `"><img...>` | `outputEscape: 'escape'` converte `"` → `&quot;`, `<` → `&lt;`, `>` → `&gt;` | Mesmo escaping | Bloqueado por validação de URL | Bloqueado por validação de cor | INERTE [VERIFIED: Context7 escaping tutorial] |
| P4 `javascript:alert(1)` | Escapado como texto | Escapado | **REQUER validação explícita no campo `button`** — LiquidJS NÃO bloqueia `javascript:` em URLs; isso precisa ser tratado na camada do renderer | N/A | PARCIAL — ver §Escaping Context-Aware |
| P5 `expression(alert(...))` | Escapado | Escapado | N/A | **REQUER validação de allowlist CSS** — LiquidJS não valida semântica CSS | Bloqueado por regex de validação de cor | REQUER validação adicional |
| P6-P10 | Cobertos pelo `outputEscape: 'escape'` para contextos HTML text/attr | Cobertos | Allowlist de scheme para URL | Regex de allowlist para cor CSS | INERTE com medidas adicionais |

**Casos especiais LiquidJS:**
- Rich-text: o campo `richtext` usa `| raw` para injetar HTML sem escaping adicional do Liquid — a sanitização via `sanitize-html` DEVE ocorrer ANTES de passar o valor para o render. [CITED: Context7 /harttle/liquidjs raw filter doc]
- Brand globals: passados como escopo top-level `{ brand: { whatsapp: '...', logo: '...' } }`, protegidos pelo mesmo `ownPropertyOnly: true`.
- Repeaters com 0 itens: `{% for item in [] %}{% endfor %}` renderiza string vazia — o template HTML estático fica com o bloco vazio mas estruturalmente válido. [VERIFIED: Context7 for-loop doc — `else` opcional]

**CVEs relevantes (TODAS corrigidas na v10.27.0):**
- CVE-2022-25948 (CVSS 5.3): `ownPropertyOnly: false` vaza prototype — corrigido em v10.0.0. [CITED: github.com/advisories/GHSA-45rm-2893-5f49]
- CVE-2026-39412: `sort_natural` bypass de `ownPropertyOnly` — corrigido em v10.25.4. [CITED: advisories.gitlab.com/pkg/npm/liquidjs/CVE-2026-39412]
- CVE-2026-44646: `Context.spawn()` no `{% render %}` tag ignora `ownPropertyOnly` per-render — corrigido em v10.25.4. [CITED: advisories.gitlab.com/npm/liquidjs/CVE-2026-44646]
- v10.26.0: bloqueio de `Object.prototype` filter/tag lookups (RCE) — patch adicional. [CITED: liquidjs.com/tutorials/changelog.html]

**Vantagens do Caminho A:**
- Nenhum interpretador de iteração precisou ser escrito — `{% for item in repeater %}` funciona imediatamente
- `parseAndAnalyze()` da LiquidJS pode listar variáveis globais para verificação cruzada com o schema emitido pelo parser
- A gramática `{{ token }}` é familiar para autores que conhecem Shopify/Jekyll
- Loops zero/N/1 item nativos sem lógica adicional
- `outputEscape: 'escape'` é opt-in explícito e documentado

**Desvantagens do Caminho A:**
- Uma dependência a mais (runtime do LiquidJS, ~180 KB gzipped)
- Rich-text DEVE ter `| raw` no template compilado + sanitize-html antes — dois passos que exigem coordenação
- Histórico de CVEs (3 em 2022-2026), embora todas corrigidas em v10.27.0
- `javascript:` em URLs e validação de cor CSS requerem lógica adicional no renderer — LiquidJS não cobre esses contextos

---

### Caminho B — Substituição Logic-Less (AST próprio)

**Mecanismo:** O parser PageForge constrói um AST próprio (nó de texto, nó de token, nó de repeater), e o renderer percorre o AST substituindo diretamente com valores escapados. Não há engine de template externo — o código faz apenas substituição de string com escaping explícito por contexto de nó.

```typescript
// Conceitual — sem eval, sem Function, sem vm
type ASTNode =
  | { kind: 'text'; raw: string }
  | { kind: 'token'; name: string; type: FieldType; context: EscapeContext }
  | { kind: 'repeater'; name: string; items: ASTNode[] };

function render(ast: ASTNode[], values: Values, brand: Brand): string {
  return ast.map(node => renderNode(node, values, brand)).join('');
}
```

**Análise de segurança por payload:**

| Payload | Resultado |
|---------|-----------|
| P1 `{{constructor...}}` | Nó de token parseado pelo parser PageForge; no contexto de valor, o valor é uma string passada pelo usuário — `escapeHtml(value)` retorna `{{constructor...}}` literalmente escapado | INERTE |
| P2 `{{__proto__...}}` | Mesmo mecanismo — é apenas uma string de valor, não execução | INERTE |
| P3-P10 | Escaping explícito por contexto: `escapeHtmlText`, `escapeHtmlAttr`, `sanitizeUrl`, `sanitizeCssColor` | INERTE com implementação correta |
| Todos SSTI | **Seguro por construção** — nenhum motor de template interage com valores de usuário como templates. Sem `eval`, sem `Function`, sem `vm`. | INERTE estruturalmente |

**Vantagens do Caminho B:**
- Zero dependência de motor de template em runtime
- SSTI impossível por construção — valores de usuário nunca são interpretados como código
- Total controle sobre cada ponto de escaping — sem surpresas de biblioteca
- Sem histórico de CVEs de terceiros para monitorar
- Mais simples de auditar para segurança (todo o escaping está em um arquivo)

**Desvantagens do Caminho B:**
- Loop de repeater, escopo de variável, e iteração zero/N precisam ser escritos do zero (~100-200 linhas)
- Sem `parseAndAnalyze()` nativo para verificar schema — o parser precisa fazer esse trabalho
- Mais surface para bugs de escaping personalizado se mal implementado
- Manutenção de edge cases de iteração (ex: `forloop.first`, `forloop.last` se necessários no futuro)
- Requer mais testes unitários do próprio mecanismo de iteração

---

### Veredicto D-10: RECOMENDAÇÃO LiquidJS (Caminho A)

**Justificativa:**

1. **O argumento central do Caminho B (SSTI impossível por construção) não se aplica ao modelo de ameaças real.** No PageForge, `{{ valor_do_usuario }}` já foi processado pelo parser — o Liquid processa o **template compilado pelo parser**, não strings brutas de usuário. O usuário preenche *valores* de campo (dados), não *templates*. A SSTI via `{{constructor...}}` é relevante se o template Liquid for construído concatenando input não-confiável — o que nosso modelo explicitamente proíbe. Passando valores como contexto de dados (o padrão correto), LiquidJS não os interpreta como templates.

2. **O loop de repeater já está resolvido.** `{% for item in repeater %}...{% endfor %}` com 0, 1 e N items funciona imediatamente sem escrever um intérprete de iteração. Dado que repeaters são a feature de maior risco de implementação nesta fase, eliminar essa superfície de erro é significativo.

3. **CVEs corrigidas, versão atual segura.** A v10.27.0 inclui patches para todos os problemas de `ownPropertyOnly` conhecidos (v10.25.4+) e o patch RCE de `Object.prototype` (v10.26.0). Com `ownPropertyOnly: true` (default) e `outputEscape: 'escape'`, o engine está corretamente configurado.

4. **`parseAndAnalyze()` da LiquidJS** permite verificação cruzada do schema emitido pelo parser contra as variáveis que o engine espera — uma camada extra de consistência.

5. **Troca é barata.** A gramática (D-01..D-09) é engine-agnostic por design. Se uma nova CVE crítica surgir no LiquidJS que não possa ser mitigada, mudar para o Caminho B requer alterar apenas o adapter de compilação (`compileToLiquid.ts`) sem tocar na gramática do autor ou nos testes de schema.

**Condição para reversão:** Se o usuário tiver restrição contra dependências de runtime de template, o Caminho B é viável — e esta pesquisa documenta os requisitos completos para implementá-lo com segurança.

---

## Escaping Context-Aware (D-12)

### Contextos por Tipo de Campo

| Tipo de Campo | Contexto de Saída | Mecanismo de Escaping |
|--------------|------------------|-----------------------|
| `text` | HTML body ou atributo de texto (`alt`, `title`, `aria-label`) | `outputEscape: 'escape'` do LiquidJS — escapa `<>&"'` para entidades HTML [VERIFIED: Context7] |
| `richtext` | HTML body como HTML raw | `{{ valor | raw }}` no template compilado + `sanitize-html` **antes** de passar o valor ao render (ver §D-11) |
| `image` | Atributo `src` de `<img>` | Validação de URL + `outputEscape` para atributo; rejeitar `javascript:` e `data:` |
| `color` | Valor de propriedade CSS (ex: `style="color: {{ cor_destaque }}"` ou variável CSS) | Validação por regex de allowlist; rejeitar tudo que não for hex/rgb/hsl/named color |
| `button` | Atributo `href` de `<a>` | Validação de esquema de URL: allowlist `http`, `https`, `mailto`, `tel`; rejeitar `javascript:`, `data:`, `vbscript:` |
| `repeater` | Contém itens com os tipos acima | O loop não injeta HTML — os tipos internos usam seus próprios escapings |

### Implementação de Referência: Validação de URL

```typescript
// Para campos `button` e `image` (src)
// REQUER verificação explícita — LiquidJS não bloqueia javascript: em URLs
const ALLOWED_URL_SCHEMES = /^(https?:\/\/|mailto:|tel:)/i;

function sanitizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (!ALLOWED_URL_SCHEMES.test(trimmed)) {
    // Rejeitar: retornar '#' ou '' (nunca o valor original)
    return '#';
  }
  return trimmed; // outputEscape do LiquidJS escapa chars HTML quando inserido como atributo
}
```

### Implementação de Referência: Validação de Cor CSS

```typescript
// Para campo `color` — allowlist de formatos válidos
// Source: OWASP XSS Prevention Cheat Sheet + MediaWiki CSS whitelist approach
const CSS_COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|hsl\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*\)|hsla\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*,\s*[\d.]+\s*\)|[a-z]+)$/i;

function sanitizeCssColor(raw: string): string {
  const trimmed = raw.trim();
  if (!CSS_COLOR_PATTERN.test(trimmed)) {
    return ''; // Cor inválida → vazio (usa fallback do CSS)
  }
  // Adicionalmente rejeitar qualquer ocorrência de '(' não precedida por rgb/rgba/hsl/hsla
  if (/expression|url|javascript|import/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}
```

### Implementação de Referência: Template Compilado com Contextos

```liquid
<!-- Campos text em body HTML — escapados automaticamente por outputEscape -->
<h1>{{ hero_titulo }}</h1>

<!-- Campo text em atributo — escapado automaticamente por outputEscape -->
<img src="{{ hero_img }}" alt="{{ hero_img_alt }}">

<!-- Campo richtext — DEVE usar | raw; sanitize-html já limpou o valor ANTES do render -->
<div class="descricao">{{ sobre_texto | raw }}</div>

<!-- Campo button — href já validado pelo sanitizeUrl() antes de chegar ao render -->
<a href="{{ cta_url }}" class="btn">{{ cta_texto }}</a>

<!-- Campo color — valor já validado por sanitizeCssColor() -->
<div style="--brand-primary: {{ brand.primary_color }}">...</div>

<!-- Repeater com escopo implícito de item -->
{% for item in roteiro %}
<div class="card">
  <img src="{{ item.imagem }}" alt="{{ item.titulo }}">
  <h3>{{ item.titulo }}</h3>
  <p>{{ item.descricao }}</p>
</div>
{% endfor %}
```

---

## Sanitização Rich-Text (D-11)

### Configuração Recomendada — sanitize-html

```typescript
// Source: Context7 /websites/npmjs_package_sanitize-html + CONTEXT.md D-11
import sanitizeHtml from 'sanitize-html';

export const RICHTEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'strong', 'em', 'b', 'i',
    'ul', 'ol', 'li',
    'a',
    'br',
  ],
  allowedAttributes: {
    'a': ['href'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    'a': ['http', 'https', 'mailto'],
  },
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,   // rejeitar //example.com (pode virar http: ou https:)
  disallowedTagsMode: 'discard',  // remover tags não permitidas (padrão)
  enforceHtmlBoundary: true,      // prevenir conteúdo fora do HTML boundary
  parseStyleAttributes: false,    // NÃO parsear atributos style (vetor CSS injection)
};

// Uso: SEMPRE sanitizar ANTES de passar ao render
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICHTEXT_SANITIZE_OPTIONS);
}
```

**Por que não incluir `img`, `h1-h6`, `blockquote`:**
- D-11 travou: "começar estrito" — esses são diferidos para revisão futura
- `img` com `src` em rich-text abre vetor de data: URI XSS
- Headings e blockquotes são discrição do usuário para expandir na Fase 3

**Sequência de processamento obrigatória:**
```
valor richtext bruto do usuário
  → sanitize-html (remove scripts, on*, iframes, tags não permitidas)
  → passar para render() como valor de { sobre_texto: sanitizedValue }
  → template Liquid usa {{ sobre_texto | raw }} para saída sem re-escaping
```

**Nunca:** passar raw HTML ao Liquid sem sanitizar, ou sanitizar depois do render.

---

## Design do Parser (D-01..D-09)

### Algoritmo de Parsing

O parser opera sobre o HTML do template como string pura (não como DOM) — mais simples e portável.

**Fase 1: Localizar repeaters via regex de comment**

```typescript
// Source: CONTEXT.md D-06 — delimitadores HTML comment
const REPEAT_OPEN  = /<!--\s*repeat:(\w+)\s*-->/g;
const REPEAT_CLOSE = /<!--\s*\/repeat:(\w+)\s*-->/g;
```

**Fase 2: Localizar tokens via regex inline**

```typescript
// Source: CONTEXT.md D-01/D-02 — anotação colon-suffix
// Captura: nome do token + tipo opcional
const TOKEN_PATTERN = /\{\{\s*([\w.]+)(?::(\w+))?\s*\}\}/g;
// Grupo 1: nome (ex: "hero_titulo", "brand.logo")
// Grupo 2: tipo (ex: "text", "image", "color") — pode ser undefined
```

**Fase 3: Classificação de tipo com degradação tolerante (D-04)**

```typescript
const VALID_TYPES = new Set(['text', 'richtext', 'image', 'color', 'button', 'repeater']);

function resolveType(raw: string | undefined, tokenName: string): { type: FieldType; warnings: string[] } {
  const warnings: string[] = [];
  if (!raw) {
    warnings.push(`Token "${tokenName}" sem tipo — usando "text"`);
    return { type: 'text', warnings };
  }
  if (!VALID_TYPES.has(raw)) {
    warnings.push(`Token "${tokenName}" tem tipo desconhecido "${raw}" — usando "text"`);
    return { type: 'text', warnings };
  }
  return { type: raw as FieldType, warnings };
}
```

**Fase 4: Namespace brand vs. campo LP (D-09)**

```typescript
function isBrandToken(name: string): boolean {
  return name.startsWith('brand.');
}
// brand.logo → token global, não inclui no schema por-LP
// hero_titulo → campo por-LP
```

### Shape do Schema (Zod) — D-05

```typescript
// Source: CONTEXT.md D-05 + recomendação do researcher
import { z } from 'zod';

export const FieldTypeSchema = z.enum(['text', 'richtext', 'image', 'color', 'button', 'repeater']);

export const TokenFieldSchema = z.object({
  name:      z.string(),           // ex: "hero_titulo"
  type:      FieldTypeSchema,      // tipo detectado
  repeater:  z.string().nullable(), // nome do repeater pai, ou null para campos top-level
  global:    z.boolean(),          // true se brand.*
});

export const ParseWarningSchema = z.object({
  token:   z.string(),
  message: z.string(),
});

export const ParsedSchemaSchema = z.object({
  fields:   z.array(TokenFieldSchema),
  repeaters: z.array(z.string()),   // nomes únicos de repeaters encontrados
  globals:  z.array(z.string()),    // nomes de tokens brand.* (sem o prefixo "brand.")
  warnings: z.array(ParseWarningSchema),
});

export type FieldType    = z.infer<typeof FieldTypeSchema>;
export type TokenField   = z.infer<typeof TokenFieldSchema>;
export type ParsedSchema = z.infer<typeof ParsedSchemaSchema>;
```

### Interface Pública do Engine

```typescript
// parse(markup) → Schema  [TPL-02]
export function parse(markup: string): ParsedSchema;

// render(markup, values, brand) → HTML estático  [GEN-05]
// Nota: valores richtext JÁ devem ter passado por sanitizeRichText() antes de chamar render()
export async function render(
  markup: string,
  values: Record<string, unknown>,
  brand: Record<string, unknown>
): Promise<string>;
```

---

## Padrões de Arquitetura

### Diagrama de Fluxo

```
Markup do template (string HTML com tokens + comment-repeaters)
          │
          ▼
   ┌─────────────┐
   │  PARSER     │  1. Extrai repeater blocks via comment regex
   │  parse()    │  2. Extrai tokens via {{ name:type }} regex
   │             │  3. Resolve tipo (tolera unknown → text + warning)
   │             │  4. Classifica brand.* vs campo LP
   └──────┬──────┘
          │  ParsedSchema (Zod-validated)
          ▼
   ┌─────────────────────────┐
   │  COMPILADOR LIQUID      │  Converte markup para Liquid puro:
   │  compileToLiquid()      │  • Strip :type annotations
   │                         │  • <!-- repeat:X --> → {% for item in X %}
   │                         │  • <!-- /repeat:X --> → {% endfor %}
   │                         │  • Tokens dentro de repeater → {{ item.campo }}
   └──────┬──────────────────┘
          │  Template Liquid compilado
          ▼
   ┌─────────────────────────────────────────────────────┐
   │  RENDERER  render()                                  │
   │                                                      │
   │  1. Pre-processa valores:                            │
   │     • richtext → sanitizeRichText() [sanitize-html] │
   │     • button URL → sanitizeUrl()                    │
   │     • color → sanitizeCssColor()                    │
   │                                                      │
   │  2. Monta scope: { ...values, brand }                │
   │                                                      │
   │  3. LiquidJS.parseAndRender(liquidTemplate, scope)  │
   │     com outputEscape:'escape', ownPropertyOnly:true │
   │                                                      │
   │  4. Retorna HTML estático                            │
   └──────┬──────────────────────────────────────────────┘
          │  HTML estático (string)
          ▼
     <output final — sem scripts, sem XSS>
```

### Estrutura de Arquivos Recomendada

```
src/engine/
├── parser.ts          # parse(markup) → ParsedSchema
├── compiler.ts        # compileToLiquid(markup, schema) → string Liquid
├── renderer.ts        # render(markup, values, brand) → Promise<string>
├── sanitizers.ts      # sanitizeRichText, sanitizeUrl, sanitizeCssColor
├── schema.ts          # Tipos Zod + tipos TypeScript exportados
└── index.ts           # Re-export da API pública

tests/engine/
├── parser.test.ts          # Schema assertions (todos os 6 tipos, repeaters, globals)
├── renderer.test.ts        # Snapshot golden-file (fixture Grécia)
├── security.test.ts        # Corpus SSTI/XSS (D-16)
└── __snapshots__/
    └── grecia.output.html  # Golden file (gerado na Wave 0)

tests/fixtures/
├── grecia-template.html    # Markup tokenizado derivado da SPA de referência
└── grecia-values.ts        # Valores de teste para a fixture Grécia
```

### Padrão 1: Compilação Engine-Agnostic → Liquid

**O quê:** O markup do autor (`{{ campo:text }}`, `<!-- repeat:X -->`) nunca é passado diretamente ao LiquidJS. O compilador é a camada intermediária que produz Liquid limpo.

**Quando usar:** Sempre — toda chamada a `render()` passa pelo compilador.

```typescript
// Source: CONTEXT.md D-02 + D-06 + recomendação do researcher
export function compileToLiquid(markup: string): string {
  return markup
    // 1. Remover anotações de tipo dos tokens
    .replace(/\{\{\s*([\w.]+):\w+\s*\}\}/g, '{{ $1 }}')
    // 2. Converter delimitadores de repeater (ANTES de tokens dentro do repeater)
    .replace(/<!--\s*repeat:(\w+)\s*-->/g, '{% for item in $1 %}')
    .replace(/<!--\s*\/repeat:(\w+)\s*-->/g, '{% endfor %}')
    // 3. Tokens dentro de repeater já usam {{ item.campo }} implicitamente?
    // NOTA: Conforme D-07, o parser já bindou os tokens ao escopo do item.
    // O compilador deve reescrever tokens dentro de repeaters como {{ item.campo }}.
    // Isso requer conhecer quais tokens estão dentro de cada repeater — use o ParsedSchema.
    ;
}
```

**Observação importante sobre D-07 e compilação:** Tokens dentro de um repeater precisam ser reescritos como `item.campo` no template Liquid. Isso requer que o compilador receba o `ParsedSchema` para saber quais tokens pertencem a qual repeater. A assinatura real do compilador será:

```typescript
export function compileToLiquid(markup: string, schema: ParsedSchema): string;
```

### Anti-Padrões a Evitar

- **Nunca** passar o markup bruto do autor diretamente ao LiquidJS sem compilar — o autor usa nossa gramática (`:type`), não Liquid.
- **Nunca** usar `| raw` sem ter passado pelo `sanitizeRichText()` antes — abre XSS stored.
- **Nunca** confiar em `outputEscape: 'escape'` para URLs — não bloqueia `javascript:`.
- **Nunca** usar `ownPropertyOnly: false` — desfaz a defesa principal contra prototype pollution.
- **Nunca** construir o template Liquid concatenando valores do usuário — os valores são SEMPRE passados como contexto de dados.

---

## Não Construa Do Zero

| Problema | Não Construir | Usar | Por Quê |
|----------|--------------|------|---------|
| Iteração de loop com 0/N itens | Seu próprio intérprete de loop | `{% for item in X %}` do LiquidJS | Edge cases de índice, `forloop.first/last`, iteração vazia |
| Sanitização HTML | Seu próprio parser HTML | `sanitize-html` v2.17.4 | Parser HTML correto é extremamente difícil; bypassos por malformed HTML são documentados |
| Escaping HTML geral | `str.replace(/</g, ...)` | `outputEscape: 'escape'` do LiquidJS | Edge cases de entidades, atributos vs body, encoding layers |
| Validação de schema | Validação manual | Zod v4.4.3 | Tipos gerados, erros de runtime, composição |

---

## Derivação do Fixture Grécia (D-13/D-14)

### Arquitetura da SPA de Referência

A rota `/grecia` da SPA (`renova-turismo-jornada-main/`) usa componentes **Grécia-específicos** em `src/components/campaigns/grecia/`, não os componentes `src/components/landing/` genéricos. Os componentes relevantes são:

| Componente | Seção | Tipo de Conteúdo Dinâmico | Repeater? |
|-----------|-------|--------------------------|-----------|
| `Navbar.tsx` | Navegação | Fixo (estrutura do nav) + `brand.whatsapp` (URL) | Não |
| `Hero.tsx` | Hero | `floatingCards` array (3 cards), hero image, textos estáticos da Grécia | **Sim** (3 cards de destaque) |
| `SobreViagem.tsx` | Sobre | 3 info-cards (Quando/Destinos/Partida), textos descritivos | Sim (3 cards, podem virar repeater) |
| `Inclusos.tsx` | Inclusos | `items` array (6 itens) com título + texto | **Sim** (6 itens de incluso) |
| `Roteiro.tsx` | Roteiro | `slides` array (7 slides de itinerário) com image, day, title, description, highlight | **Sim** (7 slides de roteiro) |
| `PorQueRenova.tsx` | Por Que Renova | `reasons` array (5 motivos) com título + texto | **Sim** (5 razões) |
| `Depoimentos.tsx` | Depoimentos | `testimonials` array (3 depoimentos) com nome, localidade, quote | **Sim** (3 depoimentos) |
| `InscrevaSe.tsx` | CTA/Contato | Textos de CTA + `brand.whatsapp` (URL do WhatsApp) | Não |
| `Footer.tsx` | Footer | Logo, social links, contato — brand globals | Não |

**Tokens globais/brand identificados na SPA:**
- `brand.whatsapp` → número de WhatsApp (`5519992016125` para Grécia) — aparece em Navbar, Roteiro, InscrevaSe
- `brand.logo` → `logo-renova.svg` — aparece em Navbar e Footer
- `brand.instagram` / `brand.facebook` / `brand.youtube` → links sociais no Hero e Footer
- `brand.email` / `brand.phone` → contato no Footer

**Tokens de campo LP identificados (exemplos):**
- `hero_titulo:text` (ex: "Explore a Grécia Eterna")
- `hero_subtitulo:text` (ex: "Renova Turismo apresenta")
- `hero_descricao:richtext`
- `hero_imagem:image`
- `cta_primary_label:text` / `cta_primary_url:button`
- `sobre_descricao_1:richtext` / `sobre_descricao_2:richtext`
- Repeater `destaques` com itens `{ imagem:image, titulo:text, descricao:richtext }`
- Repeater `inclusos` com itens `{ titulo:text, descricao:text }`
- Repeater `roteiro` com itens `{ imagem:image, dia:text, regiao:text, regiao_en:text, titulo:text, descricao:richtext, destaque:text }`
- Repeater `diferenciais` com itens `{ titulo:text, descricao:text }`
- Repeater `depoimentos` com itens `{ nome:text, localidade:text, quote:richtext }`

### Estratégia de Captura de Fixture (D-14)

**Opção recomendada — Script Playwright externo ao PageForge:**

O projeto `renova-turismo-jornada-main/` já tem Playwright configurado (via `lovable-agent-playwright-config`). Criar um script Node.js no PageForge que:

1. Sobe o servidor Vite da SPA de referência em modo dev (`vite --port 5173`)
2. Usa Playwright para navegar para `http://localhost:5173/grecia`
3. Aguarda `networkidle` e a renderização completa
4. Captura `page.content()` (HTML renderizado pós-hydration)
5. Captura o CSS compilado pelo Tailwind (via `<style>` tags injetadas pelo Vite no dev mode, ou via arquivo `dist/assets/index.css` após `vite build`)

```typescript
// scripts/generate-fixture.ts (executado uma vez)
import { chromium } from 'playwright';
import { exec } from 'child_process';
import { writeFileSync } from 'fs';

async function generateFixture() {
  // 1. Build da SPA de referência para capturar CSS compilado
  // vite build em renova-turismo-jornada-main/ → dist/

  // 2. Navegar com Playwright
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/grecia');
  await page.waitForLoadState('networkidle');

  // 3. Capturar HTML renderizado
  const html = await page.content();

  // 4. Escrever em tests/fixtures/grecia-rendered.html
  writeFileSync('tests/fixtures/grecia-rendered.html', html);

  await browser.close();
}
```

**Sobre imports Vite `@/assets/...`:** Os imports Vite de imagens são resolvidos pelo bundler para caminhos como `/assets/hero-santorini-BxYz123.jpg`. No snapshot Playwright (DOM renderizado), os `src` de `<img>` já serão URLs resolvidas. Para o fixture tokenizado, substituir esses `src` por tokens `{{ hero_imagem:image }}` — a imagem em si é out-of-scope para Fase 1 (Phase 4 faz upload).

**Alternativa mais simples (Wave 0):** Escrever o fixture HTML manualmente a partir dos componentes Grécia já inspecionados, substituindo valores dinâmicos por tokens. Isso não requer rodar a SPA. O fixture capturado via Playwright é o ideal para layout-fidelidade; o fixture manual é suficiente para provar o pipeline do engine.

**Meta/OG/gtag (discrição do researcher):** Manter `<title>`, `<meta charset>`, `<meta name="viewport">` como estático no template. Tokenizar `<meta name="description">` como `{{ seo_descricao:text }}` se desejado. Remover scripts de gtag do template (são injetados em runtime pela SPA, não são parte do LP estático). JSON-LD pode ficar como estático ou ser parcialmente tokenizado na Fase 3.

---

## Pitfalls Comuns

### Pitfall 1: Rich-Text Recebendo `| raw` Sem Sanitização Prévia

**O que falha:** Passar `{{ descricao | raw }}` no template Liquid com um valor não-sanitizado → XSS stored na LP gerada.

**Por que acontece:** `| raw` instrui o LiquidJS a não escapar o valor. Necessário para rich-text legítimo, mas fatal se o valor contiver HTML malicioso.

**Como evitar:** Sanitizar SEMPRE com `sanitize-html` antes de `render()`. Nunca sanitizar depois.

**Sinais de alerta:** `<script>`, `onerror=`, `javascript:` aparecendo na saída do render.

---

### Pitfall 2: `javascript:` URL Passando Para href

**O que falha:** `outputEscape: 'escape'` do LiquidJS escapa `<>&"'` mas NÃO bloqueia `javascript:alert(1)` como valor de `href`. O HTML resultante seria `<a href="javascript:alert(1)">`.

**Por que acontece:** LiquidJS faz escaping de HTML, não validação semântica de URL.

**Como evitar:** Chamar `sanitizeUrl()` em todos os valores do tipo `button` e `image` antes de passar ao render.

**Sinais de alerta:** Teste de payload P4 passando no corpus de segurança.

---

### Pitfall 3: Tokens Dentro de Repeater Não Sendo Reescritos como `item.campo`

**O que falha:** Template Liquid gerado tem `{{ titulo }}` dentro de `{% for item in roteiro %}` em vez de `{{ item.titulo }}` — LiquidJS procura `titulo` no scope global em vez do item do loop.

**Por que acontece:** O compilador não recebeu o `ParsedSchema` e não soube quais tokens pertencem a qual repeater.

**Como evitar:** Passar o `ParsedSchema` ao compilador; usar o campo `repeater` do `TokenField` para saber quais tokens precisam ser prefixados com `item.`.

**Sinais de alerta:** Repeater com 1+ itens renderiza vazio ou renderiza o valor global em vez do valor do item.

---

### Pitfall 4: CVEs de LiquidJS em Versões Anteriores

**O que falha:** Usar LiquidJS < 10.25.4 com `sort_natural` em valores controlados pelo usuário permite extrair propriedades de prototype via side-channel.

**Por que acontece:** CVE-2026-39412 não foi corrigida antes de v10.25.4.

**Como evitar:** Fixar `liquidjs@^10.27.0` no `package.json`. Verificar `npm view liquidjs version` antes de cada release.

**Sinais de alerta:** `npm audit` reportando vulnerabilidade em liquidjs.

---

### Pitfall 5: `ownPropertyOnly` Sendo Ignorado em `{% render %}` Tags

**O que falha:** Se templates compilados usarem a tag `{% render %}` (include de subtemplates), o contexto filho não propaga `ownPropertyOnly: true` corretamente em versões < 10.25.4.

**Por que acontece:** CVE-2026-44646 — `Context.spawn()` não propagava o override.

**Como evitar:** Usar v10.27.0; não usar `{% render %}` se possível na Fase 1 (o engine não precisa de subtemplates).

---

### Pitfall 6: Validação de Schema Zod v4 com `@hookform/resolvers`

**O que falha:** `@hookform/resolvers` versões antigas não suportam Zod v4.

**Por que não se aplica agora:** Fase 1 não tem UI — sem React Hook Form. Relevante para Fase 4.

**Como preparar:** Verificar em Fase 4 que `@hookform/resolvers@5.4.0` (versão atual verificada) suporta Zod v4.4.3.

---

## Exemplos de Código

### Exemplo 1: Configuração do Engine LiquidJS

```typescript
// Source: Context7 /harttle/liquidjs — LiquidOptions + CVE mitigations
import { Liquid } from 'liquidjs';

export const engine = new Liquid({
  outputEscape: 'escape',    // Auto-HTML-escape em {{ saídas }}
  ownPropertyOnly: true,     // Bloquear acesso a prototype (default, explícito por clareza)
  strictVariables: false,    // Variável undefined → '' (não crash)
  strictFilters: false,      // Filtro desconhecido → pass-through (não crash)
  // SEM root/partials/layouts — apenas strings em memória nesta fase
});
```

### Exemplo 2: Parse de Schema com Warnings

```typescript
// Exemplo de output do parse() para o template Grécia
const schema = parse(greciaTemplate);
// schema.fields: [
//   { name: 'hero_titulo', type: 'text', repeater: null, global: false },
//   { name: 'roteiro', type: 'repeater', repeater: null, global: false },
//   { name: 'roteiro_titulo', type: 'text', repeater: 'roteiro', global: false },
//   { name: 'brand.whatsapp', type: 'text', repeater: null, global: true },
//   ...
// ]
// schema.repeaters: ['destaques', 'inclusos', 'roteiro', 'diferenciais', 'depoimentos']
// schema.globals: ['whatsapp', 'logo', 'instagram', 'facebook']
// schema.warnings: [] (fixture bem formado)
```

### Exemplo 3: Render com Pre-processamento de Segurança

```typescript
// Source: Context7 /harttle/liquidjs parseAndRender + sanitize-html
async function renderLP(
  markup: string,
  rawValues: Record<string, unknown>,
  brand: Record<string, unknown>
): Promise<string> {
  const schema = parse(markup);
  const compiledLiquid = compileToLiquid(markup, schema);

  // Pre-processar valores por tipo
  const safeValues: Record<string, unknown> = {};
  for (const field of schema.fields) {
    const raw = rawValues[field.name];
    if (field.type === 'richtext') {
      safeValues[field.name] = sanitizeRichText(String(raw ?? ''));
    } else if (field.type === 'button') {
      safeValues[field.name] = sanitizeUrl(String(raw ?? ''));
    } else if (field.type === 'color') {
      safeValues[field.name] = sanitizeCssColor(String(raw ?? ''));
    } else if (field.type === 'repeater') {
      // Repeaters: array de objetos; cada campo do item é pré-processado
      safeValues[field.name] = processRepeaterItems(raw, field.name, schema);
    } else {
      safeValues[field.name] = raw; // text e image: escapados pelo outputEscape
    }
  }

  return engine.parseAndRender(compiledLiquid, { ...safeValues, brand });
}
```

### Exemplo 4: Teste de Corpus de Segurança (Vitest)

```typescript
// Source: CONTEXT.md D-16 + Vitest docs
import { describe, it, expect } from 'vitest';
import { render, parse } from '../src/engine';

const PAYLOADS = [
  '{{constructor.constructor(\'return process.env\')()}}',
  '{{__proto__.polluted}}',
  '"><img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  'expression(alert(1))',
  '#fff; background:url(javascript:alert(1))',
];

const FIELD_TYPES = ['text', 'richtext', 'image', 'color', 'button'] as const;

describe('Corpus de Segurança SSTI/XSS', () => {
  for (const fieldType of FIELD_TYPES) {
    for (const payload of PAYLOADS) {
      it(`[${fieldType}] payload "${payload.slice(0, 40)}..." renderiza inerte`, async () => {
        const markup = `<div>{{ campo_teste:${fieldType} }}</div>`;
        const html = await render(markup, { campo_teste: payload }, {});

        // Nenhuma execução de script
        expect(html).not.toContain('<script');
        expect(html).not.toContain('onerror=');
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('expression(');
        // O payload deve ter sido escapado ou rejeitado, não executado
        expect(html).not.toContain('alert(1)'); // não como código executável
      });
    }
  }
});
```

### Exemplo 5: Golden File Test para Fixture Grécia

```typescript
// Source: Context7 /vitest-dev/vitest toMatchFileSnapshot
import { describe, it, expect } from 'vitest';
import { render, parse } from '../src/engine';
import { greciaTemplate } from './fixtures/grecia-template';
import { greciaValues, greciaBrand } from './fixtures/grecia-values';

describe('Fixture Grécia — Golden File', () => {
  it('renderiza o template completo com valores de referência', async () => {
    const html = await render(greciaTemplate, greciaValues, greciaBrand);
    await expect(html).toMatchFileSnapshot('./tests/__snapshots__/grecia.output.html');
  });

  it('repeater roteiro com 0 itens renderiza sem crash', async () => {
    const html = await render(greciaTemplate, { ...greciaValues, roteiro: [] }, greciaBrand);
    expect(html).toContain('id="roteiro"'); // seção existe mas sem cards
  });

  it('repeater roteiro com 1 item renderiza 1 card', async () => {
    const umaEntrada = [greciaValues.roteiro[0]];
    const html = await render(greciaTemplate, { ...greciaValues, roteiro: umaEntrada }, greciaBrand);
    const cardCount = (html.match(/class="card-roteiro"/g) || []).length;
    expect(cardCount).toBe(1);
  });

  it('repeater roteiro com N itens renderiza N cards', async () => {
    const html = await render(greciaTemplate, greciaValues, greciaBrand);
    const cardCount = (html.match(/class="card-roteiro"/g) || []).length;
    expect(cardCount).toBe(greciaValues.roteiro.length);
  });
});
```

---

## Estado da Arte

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|-----------------|-----------------|--------------|---------|
| EJS / Pug (exec JS em templates) | LiquidJS / Nunjucks-sandbox / substituição logic-less | 2020+ | EJS/Pug = RCE em templates não-confiáveis; LiquidJS é padrão para sistemas multi-tenant |
| `outputEscape` opt-out | `outputEscape: 'escape'` opt-in explícito | LiquidJS v10 | Segurança por padrão em vez de por convenção |
| `ownPropertyOnly` ausente | `ownPropertyOnly: true` (default desde v10) | LiquidJS v10.0.0 | CVE-2022-25948; agora padrão seguro |
| `sort_natural` bypass | Corrigido em v10.25.4 | 2026-04 | CVE-2026-39412 |
| Handlebars como template seguro | Não usar — helper SSTI + prototype pollution documentados | 2022+ | Ver CLAUDE.md "What NOT to Use" |

**Deprecated/Outdated:**
- `liquidjs < 10.25.4`: vulnerável a bypass de `ownPropertyOnly`
- `sanitize-html < 2.12`: sem `enforceHtmlBoundary`
- Abordagem de denylist para sanitização HTML: bypassos documentados; sempre usar allowlist

---

## Arquitetura de Validação

> `nyquist_validation: false` em `.planning/config.json` — seção incluída para auxiliar o planejador, não obrigatória.

### Mapeamento de Requisitos → Testes

| Req ID | Comportamento | Tipo de Teste | Comando Automatizado | Arquivo |
|--------|--------------|---------------|---------------------|---------|
| TPL-02 | `parse()` emite schema com todos os 6 tipos detectados | Unit | `vitest run tests/engine/parser.test.ts` | Wave 0 |
| TPL-02 | `parse()` emite warning para token sem tipo | Unit | `vitest run tests/engine/parser.test.ts` | Wave 0 |
| TPL-04 | `parse()` detecta repeaters; `render()` itera 0/1/N itens | Unit | `vitest run tests/engine/renderer.test.ts` | Wave 0 |
| GEN-05 | `render()` produz HTML faithful ao fixture Grécia | Golden-file | `vitest run tests/engine/renderer.test.ts` | Wave 0 |
| GEN-06 | Todos os 6 tipos + corpus de payloads SSTI/XSS renderizam inerte | Segurança | `vitest run tests/engine/security.test.ts` | Wave 0 |

### Lacunas Wave 0

- [ ] `tests/engine/parser.test.ts` — cobre TPL-02 (schema assertions)
- [ ] `tests/engine/renderer.test.ts` — cobre TPL-04 + GEN-05 (golden-file + repeaters 0/1/N)
- [ ] `tests/engine/security.test.ts` — cobre GEN-06 (corpus SSTI/XSS D-16)
- [ ] `tests/fixtures/grecia-template.html` — fixture tokenizado derivado da SPA
- [ ] `tests/fixtures/grecia-values.ts` — valores de referência para o template
- [ ] `tests/__snapshots__/grecia.output.html` — golden file (gerado na primeira execução com `vitest -u`)
- [ ] `vitest.config.ts` na raiz do PageForge (novo projeto, sem config ainda)

---

## Domínio de Segurança

### Categorias ASVS Aplicáveis

| Categoria ASVS | Aplica | Controle Standard |
|---------------|--------|------------------|
| V5 Input Validation | Sim | Zod para schema; sanitize-html para rich-text; regex para URL/cor |
| V5.2 Sanitização | Sim | sanitize-html com allowlist estrita (D-11) |
| V6.3 Random Values | Não | Nenhuma criptografia nesta fase |
| V2 Authentication | Não | Sem autenticação nesta fase (Fase 2) |
| V4 Access Control | Não | Sem multi-tenancy nesta fase (Fase 2) |

### Padrões de Ameaça Conhecidos

| Padrão | STRIDE | Mitigação Standard |
|--------|--------|--------------------|
| SSTI via template de autoria | Tampering / Elevation | LiquidJS `outputEscape: 'escape'` + valores como dados (não como template) |
| Prototype Pollution via `__proto__` | Tampering | `ownPropertyOnly: true` (default) no LiquidJS v10.27.0 |
| XSS Stored via rich-text | Tampering | sanitize-html com allowlist antes do render |
| XSS via `javascript:` em href | Tampering | `sanitizeUrl()` com allowlist de scheme |
| CSS Injection via campo color | Tampering | `sanitizeCssColor()` com regex de allowlist |
| XSS via HTML attribute break-out | Tampering | `outputEscape: 'escape'` do LiquidJS |

---

## Log de Premissas

| # | Afirmação | Seção | Risco se Errado |
|---|-----------|-------|-----------------|
| A1 | TypeScript 5.x é aceito como linguagem (não JavaScript puro) | Stack Standard | Baixo — CLAUDE.md trata como não-negociável |
| A2 | pnpm é o package manager preferido | Instalação | Baixo — qualquer npm-compat manager serve |
| A3 | O compilador passará o `ParsedSchema` para o `compileToLiquid()` (assinatura atualizada) | Padrão 1 | Médio — se não, tokens dentro de repeater não viram `item.campo` |
| A4 | O fixture manual (sem Playwright) é suficiente para Wave 0 | Derivação de Fixture | Médio — pode reduzir fidelidade do golden-file; o ideal é captura via Playwright |
| A5 | Não usar `{% render %}` tag do LiquidJS elimina CVE-2026-44646 | Pitfall 5 | Baixo — Fase 1 não tem subtemplates |

---

## Perguntas em Aberto

1. **Quantos campos únicos tem o template Grécia completo?**
   - O que sabemos: 5 repeaters identificados (destaques, inclusos, roteiro, diferenciais, depoimentos); ~15-20 campos top-level; ~30-40 campos internos de repeaters
   - O que está incerto: contagem exata depende do nível de granularidade do tokenização
   - Recomendação: definir na preparação do fixture; começar com granularidade alta (cada texto dinâmico vira token)

2. **O fixture deve incluir o CSS do Tailwind inline ou em `<link>`?**
   - O que sabemos: a SPA compila Tailwind em um arquivo CSS separado; o HTML estático gerado pela PageForge precisará referenciar o CSS de alguma forma
   - O que está incerto: se a Fase 1 precisa de CSS correto para o teste de fidelidade de layout, ou se HTML estrutural é suficiente
   - Recomendação: para Fase 1, fixture sem CSS (ou com CSS inlined mínimo) é suficiente; CSS completo é detalhe da Fase 4/5

3. **O arquivo `vitest.config.ts` do PageForge deve usar jsdom ou node como ambiente?**
   - O que sabemos: o engine é Node puro (sem DOM); sanitize-html roda em Node; LiquidJS roda em Node
   - Recomendação: `environment: 'node'` — sem browser APIs necessárias no engine

---

## Disponibilidade de Ambiente

| Dependência | Requerida Por | Disponível | Versão | Fallback |
|------------|--------------|-----------|--------|---------|
| Node.js | Engine + testes | ✓ | Verificar ≥ 18 | — |
| pnpm | Package manager | [ASSUMED] disponível | — | npm ou yarn |
| Playwright | Geração de fixture (D-14) | ✓ (instalado na SPA de referência) | — | Fixture manual |
| Vite dev server | Fixture via Playwright | ✓ (na SPA de referência) | — | Fixture manual |

```bash
# Verificar ambiente
node --version  # deve ser >= 18
npm view liquidjs version    # deve retornar 10.27.0
npm view sanitize-html version  # deve retornar 2.17.4
npm view zod version         # deve retornar 4.4.3
npm view vitest version      # deve retornar 4.1.8
```

---

## Fontes

### Primárias (Confiança HIGH)
- Context7 `/harttle/liquidjs` — API completa, escaping tutorial, for-loop, static analysis, ownPropertyOnly, raw filter, custom tags/filters [VERIFIED]
- Context7 `/websites/liquidjs` — ownPropertyOnly options, globals scope, render options [VERIFIED]
- Context7 `/websites/npmjs_package_sanitize-html` — configuração completa, allowedTags/Attributes, schemes, transformTags [VERIFIED]
- Context7 `/vitest-dev/vitest` — toMatchFileSnapshot, toMatchSnapshot, describe/it/expect [VERIFIED]
- `npm view liquidjs version` → `10.27.0` [VERIFIED: npm registry 2026-06-01]
- `npm view sanitize-html version` → `2.17.4` [VERIFIED: npm registry 2026-06-01]
- `npm view zod version` → `4.4.3` [VERIFIED: npm registry 2026-06-01]
- `npm view vitest version` → `4.1.8` [VERIFIED: npm registry 2026-06-01]
- Leitura direta de todos os componentes `src/components/campaigns/grecia/` [VERIFIED: codebase]

### Secundárias (Confiança MEDIUM)
- `github.com/advisories/GHSA-45rm-2893-5f49` — CVE-2022-25948 LiquidJS prototype leak [CITED]
- `advisories.gitlab.com/pkg/npm/liquidjs/CVE-2026-39412` — sort_natural bypass [CITED: search result summary]
- `advisories.gitlab.com/npm/liquidjs/CVE-2026-44646` — Context.spawn() bypass [CITED: search result summary]
- `liquidjs.com/tutorials/changelog.html` — patch v10.26.0 Object.prototype RCE block [CITED]
- OWASP XSS Prevention Cheat Sheet — regras de escaping por contexto (text, atributo, URL, CSS) [CITED: cheatsheetseries.owasp.org]
- MediaWiki CSS Whitelisting approach — base para `sanitizeCssColor()` [CITED: mediawiki.org]

### Terciárias (Confiança LOW — marcadas para validação)
- hacefresko.com — padrão seguro de uso do LiquidJS (valores como contexto, não concatenados) [ASSUMED consistente com docs oficiais]

---

## Metadata

**Breakdown de confiança:**
- Stack padrão: HIGH — versões verificadas via npm registry
- Arquitetura: HIGH — baseada em documentação oficial do LiquidJS + análise direta do código da SPA
- Benchmark D-10: MEDIUM-HIGH — LiquidJS bem documentado; CVEs verificados; modelo de ameaças é inferido do contexto do produto
- Pitfalls: HIGH — CVEs verificados em fontes oficiais; outros validados via documentação
- Fixture / derivação: MEDIUM — estrutura da SPA inspecionada; granularidade de tokenização é estimada

**Data da pesquisa:** 2026-06-01
**Válido até:** 2026-09-01 (90 dias — LiquidJS tem lançamentos frequentes; verificar `npm audit` antes de iniciar desenvolvimento)
