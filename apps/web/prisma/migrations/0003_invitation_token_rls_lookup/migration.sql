-- Migration: 0003_invitation_token_rls_lookup
-- Allows the copyable invitation-link flow to read exactly one invitation row
-- by its opaque ID before the workspace context is known.
--
-- Runtime code must set app.current_invitation_id transaction-locally before
-- calling lookupInvitation(). Workspace-scoped reads and writes still use the
-- tenant_isolation policy from 0002.

CREATE POLICY invitation_token_lookup ON "workspace_invitation"
    FOR SELECT
    USING ("id" = current_setting('app.current_invitation_id', true)::text);
