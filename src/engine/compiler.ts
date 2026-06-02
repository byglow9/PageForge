import type { ParsedSchema } from './schema.js';

/**
 * Compila o markup engine-agnostic para Liquid puro.
 *
 * Lógica (D-02, D-06, D-07, D-12):
 * 1. Identifica campos por repeater e quais são richtext.
 * 2. Para tokens richtext fora de repeater: {{ campo:richtext }} → {{ campo | raw }}
 * 3. Para tokens richtext dentro de repeater: → {{ item.campo | raw }}
 * 4. Para tokens comuns fora de repeater: {{ campo:tipo }} → {{ campo }}
 * 5. Para tokens comuns dentro de repeater: → {{ item.campo }}
 * 6. <!-- repeat:X --> → {% for item in X %}
 * 7. <!-- /repeat:X --> → {% endfor %}
 *
 * A reescrita de tokens dentro de repeater (passo 3/5) ocorre ANTES da conversão
 * dos delimitadores de comment para for-loop.
 */
export function compileToLiquid(markup: string, schema: ParsedSchema): string {
  // Construir mapa: nomeCampo → nomeRepeater (para campos dentro de repeaters)
  const fieldToRepeater = new Map<string, string>();
  // Construir set: nomeCampo → true se richtext
  const richtextFields = new Set<string>();

  for (const field of schema.fields) {
    if (field.repeater !== null) {
      fieldToRepeater.set(field.name, field.repeater);
    }
    if (field.type === 'richtext') {
      richtextFields.add(field.name);
    }
  }

  let result = markup;

  // Passo 1: Reescrever tokens com anotação de tipo
  // Substituir {{ nome:tipo }} pelo token Liquid correto:
  // - richtext em repeater: {{ item.nome | raw }}
  // - richtext fora de repeater: {{ nome | raw }}
  // - outros em repeater: {{ item.nome }}
  // - outros fora de repeater: {{ nome }}
  result = result.replace(/\{\{\s*([\w.]+)(?::(\w+))?\s*\}\}/g, (_match, name: string) => {
    const inRepeater = fieldToRepeater.has(name);
    const isRichtext = richtextFields.has(name);

    if (inRepeater) {
      // Extrair o nome local do campo (sem o prefixo brand. se houver)
      const localName = name;
      if (isRichtext) {
        return `{{ item.${localName} | raw }}`;
      }
      return `{{ item.${localName} }}`;
    }

    if (isRichtext) {
      return `{{ ${name} | raw }}`;
    }

    return `{{ ${name} }}`;
  });

  // Passo 2: Converter delimitadores comment para tags Liquid for-loop (D-06)
  result = result.replace(/<!--\s*repeat:(\w+)\s*-->/g, '{% for item in $1 %}');
  result = result.replace(/<!--\s*\/repeat:(\w+)\s*-->/g, '{% endfor %}');

  return result;
}
