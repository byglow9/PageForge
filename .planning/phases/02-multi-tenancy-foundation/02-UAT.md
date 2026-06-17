---
status: complete
phase: 02-multi-tenancy-foundation
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 260603-ju4-SUMMARY.md]
started: 2026-06-03T17:45:00Z
updated: 2026-06-17T18:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Server boots against live Postgres; home page loads with no build/runtime crash (no kysely error, no Invalid origin).
result: pass

### 2. Signup + Email Verification
expected: At /signup, filling name/email/password and submitting creates the account. A verification link is generated (console transport → printed in the server log). Visiting that link verifies the email; you can then log in.
result: pass

### 3. Login (verified user)
expected: At /login, a verified user logs in with email + password and is taken into the app (not bounced to the "verify your email" screen).
result: pass

### 4. Create Workspace
expected: At /workspaces/new, entering a name + slug and clicking "Create workspace" creates it and REDIRECTS you to /w/{slug} (the workspace dashboard) — it does NOT clear the field and stay on the create form.
result: pass

### 5. Access Own Workspace
expected: Visiting /w/{slug} for a workspace you own loads the workspace dashboard (shows your role) — it does NOT bounce you back to /workspaces/new.
result: pass

### 6. Invite a Member (copyable link)
expected: At /w/{slug}/members (as owner/admin), creating an invitation for an email produces a copyable invite link (no email is auto-sent in v1).
result: pass

### 7. Invite Email Mismatch Rejected
expected: Accepting an invitation while logged in as a user whose email does NOT match the invited email is rejected (you do not silently join the workspace).
result: pass
note: |
  Re-verified 2026-06-17. Closed by plan 02-07 (AcceptButton client island that
  surfaces the {ok:false,error} return via a role="alert" Alert) plus session
  fast tasks: a "Switch account" button on the invite page and a post-login
  invite-redirect. User confirmed end-to-end: switching to the invited account
  and accepting joins correctly; a mismatched accept shows a visible error and
  does NOT join the workspace.

### 8. RBAC — Member Management Restricted
expected: Member management actions (invite, change role, remove) are available to owner/admin only. An editor or viewer cannot invite/remove members.
result: skipped
reason: "Multi-account editor/viewer setup too involved to test manually now. Server-side enforcement confirmed in code review: management actions gate on requireWorkspaceRole(slug, ['owner','admin'])."

### 9. Cross-Tenant Isolation
expected: Visiting /w/{slug} for a workspace you are NOT a member of denies access (redirects to /workspaces/new) — you cannot read another workspace's data by URL/ID.
result: pass
note: "User confirmed: accessing a workspace they are not a member of redirects to /workspaces/new; no other workspace's content is shown. Isolation (SC-3/WS-05) holds at the access layer."

### 10. Post-Login Workspace Landing (emergent finding)
expected: After logging in, a returning user who already has workspace(s) can reach them — e.g. lands on a workspace list/picker or is redirected to a workspace — without memorizing URLs.
result: pass
note: |
  Re-verified 2026-06-17. Closed by plan 02-08 (/workspaces listing page using a
  non-RLS organization/member query + post-login redirect to /workspaces) plus a
  session fast task adding the account name and Log out control to /workspaces.
  User confirmed: after login they land on /workspaces with their membership
  list and can open each workspace via a link.

## Summary

total: 10
passed: 9
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Accepting an invitation gives the user clear feedback (success → land in workspace; failure/email-mismatch → visible error message)."
  status: resolved
  reason: "Closed by plan 02-07 (AcceptButton client island surfacing {ok:false,error} via role=\"alert\") + session fast tasks (Switch account button, post-login invite-redirect). Re-verified by user 2026-06-17."
  severity: major
  test: 7
  artifacts: ["apps/web/src/app/invitations/[id]/AcceptButton.tsx", "apps/web/src/app/invitations/[id]/SwitchAccountButton.tsx", "apps/web/src/app/(auth)/login/page.tsx"]

- truth: "A returning user who already has workspaces can navigate to them after login without typing URLs."
  status: resolved
  reason: "Closed by plan 02-08 (/workspaces listing page + post-login redirect) + session fast task (account name + Log out on /workspaces). Re-verified by user 2026-06-17."
  severity: major
  test: 10
  artifacts: ["apps/web/src/app/workspaces/page.tsx", "apps/web/src/app/workspaces/LogoutButton.tsx", "apps/web/src/lib/workspaces/listing.ts"]
