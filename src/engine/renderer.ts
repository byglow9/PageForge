import { Liquid } from 'liquidjs';
import { parse } from './parser.js';
import { compileToLiquid } from './compiler.js';
import { sanitizeRichText, sanitizeUrl, sanitizeCssColor } from './sanitizers.js';
import type { ParsedSchema } from './schema.js';

/**
 * Engine LiquidJS com guardrails de segurança D-10:
 * - outputEscape: 'escape' → auto-HTML-escapa {{ saídas }} para text/image/button/color
 * - ownPropertyOnly: true → bloqueia acesso a prototype (CVEs corrigidas em v10.27.0)
 * - strictVariables: false → undefined → '' (não crash)
 * - strictFilters: false → filtro desconhecido → pass-through (não crash)
 */
export const engine = new Liquid({
  outputEscape: 'escape',
  ownPropertyOnly: true,
  strictVariables: false,
  strictFilters: false,
});

/**
 * Extracts a plain URL string from a button field value.
 *
 * The LP form (schema-derive.ts) stores button fields as {label: string, url: string}
 * objects. The engine renders button tokens as plain URL strings in href attributes.
 * This helper unwraps the url property when the value is an object, preserving
 * backward compatibility with plain string values (e.g. from fixture tests).
 */
function resolveButtonUrl(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).url === 'string'
  ) {
    return (value as Record<string, unknown>).url as string;
  }
  return '';
}

/**
 * Resolve o valor de um campo `image` para a URL pública.
 *
 * Valores de upload chegam como objeto { publicUrl, s3Key } (vindos do LpForm);
 * este helper extrai `publicUrl`. Mantém compatibilidade com strings simples
 * (ex: fixtures/testes ou dados legados) passando-as adiante inalteradas.
 */
function resolveImageUrl(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).publicUrl === 'string'
  ) {
    return (value as Record<string, unknown>).publicUrl as string;
  }
  return '';
}

/**
 * Pré-processa valores de um repeater: aplica sanitização a cada item recursivamente.
 */
function processRepeaterItems(
  raw: unknown,
  repeaterName: string,
  schema: ParsedSchema
): unknown[] {
  if (!Array.isArray(raw)) return [];

  // Obter campos que pertencem a este repeater
  const itemFields = schema.fields.filter((f) => f.repeater === repeaterName);

  return raw.map((item) => {
    if (typeof item !== 'object' || item === null) return item;
    const safeItem: Record<string, unknown> = {};

    for (const field of itemFields) {
      // O nome do campo dentro do item é o nome sem o prefixo do repeater
      // (ex: campo 'imagem' do repeater 'roteiro' → item.imagem)
      const fieldValue = (item as Record<string, unknown>)[field.name];

      if (field.type === 'richtext') {
        safeItem[field.name] = sanitizeRichText(String(fieldValue ?? ''));
      } else if (field.type === 'button') {
        // button: unwrap {label, url} object from LpForm or use plain string (backward compat)
        safeItem[field.name] = sanitizeUrl(resolveButtonUrl(fieldValue));
      } else if (field.type === 'image') {
        // image: unwrap {publicUrl, s3Key} (ou string legada); src pode conter
        // javascript: — mesmo sanitizeUrl que button (D-12)
        safeItem[field.name] = sanitizeUrl(resolveImageUrl(fieldValue));
      } else if (field.type === 'color') {
        safeItem[field.name] = sanitizeCssColor(String(fieldValue ?? ''));
      } else {
        // text: escapado pelo outputEscape do LiquidJS
        safeItem[field.name] = fieldValue;
      }
    }

    // Preservar campos não declarados no schema (passthrough)
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      if (!(k in safeItem)) {
        safeItem[k] = v;
      }
    }

    return safeItem;
  });
}

/**
 * Renderiza o markup tokenizado com os valores fornecidos, produzindo HTML estático.
 *
 * Pipeline:
 * 1. parse(markup) → schema
 * 2. compileToLiquid(markup, schema) → template Liquid
 * 3. Pré-processar valores por tipo (richtext → sanitize, button/image → sanitizeUrl, color → sanitizeCssColor)
 * 4. Montar scope: { ...safeValues, brand }
 * 5. engine.parseAndRender(compiledLiquid, scope) → HTML estático
 */
export async function render(
  markup: string,
  values: Record<string, unknown>,
  brand: Record<string, unknown>
): Promise<string> {
  const schema = parse(markup);
  const compiledLiquid = compileToLiquid(markup, schema);

  // Pré-processar valores por tipo de campo
  const safeValues: Record<string, unknown> = {};

  // Repeaters: cada repeater é uma chave de array no topo do scope (D-06/D-07).
  // Os itens são sanitizados por tipo de campo dentro de processRepeaterItems.
  for (const repeaterName of schema.repeaters) {
    safeValues[repeaterName] = processRepeaterItems(
      values[repeaterName],
      repeaterName,
      schema
    );
  }

  for (const field of schema.fields) {
    // Pular campos globais (brand.*) — são passados via brand no scope
    if (field.global) continue;
    // Pular campos pertencentes a um repeater — já tratados acima por item
    if (field.repeater) continue;

    const raw = values[field.name];

    if (field.type === 'richtext') {
      safeValues[field.name] = sanitizeRichText(String(raw ?? ''));
    } else if (field.type === 'button') {
      // button: unwrap {label, url} object from LpForm or use plain string (backward compat)
      safeValues[field.name] = sanitizeUrl(resolveButtonUrl(raw));
    } else if (field.type === 'image') {
      // image: unwrap {publicUrl, s3Key} (ou string legada); src pode conter
      // javascript:/data: — mesmo sanitizeUrl que button (D-12)
      safeValues[field.name] = sanitizeUrl(resolveImageUrl(raw));
    } else if (field.type === 'color') {
      safeValues[field.name] = sanitizeCssColor(String(raw ?? ''));
    } else {
      // text: passado como-está (LiquidJS escapa via outputEscape)
      safeValues[field.name] = raw;
    }
  }

  // Sanitizar valores de brand por tipo de campo declarado (CR-01).
  // Campos brand.* são pulados no loop acima (field.global) e iriam direto ao
  // scope sem sanitização — brand.logo:image com 'javascript:' ou brand.x:richtext
  // (renderizado via | raw) seriam vetores de XSS. Sanitizamos pelo tipo aqui.
  const safeBrand: Record<string, unknown> = { ...brand };
  for (const field of schema.fields) {
    if (!field.global) continue;
    const localName = field.name.replace(/^brand\./, '');
    const raw = (brand as Record<string, unknown>)[localName];
    if (field.type === 'richtext') {
      safeBrand[localName] = sanitizeRichText(String(raw ?? ''));
    } else if (field.type === 'button') {
      safeBrand[localName] = sanitizeUrl(resolveButtonUrl(raw));
    } else if (field.type === 'image') {
      safeBrand[localName] = sanitizeUrl(resolveImageUrl(raw));
    } else if (field.type === 'color') {
      safeBrand[localName] = sanitizeCssColor(String(raw ?? ''));
    }
    // text: LiquidJS outputEscape cuida do escaping de entidades HTML
  }

  // Montar scope final: valores seguros + brand sanitizado
  const scope = { ...safeValues, brand: safeBrand };

  return engine.parseAndRender(compiledLiquid, scope);
}
