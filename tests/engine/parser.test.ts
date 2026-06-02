import { describe, it, expect } from 'vitest';
import { parse } from '../../src/engine/index.js';
import { compileToLiquid } from '../../src/engine/compiler.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('parse() — schema assertions (TPL-02)', () => {
  it('detecta tipo text', () => {
    const schema = parse('<div>{{ titulo:text }}</div>');
    const field = schema.fields.find((f) => f.name === 'titulo');
    expect(field).toBeDefined();
    expect(field?.type).toBe('text');
    expect(field?.repeater).toBeNull();
    expect(field?.global).toBe(false);
  });

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
    const types = schema.fields.map((f) => f.type);
    expect(types).toContain('text');
    expect(types).toContain('richtext');
    expect(types).toContain('image');
    expect(types).toContain('color');
    expect(types).toContain('button');
    expect(schema.repeaters).toContain('itens');
  });

  it('parse detecta repeater e tokens dentro do repeater com escopo correto', () => {
    const schema = parse(
      '<div>{{ s:richtext }}<!-- repeat:x -->{{ y:image }}<!-- /repeat:x --></div>'
    );
    expect(schema.repeaters).toContain('x');
    const yField = schema.fields.find((f) => f.name === 'y');
    expect(yField?.repeater).toBe('x');
  });

  it('token sem tipo → "text" + warning com mensagem "sem tipo" (D-04)', () => {
    const schema = parse('<p>{{ campo_sem_tipo }}</p>');
    const field = schema.fields.find((f) => f.name === 'campo_sem_tipo');
    expect(field?.type).toBe('text');
    expect(schema.warnings.length).toBeGreaterThanOrEqual(1);
    expect(schema.warnings[0].message).toMatch(/sem tipo/i);
  });

  it('token com tipo desconhecido → "text" + warning com "tipo desconhecido" (D-04)', () => {
    const schema = parse('<p>{{ campo:banana }}</p>');
    const field = schema.fields.find((f) => f.name === 'campo');
    expect(field?.type).toBe('text');
    expect(schema.warnings[0].message).toMatch(/tipo desconhecido/i);
  });

  it('detecta tokens brand.* como globals (D-09)', () => {
    const schema = parse('<img src="{{ brand.logo:image }}">');
    expect(schema.globals).toContain('logo');
    const field = schema.fields.find((f) => f.name === 'brand.logo');
    expect(field?.global).toBe(true);
  });

  it('campo richtext é compilado com filtro | raw (D-12)', () => {
    const schema = parse('<div>{{ corpo:richtext }}</div>');
    const liquid = compileToLiquid('<div>{{ corpo:richtext }}</div>', schema);
    expect(liquid).toContain('| raw');
    expect(liquid).toContain('{{ corpo | raw }}');
  });

  it('compileToLiquid reescreve tokens de repeater como item.campo (D-07)', () => {
    const markup = '<!-- repeat:rot -->{{ dia:text }}<!-- /repeat:rot -->';
    const schema = parse(markup);
    const liquid = compileToLiquid(markup, schema);
    expect(liquid).toContain('{% for item in rot %}');
    expect(liquid).toContain('{{ item.dia }}');
  });

  it('compileToLiquid remove anotação :type de tokens não-repeater não-richtext', () => {
    const markup = '<p>{{ titulo:text }}</p>';
    const schema = parse(markup);
    const liquid = compileToLiquid(markup, schema);
    expect(liquid).toBe('<p>{{ titulo }}</p>');
  });

  it('fixture Grécia: parse detecta os 6 repeaters esperados', () => {
    const greciaTemplate = readFileSync(
      join(process.cwd(), 'tests/fixtures/grecia-template.html'),
      'utf-8'
    );
    const schema = parse(greciaTemplate);
    expect(schema.repeaters).toContain('destaques');
    expect(schema.repeaters).toContain('info_cards');
    expect(schema.repeaters).toContain('inclusos');
    expect(schema.repeaters).toContain('roteiro');
    expect(schema.repeaters).toContain('diferenciais');
    expect(schema.repeaters).toContain('depoimentos');
  });
});
