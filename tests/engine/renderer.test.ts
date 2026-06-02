import { describe, it, expect } from 'vitest';
import { render } from '../../src/engine/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { greciaValues, greciaBrand } from '../fixtures/grecia-values.js';

const greciaTemplate = readFileSync(
  join(process.cwd(), 'tests/fixtures/grecia-template.html'),
  'utf-8'
);

describe('render() — basic behavior', () => {
  it('renderiza template simples com valor text', async () => {
    const html = await render('<p>{{ nome:text }}</p>', { nome: 'Mundo' }, {});
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('Mundo');
  });

  it('escapa XSS em campo text (outputEscape: escape)', async () => {
    const html = await render(
      '<p>{{ msg:text }}</p>',
      { msg: '"><script>alert(1)</script>' },
      {}
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });
});

describe('Fixture Grécia — Golden File (GEN-05, TPL-04)', () => {
  it('renderiza o template completo com valores de referência', async () => {
    const html = await render(greciaTemplate, greciaValues, greciaBrand);
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain('id="inicio"');
    expect(html).toContain('id="roteiro"');
    expect(html).toContain('id="depoimentos"');
    await expect(html).toMatchFileSnapshot('tests/__snapshots__/grecia.output.html');
  });

  it('repeater roteiro com 0 itens renderiza sem crash e sem cards', async () => {
    const html = await render(greciaTemplate, { ...greciaValues, roteiro: [] }, greciaBrand);
    expect(html).toBeDefined();
    expect(html).toContain('id="roteiro"');
    const cardCount = (html.match(/class="card-roteiro"/g) || []).length;
    expect(cardCount).toBe(0);
  });

  it('repeater roteiro com 1 item renderiza exatamente 1 card-roteiro', async () => {
    const html = await render(
      greciaTemplate,
      { ...greciaValues, roteiro: [greciaValues.roteiro[0]] },
      greciaBrand
    );
    const cardCount = (html.match(/class="card-roteiro"/g) || []).length;
    expect(cardCount).toBe(1);
  });

  it('repeater roteiro com N itens renderiza exatamente N cards', async () => {
    const html = await render(greciaTemplate, greciaValues, greciaBrand);
    const cardCount = (html.match(/class="card-roteiro"/g) || []).length;
    expect(cardCount).toBe(greciaValues.roteiro.length);
  });
});
