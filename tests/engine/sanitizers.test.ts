/**
 * Testes RED para sanitizers.ts — Tarefa 1 do Plano 03.
 *
 * Esses testes DEVEM FALHAR com o stub atual de sanitizeRichText
 * e PASSAR após a implementação real com sanitize-html (D-11).
 */
import { describe, it, expect } from 'vitest';
import {
  sanitizeRichText,
  sanitizeUrl,
  sanitizeCssColor,
  RICHTEXT_SANITIZE_OPTIONS,
} from '../../src/engine/sanitizers.js';

describe('sanitizeRichText (D-11 — allowlist estrita)', () => {
  it('remove <script> e retorna string sem a tag', () => {
    const result = sanitizeRichText('<script>alert(1)</script>texto');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(1)');
  });

  it('preserva tags permitidas: p e strong', () => {
    const result = sanitizeRichText('<p>bold <strong>texto</strong></p>');
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
    expect(result).toContain('texto');
  });

  it('remove <img> com onerror (img não está na allowlist)', () => {
    const result = sanitizeRichText('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
  });

  it('remove href javascript: de <a> (scheme não permitido)', () => {
    const result = sanitizeRichText('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain('javascript:');
    expect(result).toContain('link');
  });

  it('preserva href https: em <a>', () => {
    const result = sanitizeRichText('<a href="https://ok.com">link</a>');
    expect(result).toContain('href="https://ok.com"');
    expect(result).toContain('link');
  });

  it('RICHTEXT_SANITIZE_OPTIONS exportado tem allowProtocolRelative: false', () => {
    expect(RICHTEXT_SANITIZE_OPTIONS).toBeDefined();
    expect((RICHTEXT_SANITIZE_OPTIONS as Record<string, unknown>).allowProtocolRelative).toBe(false);
  });

  it('não é um stub pass-through — <script> não atravessa', () => {
    // Se ainda for o stub, o resultado SERÁ '<script>alert(1)</script>texto'
    const result = sanitizeRichText('<script>alert(1)</script>texto');
    // Essa asserção falha no stub atual (que retorna o html sem alterar)
    expect(result).not.toContain('<script>alert(1)</script>');
  });
});

describe('sanitizeUrl (D-12 — scheme allowlist)', () => {
  it('bloqueia javascript: e retorna #', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
  });

  it('bloqueia data: e retorna #', () => {
    expect(sanitizeUrl('data:text/html,<script>')).toBe('#');
  });

  it('bloqueia vbscript: e retorna #', () => {
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('#');
  });

  it('permite https:', () => {
    expect(sanitizeUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });

  it('permite mailto:', () => {
    expect(sanitizeUrl('mailto:user@example.com')).toBe('mailto:user@example.com');
  });

  it('permite tel:', () => {
    expect(sanitizeUrl('tel:+5519992016125')).toBe('tel:+5519992016125');
  });

  it('retorna vazio para string vazia', () => {
    expect(sanitizeUrl('')).toBe('');
  });

  it('permite caminhos relativos /assets/img.jpg (sem scheme)', () => {
    expect(sanitizeUrl('/assets/img.jpg')).toBe('/assets/img.jpg');
  });

  it('permite caminhos relativos ./img.jpg (sem scheme)', () => {
    expect(sanitizeUrl('./img.jpg')).toBe('./img.jpg');
  });
});

describe('sanitizeCssColor (D-12 — regex allowlist)', () => {
  it('bloqueia expression() e retorna vazio', () => {
    expect(sanitizeCssColor('expression(alert(1))')).toBe('');
  });

  it('bloqueia url(javascript:) e retorna vazio', () => {
    expect(sanitizeCssColor('url(javascript:alert(1))')).toBe('');
  });

  it('permite hex #0a1628', () => {
    expect(sanitizeCssColor('#0a1628')).toBe('#0a1628');
  });

  it('permite rgb()', () => {
    expect(sanitizeCssColor('rgb(10, 22, 40)')).toBe('rgb(10, 22, 40)');
  });

  it('permite named color red', () => {
    expect(sanitizeCssColor('red')).toBe('red');
  });

  it('rejeita hex inválido #gg1234', () => {
    expect(sanitizeCssColor('#gg1234')).toBe('');
  });
});
