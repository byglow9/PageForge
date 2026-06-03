/**
 * better-auth client configuration.
 *
 * Client-side auth client. Import this in React components and
 * client-side Server Action callers. The server-side `auth` object
 * is for route handlers and Server Actions only.
 */
"use client";

import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";

import { ac, roles } from "@/lib/auth/permissions";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac,
      roles,
    }),
  ],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  organization,
  useActiveOrganization,
} = authClient;
