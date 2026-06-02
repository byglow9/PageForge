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
// Estratégia: allowlist de schemes absolutos + permitir URLs relativas (sem scheme).
// Schemes permitidos: http, https, mailto, tel, + paths relativos (/..., ./, ../...).
// Schemes bloqueados: javascript:, data:, vbscript: e qualquer outro scheme não listado.
// Source: 01-RESEARCH.md §Escaping Context-Aware + CONTEXT.md D-12
// Nota: LiquidJS outputEscape NÃO bloqueia javascript: em URLs — esse é o Pitfall 2 documentado.

const ALLOWED_URL_SCHEMES = /^(https?:\/\/|mailto:|tel:)/i;
// Qualquer colon antes de // ou antes de letra indica um scheme
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+\-.]*:/;

export function sanitizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Protocol-relative (//host): o browser herda o protocolo da página → open
  // redirect / carregamento de recurso externo. Bloquear (WR-01).
  if (trimmed.startsWith('//')) {
    return '#';
  }

  // Se começa com um scheme (foo:), só permite os schemes da allowlist
  if (HAS_SCHEME.test(trimmed)) {
    if (!ALLOWED_URL_SCHEMES.test(trimmed)) {
      // Bloqueia: javascript:, data:, vbscript:, etc.
      return '#';
    }
    return trimmed;
  }

  // URL relativa (sem scheme e não protocol-relative): segura pois não executa
  // código (ex: /assets/img.jpg, ./img.jpg, #ancora)
  return trimmed;
}

// --- CSS Color Sanitization (D-12) — campo color ---
// Allowlist de formatos CSS válidos: hex, rgb/rgba, hsl/hsla, named colors.
// Qualquer formato fora do padrão → retorna ''.
// Check secundário: rejeitar valores que contenham palavras perigosas mesmo se
// a regex base passou (edge cases como 'red; expression(...)').
// Source: OWASP XSS Prevention Cheat Sheet + MediaWiki CSS whitelist + 01-RESEARCH.md

// Formatos funcionais/hex aceitos. O ramo de palavra-livre [a-z]+ foi removido
// (WR-03): aceitava qualquer string alfabética (ex: 'notacolor', 'inherit').
const CSS_COLOR_PATTERN =
  /^(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|hsl\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*\)|hsla\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*,\s*[\d.]+\s*\))$/i;

// Cores nomeadas / keywords CSS permitidas (allowlist explícita, WR-03).
const NAMED_COLORS = new Set([
  'transparent', 'currentcolor', 'inherit', 'initial', 'unset',
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
  'pink', 'brown', 'gray', 'grey', 'silver', 'gold', 'cyan', 'magenta',
  'navy', 'teal', 'olive', 'maroon', 'lime', 'aqua', 'fuchsia', 'beige',
  'coral', 'crimson', 'indigo', 'ivory', 'khaki', 'lavender', 'salmon',
  'tan', 'turquoise', 'violet', 'wheat',
]);

export function sanitizeCssColor(raw: string): string {
  const trimmed = raw.trim();
  const isValid = CSS_COLOR_PATTERN.test(trimmed) || NAMED_COLORS.has(trimmed.toLowerCase());
  if (!isValid) {
    return ''; // Cor inválida → vazio (usa fallback do CSS)
  }
  // Rejeitar qualquer ocorrência de expressões perigosas (check secundário de segurança)
  if (/expression|url|javascript|import/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}
