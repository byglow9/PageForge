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
      const rawStr = String(fieldValue ?? '');

      if (field.type === 'richtext') {
        safeItem[field.name] = sanitizeRichText(rawStr);
      } else if (field.type === 'button') {
        safeItem[field.name] = sanitizeUrl(rawStr);
      } else if (field.type === 'color') {
        safeItem[field.name] = sanitizeCssColor(rawStr);
      } else {
        // text, image: escapados pelo outputEscape do LiquidJS
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
      safeValues[field.name] = sanitizeUrl(String(raw ?? ''));
    } else if (field.type === 'color') {
      safeValues[field.name] = sanitizeCssColor(String(raw ?? ''));
    } else {
      // text, image: passados como-está (LiquidJS escapa via outputEscape)
      safeValues[field.name] = raw;
    }
  }

  // Montar scope final: valores seguros + brand
  const scope = { ...safeValues, brand };

  return engine.parseAndRender(compiledLiquid, scope);
}
