/**
 * server-only — no 'use server' directive; called from route handler, not Server Action.
 *
 * HMAC-SHA256 token utilities for the isolated serving origin's authorization scheme.
 *
 * Implements D-05: signed/ephemeral token scoped to {workspaceId, templateId} with
 * 30-minute TTL. The token is minted by the dashboard and verified by the serving
 * route handler, which has no access to the session cookie.
 *
 * Security:
 * - T-07-01-01: timingSafeEqual from node:crypto — no timing oracle on signature comparison
 * - T-07-01-02: exp baked into HMAC payload; enforced on every verify call
 * - T-07-01-03: process.env.SERVE_TOKEN_SECRET! — fails at module load if absent (fail-fast)
 * - PRJ-04, PRJ-06: scope claims (workspaceId, templateId) prevent cross-tenant access
 *
 * The createTokenUtils(secret) factory enables unit tests to pass a known secret
 * without reading process.env. Top-level mintServeToken/verifyServeToken are the
 * production API, using process.env.SERVE_TOKEN_SECRET!.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Claims embedded in the signed token. */
export interface ServeClaims {
  workspaceId: string;
  templateId: string;
  /** Expiry timestamp — milliseconds since epoch (Date.now() + TTL). */
  exp: number;
}

/** TTL: 30 minutes in milliseconds. */
const TTL_MS = 30 * 60 * 1000;

/**
 * Factory that returns mint/verify functions bound to the provided secret.
 *
 * Use this in tests so no process.env dependency is needed:
 *   const utils = createTokenUtils('test-secret-32-bytes-padded!!!')
 *   const token = utils.mintServeToken('ws1', 'tpl1')
 *   const claims = utils.verifyServeToken(token)
 *
 * In production, use the top-level mintServeToken / verifyServeToken exports
 * which read process.env.SERVE_TOKEN_SECRET! automatically.
 */
export function createTokenUtils(secret: string): {
  mintServeToken: (workspaceId: string, templateId: string) => string;
  verifyServeToken: (token: string) => ServeClaims | null;
} {
  function mintServeToken(workspaceId: string, templateId: string): string {
    const payload: ServeClaims = {
      workspaceId,
      templateId,
      exp: Date.now() + TTL_MS,
    };
    const data = JSON.stringify(payload);
    const b64 = Buffer.from(data).toString("base64url");
    const sig = createHmac("sha256", secret).update(b64).digest("base64url");
    return `${b64}.${sig}`;
  }

  function verifyServeToken(token: string): ServeClaims | null {
    try {
      // Split on the FIRST dot only — base64url payload may not contain dots,
      // but we want to be explicit: [b64, sig] from "b64.sig"
      const dotIdx = token.indexOf(".");
      if (dotIdx === -1) return null;
      const b64 = token.slice(0, dotIdx);
      const sig = token.slice(dotIdx + 1);
      if (!b64 || !sig) return null;

      // Recompute expected signature
      const expected = createHmac("sha256", secret).update(b64).digest("base64url");

      // T-07-01-01: timing-safe comparison — prevents timing oracle on signature
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length) return null;
      if (!timingSafeEqual(sigBuf, expBuf)) return null;

      // Decode claims
      const claims = JSON.parse(
        Buffer.from(b64, "base64url").toString()
      ) as ServeClaims;

      // T-07-01-02: enforce expiry — token must not be expired
      if (Date.now() >= claims.exp) return null;

      return claims;
    } catch {
      // Any parse error (malformed JSON, invalid base64url, etc.) → null
      return null;
    }
  }

  return { mintServeToken, verifyServeToken };
}

// -----------------------------------------------------------------------
// Production singletons — use process.env.SERVE_TOKEN_SECRET!
// T-07-01-03: the ! assertion causes a runtime panic if the env var is absent
// (fail-fast; avoids silently starting with an undefined secret).
// -----------------------------------------------------------------------

const _productionUtils = createTokenUtils(process.env.SERVE_TOKEN_SECRET!);

/**
 * Mint a signed serve token scoped to {workspaceId, templateId} with 30-minute TTL.
 * Reads SERVE_TOKEN_SECRET from process.env — server-only.
 */
export const mintServeToken = _productionUtils.mintServeToken;

/**
 * Verify a serve token. Returns ServeClaims on success, null on any failure
 * (tampered, expired, wrong secret, malformed).
 * Reads SERVE_TOKEN_SECRET from process.env — server-only.
 */
export const verifyServeToken = _productionUtils.verifyServeToken;
