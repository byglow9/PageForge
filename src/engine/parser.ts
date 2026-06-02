import { ParsedSchemaSchema } from './schema.js';
import type { ParsedSchema, TokenField, ParseWarning, FieldType } from './schema.js';

// Regexes para scanning do markup (D-06, D-01/D-02)
const REPEAT_OPEN = /<!--\s*repeat:(\w+)\s*-->/g;
const REPEAT_CLOSE = /<!--\s*\/repeat:(\w+)\s*-->/g;
const TOKEN_PATTERN = /\{\{\s*([\w.]+)(?::(\w+))?\s*\}\}/g;

const VALID_TYPES = new Set<string>(['text', 'richtext', 'image', 'color', 'button', 'repeater']);

// Fase 3: Classificação de tipo com degradação tolerante (D-04)
function resolveType(
  raw: string | undefined,
  tokenName: string,
  warnings: ParseWarning[]
): FieldType {
  if (!raw) {
    warnings.push({
      token: tokenName,
      message: `Token "${tokenName}" sem tipo — usando "text"`,
    });
    return 'text';
  }
  if (!VALID_TYPES.has(raw)) {
    warnings.push({
      token: tokenName,
      message: `Token "${tokenName}" tem tipo desconhecido "${raw}" — usando "text"`,
    });
    return 'text';
  }
  return raw as FieldType;
}

// Fase 4: Namespace brand (D-09)
function isBrandToken(name: string): boolean {
  return name.startsWith('brand.');
}

// Extrai a chave brand sem o prefixo "brand."
function brandKey(name: string): string {
  return name.slice('brand.'.length);
}

export function parse(markup: string): ParsedSchema {
  const warnings: ParseWarning[] = [];
  const fields: TokenField[] = [];
  const seenFields = new Set<string>(); // para deduplicar tokens com mesmo nome
  const repeaters: string[] = [];
  const seenRepeaters = new Set<string>();
  const globals: string[] = [];
  const seenGlobals = new Set<string>();

  // Fase 1: Localizar posições dos blocos repeat (D-06)
  // Cada repeater: { name, start (início do <!-- repeat:X -->), end (fim do <!-- /repeat:X -->) }
  interface RepeaterRange {
    name: string;
    start: number;
    end: number;
  }

  const repeaterRanges: RepeaterRange[] = [];

  // Primeira passagem: mapear REPEAT_OPEN
  const openMatches: Array<{ name: string; pos: number }> = [];
  let m: RegExpExecArray | null;
  REPEAT_OPEN.lastIndex = 0;
  while ((m = REPEAT_OPEN.exec(markup)) !== null) {
    openMatches.push({ name: m[1], pos: m.index });
  }

  // Segunda passagem: mapear REPEAT_CLOSE
  const closeMatches: Array<{ name: string; pos: number }> = [];
  REPEAT_CLOSE.lastIndex = 0;
  while ((m = REPEAT_CLOSE.exec(markup)) !== null) {
    closeMatches.push({ name: m[1], pos: m.index + m[0].length });
  }

  // Parear open/close por nome (flat-only, D-08)
  for (const open of openMatches) {
    const close = closeMatches.find((c) => c.name === open.name);
    if (close) {
      repeaterRanges.push({ name: open.name, start: open.pos, end: close.pos });
      if (!seenRepeaters.has(open.name)) {
        seenRepeaters.add(open.name);
        repeaters.push(open.name);
      }
    } else {
      // Bloco repeat aberto sem fechamento correspondente (D-04 tolerante)
      warnings.push({
        token: open.name,
        message: `Bloco repeat "${open.name}" aberto sem <!-- /repeat:${open.name} --> correspondente — ignorado`,
      });
    }
  }

  // Detectar repeaters aninhados — v1 é flat-only (D-08). Aninhamento produz
  // output incorreto silencioso (loops com a mesma variável 'item'); avisar (WR-04/D-04).
  for (const inner of repeaterRanges) {
    const outer = repeaterRanges.find(
      (r) => r !== inner && inner.start > r.start && inner.end <= r.end
    );
    if (outer) {
      warnings.push({
        token: inner.name,
        message: `Repeater "${inner.name}" está aninhado dentro de "${outer.name}" — repeaters aninhados não são suportados na v1 (flat-only, D-08)`,
      });
    }
  }

  // Fase 2: Localizar tokens e determinar qual repeater os contém
  TOKEN_PATTERN.lastIndex = 0;
  while ((m = TOKEN_PATTERN.exec(markup)) !== null) {
    const tokenName = m[1];
    const rawType = m[2];
    const tokenPos = m.index;

    // Determinar se o token está dentro de um repeater
    let repeaterName: string | null = null;
    for (const range of repeaterRanges) {
      if (tokenPos > range.start && tokenPos < range.end) {
        repeaterName = range.name;
        break;
      }
    }

    // Fase 3: Resolver tipo com tolerância (D-04)
    const type = resolveType(rawType, tokenName, warnings);

    // Fase 4: Classificar brand.* (D-09)
    const global = isBrandToken(tokenName);
    if (global) {
      const key = brandKey(tokenName);
      if (!seenGlobals.has(key)) {
        seenGlobals.add(key);
        globals.push(key);
      }
    }

    // Deduplicar campos com mesmo nome+repeater
    const dedupKey = `${tokenName}|${repeaterName ?? ''}`;
    if (!seenFields.has(dedupKey)) {
      seenFields.add(dedupKey);
      fields.push({
        name: tokenName,
        type,
        repeater: repeaterName,
        global,
      });
    }
  }

  // Validar o schema com Zod antes de retornar
  const raw = { fields, repeaters, globals, warnings };
  try {
    return ParsedSchemaSchema.parse(raw);
  } catch (err) {
    throw new Error(`parse(): schema inválido — ${String(err)}`);
  }
}
