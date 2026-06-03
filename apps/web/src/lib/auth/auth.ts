/**
 * better-auth server configuration.
 *
 * Enabled features (v1):
 *   - email + password (no OAuth, no magic-link, no MFA — D-01, D-03)
 *   - mandatory email verification before workspace creation (D-02)
 *   - organization plugin with custom roles owner/admin/editor/viewer (D-08)
 *
 * Auth methods NOT configured (by decision):
 *   - OAuth / social login (Google, GitHub, etc.)
 *   - Magic-link / passwordless
 *   - Two-factor / MFA
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send-email";
import { ac, roles } from "@/lib/auth/permissions";

export const auth = betterAuth({
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // ----------------------------------------------------------------
  // Email + password (D-01: only auth method in v1)
  // ----------------------------------------------------------------
  emailAndPassword: {
    enabled: true,
    // D-02: user must verify email before using the workspace
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  // ----------------------------------------------------------------
  // Email verification (D-02)
  // ----------------------------------------------------------------
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your PageForge email address",
        text: `Welcome to PageForge!\n\nClick the link below to verify your email address and activate your account:\n\n${url}\n\nThis link expires in 24 hours.\n\nIf you did not create a PageForge account, you can safely ignore this email.`,
        html: `<p>Welcome to PageForge!</p><p>Click the link below to verify your email address and activate your account:</p><p><a href="${url}">${url}</a></p><p>This link expires in 24 hours.</p><p>If you did not create a PageForge account, you can safely ignore this email.</p>`,
      });
    },
    // D-02: generate and send verification token at signup
    sendOnSignUp: true,
    // Also send verification on login attempt if email is still unverified
    sendOnSignIn: true,
    expiresIn: 60 * 60 * 24, // 24 hours
  },

  // ----------------------------------------------------------------
  // Organization plugin = workspace multi-tenancy (D-08)
  // Custom roles: owner, admin, editor, viewer
  // ----------------------------------------------------------------
  plugins: [
    organization({
      ac,
      roles,
      // D-02 extension: require verified email to accept invitations
      requireEmailVerificationOnInvitation: true,
      // Allow the invited user to create an account on invitation acceptance (D-07)
      allowUserToCreateOrganization: true,
    }),
  ],
});

export type Auth = typeof auth;
