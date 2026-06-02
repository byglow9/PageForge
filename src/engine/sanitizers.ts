/**
 * Sanitizadores de segurança para os tipos de campo do engine.
 *
 * NOTA: sanitizeRichText é um STUB no Plano 02 — o Plano 03 substituirá
 * com a implementação real usando sanitize-html com allowlist D-11.
 * Os demais sanitizadores (sanitizeUrl, sanitizeCssColor) são implementações
 * reais baseadas em 01-RESEARCH.md §Escaping Context-Aware.
 */

// --- Rich-Text Sanitization ---
// STUB (Plano 02): retorna o valor como-está.
// O Plano 03 substituirá com sanitize-html + allowlist D-11.
export function sanitizeRichText(html: string): string {
  // TODO (Plano 03): substituir com sanitize-html usando RICHTEXT_SANITIZE_OPTIONS
  return html;
}

// --- URL Sanitization (button + image fields) ---
// Implementação real: allowlist de schemes (D-12, Pitfall 2)
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

// --- CSS Color Sanitization (color fields) ---
// Implementação real: allowlist de formatos CSS válidos (D-12)
// Source: OWASP XSS Prevention Cheat Sheet + MediaWiki CSS whitelist
const CSS_COLOR_PATTERN =
  /^(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|hsl\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*\)|hsla\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*,\s*[\d.]+\s*\)|[a-z]+)$/i;

export function sanitizeCssColor(raw: string): string {
  const trimmed = raw.trim();
  if (!CSS_COLOR_PATTERN.test(trimmed)) {
    return ''; // Cor inválida → vazio (usa fallback do CSS)
  }
  // Rejeitar qualquer ocorrência de expressões perigosas
  if (/expression|url|javascript|import/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}
