---
phase: quick
plan: 260608-dbk
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/app/(auth)/login/page.tsx
  - apps/web/src/app/(auth)/signup/page.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Login and signup pages render a card centered on screen with title and description in the header"
    - "All form fields show a Label above each Input"
    - "Submit button is full-width"
    - "Error state uses Alert variant=destructive instead of inline red paragraph"
    - "verification_required (login) and verification_sent (signup) states render as a centered card with Alert and Back to login link"
    - "Footer link (sign up / log in toggle) sits inside CardFooter"
    - "Zero logic changes — all useState/FormState, handleSubmit, signIn/signUp calls, input names/attributes, redirect, and text are byte-for-byte identical"
  artifacts:
    - path: "apps/web/src/app/(auth)/login/page.tsx"
      provides: "Styled login page"
    - path: "apps/web/src/app/(auth)/signup/page.tsx"
      provides: "Styled signup page"
  key_links:
    - from: "login/page.tsx"
      to: "shadcn Card / Alert / Button / Input / Label"
      via: "named imports from @/components/ui/*"
    - from: "signup/page.tsx"
      to: "shadcn Card / Alert / Button / Input / Label"
      via: "named imports from @/components/ui/*"
---

<objective>
Style the two auth pages (login and signup) using the existing design system — Tailwind 4 tokens + shadcn/ui components — without touching any logic.

Purpose: The pages currently render unstyled markup. Applying the design system makes them consistent with the homepage and usable in production.
Output: Two rewritten TSX files with Card-centered layout, proper field components, and Alert-based error display.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260608-d6s-homepage-basic-front/ (prior quick task — homepage already styled; match conventions)
</context>

<interfaces>
<!-- Confirmed component APIs extracted from source files. Use exactly these. -->

Card family — apps/web/src/components/ui/card.tsx:
  Card          props: className?, size?("default"|"sm"), ...div
  CardHeader    props: className?, ...div
  CardTitle     props: className?, ...div  (text-base font-medium)
  CardDescription props: className?, ...div  (text-sm text-muted-foreground)
  CardContent   props: className?, ...div  (px-(--card-spacing))
  CardFooter    props: className?, ...div  (border-t bg-muted/50)
  exports: Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent

Alert — apps/web/src/components/ui/alert.tsx:
  Alert         variant: "default" | "destructive"  <-- destructive EXISTS
  AlertTitle    ...div
  AlertDescription ...div
  exports: Alert, AlertTitle, AlertDescription, AlertAction

Button — apps/web/src/components/ui/button.tsx:
  Button        variant: default|outline|secondary|ghost|destructive|link
                size: default|xs|sm|lg|icon|icon-xs|icon-sm|icon-lg
  NOTE: uses @base-ui/react/button as primitive — accepts standard button props
        Use size="lg" + className="w-full" for full-width submit button

Input — apps/web/src/components/ui/input.tsx:
  Input         all standard <input> props (type, name, id, required, autoComplete, minLength, etc.)
  NOTE: uses @base-ui/react/input as primitive

Label — apps/web/src/components/ui/label.tsx:
  Label         htmlFor, className, ...label props

Homepage layout pattern (apps/web/src/app/page.tsx):
  Outer wrapper:  <main className="flex min-h-screen flex-col items-center justify-center bg-background">
  Inner wrapper:  <div className="flex max-w-sm flex-col ... px-4">
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Style login/page.tsx — card layout, field components, Alert error, styled verification state</name>
  <files>apps/web/src/app/(auth)/login/page.tsx</files>
  <action>
Rewrite the JSX/TSX presentation layer only. Preserve every line of logic verbatim (imports of signIn, useState, FormState type, handleSubmit body, window.location.href, all text strings). Only change the returned JSX markup and add UI component imports.

IMPORT ADDITIONS (add after existing imports, no removals):
  import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
  import { Alert, AlertDescription } from "@/components/ui/alert"
  import { Button } from "@/components/ui/button"
  import { Input } from "@/components/ui/input"
  import { Label } from "@/components/ui/label"

LAYOUT — outer wrapper (matches homepage pattern):
  <main className="flex min-h-screen items-center justify-center bg-background px-4">

CARD wrapper:
  <Card className="w-full max-w-sm">

verification_required branch:
  Return the same outer main wrapper with a Card containing:
  - CardHeader: CardTitle "Verify your email first"
  - CardContent: Alert (no variant — default) wrapping the two existing paragraphs about the verification link and checking inbox; each paragraph as AlertDescription
  - CardFooter: the existing <Link href="/login">Back to login</Link> rendered as a link styled with className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"

Main form branch:
  - CardHeader:
      CardTitle "Log in to PageForge"
      CardDescription "Enter your email and password to access your workspace"
  - CardContent:
      - If formState.status === "error": render <Alert variant="destructive"><AlertDescription>{formState.message}</AlertDescription></Alert>
        Remove the existing <p role="alert" style={{color:"red"}}> entirely.
      - <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          - Email field: <div className="flex flex-col gap-1.5"><Label htmlFor="email">Email address</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
          - Password field: <div className="flex flex-col gap-1.5"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required autoComplete="current-password" /></div>
          - Submit: <Button type="submit" size="lg" className="w-full" disabled={formState.status === "loading"}>{formState.status === "loading" ? "Logging in…" : "Log in"}</Button>
        </form>
  - CardFooter:
      <p className="text-sm text-muted-foreground">Don&apos;t have an account?{" "}<Link href="/signup" className="text-foreground underline underline-offset-4 hover:text-foreground/80">Sign up</Link></p>

CRITICAL: Do not change any of the following — they must be identical to the current file:
  - "use client" directive
  - FormState type definition
  - useState initialization
  - handleSubmit function body (all of it, including FormData, signIn.email call, error handling, window.location.href)
  - input name="email", name="password" attributes
  - required, autoComplete, type attributes on inputs
  - All visible text strings (titles, labels, link text, error messages, loading states)
  </action>
  <verify>
    <automated>cd /home/glow/Documentos/projetos/PageForge && grep -c "signIn.email" apps/web/src/app/(auth)/login/page.tsx && grep -c "window.location.href" apps/web/src/app/(auth)/login/page.tsx && grep -c "Card" apps/web/src/app/(auth)/login/page.tsx && grep -c "Alert" apps/web/src/app/(auth)/login/page.tsx</automated>
  </verify>
  <done>login/page.tsx renders a centered Card with CardHeader/CardContent/CardFooter structure, uses Label+Input for fields, Button for submit, Alert variant=destructive for errors, styled verification state — and all signIn/handleSubmit/FormState logic is unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Style signup/page.tsx — card layout, field components, Alert error, styled verification_sent state</name>
  <files>apps/web/src/app/(auth)/signup/page.tsx</files>
  <action>
Same approach as Task 1. Preserve all logic verbatim; only rewrite JSX markup and add UI component imports.

IMPORT ADDITIONS:
  import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
  import { Alert, AlertDescription } from "@/components/ui/alert"
  import { Button } from "@/components/ui/button"
  import { Input } from "@/components/ui/input"
  import { Label } from "@/components/ui/label"

verification_sent branch:
  Same outer main + Card structure as login verification branch.
  - CardHeader: CardTitle "Check your email"
  - CardContent:
      - Alert (default variant) with two AlertDescription items (keep original text about the verification link to formState.email, and about not being able to create/join workspace)
  - CardFooter: <Link href="/login"> with same link styling as login page

Main form branch:
  - CardHeader:
      CardTitle "Create your account"
      CardDescription "Fill in the details below to get started"
  - CardContent:
      - If formState.status === "error": <Alert variant="destructive"><AlertDescription>{formState.message}</AlertDescription></Alert>
        Remove the existing <p role="alert" style={{color:"red"}}> entirely.
      - <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          - Name field: <div className="flex flex-col gap-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" type="text" required autoComplete="name" /></div>
          - Email field: <div className="flex flex-col gap-1.5"><Label htmlFor="email">Email address</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
          - Password field: <div className="flex flex-col gap-1.5"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" /><p className="text-xs text-muted-foreground">Minimum 8 characters</p></div>
          - Submit: <Button type="submit" size="lg" className="w-full" disabled={formState.status === "loading"}>{formState.status === "loading" ? "Creating account…" : "Create account"}</Button>
        </form>
  - CardFooter:
      <p className="text-sm text-muted-foreground">Already have an account?{" "}<Link href="/login" className="text-foreground underline underline-offset-4 hover:text-foreground/80">Log in</Link></p>

CRITICAL: Do not change any of the following:
  - "use client" directive
  - FormState type definition (including verification_sent variant)
  - useState initialization
  - handleSubmit function body (FormData, name/email/password extraction, signUp.email call, error handling, setFormState for verification_sent)
  - input name="name", name="email", name="password" attributes
  - required, minLength={8}, autoComplete, type attributes on all inputs
  - All visible text strings
  </action>
  <verify>
    <automated>cd /home/glow/Documentos/projetos/PageForge && grep -c "signUp.email" apps/web/src/app/(auth)/signup/page.tsx && grep -c "verification_sent" apps/web/src/app/(auth)/signup/page.tsx && grep -c "Card" apps/web/src/app/(auth)/signup/page.tsx && grep -c "Alert" apps/web/src/app/(auth)/signup/page.tsx</automated>
  </verify>
  <done>signup/page.tsx renders a centered Card with all three states (idle/loading form, error alert, verification_sent card) styled consistently, all signUp/handleSubmit/FormState logic unchanged, minLength={8} preserved on password input.</done>
</task>

</tasks>

<verification>
After both tasks:
- Visit http://localhost:3000/login — card centered on screen, no raw markup visible
- Visit http://localhost:3000/signup — same card treatment, name field present
- Submit login with wrong credentials — Alert destructive appears (red-tinted, no inline red paragraph)
- TypeScript build passes: pnpm --filter web build (or pnpm --filter web tsc --noEmit)
</verification>

<success_criteria>
- Both auth pages use Card/CardHeader/CardContent/CardFooter layout centered with min-h-screen flex
- All form fields wrapped in Label+Input pairs with gap-1.5 column layout
- Error messages rendered as Alert variant="destructive" — zero inline style={{color:"red"}} remaining
- verification_required and verification_sent states render as styled cards with Alert and Back to login link
- Submit buttons are full-width (w-full) with size="lg"
- TypeScript compiles with no new errors
- Zero logic changes — all auth calls, FormState branches, input attributes, and redirect behavior are identical to pre-task source
</success_criteria>

<output>
After completion, create `.planning/quick/260608-dbk-style-auth-pages/260608-dbk-SUMMARY.md`
</output>
