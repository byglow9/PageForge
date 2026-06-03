---
status: complete
phase: 02-multi-tenancy-foundation
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 260603-ju4-SUMMARY.md]
started: 2026-06-03T17:45:00Z
updated: 2026-06-03T17:45:00Z
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
result: issue
reported: "clico em accept mas nao vai nada — nenhum feedback ao aceitar"
severity: major
note: |
  Security IS correct — CR-01 email-match rejection fires server-side; the
  mismatched user was NOT added (verified: micdozylonty stayed owner-only;
  invitation was for renancavenaghizuri). BUT there is NO UI feedback: the
  accept Server Action returns an ActionResult ({ok:false,error} on mismatch)
  and the page's submitAcceptInvitation wrapper IGNORES the return — no error
  shown, no redirect surfaced. CR-03 (POST-only accept) wired the form to the
  action but never wired the result back to the UI.

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
result: issue
reported: "quando logo em uma conta que já tem workspace sou redirecionado para a criação de workspace; só consigo acessar os que já criei digitando a URL"
severity: major
note: |
  No post-login landing / workspace list exists. A returning owner is dumped on
  /workspaces/new with no list of their existing workspaces and must type the
  /w/{slug} URL manually. Breaks usability of the D-05 multi-workspace model
  (no switcher/list). Likely: /workspaces/new (or a new /workspaces index) should
  list the user's memberships with links, and post-login should route there.

## Summary

total: 10
passed: 7
issues: 2
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Accepting an invitation gives the user clear feedback (success → land in workspace; failure/email-mismatch → visible error message)."
  status: failed
  reason: "User reported: clicking Accept does nothing visible. Root cause: submitAcceptInvitation (apps/web/src/app/invitations/[id]/page.tsx) awaits acceptInvitationAction(id) but ignores the returned ActionResult — on {ok:false} (e.g. email mismatch) no error is rendered; only the success path's internal redirect() produces any navigation. Server-side rejection (CR-01) works correctly and securely; the defect is missing UI feedback on the failure/rejection path."
  severity: major
  test: 7
  artifacts: ["apps/web/src/app/invitations/[id]/page.tsx", "apps/web/src/lib/workspaces/actions.ts"]
  missing: ["error-state rendering on the accept form (useActionState or returned-error display)", "user-visible rejection message when invited email != session email"]

- truth: "A returning user who already has workspaces can navigate to them after login without typing URLs."
  status: failed
  reason: "User reported: after login (account with existing workspaces) they are dropped on /workspaces/new and can only reach existing workspaces by typing /w/{slug} manually. No workspace list/picker and no post-login redirect to an existing workspace."
  severity: major
  test: 10
  artifacts: ["apps/web/src/app/workspaces/new/page.tsx", "apps/web/src/app/page.tsx", "apps/web/src/lib/workspaces/guards.ts"]
  missing: ["a workspaces index/list page showing the user's memberships (organization/member) with links to /w/{slug}", "post-login routing to that list (or to a single workspace when only one exists)"]
