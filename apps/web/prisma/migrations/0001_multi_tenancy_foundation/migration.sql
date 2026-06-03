-- ============================================================
-- Migration 0001: Multi-Tenancy Foundation
-- ============================================================
-- Creates all tables required by:
--   - better-auth Prisma adapter (user, session, account, verification)
--   - better-auth organization plugin (organization, member, invitation)
--   - PageForge app-level workspace entities (workspace, workspace_member,
--     workspace_invitation, tenant_isolation_probe)
--
-- Also enables PostgreSQL Row-Level Security (RLS) on the
-- tenant_isolation_probe table as the isolation backstop (D-13, F6).
-- ============================================================

-- ------------------------------------------------------------
-- Better Auth tables
-- ------------------------------------------------------------

CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activeOrganizationId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- Organization plugin tables (better-auth)
-- ------------------------------------------------------------

CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");

CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- PageForge app-level workspace entities
-- ------------------------------------------------------------

CREATE TABLE "workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_slug_key" ON "workspace"("slug");

CREATE TABLE "workspace_member" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_member_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_member_workspaceId_userId_key" ON "workspace_member"("workspaceId", "userId");

CREATE TABLE "workspace_invitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invitation_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- TenantIsolationProbe — exemplar tenant-owned table for RLS tests
-- ------------------------------------------------------------

CREATE TABLE "tenant_isolation_probe" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_isolation_probe_pkey" PRIMARY KEY ("id")
);

-- Index to support workspace-scoped lookups
CREATE INDEX "tenant_isolation_probe_workspaceId_idx" ON "tenant_isolation_probe"("workspaceId");

-- ------------------------------------------------------------
-- Foreign key constraints
-- ------------------------------------------------------------

ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_isolation_probe" ADD CONSTRAINT "tenant_isolation_probe_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- PostgreSQL Row-Level Security — TenantIsolationProbe (D-13)
--
-- Defense-in-depth backstop: even if the application-level filter is
-- bypassed, the database enforces workspace_id boundaries.
--
-- Pattern applies to ALL future tenant-owned tables.
-- The transaction-local setting app.current_workspace_id must be set
-- inside every transaction via "SET LOCAL app.current_workspace_id = ..."
-- before any RLS-protected query runs (D-14).
-- ------------------------------------------------------------

-- Enable RLS — policies will apply to all users including table owner
ALTER TABLE "tenant_isolation_probe" ENABLE ROW LEVEL SECURITY;

-- Force RLS — ensures table owner is also subject to the policy
ALTER TABLE "tenant_isolation_probe" FORCE ROW LEVEL SECURITY;

-- Create the tenant isolation policy
CREATE POLICY tenant_isolation ON "tenant_isolation_probe"
    USING (
        "workspaceId" = current_setting('app.current_workspace_id', true)::text
    )
    WITH CHECK (
        "workspaceId" = current_setting('app.current_workspace_id', true)::text
    );
