/**
 * Corpus de Segurança SSTI/XSS — GEN-06, D-15, D-16
 *
 * 60 testes parametrizados: 10 payloads × 6 contextos de campo
 * (text, richtext, image, color, button, repeater-text)
 *
 * Cada teste prova que o payload é neutralizado — o HTML resultante
 * não contém marcadores de injeção executáveis no contexto específico
 * do campo.
 *
 * Nota sobre asserções context-aware:
 * - Campos text/image/repeater-text: o LiquidJS outputEscape escapa <>&"'
 *   Portanto `<script>` vira `&lt;script&gt;` (inerte). A asserção correta
 *   verifica que não há tags HTML executáveis (não escapadas).
 * - Campos richtext: sanitize-html remove scripts antes do render.
 * - Campos button: sanitizeUrl bloqueia javascript:/data: → '#'.
 * - Campos color: sanitizeCssColor bloqueia expression()/url() → ''.
 *
 * D-16: todos os seis tipos fuzzados, incluindo dentro de repeater.
 */
import { describe, it, expect } from 'vitest';
import { render } from '../../src/engine/index.js';

// ---------------------------------------------------------------------------
// Corpus de Ameaças D-16 (10 payloads)
// ---------------------------------------------------------------------------
const PAYLOADS = [
  /* P1  */ `{{constructor.constructor('return process.env')()}}`,
  /* P2  */ `{{__proto__.polluted}}`,
  /* P3  */ `"><img src=x onerror=alert(1)>`,
  /* P4  */ `javascript:alert(1)`,
  /* P5  */ `expression(alert(1))`,
  /* P6  */ `#fff; background:url(javascript:alert(1))`,
  /* P7  */ `<script>alert(1)</script>`,
  /* P8  */ `" onmouseover="alert(1)`,
  /* P9  */ `data:text/html,<script>alert(1)</script>`,
  /* P10 */ `\x00<script>alert(1)</script>`,
] as const;

// ---------------------------------------------------------------------------
// Asserções de inercia por contexto de campo
//
// Para cada contexto de campo, verificamos que o HTML produzido não contém
// nenhuma forma executável de injeção. Em campos text/image, os payloads
// HTML são escapados (ex: < → &lt;) portanto são inofensivos como texto —
// a asserção correta verifica ausência de tags não-escapadas.
// ---------------------------------------------------------------------------

/**
 * Verifica que o HTML é inerte para campos text/image/repeater-text.
 * Nesses contextos o LiquidJS escapa < para &lt;, tornando tags inertes.
 *
 * Princípio: verificamos EXECUTABILIDADE, não presença de strings.
 *
 * Campos text/image/repeater-text: o LiquidJS outputEscape escapa < para &lt;
 * e > para &gt;, então NENHUMA tag HTML nova pode ser injetada pelo payload.
 * - `onerror=alert(1)` dentro de src="..." é inerte (escapado como valor)
 * - `javascript:alert(1)` como texto em body é inerte (não é href)
 * - Apenas `src` como atributo real com value javascript:/data: seria perigoso
 *   → mas sanitizeUrl() bloqueia isso para campos image
 */
function assertInertHtmlEscapedContext(html: string): void {
  // Nenhuma tag <script> executável (não escapada com &lt;)
  // "<script" seria perigoso; "&lt;script" é inerte
  expect(html).not.toMatch(/<script[\s>]/i);
  // LiquidJS escapa < para &lt;, portanto nenhuma nova tag pode ser aberta
  // pelo payload. Verificamos que < não seguido de entidade é de tag original.
  // (Verificação direta: o payload não pode introduzir tags executáveis)

  // Para campos image: sanitizeUrl já bloqueia javascript:/data: em src real.
  // Verificar que src real do elemento não tem javascript: ou data:
  // Nota: src="&#34;&gt;&lt;img src=x onerror=..." é inerte pois é um valor
  // escapado dentro do atributo src original — o browser não interpreta como HTML.
  expect(html).not.toMatch(/\bsrc\s*=\s*["']\s*javascript:/i);
  expect(html).not.toMatch(/\bsrc\s*=\s*["']\s*data:/i);
  expect(html).not.toMatch(/\bhref\s*=\s*["']\s*javascript:/i);
  expect(html).not.toMatch(/\bhref\s*=\s*["']\s*data:/i);
}

/**
 * Verifica que o HTML é inerte para campos richtext.
 * sanitize-html remove scripts antes do render; mas valores como
 * 'javascript:alert(1)' como texto puro não são injetados como href.
 *
 * Nota: payloads como `" onmouseover="alert(1)` podem aparecer como
 * TEXTO PURO no output (sem tag HTML os contendo) — isso é inerte.
 * A asserção correta verifica que não há event handlers em TAGS reais.
 */
function assertInertRichTextContext(html: string): void {
  // Nenhuma tag <script> executável
  expect(html).not.toContain('<script');
  // Nenhum handler de evento em TAG HTML real (não como texto puro)
  // Ex perigoso: <p onmouseover="alert(1)">
  // Ex inerte: 'onmouseover="alert(1)' como texto puro entre tags
  expect(html).not.toMatch(/<\w+[^>]*\s+on\w+\s*=\s*["'][^"']*["'][^>]*>/i);
  // Nenhum href com javascript: (sanitize-html bloqueia schemes proibidos em href)
  expect(html).not.toMatch(/href\s*=\s*["']javascript:/i);
  // Nenhum href com data: URI
  expect(html).not.toMatch(/href\s*=\s*["']data:/i);
}

/**
 * Verifica que o HTML é inerte para campos button (href).
 * sanitizeUrl bloqueia javascript:, data:, vbscript: → '#'
 * Portanto nenhum href executável deve aparecer.
 */
function assertInertButtonContext(html: string): void {
  expect(html).not.toMatch(/href\s*=\s*["']javascript:/i);
  expect(html).not.toMatch(/href\s*=\s*["']data:/i);
  expect(html).not.toMatch(/href\s*=\s*["']vbscript:/i);
  // Verificar que nenhum script foi injetado
  expect(html).not.toContain('<script');
}

/**
 * Verifica que o HTML é inerte para campos color (CSS).
 * sanitizeCssColor bloqueia expression(), url(javascript:) → ''
 * O campo fica com valor vazio no estilo.
 */
function assertInertColorContext(html: string): void {
  // expression() CSS injection (IE legacy) deve estar bloqueado
  expect(html).not.toContain('expression(');
  // url(javascript:) deve estar bloqueado
  expect(html).not.toMatch(/url\s*\(\s*javascript:/i);
  // Nenhum script injetado
  expect(html).not.toContain('<script');
}

// ---------------------------------------------------------------------------
// Contextos de Campo (6 contextos = 5 tipos diretos + 1 repeater-text)
// ---------------------------------------------------------------------------
type FieldContext = {
  name: string;
  buildMarkup: () => string;
  buildValues: (payload: string) => Record<string, unknown>;
  assertInert: (html: string) => void;
};

const FIELD_CONTEXTS: FieldContext[] = [
  {
    // Contexto 1: texto simples em HTML body — escapado por outputEscape
    name: 'text',
    buildMarkup: () => `<div>{{ campo_teste:text }}</div>`,
    buildValues: (payload) => ({ campo_teste: payload }),
    assertInert: assertInertHtmlEscapedContext,
  },
  {
    // Contexto 2: rich-text — sanitizado por sanitizeRichText() antes do render
    name: 'richtext',
    buildMarkup: () => `<div>{{ campo_teste:richtext }}</div>`,
    buildValues: (payload) => ({ campo_teste: payload }),
    assertInert: assertInertRichTextContext,
  },
  {
    // Contexto 3: atributo src de imagem — escapado por outputEscape
    name: 'image',
    buildMarkup: () => `<img src="{{ campo_teste:image }}" alt="test">`,
    buildValues: (payload) => ({ campo_teste: payload }),
    assertInert: assertInertHtmlEscapedContext,
  },
  {
    // Contexto 4: valor de propriedade CSS — validado por sanitizeCssColor()
    name: 'color',
    buildMarkup: () => `<div style="color: {{ campo_teste:color }}">x</div>`,
    buildValues: (payload) => ({ campo_teste: payload }),
    assertInert: assertInertColorContext,
  },
  {
    // Contexto 5: href de link — validado por sanitizeUrl()
    name: 'button',
    buildMarkup: () => `<a href="{{ campo_teste:button }}">link</a>`,
    buildValues: (payload) => ({ campo_teste: payload }),
    assertInert: assertInertButtonContext,
  },
  {
    // Contexto 6: campo text DENTRO de um repeater — prova que escaping se aplica
    // igualmente a campos dentro de blocos {% for %} (D-16 requisito explícito)
    name: 'repeater-text',
    buildMarkup: () =>
      `<!-- repeat:r -->{{ campo_teste:text }}<!-- /repeat:r -->`,
    buildValues: (payload) => ({ r: [{ campo_teste: payload }] }),
    assertInert: assertInertHtmlEscapedContext,
  },
];

// ---------------------------------------------------------------------------
// Suite Parametrizada — 10 × 6 = 60 testes
// ---------------------------------------------------------------------------
describe('Corpus de Segurança SSTI/XSS (GEN-06, D-16)', () => {
  for (const fieldCtx of FIELD_CONTEXTS) {
    for (let i = 0; i < PAYLOADS.length; i++) {
      const payload = PAYLOADS[i];
      const shortPayload = payload.slice(0, 30);

      it(`[${fieldCtx.name}] payload P${i + 1}: ${shortPayload}`, async () => {
        const markup = fieldCtx.buildMarkup();
        const values = fieldCtx.buildValues(payload);

        const html = await render(markup, values, {});

        // Garantir que o render não lançou (resultado é string válida)
        expect(typeof html).toBe('string');

        // Verificar inercia no contexto específico do campo
        fieldCtx.assertInert(html);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Testes de unidade focados nos sanitizadores individuais (cobertura rápida)
// ---------------------------------------------------------------------------
describe('Sanitizadores individuais — asserções unitárias', () => {
  it('render com richtext contendo <script> produz HTML sem <script', async () => {
    const html = await render(
      '<div>{{ corpo:richtext }}</div>',
      { corpo: '<script>alert(1)</script><p>texto seguro</p>' },
      {}
    );
    expect(html).not.toContain('<script');
    expect(html).toContain('texto seguro');
  });

  it('render com button contendo javascript: produz href="#"', async () => {
    const html = await render(
      '<a href="{{ url:button }}">clique</a>',
      { url: 'javascript:alert(1)' },
      {}
    );
    expect(html).not.toMatch(/href\s*=\s*["']javascript:/i);
    expect(html).toContain('href="#"');
  });

  it('render com color contendo expression() produz estilo vazio', async () => {
    const html = await render(
      '<div style="color: {{ cor:color }}">x</div>',
      { cor: 'expression(alert(1))' },
      {}
    );
    expect(html).not.toContain('expression(');
    // A cor vazia resulta em style="color: " (string vazia — sem valor injetado)
    expect(html).toContain('style="color: "');
  });

  it('render com text contendo SSTI {{constructor...}} não executa código', async () => {
    const payload = `{{constructor.constructor('return process.env')()}}`;
    const html = await render('<p>{{ campo:text }}</p>', { campo: payload }, {});
    // LiquidJS não re-parseia valores de scope como templates
    // O payload é tratado como string de dados e escapado
    // Verificar que não há execução de código (RCE impossível com ownPropertyOnly:true)
    expect(html).not.toMatch(/<script/);
    // O payload inteiro fica como texto escapado — o `{` e `'` são escapados
    expect(html).toContain('constructor');  // texto escapado inerte
    // As chaves {{ e }} são escapadas pelo LiquidJS como text (não interpretadas)
    expect(html).not.toContain('<script');
  });

  it('render com richtext contendo <img onerror=...> remove o atributo perigoso', async () => {
    const html = await render(
      '<div>{{ campo:richtext }}</div>',
      { campo: '<img src="x" onerror="alert(1)"><p>conteúdo</p>' },
      {}
    );
    expect(html).not.toMatch(/onerror\s*=/i);
    expect(html).toContain('conteúdo');
  });

  it('render com button contendo data: URI produz href="#"', async () => {
    const html = await render(
      '<a href="{{ url:button }}">link</a>',
      { url: 'data:text/html,<script>alert(1)</script>' },
      {}
    );
    expect(html).not.toMatch(/href\s*=\s*["']data:/i);
    expect(html).toContain('href="#"');
  });
});
