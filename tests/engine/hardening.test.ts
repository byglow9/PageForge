import { describe, it, expect } from 'vitest';
import { render, parse } from '../../src/engine/index.js';
import { sanitizeUrl, sanitizeCssColor } from '../../src/engine/sanitizers.js';

/**
 * Regressões dos achados do code review da Fase 1 (01-REVIEW.md).
 * Cada teste corresponde a uma issue: CR-01, CR-02, WR-01, WR-03, WR-04.
 */

describe('CR-01 — valores de brand são sanitizados por tipo', () => {
  it('brand image com javascript: vira # (não executa)', async () => {
    const html = await render(
      '<img src="{{ brand.logo:image }}">',
      {},
      { logo: 'javascript:alert(1)' }
    );
    expect(html).not.toContain('javascript:');
    expect(html).toContain('src="#"');
  });

  it('brand richtext é sanitizado (script removido, formatação mantida)', async () => {
    const html = await render(
      '<div>{{ brand.bio:richtext }}</div>',
      {},
      { bio: '<script>alert(1)</script><p>olá</p>' }
    );
    expect(html).not.toContain('<script');
    expect(html).toContain('<p>olá</p>');
  });

  it('brand color inválida vira vazio', async () => {
    const html = await render(
      '<div style="color: {{ brand.cor:color }}">x</div>',
      {},
      { cor: 'expression(alert(1))' }
    );
    expect(html).not.toContain('expression');
  });
});

describe('CR-02 — Liquid injetado pelo autor do template é neutralizado', () => {
  it('{{ campo | raw }} não é honrado como raw (renderiza literal, inerte)', async () => {
    // 'titulo' é um token text válido; o autor tenta forçar | raw num segundo uso.
    const html = await render(
      '<p>{{ titulo:text }}</p><div>{{ titulo | raw }}</div>',
      { titulo: '<script>alert(1)</script>' },
      {}
    );
    expect(html).not.toContain('<script');
  });

  it('{% assign %} injetado pelo autor não é executado', async () => {
    const html = await render(
      "<p>{% assign x = 1 %}{{ x }}</p>",
      {},
      {}
    );
    // A tag não deve ser interpretada como Liquid; chaves viram literais inertes.
    expect(html).not.toContain('<script');
    expect(html).toContain('%&#125;'); // delimitador neutralizado
  });
});

describe('WR-01 — sanitizeUrl bloqueia URLs protocol-relative', () => {
  it('//evil.com vira #', () => {
    expect(sanitizeUrl('//evil.com')).toBe('#');
  });
  it('mantém https e caminhos relativos', () => {
    expect(sanitizeUrl('https://ok.com')).toBe('https://ok.com');
    expect(sanitizeUrl('/assets/x.jpg')).toBe('/assets/x.jpg');
  });
});

describe('WR-03 — sanitizeCssColor rejeita strings não-cor', () => {
  it('palavra arbitrária vira vazio', () => {
    expect(sanitizeCssColor('notacolor')).toBe('');
  });
  it('aceita hex e cores nomeadas válidas', () => {
    expect(sanitizeCssColor('#0a1628')).toBe('#0a1628');
    expect(sanitizeCssColor('red')).toBe('red');
    expect(sanitizeCssColor('transparent')).toBe('transparent');
  });
});

describe('WR-04 — repeater aninhado emite warning (flat-only v1, D-08)', () => {
  it('aninhamento gera parse warning', () => {
    const schema = parse(
      '<!-- repeat:outer -->{{ a:text }}<!-- repeat:inner -->{{ b:text }}<!-- /repeat:inner --><!-- /repeat:outer -->'
    );
    const nested = schema.warnings.find((w) => /aninhado/i.test(w.message));
    expect(nested).toBeTruthy();
  });
});
