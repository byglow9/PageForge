import { describe, it, expect } from 'vitest';
import { parse, render } from '../../src/engine/index.js';

describe('Engine e2e (walk-up slice)', () => {
  it('parse detecta tipo text', () => {
    const schema = parse('<div>{{ titulo:text }}</div>');
    const field = schema.fields.find((f) => f.name === 'titulo');
    expect(field).toBeDefined();
    expect(field?.name).toBe('titulo');
    expect(field?.type).toBe('text');
  });

  it('parse detecta repeater', () => {
    const schema = parse(
      '<div>{{ s:richtext }}<!-- repeat:x -->{{ y:image }}<!-- /repeat:x --></div>'
    );
    expect(schema.repeaters).toContain('x');
  });

  it('render produz HTML com valor', async () => {
    const html = await render('<p>{{ nome:text }}</p>', { nome: 'Mundo' }, {});
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('Mundo');
  });

  it('render escapa XSS em campo text', async () => {
    const html = await render(
      '<p>{{ msg:text }}</p>',
      { msg: '"><script>alert(1)</script>' },
      {}
    );
    expect(html).not.toContain('<script');
  });
});
