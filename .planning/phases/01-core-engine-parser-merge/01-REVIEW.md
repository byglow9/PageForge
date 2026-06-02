---
phase: 01-core-engine-parser-merge
reviewed: 2026-06-02T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/engine/schema.ts
  - src/engine/parser.ts
  - src/engine/compiler.ts
  - src/engine/renderer.ts
  - src/engine/sanitizers.ts
  - src/engine/index.ts
  - tests/engine/security.test.ts
  - tests/engine/renderer.test.ts
  - tests/engine/parser.test.ts
  - tests/engine/sanitizers.test.ts
  - tests/engine/e2e.test.ts
findings:
  critical: 2
  warning: 5
  info: 1
  total: 8
status: resolved
resolution:
  resolved_in: c91c36c
  resolved: 2026-06-02
  notes: >
    CR-01, CR-02, WR-01, WR-03, WR-04 corrigidos com cobertura de teste
    (tests/engine/hardening.test.ts, 10 testes; suite total 118 verde).
    WR-02 (RELATIVE_URL morto) removido junto à correção de WR-01.
    WR-05 (brand.* dentro de repeater renderiza vazio) aceito como limitação
    conhecida da v1 — brand globais são consumidos fora de repeaters no escopo atual.
    IN-01 (corpus sem payload em brand) endereçado pelos testes CR-01.
---

# Fase 01: Relatório de Code Review — Core Engine (Parser + Compiler + Renderer + Sanitizers)

**Revisado:** 2026-06-02
**Profundidade:** standard (com verificação manual de cada cadeia de chamada de segurança)
**Arquivos revisados:** 11
**Status:** issues_found

---

## Sumário

Este engine é o coração de segurança do PageForge: recebe markup com tokens, compila para LiquidJS e renderiza HTML estático com valores de usuário. A implementação está bem estruturada no caminho feliz — o uso de `outputEscape: 'escape'` e `ownPropertyOnly: true` no LiquidJS, combinado com `sanitizeRichText` e `sanitizeUrl` para os tipos corretos, constitui uma base defensável.

Entretanto, dois vetores de XSS confirmados e exploráveis foram identificados durante a análise:

1. **O objeto `brand` passa completamente sem sanitização de tipo** — valores `brand.*` do tipo `image`, `button`, `color` e `richtext` não passam pelos sanitizadores correspondentes. Um valor `brand.logo = "javascript:alert(1)"` inserido no scope de LiquidJS produz `<img src="javascript:alert(1)">` no HTML final, pois `outputEscape` não bloqueia schemes de URL.

2. **O filtro `| raw` nativo do LiquidJS pode ser injetado manualmente por autores de template** — o LiquidJS registra `raw` como filtro embutido que tem a propriedade `raw: true`, o que faz com que o `outputEscape` seja explicitamente suprimido naquela saída (confirmado em `liquid.node.js:2454`). O TOKEN_PATTERN da fase de parsing/compilação não detecta `{{ campo | raw }}` (o pipe quebra o match), de modo que a expressão passa inalterada para o template compilado. Se o template contem `{{ campo:text }}` em qualquer lugar, `campo` entra no scope como texto puro sem sanitização, e `{{ campo | raw }}` o renderiza sem escaping — XSS de stored.

Além desses, foram encontrados problemas de qualidade e robustez que devem ser corrigidos antes do merge.

---

## Critical Issues

### CR-01: Objeto `brand` ignora completamente a sanitização por tipo de campo

**Arquivo:** `src/engine/renderer.ts:101`

**Issue:** O `render()` recebe o parâmetro `brand: Record<string, unknown>` e o coloca diretamente no scope do LiquidJS via `const scope = { ...safeValues, brand }` (linha 121). O laço de sanitização em `schema.fields` pula todos os campos globais com `if (field.global) continue` (linha 101) e, portanto, nenhum valor de `brand.*` passa por `sanitizeRichText`, `sanitizeUrl` ou `sanitizeCssColor`.

O protetor `outputEscape: 'escape'` do LiquidJS aplica apenas escaping de entidades HTML (`&`, `<`, `>`, `"`, `'`). Isso é **insuficiente** para contextos de URL e CSS:

- `brand.logo = "javascript:alert(1)"` em `<img src="{{ brand.logo }}">` produz `<img src="javascript:alert(1)">` (nenhum caractere HTML para escapar) → XSS executável via `src`.
- `brand.url = "javascript:alert(1)"` em `<a href="{{ brand.url }}">` → XSS via `href`.
- `brand.cor = "expression(alert(1))"` em `style="color: {{ brand.cor }}"` → CSS injection legada.
- `brand.descricao:richtext` com `{{ brand.descricao | raw }}` (gerado pelo compiler) → HTML bruto sem `sanitizeRichText` aplicado.

O corpus de segurança (`security.test.ts`) passa `brand = {}` em todos os 60 testes, portanto esse vetor nunca é exercitado pelos testes existentes.

**Fix:**
```typescript
// renderer.ts — após montar safeValues, sanitizar brand por tipo de campo antes de compor scope

function sanitizeBrandValues(brand: Record<string, unknown>, schema: ParsedSchema): Record<string, unknown> {
  const safeBrand: Record<string, unknown> = {};
  const brandFields = schema.fields.filter((f) => f.global);

  for (const field of brandFields) {
    // field.name é "brand.X" — a chave no objeto brand é X (sem o prefixo)
    const key = field.name.slice('brand.'.length);
    const raw = String((brand as Record<string, unknown>)[key] ?? '');

    if (field.type === 'richtext') {
      safeBrand[key] = sanitizeRichText(raw);
    } else if (field.type === 'button' || field.type === 'image') {
      safeBrand[key] = sanitizeUrl(raw);
    } else if (field.type === 'color') {
      safeBrand[key] = sanitizeCssColor(raw);
    } else {
      safeBrand[key] = brand[key]; // text: outputEscape do LiquidJS cobre
    }
  }

  // Preservar chaves de brand não declaradas no schema (passthrough)
  for (const [k, v] of Object.entries(brand)) {
    if (!(k in safeBrand)) {
      safeBrand[k] = v;
    }
  }

  return safeBrand;
}

// Na função render(), linha 121, substituir:
// const scope = { ...safeValues, brand };
// por:
const safeBrand = sanitizeBrandValues(brand, schema);
const scope = { ...safeValues, brand: safeBrand };
```

---

### CR-02: Filtro `| raw` nativo do LiquidJS pode ser injetado por autores de template, contornando `outputEscape`

**Arquivo:** `src/engine/compiler.ts:41` e `src/engine/renderer.ts:14-19`

**Issue:** O LiquidJS registra `raw` como filtro embutido com `{ raw: true, handler: identify }`. A propriedade `raw: true` no filtro sinaliza ao engine para **não** acrescentar o `outputEscape` naquela expressão (confirmado em `liquid.node.js:2454`: `if (!filters[filters.length - 1]?.raw && outputEscape)`). Portanto, `{{ campo | raw }}` é equivalente a output sem escaping algum.

O `compileToLiquid` só transforma tokens que casam com `/\{\{\s*([\w.]+)(?::(\w+))?\s*\}\}/g` (que exige `}}` logo após o nome/tipo). O padrão `{{ campo | raw }}` — com ` | raw` entre o nome e `}}` — **não casa** com esse regex. Assim:

1. O parser não detecta `campo` como campo do schema (TOKEN_PATTERN também não casa).
2. O compiler não transforma `{{ campo | raw }}`.
3. A expressão passa intacta para o template compilado que o LiquidJS recebe.
4. Se `campo` estiver no scope (porque foi declarado em outro token, p. ex. `{{ campo:text }}`), o LiquidJS o renderiza com `raw` — sem `outputEscape` — com o valor de texto puro sem sanitização.

Cadeia de ataque confirmada:
```
Template:  <p>{{ nome:text }}</p><footer>{{ nome | raw }}</footer>
Valor:     { nome: '<script>alert(1)</script>' }
Schema:    nome → text (safeValues["nome"] = valor bruto, sem sanitize para text)
Render:    <p>&lt;script&gt;alert(1)&lt;/script&gt;</p>   ← seguro
           <footer><script>alert(1)</script></footer>      ← XSS EXECUTADO
```

Nota: se `campo` for do tipo `richtext` (e portanto `safeValues["campo"] = sanitizeRichText(...)`), o `{{ campo | raw }}` manual ainda seria seguro porque o valor já foi sanitizado. A vulnerabilidade existe quando o campo é `text`, `image`, `button` ou `color`.

**Fix (opção recomendada — remover o filtro `raw` da instância do engine e usar mecanismo próprio):**
```typescript
// renderer.ts — usar Liquid sem o filtro raw embutido, registrar filtro customizado
// que só funciona para valores já marcados como pré-sanitizados

import { Liquid } from 'liquidjs';

export const engine = new Liquid({
  outputEscape: 'escape',
  ownPropertyOnly: true,
  strictVariables: false,
  strictFilters: false,
});

// REMOVER o filtro 'raw' embutido e registrar versão que só passa valores previamente sanitizados
// (Liquid não expõe remoção de filtros diretamente, portanto a alternativa mais segura é:)
// Registrar 'raw' com um wrapper que exige que o valor esteja envolto em um tipo especial
// que só o renderer pode criar após sanitização, OU:

// ALTERNATIVA: em compileToLiquid(), antes de devolver o template,
// detectar e bloquear qualquer {{ ... | raw }} que não foi gerado pelo compiler:
```

```typescript
// compiler.ts — adicionar pós-processamento para neutralizar | raw não autorizado
export function compileToLiquid(markup: string, schema: ParsedSchema): string {
  // ... lógica existente ...

  // Pós-processamento: detectar {{ ... | raw }} residuais (não gerados pelo compiler)
  // e convertê-los para {{ ... }} (sem | raw), o que faz outputEscape ser aplicado
  // Nota: o compiler gera {{ campo | raw }} e {{ item.campo | raw }} — esses são legítimos.
  // O problema são {{ ... | raw }} que estavam no markup original não transformados.
  // Como o compiler substitui TODOS os tokens reconhecidos antes de chegar aqui,
  // qualquer | raw residual é suspeito.
  // 
  // Estratégia: após todas as substituições, fazer uma passagem final que
  // detecta padrões {{ ... | raw }} e os neutraliza removendo o | raw:
  result = result.replace(/\{\{(\s*[\w.]+\s*)\|\s*raw\s*\}\}/g, '{{ $1}}');

  return result;
}
```

A opção mais segura é a segunda (neutralização no compiler), que garante que nenhum `| raw` não autorizado chegue ao LiquidJS, independentemente de como a instância do engine é configurada.

---

## Warnings

### WR-01: `sanitizeUrl` permite URLs protocol-relative (`//evil.com`), vetor de open redirect e SSRF

**Arquivo:** `src/engine/sanitizers.ts:61-77`

**Issue:** A função `sanitizeUrl` usa `HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+\-.]*:/` para detectar se a URL tem um scheme. Uma URL protocol-relative como `//evil.com` começa com `//`, que não inicia com letra seguida de `:` — portanto `HAS_SCHEME.test("//evil.com")` retorna `false`. A URL cai no caminho de retorno `return trimmed` (linha 76) como se fosse um caminho relativo seguro.

Em contexto HTML, `<img src="//evil.com/tracking.gif">` carrega recurso da origem do atacante. Em `<a href="//evil.com">`, o browser navega para `//evil.com` usando o protocolo da página atual. Isso viabiliza open redirect e phishing.

O comentário no código menciona `allowProtocolRelative: false` nas opções do `sanitize-html` para richtext, mas essa proteção não se aplica à função `sanitizeUrl` usada para `button` e `image`.

Adicionalmente, a constante `RELATIVE_URL` definida na linha 57 nunca é usada na função — código morto que indica intenção original não implementada.

**Fix:**
```typescript
export function sanitizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Bloquear protocol-relative URLs (//evil.com)
  if (trimmed.startsWith('//')) return '#';

  if (HAS_SCHEME.test(trimmed)) {
    if (!ALLOWED_URL_SCHEMES.test(trimmed)) {
      return '#';
    }
    return trimmed;
  }

  // URL relativa legítima: começa com /, ./, ../, ou #
  // Bloquear qualquer outra string sem scheme que não seja claramente relativa
  if (RELATIVE_URL.test(trimmed)) {
    return trimmed;
  }

  // Qualquer outra coisa (ex: "javascript :alert") → bloquear por precaução
  return '#';
}
```

---

### WR-02: Constante `RELATIVE_URL` é código morto

**Arquivo:** `src/engine/sanitizers.ts:57`

**Issue:** A constante `const RELATIVE_URL = /^(\/|\.\/|\.\.\/|#)/` é definida mas nunca referenciada dentro de `sanitizeUrl`. A lógica de URLs relativas é completamente dependente do fallthrough (qualquer coisa que não case `HAS_SCHEME` é retornada como-está), sem verificar se a URL é de fato um caminho relativo seguro. Além de ser código morto, a ausência do uso desse regex cria a vulnerabilidade WR-01 acima.

**Fix:** Usar `RELATIVE_URL` na função como descrito no WR-01, ou removê-la explicitamente se a estratégia mudar.

---

### WR-03: Padrão `[a-z]+` em `sanitizeCssColor` aceita qualquer string alphabética, não apenas named colors CSS

**Arquivo:** `src/engine/sanitizers.ts:87`

**Issue:** O branch final do `CSS_COLOR_PATTERN` é `[a-z]+`, que casa com QUALQUER sequência de letras (case-insensitive via flag `/i`). Isso significa que valores como `"notacolor"`, `"something"`, `"inherit"`, `"auto"`, `"none"` todos passam pela validação. Embora o check secundário (`/expression|url|javascript|import/i`) bloqueie as palavras mais óbvias, o padrão é semanticamente incorreto como "named CSS color".

Na prática, o risco direto de XSS é baixo — valores puramente alphabéticos não são executáveis em contexto CSS sem constructs como `url()` ou `expression()`. Mas o branch é excessivamente permissivo para um controle de segurança, e pode deixar passar valores inválidos que quebram o layout (ex.: `"something"` como valor de `color:` não produz cor visível).

**Fix:**
```typescript
// Substituir [a-z]+ por uma allowlist de CSS keywords válidas
const CSS_NAMED_COLOR_OR_KEYWORD =
  /^(transparent|currentcolor|inherit|initial|unset|revert|revert-layer|none|auto|[a-z]+(blue|red|green|white|black|gray|grey|pink|brown|purple|orange|yellow|cyan|magenta|lime|olive|navy|teal|silver|gold|violet|indigo|maroon|aqua|coral|salmon|khaki|beige|ivory|lavender|plum|orchid))$/i;

// Ou usar uma abordagem mais simples: manter a regex atual mas adicionar
// validação contra uma allowlist de named colors CSS conhecidos (há ~150 nomes)
// Para v1, ao menos restringir a [a-z]+ a apenas letras sem dígitos e < 30 chars:
const CSS_COLOR_PATTERN =
  /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(...\)|hsl\(...\)|hsla\(...\)|[a-z]{2,30})$/i;
// E manter o check secundário como está.
```

---

### WR-04: Repeaters aninhados produzem output silenciosamente incorreto sem erro ou aviso

**Arquivo:** `src/engine/parser.ts:79-88` e `src/engine/compiler.ts:62-63`

**Issue:** O design documenta suporte apenas a repeaters planos (flat-only). Porém, se um template contém repeaters aninhados — `<!-- repeat:outer --><!-- repeat:inner -->{{ x:text }}<!-- /repeat:inner --><!-- /repeat:outer -->` — o comportamento é **silenciosamente errado** em vez de gerar um erro:

1. **Parser:** O `closeMatches.find()` retorna o primeiro close com o mesmo nome. Com dois opens de nome diferente e closes aninhados, o token `x` fica dentro de ambos os ranges (outer e inner). O laço de repeaterRanges usa `break` no primeiro match — `x` é atribuído ao **outer** repeater.

2. **Compiler:** Os dois `<!-- repeat:... -->` são convertidos para `{% for item in outer %}{% for item in inner %}`. O `item` do loop interno **shadowing** o `item` do loop externo. O template compilado tem nested for loops com a mesma variável `item`.

3. **Renderer:** `safeValues["outer"]` é o array a iterar, mas `item.x` é acessado no loop `inner`, não no `outer`. O resultado é undefined (ou o valor do loop errado).

Não há warning emitido no schema, nem erro no renderer. O template autor não tem feedback sobre o que deu errado.

**Fix:**
```typescript
// parser.ts — detectar repeaters aninhados e emitir warning

for (const open of openMatches) {
  // Verificar se este open está dentro de um range já registrado (nesting detectado)
  const isNested = repeaterRanges.some(
    (r) => open.pos > r.start && open.pos < r.end
  );
  if (isNested) {
    warnings.push({
      token: `repeat:${open.name}`,
      message: `Repeater "${open.name}" aninhado dentro de outro repeater — não suportado (flat-only). O bloco será ignorado.`,
    });
    continue; // Não adicionar ao repeaterRanges
  }

  const close = closeMatches.find((c) => c.name === open.name);
  if (close) {
    repeaterRanges.push({ name: open.name, start: open.pos, end: close.pos });
    // ...
  }
}
```

---

### WR-05: Campos `brand.*` declarados dentro de um repeater renderizam como string vazia sem aviso

**Arquivo:** `src/engine/renderer.ts:101` e `src/engine/compiler.ts:46-51`

**Issue:** Se um template contém `{{ brand.logo:image }}` dentro de um bloco `<!-- repeat:X -->`, o parser cria um campo com `{ name: "brand.logo", global: true, repeater: "X" }`. O compiler, vendo que o campo está em um repeater, emite `{{ item.brand.logo }}` (linha 49 do compiler). Porém, no renderer, o check `if (field.global) continue` (linha 101) é executado **antes** de `if (field.repeater) continue`, então o campo é ignorado pelo loop de sanitização. O scope do LiquidJS não tem `item.brand.logo` em nenhum item do array `X` — o valor renderiza como string vazia silenciosamente.

Isso é um bug de lógica que produz dados faltando no output sem qualquer feedback.

**Fix:**
```typescript
// parser.ts — adicionar warning quando brand.* é detectado dentro de repeater
if (global && repeaterName !== null) {
  warnings.push({
    token: tokenName,
    message: `Token global "${tokenName}" encontrado dentro do repeater "${repeaterName}" — tokens brand.* não são suportados dentro de repeaters e serão renderizados como string vazia.`,
  });
}
```

Ou melhor: no compiler, detectar `global && inRepeater` e emitir o token como `{{ brand.logo }}` (acesso direto ao scope, fora do `item`) em vez de `{{ item.brand.logo }}`, e no renderer processar brand fields dentro de repeaters como top-level brand fields.

---

## Info

### IN-01: Corpus de segurança não cobre payloads em valores de `brand` — cobertura insuficiente para o CR-01

**Arquivo:** `tests/engine/security.test.ts:199`

**Issue:** Todos os 60 testes parametrizados de segurança chamam `render(markup, values, {})` com `brand = {}` vazio. Nenhum teste verifica o comportamento do engine quando o objeto `brand` contém payloads XSS em campos de tipo `image`, `button`, `color` ou `richtext`. Isso significa que o bug CR-01 não seria detectado pela suite de testes mesmo após a implementação.

**Fix:** Adicionar um describe separado ou ampliar os `FIELD_CONTEXTS` para incluir contextos de campo `brand.*`:

```typescript
// Adicionar ao security.test.ts

describe('Corpus brand — sanitização de valores brand.* (CR-01)', () => {
  const BRAND_CONTEXTS = [
    {
      name: 'brand-image',
      buildMarkup: () => `<img src="{{ brand.logo:image }}">`,
      buildBrand: (payload: string) => ({ logo: payload }),
      assertInert: assertInertHtmlEscapedContext,
    },
    {
      name: 'brand-button',
      buildMarkup: () => `<a href="{{ brand.url:button }}">link</a>`,
      buildBrand: (payload: string) => ({ url: payload }),
      assertInert: assertInertButtonContext,
    },
    {
      name: 'brand-color',
      buildMarkup: () => `<div style="color: {{ brand.cor:color }}">x</div>`,
      buildBrand: (payload: string) => ({ cor: payload }),
      assertInert: assertInertColorContext,
    },
    {
      name: 'brand-richtext',
      buildMarkup: () => `<div>{{ brand.desc:richtext }}</div>`,
      buildBrand: (payload: string) => ({ desc: payload }),
      assertInert: assertInertRichTextContext,
    },
  ];

  for (const ctx of BRAND_CONTEXTS) {
    for (let i = 0; i < PAYLOADS.length; i++) {
      const payload = PAYLOADS[i];
      it(`[${ctx.name}] payload P${i + 1}: ${payload.slice(0, 30)}`, async () => {
        const html = await render(ctx.buildMarkup(), {}, ctx.buildBrand(payload));
        expect(typeof html).toBe('string');
        ctx.assertInert(html);
      });
    }
  }
});
```

---

## Notas adicionais

**O que está correto e não precisa de alteração:**

- `ownPropertyOnly: true` no engine LiquidJS protege corretamente contra acesso a `Object.prototype` via templates. Confirmado: `{{constructor.constructor(...)()}}` como valor de campo não resulta em execução de código.
- `sanitizeRichText` usa a allowlist estrita do `sanitize-html` corretamente: `allowProtocolRelative: false`, `parseStyleAttributes: false`, `enforceHtmlBoundary: true`.
- O reset de `lastIndex` antes de cada uso dos regex globais (`REPEAT_OPEN.lastIndex = 0`, etc.) em `parser.ts` está correto e previne comportamento não-determinístico em chamadas repetidas (dado que `parse()` é síncrona).
- O `processRepeaterItems` sanitiza corretamente por tipo de campo para campos **declarados** no schema.
- O mecanismo de deduplicação de tokens por `dedupKey = "${tokenName}|${repeaterName ?? ''}"` é correto.
- A lógica de pairing de open/close de repeaters (find() por nome) é correta para o caso flat-only sem nesting.
- O `allowProtocolRelative: false` nas opções do `sanitize-html` (RICHTEXT_SANITIZE_OPTIONS) protege corretamente URLs em `href` de links dentro de rich text.

---

_Revisado em: 2026-06-02_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
