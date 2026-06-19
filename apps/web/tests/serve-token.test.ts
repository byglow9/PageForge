/**
 * Tests for lib/serve/token.ts — HMAC-SHA256 token mint/verify
 *
 * Uses the createTokenUtils(secret) factory so tests never depend on process.env.
 * This matches the pattern resolved in Open Question 2 of 07-RESEARCH.md.
 *
 * Security assertions covered:
 * - T-07-01-01: timingSafeEqual for signature comparison (structural — by verifying
 *   tampered tokens return null, not by testing internals)
 * - T-07-01-02: exp field enforced at verify time
 * - PRJ-04, PRJ-06: scope claims (workspaceId, templateId) preserved in round-trip
 */
import { describe, it, expect } from "vitest";
import { createTokenUtils } from "@/lib/serve/token";

const TEST_SECRET = "test-secret-32-bytes-padded!!!";
const utils = createTokenUtils(TEST_SECRET);

describe("serve token (07-01)", () => {
  it("round-trip valid token — verifyServeToken returns correct ServeClaims", () => {
    const token = utils.mintServeToken("ws1", "tpl1");
    expect(typeof token).toBe("string");
    // Token must contain exactly one dot separator
    const dotCount = (token.match(/\./g) ?? []).length;
    expect(dotCount).toBe(1);

    const claims = utils.verifyServeToken(token);
    expect(claims).not.toBeNull();
    expect(claims).toEqual({
      workspaceId: "ws1",
      templateId: "tpl1",
      exp: expect.any(Number),
    });
    // exp must be in the future (30-minute TTL)
    expect(claims!.exp).toBeGreaterThan(Date.now());
  });

  it("tampered token rejected — bit-flipped token returns null", () => {
    const token = utils.mintServeToken("ws1", "tpl1");
    // Flip the last character of the token
    const tampered = token.slice(0, -1) + (token.slice(-1) === "x" ? "y" : "x");
    const result = utils.verifyServeToken(tampered);
    expect(result).toBeNull();
  });

  it("expired token rejected — token with exp in the past returns null", async () => {
    // Craft a valid HMAC token but with a past expiry to test the expiry check
    const { createHmac } = await import("node:crypto");
    const expiredClaims = {
      workspaceId: "ws1",
      templateId: "tpl1",
      exp: Date.now() - 1000, // 1 second in the past
    };
    const b64 = Buffer.from(JSON.stringify(expiredClaims)).toString("base64url");
    const sig = createHmac("sha256", TEST_SECRET).update(b64).digest("base64url");
    const expiredToken = `${b64}.${sig}`;

    const result = utils.verifyServeToken(expiredToken);
    expect(result).toBeNull();
  });

  it("wrong-secret rejected — token from a different secret returns null", () => {
    const utils2 = createTokenUtils("other-secret!!!!!!!!!!!!!!");
    const tokenFromOtherSecret = utils2.mintServeToken("ws1", "tpl1");
    // Verifying a token from utils2 with utils (TEST_SECRET) must fail
    const result = utils.verifyServeToken(tokenFromOtherSecret);
    expect(result).toBeNull();
  });

  it("scope claims preserved — returned claims contain workspaceId and templateId unchanged", () => {
    const workspaceId = "workspace-abc-123";
    const templateId = "template-xyz-456";
    const token = utils.mintServeToken(workspaceId, templateId);
    const claims = utils.verifyServeToken(token);
    expect(claims).not.toBeNull();
    expect(claims!.workspaceId).toBe(workspaceId);
    expect(claims!.templateId).toBe(templateId);
  });

  it("malformed string (no dot separator) returns null", () => {
    const result = utils.verifyServeToken("nodothere");
    expect(result).toBeNull();
  });
});
