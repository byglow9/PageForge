/**
 * Sanitizadores de segurança para os tipos de campo do engine (GEN-06, D-11, D-12).
 *
 * Implementações reais — Plano 03:
 * - sanitizeRichText: usa sanitize-html com allowlist estrita D-11
 * - sanitizeUrl: allowlist de schemes (rejeita javascript:, data:, vbscript:)
 * - sanitizeCssColor: regex allowlist (rejeita expression(), url(), import())
 */

import sanitizeHtml from 'sanitize-html';

// --- Rich-Text Sanitization (D-11) ---
// Allowlist estrita: apenas formatação básica; sem script/style/on*/iframe/img.
// Source: 01-RESEARCH.md §Sanitização Rich-Text + CONTEXT.md D-11

export const RICHTEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'strong', 'em', 'b', 'i',
    'ul', 'ol', 'li',
    'a',
    'br',
  ],
  allowedAttributes: {
    'a': ['href'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    'a': ['http', 'https', 'mailto'],
  },
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,   // rejeitar //example.com (pode virar http: ou https:)
  disallowedTagsMode: 'discard',  // remover tags não permitidas (padrão)
  enforceHtmlBoundary: true,      // prevenir conteúdo fora do HTML boundary
  parseStyleAttributes: false,    // NÃO parsear atributos style (vetor CSS injection)
};

/**
 * Sanitiza HTML rich-text usando allowlist estrita D-11.
 * Deve ser chamada ANTES de passar o valor para render() como campo richtext.
 *
 * Sequência obrigatória (Pitfall 1):
 *   valor bruto → sanitizeRichText() → scope LiquidJS → {{ campo | raw }}
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICHTEXT_SANITIZE_OPTIONS);
}

// --- URL Sanitization (D-12) —— campos button e image (href/src) ---
// Allowlist de schemes: http, https, mailto, tel.
// Qualquer outro scheme → retorna '#'.
// Source: 01-RESEARCH.md §Escaping Context-Aware + CONTEXT.md D-12
// Nota: LiquidJS outputEscape NÃO bloqueia javascript: em URLs — esse é o Pitfall 2 documentado.

const ALLOWED_URL_SCHEMES = /^(https?:\/\/|mailto:|tel:)/i;

export function sanitizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (!ALLOWED_URL_SCHEMES.test(trimmed)) {
    // Rejeitar: devolver '#' — nunca o valor original
    return '#';
  }
  return trimmed;
}

// --- CSS Color Sanitization (D-12) — campo color ---
// Allowlist de formatos CSS válidos: hex, rgb/rgba, hsl/hsla, named colors.
// Qualquer formato fora do padrão → retorna ''.
// Check secundário: rejeitar valores que contenham palavras perigosas mesmo se
// a regex base passou (edge cases como 'red; expression(...)').
// Source: OWASP XSS Prevention Cheat Sheet + MediaWiki CSS whitelist + 01-RESEARCH.md

const CSS_COLOR_PATTERN =
  /^(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|hsl\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*\)|hsla\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*,\s*[\d.]+\s*\)|[a-z]+)$/i;

export function sanitizeCssColor(raw: string): string {
  const trimmed = raw.trim();
  if (!CSS_COLOR_PATTERN.test(trimmed)) {
    return ''; // Cor inválida → vazio (usa fallback do CSS)
  }
  // Rejeitar qualquer ocorrência de expressões perigosas (check secundário de segurança)
  if (/expression|url|javascript|import/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}
