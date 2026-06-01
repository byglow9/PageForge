# Phase 1: Core Engine (Parser + Merge) — Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 11 (6 engine library + 5 test/fixture)
**Analogs found:** 5 / 11 (SPA de referência; codebase PageForge é greenfield — sem analogs internos)

---

## Contexto de Greenfield

O repositório PageForge contém apenas `CLAUDE.md` e `.planning/` — zero código de aplicação.
**Não existe analog interno** para nenhum dos arquivos do engine. A única base de código real
disponível é a SPA de referência em `renova-turismo-jornada-main/`, que fornece:

- Padrões para a **configuração Vitest** (estrutura de `vitest.config.ts`)
- Dados concretos para o **fixture Grécia** (componentes da campanha Grécia)
- Mapa de **campos por-item vs. estáticos** em cada repeater (via `.map()` blocks nos componentes)
- Padrões de **valores de dados** que alimentarão `grecia-values.ts`

Para os módulos do engine (`parser.ts`, `compiler.ts`, `renderer.ts`, `sanitizers.ts`, `schema.ts`),
o planner deve usar os padrões de código do `01-RESEARCH.md` como fonte primária — eles são baseados
em documentação oficial verificada (LiquidJS, sanitize-html, Zod, Vitest).

---

## File Classification

| Arquivo a criar | Role | Data Flow | Closest Analog | Match Quality |
|-----------------|------|-----------|----------------|---------------|
| `src/engine/schema.ts` | utility / types | transform | nenhum (greenfield) | — |
| `src/engine/parser.ts` | utility | transform | nenhum (greenfield) | — |
| `src/engine/compiler.ts` | utility | transform | nenhum (greenfield) | — |
| `src/engine/sanitizers.ts` | utility | transform | nenhum (greenfield) | — |
| `src/engine/renderer.ts` | service | request-response | nenhum (greenfield) | — |
| `src/engine/index.ts` | utility / config | — | nenhum (greenfield) | — |
| `vitest.config.ts` | config | — | `renova-turismo-jornada-main/vitest.config.ts` | role-match (ambiente diferente) |
| `tests/engine/parser.test.ts` | test | transform | `renova-turismo-jornada-main/vitest.config.ts` (setup) | partial |
| `tests/engine/renderer.test.ts` | test | request-response | nenhum (greenfield) | — |
| `tests/engine/security.test.ts` | test | transform | nenhum (greenfield) | — |
| `tests/fixtures/grecia-template.html` | fixture | — | componentes `renova-turismo-jornada-main/src/components/campaigns/grecia/*` | exact (fonte direta) |
| `tests/fixtures/grecia-values.ts` | fixture | — | `renova-turismo-jornada-main/src/data/campaigns.ts` + componentes Grécia | role-match |

---

## Pattern Assignments

### `src/engine/schema.ts` (utility / types)

**Analog:** nenhum — usar padrão do `01-RESEARCH.md §Design do Parser → Shape do Schema (Zod)`

**Padrão de imports:**
```typescript
import { z } from 'zod';
```

**Core pattern — definições Zod completas** (extraído de `01-RESEARCH.md` linhas 441–467):
```typescript
export const FieldTypeSchema = z.enum(['text', 'richtext', 'image', 'color', 'button', 'repeater']);

export const TokenFieldSchema = z.object({
  name:     z.string(),           // ex: "hero_titulo"
  type:     FieldTypeSchema,      // tipo detectado
  repeater: z.string().nullable(), // nome do repeater pai, ou null para campos top-level
  global:   z.boolean(),          // true se brand.*
});

export const ParseWarningSchema = z.object({
  token:   z.string(),
  message: z.string(),
});

export const ParsedSchemaSchema = z.object({
  fields:    z.array(TokenFieldSchema),
  repeaters: z.array(z.string()),   // nomes únicos de repeaters encontrados
  globals:   z.array(z.string()),   // nomes de tokens brand.* (sem prefixo "brand.")
  warnings:  z.array(ParseWarningSchema),
});

export type FieldType    = z.infer<typeof FieldTypeSchema>;
export type TokenField   = z.infer<typeof TokenFieldSchema>;
export type ParsedSchema = z.infer<typeof ParsedSchemaSchema>;
export type ParseWarning = z.infer<typeof ParseWarningSchema>;
```

---

### `src/engine/parser.ts` (utility, transform)

**Analog:** nenhum — usar padrões do `01-RESEARCH.md §Design do Parser → Algoritmo de Parsing`

**Padrão de imports:**
```typescript
import { ParsedSchema, TokenField, ParseWarning, FieldType } from './schema';
```

**Interface pública** (extraído de `01-RESEARCH.md` linha 473):
```typescript
export function parse(markup: string): ParsedSchema;
```

**Core pattern — regexes e resolução de tipo** (extraído de `01-RESEARCH.md` linhas 391–425):
```typescript
// Fase 1: Localizar repeaters via regex de comment
const REPEAT_OPEN  = /<!--\s*repeat:(\w+)\s*-->/g;
const REPEAT_CLOSE = /<!--\s*\/repeat:(\w+)\s*-->/g;

// Fase 2: Localizar tokens via regex inline
const TOKEN_PATTERN = /\{\{\s*([\w.]+)(?::(\w+))?\s*\}\}/g;
// Grupo 1: nome (ex: "hero_titulo", "brand.logo")
// Grupo 2: tipo (ex: "text", "image", "color") — pode ser undefined

// Fase 3: Classificação com degradação tolerante (D-04)
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

// Fase 4: Namespace brand (D-09)
function isBrandToken(name: string): boolean {
  return name.startsWith('brand.');
}
```

---

### `src/engine/compiler.ts` (utility, transform)

**Analog:** nenhum — usar padrão do `01-RESEARCH.md §Padrões de Arquitetura → Padrão 1`

**Interface pública** (extraído de `01-RESEARCH.md` linhas 577–581):
```typescript
import { ParsedSchema } from './schema';

// Requer ParsedSchema para saber quais tokens pertencem a qual repeater (D-07)
export function compileToLiquid(markup: string, schema: ParsedSchema): string;
```

**Core pattern — transformações de string** (extraído de `01-RESEARCH.md` linhas 563–574):
```typescript
export function compileToLiquid(markup: string, schema: ParsedSchema): string {
  return markup
    // 1. Remover anotações de tipo dos tokens
    .replace(/\{\{\s*([\w.]+):\w+\s*\}\}/g, '{{ $1 }}')
    // 2. Converter delimitadores de repeater
    .replace(/<!--\s*repeat:(\w+)\s*-->/g, '{% for item in $1 %}')
    .replace(/<!--\s*\/repeat:(\w+)\s*-->/g, '{% endfor %}')
    // 3. Tokens dentro de repeater → {{ item.campo }}
    // Usar schema.fields onde field.repeater !== null para saber quais reescrever
    ;
}
```

**Observação crítica (Pitfall 3 do `01-RESEARCH.md` linhas 712–720):** Tokens dentro de repeater
devem ser reescritos como `item.campo`. O compilador precisa iterar `schema.fields` onde
`field.repeater !== null` e substituir `{{ campo }}` por `{{ item.campo }}` para cada campo
pertencente àquele repeater — caso contrário o LiquidJS busca `campo` no escopo global.

---

### `src/engine/sanitizers.ts` (utility, transform)

**Analog:** nenhum — usar padrões do `01-RESEARCH.md §Sanitização Rich-Text` e `§Escaping Context-Aware`

**Padrão de imports:**
```typescript
import sanitizeHtml from 'sanitize-html';
```

**Rich-text sanitization config** (extraído de `01-RESEARCH.md` linhas 336–364):
```typescript
import sanitizeHtml from 'sanitize-html';

export const RICHTEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'a', 'br'],
  allowedAttributes: { 'a': ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { 'a': ['http', 'https', 'mailto'] },
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: true,
  parseStyleAttributes: false,
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICHTEXT_SANITIZE_OPTIONS);
}
```

**URL sanitization** (extraído de `01-RESEARCH.md` linhas 269–279):
```typescript
const ALLOWED_URL_SCHEMES = /^(https?:\/\/|mailto:|tel:)/i;

export function sanitizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (!ALLOWED_URL_SCHEMES.test(trimmed)) return '#';
  return trimmed;
}
```

**CSS color sanitization** (extraído de `01-RESEARCH.md` linhas 284–300):
```typescript
const CSS_COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|hsl\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*\)|hsla\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*,\s*[\d.]+\s*\)|[a-z]+)$/i;

export function sanitizeCssColor(raw: string): string {
  const trimmed = raw.trim();
  if (!CSS_COLOR_PATTERN.test(trimmed)) return '';
  if (/expression|url|javascript|import/i.test(trimmed)) return '';
  return trimmed;
}
```

---

### `src/engine/renderer.ts` (service, request-response)

**Analog:** nenhum — usar padrões do `01-RESEARCH.md §Exemplos de Código → Exemplo 1 e Exemplo 3`

**Padrão de imports:**
```typescript
import { Liquid } from 'liquidjs';
import { parse } from './parser';
import { compileToLiquid } from './compiler';
import { sanitizeRichText, sanitizeUrl, sanitizeCssColor } from './sanitizers';
import type { ParsedSchema } from './schema';
```

**Configuração do engine LiquidJS** (extraído de `01-RESEARCH.md` linhas 765–772):
```typescript
export const engine = new Liquid({
  outputEscape: 'escape',    // Auto-HTML-escape em {{ saídas }}
  ownPropertyOnly: true,     // Bloquear acesso a prototype (default, explícito por clareza)
  strictVariables: false,    // Variável undefined → '' (não crash)
  strictFilters: false,      // Filtro desconhecido → pass-through (não crash)
  // SEM root/partials/layouts — apenas strings em memória nesta fase
});
```

**Interface pública** (extraído de `01-RESEARCH.md` linhas 476–482):
```typescript
// Nota: valores richtext JÁ devem ter passado por sanitizeRichText() antes de chamar render()
export async function render(
  markup: string,
  values: Record<string, unknown>,
  brand: Record<string, unknown>
): Promise<string>;
```

**Core pattern — pre-processamento por tipo antes do render** (extraído de `01-RESEARCH.md` linhas 795–822):
```typescript
async function renderLP(markup, rawValues, brand) {
  const schema = parse(markup);
  const compiledLiquid = compileToLiquid(markup, schema);

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
      safeValues[field.name] = processRepeaterItems(raw, field.name, schema);
    } else {
      safeValues[field.name] = raw; // text e image: escapados pelo outputEscape
    }
  }

  return engine.parseAndRender(compiledLiquid, { ...safeValues, brand });
}
```

**Contextos de escaping por tipo de campo** (extraído de `01-RESEARCH.md` linhas 303–328):
```liquid
<!-- text → escapado automaticamente por outputEscape -->
<h1>{{ hero_titulo }}</h1>

<!-- richtext → DEVE usar | raw; sanitize-html já limpou ANTES do render -->
<div class="descricao">{{ sobre_texto | raw }}</div>

<!-- button → href já validado por sanitizeUrl() antes do render -->
<a href="{{ cta_url }}" class="btn">{{ cta_texto }}</a>

<!-- color → valor já validado por sanitizeCssColor() -->
<div style="--brand-primary: {{ brand.primary_color }}">...</div>

<!-- repeater → escopo de item (resultado do compileToLiquid) -->
{% for item in roteiro %}
<div class="card">
  <img src="{{ item.imagem }}" alt="{{ item.titulo }}">
  <h3>{{ item.titulo }}</h3>
  <p>{{ item.descricao }}</p>
</div>
{% endfor %}
```

---

### `src/engine/index.ts` (utility / config)

**Analog:** nenhum — re-export simples da API pública

**Core pattern:**
```typescript
export { parse } from './parser';
export { render } from './renderer';
export { sanitizeRichText, sanitizeUrl, sanitizeCssColor } from './sanitizers';
export type { FieldType, TokenField, ParsedSchema, ParseWarning } from './schema';
```

---

### `vitest.config.ts` (config)

**Analog:** `renova-turismo-jornada-main/vitest.config.ts` (linhas 1–16) — match de role, ambiente diferente

**Divergência crítica:** A SPA de referência usa `environment: "jsdom"` e `plugins: [react()]` porque
testa componentes React. O engine PageForge é Node puro — sem DOM, sem React. Copiar o config da SPA
diretamente quebraria os testes. O ambiente correto é `"node"`.

**Padrão da SPA de referência** (para entender a estrutura, NÃO copiar literalmente):
```typescript
// renova-turismo-jornada-main/vitest.config.ts (linhas 1-16)
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],           // ← NÃO usar no PageForge engine (sem React)
  test: {
    environment: "jsdom",       // ← NÃO usar; engine é Node puro → usar "node"
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

**Padrão correto para o PageForge engine:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',          // engine é Node puro — sem browser APIs
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
```

---

### `tests/engine/parser.test.ts` (test, transform)

**Analog:** estrutura de `describe`/`it`/`expect` do Vitest — padrão universal

**Core pattern** (extraído de `01-RESEARCH.md` linhas 826–861, adaptado para parser):
```typescript
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/engine';

describe('parse() — schema assertions (TPL-02)', () => {
  it('detecta todos os seis tipos de campo', () => {
    const markup = `
      <div>
        {{ titulo:text }}
        {{ descricao:richtext }}
        {{ imagem:image }}
        {{ cor:color }}
        {{ link:button }}
        <!-- repeat:itens -->{{ item_nome:text }}<!-- /repeat:itens -->
      </div>`;
    const schema = parse(markup);
    const types = schema.fields.map(f => f.type);
    expect(types).toContain('text');
    expect(types).toContain('richtext');
    expect(types).toContain('image');
    expect(types).toContain('color');
    expect(types).toContain('button');
    expect(schema.repeaters).toContain('itens');
  });

  it('token sem tipo → "text" + warning (D-04)', () => {
    const schema = parse('<p>{{ campo_sem_tipo }}</p>');
    const field = schema.fields.find(f => f.name === 'campo_sem_tipo');
    expect(field?.type).toBe('text');
    expect(schema.warnings).toHaveLength(1);
    expect(schema.warnings[0].message).toMatch(/sem tipo/i);
  });

  it('token com tipo desconhecido → "text" + warning (D-04)', () => {
    const schema = parse('<p>{{ campo:banana }}</p>');
    const field = schema.fields.find(f => f.name === 'campo');
    expect(field?.type).toBe('text');
    expect(schema.warnings[0].message).toMatch(/tipo desconhecido/i);
  });

  it('detecta tokens brand.* como globals (D-09)', () => {
    const schema = parse('<img src="{{ brand.logo:image }}">');
    expect(schema.globals).toContain('logo');
    const field = schema.fields.find(f => f.name === 'brand.logo');
    expect(field?.global).toBe(true);
  });
});
```

---

### `tests/engine/renderer.test.ts` (test, request-response)

**Analog:** padrão `toMatchFileSnapshot` do Vitest — documentado em `01-RESEARCH.md` linhas 866–896

**Core pattern — golden file + repeaters 0/1/N** (extraído de `01-RESEARCH.md` linhas 866–896):
```typescript
import { describe, it, expect } from 'vitest';
import { render, parse } from '../../src/engine';
import { greciaTemplate } from '../fixtures/grecia-template';
import { greciaValues, greciaBrand } from '../fixtures/grecia-values';

describe('Fixture Grécia — Golden File (GEN-05, TPL-04)', () => {
  it('renderiza o template completo com valores de referência', async () => {
    const html = await render(greciaTemplate, greciaValues, greciaBrand);
    await expect(html).toMatchFileSnapshot('./tests/__snapshots__/grecia.output.html');
  });

  it('repeater roteiro com 0 itens renderiza sem crash', async () => {
    const html = await render(greciaTemplate, { ...greciaValues, roteiro: [] }, greciaBrand);
    expect(html).toContain('id="roteiro"'); // seção existe mas sem cards
  });

  it('repeater roteiro com 1 item renderiza 1 card', async () => {
    const html = await render(greciaTemplate, { ...greciaValues, roteiro: [greciaValues.roteiro[0]] }, greciaBrand);
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

### `tests/engine/security.test.ts` (test, transform)

**Analog:** nenhum — padrão parametrizado extraído de `01-RESEARCH.md` linhas 826–861

**Corpus de payloads e padrão de teste** (extraído de `01-RESEARCH.md` linhas 829–861):
```typescript
import { describe, it, expect } from 'vitest';
import { render } from '../../src/engine';

const PAYLOADS = [
  `{{constructor.constructor('return process.env')()}}`,
  '{{__proto__.polluted}}',
  '"><img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  'expression(alert(1))',
  '#fff; background:url(javascript:alert(1))',
  '<script>alert(1)</script>',
  '" onmouseover="alert(1)',
  'data:text/html,<script>alert(1)</script>',
  '\x00<script>alert(1)</script>',
];

const FIELD_TYPES = ['text', 'richtext', 'image', 'color', 'button'] as const;

describe('Corpus de Segurança SSTI/XSS (GEN-06, D-16)', () => {
  for (const fieldType of FIELD_TYPES) {
    for (const payload of PAYLOADS) {
      it(`[${fieldType}] payload "${payload.slice(0, 40)}..." renderiza inerte`, async () => {
        const markup = `<div>{{ campo_teste:${fieldType} }}</div>`;
        const html = await render(markup, { campo_teste: payload }, {});
        expect(html).not.toContain('<script');
        expect(html).not.toContain('onerror=');
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('expression(');
      });
    }
  }
});
```

---

### `tests/fixtures/grecia-template.html` (fixture)

**Analog direto:** componentes em `renova-turismo-jornada-main/src/components/campaigns/grecia/`

Este é o arquivo mais dependente de leitura da SPA de referência. O planner deve instruir o
implementador a ler cada componente abaixo antes de montar o template tokenizado.

**Mapa de repeaters identificados na SPA Grécia:**

| Repeater | Componente fonte | Campos por-item | Campos estáticos do bloco |
|----------|-----------------|-----------------|--------------------------|
| `destaques` | `Hero.tsx` linhas 9–28 (`floatingCards`) | `imagem:image`, `titulo:text`, `descricao:richtext` | subtítulo "Renova Turismo apresenta", CTA "Reservar Agora" |
| `info_cards` | `SobreViagem.tsx` linhas 33–63 (array inline de `[{icon, label, value}]`) | `label:text`, `valor:text` | textos de "Sobre a Jornada", subtítulo, separador |
| `inclusos` | `Inclusos.tsx` linhas 3–33 (`items` array) | `titulo:text`, `texto:text` | cabeçalho "O que está incluso", subtítulo |
| `roteiro` | `Roteiro.tsx` linhas 28–106 (`slides` array) | `imagem:image`, `imagem_alt:text`, `regiao:text`, `regiao_en:text`, `dia:text`, `titulo:text`, `descricao:richtext`, `destaque:text` | cabeçalho "Roteiro Grécia", subtítulo "11 dias", CTA "Garanta Sua Vaga" |
| `diferenciais` | `PorQueRenova.tsx` linhas 3–8 (`reasons` array) | `titulo:text`, `texto:text` | cabeçalho "Por que a Renova", subtítulo |
| `depoimentos` | `Depoimentos.tsx` linhas 4–22 (`testimonials` array) | `nome:text`, `localidade:text`, `quote:richtext` | cabeçalho "Depoimentos", subtítulo |

**Tokens top-level (campos por-LP, não repeater):**

| Token | Tipo | Seção | Componente |
|-------|------|-------|------------|
| `hero_subtitulo` | `text` | Hero | `Hero.tsx` linha 93: "Renova Turismo apresenta" |
| `hero_titulo_linha1` | `text` | Hero | `Hero.tsx` linha 95: "Explore" |
| `hero_titulo_linha2` | `text` | Hero | `Hero.tsx` linha 96: "a Grécia" |
| `hero_titulo_linha3` | `text` | Hero | `Hero.tsx` linha 97: "Eterna" |
| `hero_descricao` | `richtext` | Hero | `Hero.tsx` linha 100–102: parágrafo descritivo |
| `hero_imagem` | `image` | Hero | `Hero.tsx` linha 4: `heroImg` (hero-santorini.jpg) |
| `cta_primary_label` | `text` | Hero | `Hero.tsx` linha 108: "Reservar Agora" |
| `cta_primary_url` | `button` | Hero | `Hero.tsx` linha 107: `href="#contato"` |
| `sobre_descricao_1` | `richtext` | Sobre | `SobreViagem.tsx` linhas 21–28: parágrafo 1 |
| `sobre_descricao_2` | `richtext` | Sobre | `SobreViagem.tsx` linhas 29–31: parágrafo 2 |
| `roteiro_subtitulo` | `text` | Roteiro | `Roteiro.tsx` linha 135: "11 dias inesquecíveis: ..." |
| `cta_roteiro_label` | `text` | Roteiro | `Roteiro.tsx` linha 230: "Garanta Sua Vaga" |
| `inscrevase_subtitulo` | `text` | CTA | `InscrevaSe.tsx` linha 38: "Vagas limitadas" |
| `inscrevase_titulo_1` | `text` | CTA | `InscrevaSe.tsx` linha 40: "Garanta seu" |
| `inscrevase_titulo_2` | `text` | CTA | `InscrevaSe.tsx` linha 43: "Lugar" |
| `inscrevase_descricao` | `richtext` | CTA | `InscrevaSe.tsx` linhas 47–49: parágrafo descritivo |
| `inscrevase_cta_label` | `text` | CTA | `InscrevaSe.tsx` linha 57: "Falar no WhatsApp" |

**Tokens brand (globais, prefixo `brand.`):**

| Token | Tipo | Aparece em | Componente / Linha |
|-------|------|-----------|-------------------|
| `brand.whatsapp` | `button` | Navbar, Roteiro, InscrevaSe, Footer | `Navbar.tsx` linha 13–14, `Roteiro.tsx` linha 108–109, `InscrevaSe.tsx` linha 6 |
| `brand.logo` | `image` | Navbar, Footer | `Navbar.tsx` linha 5, `Footer.tsx` linha 4 |
| `brand.instagram` | `button` | Hero, Footer | `Hero.tsx` linha 70, `Footer.tsx` linha 33 |
| `brand.facebook` | `button` | Hero, Footer | `Hero.tsx` linha 74, `Footer.tsx` linha 37 |
| `brand.youtube` | `button` | Hero, Footer | `Hero.tsx` linha 78, `Footer.tsx` linha 41 |
| `brand.email` | `text` | Footer | `Footer.tsx` linha 48 |
| `brand.phone` | `text` | Footer | `Footer.tsx` linha 44 |
| `brand.primary_color` | `color` | (CSS custom property) | variável CSS `--grecia-deep` em `Hero.tsx` linha 51 |

**Estrutura de delimitadores de repeater no template tokenizado:**
```html
<!-- repeat:roteiro -->
<div class="card-roteiro">
  <img src="{{ item.imagem:image }}" alt="{{ item.imagem_alt:text }}">
  <span>{{ item.dia:text }}</span>
  <h3>{{ item.titulo:text }}</h3>
  <div>{{ item.descricao:richtext }}</div>
  <p>{{ item.destaque:text }}</p>
</div>
<!-- /repeat:roteiro -->

<!-- repeat:inclusos -->
<div class="card-incluso">
  <h3>{{ item.titulo:text }}</h3>
  <p>{{ item.texto:text }}</p>
</div>
<!-- /repeat:inclusos -->

<!-- repeat:depoimentos -->
<div class="card-depoimento">
  <p>{{ item.quote:richtext }}</p>
  <p>{{ item.nome:text }}</p>
  <p>{{ item.localidade:text }}</p>
</div>
<!-- /repeat:depoimentos -->
```

**Arquivos da SPA que o implementador DEVE ler antes de montar o fixture:**
- `/home/glow/Documentos/projetos/PageForge/renova-turismo-jornada-main/src/components/campaigns/grecia/Hero.tsx`
- `/home/glow/Documentos/projetos/PageForge/renova-turismo-jornada-main/src/components/campaigns/grecia/SobreViagem.tsx`
- `/home/glow/Documentos/projetos/PageForge/renova-turismo-jornada-main/src/components/campaigns/grecia/Roteiro.tsx`
- `/home/glow/Documentos/projetos/PageForge/renova-turismo-jornada-main/src/components/campaigns/grecia/Inclusos.tsx`
- `/home/glow/Documentos/projetos/PageForge/renova-turismo-jornada-main/src/components/campaigns/grecia/PorQueRenova.tsx`
- `/home/glow/Documentos/projetos/PageForge/renova-turismo-jornada-main/src/components/campaigns/grecia/Depoimentos.tsx`
- `/home/glow/Documentos/projetos/PageForge/renova-turismo-jornada-main/src/components/campaigns/grecia/InscrevaSe.tsx`
- `/home/glow/Documentos/projetos/PageForge/renova-turismo-jornada-main/src/components/campaigns/grecia/Navbar.tsx`
- `/home/glow/Documentos/projetos/PageForge/renova-turismo-jornada-main/src/components/landing/Footer.tsx`

---

### `tests/fixtures/grecia-values.ts` (fixture)

**Analog:** `renova-turismo-jornada-main/src/data/campaigns.ts` (estrutura de dados de campanha) +
dados hardcoded nos componentes Grécia

**Fonte dos dados por repeater:**

| Repeater | Fonte dos valores | Localização |
|----------|------------------|-------------|
| `roteiro` | Array `slides` (7 itens) | `Roteiro.tsx` linhas 28–106 |
| `inclusos` | Array `items` (6 itens) | `Inclusos.tsx` linhas 3–33 |
| `depoimentos` | Array `testimonials` (3 itens) | `Depoimentos.tsx` linhas 4–22 |
| `destaques` | Array `floatingCards` (3 itens) | `Hero.tsx` linhas 9–28 |
| `diferenciais` | Array `reasons` (5 itens) | `PorQueRenova.tsx` linhas 3–8 |
| `info_cards` | Array inline (3 itens) | `SobreViagem.tsx` linhas 33–63 |

**Estrutura esperada do arquivo:**
```typescript
// tests/fixtures/grecia-values.ts
export const greciaValues = {
  hero_subtitulo: 'Renova Turismo apresenta',
  hero_titulo_linha1: 'Explore',
  hero_titulo_linha2: 'a Grécia',
  hero_titulo_linha3: 'Eterna',
  hero_descricao: '<p>Uma jornada entre deuses, ilhas e o azul mais profundo...</p>',
  hero_imagem: '/assets/grecia/hero-santorini.jpg',
  cta_primary_label: 'Reservar Agora',
  cta_primary_url: 'https://api.whatsapp.com/send/?phone=5519992016125&...',
  sobre_descricao_1: '<p>A Grécia é o ponto de encontro entre mito e mar...</p>',
  sobre_descricao_2: '<p>Pequenos grupos, guias em português...</p>',
  roteiro: [
    { imagem: '/assets/grecia/egeu.jpg', imagem_alt: 'Vista aérea de enseada grega', regiao: 'São Paulo → Atenas', regiao_en: 'Departure', dia: '1º — 2º Dia', titulo: 'GUARULHOS → ATENAS', descricao: '<p>Apresentação no aeroporto...</p>', destaque: 'O início de uma jornada...' },
    // ... 6 itens adicionais de Roteiro.tsx linhas 40–105
  ],
  inclusos: [
    { titulo: 'Guias Especializados', texto: 'Guias locais falando português...' },
    // ... 5 itens adicionais de Inclusos.tsx linhas 3–33
  ],
  depoimentos: [
    { nome: 'Dr. Felipe Silva', localidade: 'Campinas/SP', quote: '<p>Excelente empresa...</p>' },
    // ... 2 itens adicionais de Depoimentos.tsx linhas 4–22
  ],
  // destaques e diferenciais seguem mesmo padrão
};

export const greciaBrand = {
  whatsapp: 'https://api.whatsapp.com/send/?phone=5519992016125&...',
  logo: '/assets/logo-renova.svg',
  instagram: 'https://instagram.com/renovaturismo',
  facebook: 'https://facebook.com/renovaturismo',
  youtube: 'https://youtube.com/@renovaturismo',
  email: 'contato@renovaturismo.com.br',
  phone: '+55 19 3241-2424',
  primary_color: '#0a1628',
};
```

---

## Shared Patterns

### Configuração LiquidJS (Segurança)

**Fonte:** `01-RESEARCH.md` linhas 765–772 + D-10 (CONTEXT.md linhas 67–70)
**Aplicar em:** `src/engine/renderer.ts`

```typescript
const engine = new Liquid({
  outputEscape: 'escape',    // OBRIGATÓRIO — auto-escapa HTML em {{ saídas }}
  ownPropertyOnly: true,     // OBRIGATÓRIO — bloqueia prototype pollution
  strictVariables: false,    // undefined → '' (não crash)
  strictFilters: false,
});
```

**Guardrails fixos (D-10):**
- Pinnar `liquidjs@^10.27.0` no `package.json` (3 CVEs corrigidas nessa versão)
- NUNCA usar `ownPropertyOnly: false`
- NUNCA usar `{% render %}` tag (Fase 1 não tem subtemplates — evita CVE-2026-44646)

### Sequência de Sanitização Rich-Text

**Fonte:** `01-RESEARCH.md` linhas 372–380 + Pitfall 1 (linhas 690–698)
**Aplicar em:** `src/engine/renderer.ts` (pré-processamento), `tests/engine/security.test.ts`

```
valor richtext bruto
  → sanitizeRichText() [sanitize-html com allowlist D-11]
  → passar ao render() como valor no scope
  → template Liquid usa {{ campo | raw }} para saída sem re-escaping
```

**Nunca:** `{{ campo | raw }}` sem sanitização prévia. **Nunca:** sanitizar após o render.

### Escaping Context-Aware por Tipo

**Fonte:** `01-RESEARCH.md` linhas 255–261 + Pitfall 2 (linhas 701–709)
**Aplicar em:** `src/engine/renderer.ts` (pré-processamento), `src/engine/sanitizers.ts`

| Tipo | Mecanismo | Responsável |
|------|-----------|-------------|
| `text` | `outputEscape: 'escape'` do LiquidJS | automático |
| `richtext` | `sanitize-html` antes + `\| raw` no template | `sanitizeRichText()` |
| `image` | `outputEscape` + `sanitizeUrl()` | `sanitizeUrl()` |
| `color` | `sanitizeCssColor()` regex allowlist | `sanitizeCssColor()` |
| `button` | `sanitizeUrl()` allowlist de scheme | `sanitizeUrl()` |

### Degradação Tolerante do Parser

**Fonte:** D-04 (CONTEXT.md linha 39) + `01-RESEARCH.md` linhas 410–425
**Aplicar em:** `src/engine/parser.ts`

- Token sem `:tipo` → `text` + emit warning (nunca crash)
- Tipo desconhecido → `text` + emit warning (nunca crash)
- `ParsedSchema.warnings` acumula todos os warnings para reporting posterior

---

## No Analog Found

Arquivos sem correspondência no codebase existente (planner deve usar padrões do `01-RESEARCH.md`):

| Arquivo | Role | Data Flow | Razão |
|---------|------|-----------|-------|
| `src/engine/schema.ts` | utility/types | transform | Greenfield — sem tipos Zod existentes no repo |
| `src/engine/parser.ts` | utility | transform | Greenfield — sem parser de template existente |
| `src/engine/compiler.ts` | utility | transform | Greenfield — sem compilador LiquidJS existente |
| `src/engine/sanitizers.ts` | utility | transform | Greenfield — sem sanitização HTML existente |
| `src/engine/renderer.ts` | service | request-response | Greenfield — sem pipeline de render existente |
| `src/engine/index.ts` | utility/config | — | Greenfield — sem barrel exports existentes |
| `tests/engine/renderer.test.ts` | test | request-response | Greenfield — sem testes existentes no PageForge |
| `tests/engine/security.test.ts` | test | transform | Greenfield — sem testes de segurança existentes |

---

## Metadata

**Escopo de busca de analogs:** `renova-turismo-jornada-main/` (única codebase existente)
**Arquivos da SPA inspecionados:** 12
- `src/components/campaigns/grecia/Hero.tsx`
- `src/components/campaigns/grecia/SobreViagem.tsx`
- `src/components/campaigns/grecia/Roteiro.tsx`
- `src/components/campaigns/grecia/Inclusos.tsx`
- `src/components/campaigns/grecia/PorQueRenova.tsx`
- `src/components/campaigns/grecia/Depoimentos.tsx`
- `src/components/campaigns/grecia/InscrevaSe.tsx`
- `src/components/campaigns/grecia/Navbar.tsx`
- `src/components/landing/Footer.tsx`
- `src/data/campaigns.ts`
- `vitest.config.ts`
- `playwright.config.ts`
**Data de mapeamento:** 2026-06-01
