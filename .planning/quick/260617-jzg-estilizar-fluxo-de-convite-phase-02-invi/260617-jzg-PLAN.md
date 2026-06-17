---
phase: quick/260617-jzg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/app/w/[slug]/members/InviteLinkDialog.tsx
  - apps/web/src/app/w/[slug]/members/page.tsx
  - apps/web/src/app/invitations/[id]/page.tsx
  - apps/web/src/app/invitations/[id]/AcceptButton.tsx
autonomous: true
requirements: [STYLE-INVITE-01, STYLE-INVITE-02]

must_haves:
  truths:
    - "After generating an invite, a Dialog modal opens automatically over the Members page showing the invite link"
    - "The Dialog has a Copy button that copies the link to the clipboard"
    - "Closing the Dialog clears ?inviteUrl= from the URL (no modal on refresh)"
    - "The inline Alert block inside the Invite card is removed from members/page.tsx"
    - "The invitation acceptance page shows a centered Card layout for all states (not found, revoked, expired, already accepted, unauthenticated, email-unverified, valid)"
    - "AcceptButton uses Button/Alert from the design system while preserving role='alert', useTransition, and the error surfacing logic unchanged"
  artifacts:
    - path: "apps/web/src/app/w/[slug]/members/InviteLinkDialog.tsx"
      provides: "Client island — Dialog with copy-to-clipboard for invite link"
      exports: ["InviteLinkDialog"]
    - path: "apps/web/src/app/w/[slug]/members/page.tsx"
      provides: "Server Component — renders InviteLinkDialog passing inviteUrl prop; inline Alert block removed"
    - path: "apps/web/src/app/invitations/[id]/page.tsx"
      provides: "Server Component — all states wrapped in centered Card layout"
    - path: "apps/web/src/app/invitations/[id]/AcceptButton.tsx"
      provides: "Client island — Button/Alert from design system, identical logic to current"
  key_links:
    - from: "apps/web/src/app/w/[slug]/members/page.tsx"
      to: "InviteLinkDialog"
      via: "<InviteLinkDialog inviteUrl={inviteUrl} />"
      pattern: "InviteLinkDialog"
    - from: "InviteLinkDialog"
      to: "useRouter"
      via: "router.replace to strip ?inviteUrl= on close"
      pattern: "router\\.replace"
    - from: "apps/web/src/app/invitations/[id]/AcceptButton.tsx"
      to: "acceptInvitationAction"
      via: "startTransition(async () => { const result = await acceptInvitationAction(...) })"
      pattern: "acceptInvitationAction"
---

<objective>
Restyle the invite-link flow and the invitation acceptance page to match the
existing design system (shadcn/ui + Tailwind, base-ui primitives) used by the
auth pages.

Purpose: The two surfaces are the last unstyled flows in the Phase 2 invitation
feature. Completing them makes the product coherent end-to-end.

Output:
- InviteLinkDialog.tsx (new client island) — Dialog modal with copy button
- members/page.tsx updated — inline Alert removed, InviteLinkDialog wired
- invitations/[id]/page.tsx restyled — centered Card for all 6 states
- AcceptButton.tsx restyled — Button/Alert primitives, logic 100% preserved
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md

<interfaces>
<!-- Design system primitives available. Extracted from codebase. -->

From apps/web/src/components/ui/dialog.tsx (uses @base-ui/react/dialog):
```typescript
// All components are named exports — NOT default exports
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
         DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger }

// Dialog.Root accepts: open?: boolean, onOpenChange?: (open: boolean) => void
// DialogContent: wraps Backdrop + Popup, includes X close button by default
// DialogFooter accepts showCloseButton?: boolean prop
// DialogHeader: flex flex-col gap-2
// DialogTitle: DialogPrimitive.Title (required for a11y)
// DialogDescription: DialogPrimitive.Description
```

From apps/web/src/components/ui/card.tsx:
```typescript
export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
// Card size prop: "default" | "sm"
// CardFooter: flex items-center rounded-b-xl border-t bg-muted/50
```

From apps/web/src/components/ui/alert.tsx:
```typescript
export { Alert, AlertTitle, AlertDescription, AlertAction }
// Alert already has role="alert" on its root div
// variant: "default" | "destructive"
```

From apps/web/src/components/ui/button.tsx (uses @base-ui/react/button):
```typescript
// variants: default | outline | secondary | ghost | destructive | link
// sizes: default (h-8) | xs (h-6) | sm (h-7) | lg (h-9) | icon | icon-xs | icon-sm
```

Auth page pattern (apps/web/src/app/(auth)/login/page.tsx):
```tsx
// Centering shell:
<main className="flex min-h-screen items-center justify-center bg-background px-4">
  <Card className="w-full max-w-sm">
    <CardHeader><CardTitle>...</CardTitle><CardDescription>...</CardDescription></CardHeader>
    <CardContent>...</CardContent>
    <CardFooter>...</CardFooter>
  </Card>
</main>
```

From apps/web/src/app/invitations/[id]/AcceptButton.tsx (current, to preserve):
```typescript
"use client"
import { useState, useTransition } from "react"
import { acceptInvitationAction } from "@/lib/workspaces/actions"

export function AcceptButton({ invitationId }: { invitationId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await acceptInvitationAction(invitationId)
      if (!result.ok) { setError(result.error) }
    })
  }
  // renders button + conditional error paragraph with role="alert"
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create InviteLinkDialog client island and wire it into members/page.tsx</name>
  <files>
    apps/web/src/app/w/[slug]/members/InviteLinkDialog.tsx
    apps/web/src/app/w/[slug]/members/page.tsx
  </files>
  <action>
Create apps/web/src/app/w/[slug]/members/InviteLinkDialog.tsx as a "use client" component.

Props: `{ inviteUrl: string | undefined }`.

Behaviour:
- The Dialog open state is derived from `inviteUrl` being a non-empty string. On mount (or when inviteUrl changes) set `open = !!inviteUrl` via useState initialised from the prop.
- `onOpenChange`: when the dialog closes, call `router.replace` (from `useRouter` — import from "next/navigation") to strip the `?inviteUrl=` query param, keeping the rest of the URL intact (use `window.location.pathname` for the base path to avoid importing params). Set `open = false`.
- Copy button: uses `navigator.clipboard.writeText(inviteUrl)` inside an async handler. Show "Copied!" label for 2 seconds after success (useState boolean `copied`). Use the `Button` primitive (size="sm").
- Dialog structure:
  - `<Dialog open={open} onOpenChange={handleOpenChange}>`
  - `<DialogContent>` (showCloseButton=true, default)
  - `<DialogHeader>`
    - `<DialogTitle>Invite link generated</DialogTitle>`
    - `<DialogDescription>Share the link below. It expires after one use.</DialogDescription>`
  - `</DialogHeader>`
  - Inside DialogContent after DialogHeader: a `<code>` block for the link, styled `block rounded bg-muted px-2 py-1.5 font-mono text-xs break-all select-all mt-2`, displaying `inviteUrl`.
  - `<DialogFooter showCloseButton={false}>` containing only the Copy button.
- Import: Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle from "@/components/ui/dialog"; Button from "@/components/ui/button".

Do NOT render anything if `inviteUrl` is undefined — return null early (the component is always rendered by the server, but is a no-op when there is no URL).

In apps/web/src/app/w/[slug]/members/page.tsx:
- Add import for InviteLinkDialog (relative: "./InviteLinkDialog").
- Remove the `{inviteUrl && (<Alert>...</Alert>)}` block (lines 115-125 in the current file) from inside CardContent of the "Invite a member" card.
- Add `<InviteLinkDialog inviteUrl={inviteUrl} />` immediately before the closing `</div>` of the return (outside the canManage guard so it renders even if the user navigates back with the query param, though in practice only admins reach this state). Placing it just before `</div>` at the root level is fine.
- No other changes to members/page.tsx — preserve all server actions, guards, and the rest of the JSX.
  </action>
  <verify>
    <automated>cd /home/glow/Documentos/projetos/PageForge && pnpm --filter web tsc --noEmit 2>&1 | grep -E "InviteLinkDialog|members/page" || echo "no type errors in changed files"</automated>
  </verify>
  <done>
    InviteLinkDialog.tsx exists and exports InviteLinkDialog. members/page.tsx imports and renders it. The inline Alert block is absent from members/page.tsx. TypeScript reports no errors in the two changed files.
  </done>
</task>

<task type="auto">
  <name>Task 2: Restyle invitation acceptance page and AcceptButton</name>
  <files>
    apps/web/src/app/invitations/[id]/page.tsx
    apps/web/src/app/invitations/[id]/AcceptButton.tsx
  </files>
  <action>
Restyle apps/web/src/app/invitations/[id]/page.tsx — presentation layer only.

Wrap EVERY state branch in the same centering shell used by the auth pages:

```
<main className="flex min-h-screen items-center justify-center bg-background px-4">
  <Card className="w-full max-w-sm">
    ...
  </Card>
</main>
```

Add imports at top: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter from "@/components/ui/card"; Button from "@/components/ui/button"; Link from "next/link". Keep all existing imports (headers, auth, lookupInvitation, isInvitationExpired, AcceptButton).

State-by-state treatment (preserve all text, only swap HTML primitives for design system components):

1. Not found: CardTitle="Invitation not found", CardDescription="This invitation link is invalid or has been removed.", CardFooter with Link href="/" styled as `text-sm text-muted-foreground hover:text-foreground underline underline-offset-4`.

2. Revoked: CardTitle="Invitation revoked", CardDescription="This invitation has been revoked by the workspace administrator.", same footer link pattern.

3. Already accepted: CardTitle="Invitation already accepted", CardDescription="This invitation has already been used.", same footer link.

4. Expired: CardTitle="Invitation expired", CardDescription="This invitation link has expired. Please ask the workspace administrator for a new invite.", same footer link.

5. Not signed in (no session): CardTitle="You have been invited", CardContent with a paragraph "You have been invited to join a workspace as [role] (bold)." and "To accept, please sign in or create an account.", CardFooter with two Buttons: primary `<Button asChild><Link href={`/login?invitationId=${id}`}>Sign in</Link></Button>` and ghost/outline `<Button variant="outline" asChild><Link href={`/signup?invitationId=${id}`}>Create an account</Link></Button>`. Keep the expiry note as a `<p className="text-xs text-muted-foreground mt-2">` inside CardContent.

6. Email unverified: CardTitle="Email verification required", CardContent paragraph "You must verify your email address before accepting an invitation.", CardFooter with `<Button asChild><Link href={`/verify-email?invitationId=${id}`}>Verify your email</Link></Button>`.

7. Valid (authenticated + verified): CardTitle="Workspace invitation", CardContent with "You have been invited to join as [role] (bold).", "Signed in as: [email] (bold).", expiry note as `<p className="text-xs text-muted-foreground mt-2">`. Then `<AcceptButton invitationId={id} />`. CardFooter with a ghost Decline link: `<Button variant="ghost" size="sm" asChild><Link href="/">Decline</Link></Button>`.

DO NOT change any conditional logic, security checks, session lookups, or the order of the if-branches. The only change is the JSX/HTML structure of each return value.

Restyle apps/web/src/app/invitations/[id]/AcceptButton.tsx:

Replace the raw `<button>` and `<p role="alert">` with design system primitives. The logic (useState, useTransition, handleClick, acceptInvitationAction call, result.ok check) must be 100% identical.

- Import Button from "@/components/ui/button"; Alert, AlertDescription from "@/components/ui/alert". Keep existing imports (useState, useTransition, acceptInvitationAction).
- Replace `<button type="button" onClick={handleClick} disabled={isPending}>` with `<Button type="button" onClick={handleClick} disabled={isPending} className="w-full">`.
- Replace `<p role="alert" style={{ color: "#dc2626" }}>{error}</p>` with `<Alert variant="destructive" role="alert" className="mt-3"><AlertDescription>{error}</AlertDescription></Alert>`.
  - Note: Alert from the design system already renders a `role="alert"` on its root div. Adding role="alert" explicitly as a prop on Alert is redundant but harmless — include it anyway to preserve the tested attribute selector (`role="alert"` in UAT Test 7 relies on the DOM attribute being present, which it is via Alert's own implementation). This keeps the UAT Test 7 guarantee intact.
- The JSX wrapper `<div>` around button + error remains; it provides structural grouping inside the parent page.
  </action>
  <verify>
    <automated>cd /home/glow/Documentos/projetos/PageForge && pnpm --filter web tsc --noEmit 2>&1 | grep -E "invitations" || echo "no type errors in invitation files"</automated>
  </verify>
  <done>
    invitations/[id]/page.tsx uses Card centering for all 6 state branches. AcceptButton.tsx uses Button and Alert primitives. The role="alert" attribute is present on the error element in the DOM (via Alert's built-in implementation). All conditional logic and security guards are identical to the original. TypeScript reports no errors.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    - InviteLinkDialog modal opens automatically when ?inviteUrl= is present in members page URL
    - Copy button copies the invite URL to clipboard and shows "Copied!" feedback
    - Closing the dialog strips the query param (no re-open on refresh)
    - Inline Alert inside the Invite card is gone
    - Invitation acceptance page has a centered Card layout for all states (not found, revoked, expired, already accepted, unauthenticated, email-unverified, valid)
    - AcceptButton uses Button/Alert design system components; error message still shows with role="alert" on failure
  </what-built>
  <how-to-verify>
    1. Run `pnpm dev` from the repo root.
    2. Log in as a workspace admin and navigate to /w/{slug}/members.
    3. Fill in the invite form and click "Generate invite link" — the Dialog should open over the page.
    4. Click "Copy" — the button label should briefly show "Copied!".
    5. Close the dialog (X button or Escape) — the URL should no longer contain ?inviteUrl=. Refresh — dialog should not reopen.
    6. Navigate directly to /invitations/{any-invalid-id} — should show a styled "Invitation not found" card centered in the viewport.
    7. Navigate to a valid pending invitation as a signed-out user — should show "You have been invited" card with Sign in / Create an account buttons.
    8. Navigate to a valid invitation as the correct signed-in user — should show "Workspace invitation" card with Accept and Decline.
  </how-to-verify>
  <resume-signal>Type "approved" if all states look correct, or describe any issues found.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client browser -> members page | inviteUrl arrives as a server-rendered prop; client reads but does not source it |
| client browser -> clipboard API | navigator.clipboard is a browser API; no server-side trust boundary crossed |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-q01-01 | Tampering | InviteLinkDialog: inviteUrl prop | accept | inviteUrl is rendered from server searchParams, not user-editable client state; copying a tampered URL harms only the attacker |
| T-q01-02 | Information Disclosure | InviteLinkDialog: invite URL visible in dialog | accept | URL is already in the address bar and intended for sharing; dialog does not expand attack surface |
| T-q01-03 | Spoofing | AcceptButton: invitationId prop | mitigate | invitationId comes from server-rendered await params (T-02-07-01 already mitigated in Phase 2); this task preserves that flow unchanged |
| T-q01-04 | XSS | invitation page: invitation.role rendered in JSX | accept | JSX auto-escapes string interpolation; no dangerouslySetInnerHTML used |
</threat_model>

<verification>
After both auto tasks complete:

- `pnpm --filter web tsc --noEmit` — zero errors
- `grep -n "inviteUrl && (" apps/web/src/app/w/\\[slug\\]/members/page.tsx` — returns no match (inline Alert removed)
- `grep -n "InviteLinkDialog" apps/web/src/app/w/\\[slug\\]/members/page.tsx` — confirms import and usage
- `grep -n "role=\"alert\"" apps/web/src/app/invitations/\\[id\\]/AcceptButton.tsx` — confirms attribute present
- `grep -rn "min-h-screen" apps/web/src/app/invitations/\\[id\\]/page.tsx` — confirms centering shell present
</verification>

<success_criteria>
- Dialog replaces the inline Alert on the members page; no regression to the invite form logic
- Closing the dialog clears the ?inviteUrl= search param without a full navigation
- All 6 invitation page states render inside a centered Card matching the auth page aesthetic
- AcceptButton logic is byte-for-byte identical in behaviour; only the JSX primitives change
- UAT Test 7 (role="alert" error surfacing) continues to pass
- Zero TypeScript errors across all four modified/created files
</success_criteria>

<output>
After task completion, create .planning/quick/260617-jzg-estilizar-fluxo-de-convite-phase-02-invi/260617-jzg-SUMMARY.md
using the summary template at $HOME/.claude/get-shit-done/templates/summary.md.
</output>
