# Research: landing page and zero-branding auth UI

Status: read-only research. No repo file changed except this document. No installs, builds or commits.

## 1. Sources inspected

Repo (read):
- `app/page.tsx`, `app/layout.tsx`, `app/providers.tsx`, `app/editor/page.tsx` (grep only)
- `app/(auth)/layout.tsx`, `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- `proxy.ts`, `lib/auth.ts` (lines 1-80), `lib/clerk-appearance.ts`, `lib/env.ts` (key names only), `next.config.ts`
- `components/editor/user-menu.tsx`, `components/auth/*` (names and grep), `components/canvas/presence-stack.tsx` (comments)
- Specs: `features/02-authentication-and-users/01-requirements.md`, `00-overview.md`, `status.md`; `features/01-app-shell-and-design-system/00-overview.md`; `features/04-.../00-overview.md`; `context/decision-log.md` (grep); `context/ui-context.md`, `context/security-model.md`

Reference (read-only): `No_touch_ai/26-05-01 — How Real Engineers Build _ Liveblocks, Trigger.dev/`. 73 files, mostly specs, context and zips. Read `feature-specs/feature-specs/03-auth.md` in full. Grepped the whole tree for landing/hero/marketing/pricing/tagline.

Clerk docs (read via context7 `/clerk/clerk-docs`, which mirrors clerk.com/docs):
- `docs/_partials/custom-flows/email-password-sign-in.mdx` (useSignIn, signIn.password, needs_client_trust, email code)
- `docs/guides/development/custom-flows/authentication/device-trust.mdx`
- `docs/guides/development/custom-flows/authentication/forgot-password.mdx` (resetPasswordEmailCode.sendCode/verifyCode/submitPassword)
- `docs/guides/development/custom-flows/authentication/oauth-connections.mdx` (signIn.sso, redirectUrl / redirectCallbackUrl, HandleSSOCallback)
- `docs/guides/development/custom-flows/authentication/sign-out.mdx` (useClerk().signOut({ redirectUrl }))
- `docs/_partials/secured-by-clerk-branding.mdx` (badge removal is a Dashboard toggle, not an appearance key)
- `docs/guides/customizing-clerk/appearance-prop/options.mdx` (`unsafe_disableDevelopmentModeWarnings`, `logoPlacement`)
- `docs/guides/account-portal/overview.mdx` (Account Portal pages: "cannot be customized beyond the options provided in the Clerk Dashboard")
- `docs/guides/customizing-clerk/adding-items/user-button.mdx` (UserButton.MenuItems, Action, Link)
- `docs/reference/nextjs/clerk-middleware.mdx` (dynamic keys: signInUrl, signUpUrl)
- `docs/getting-started/quickstart.mdx`, `_partials/nextjs/nextjs-15-callout.mdx` (proxy.ts naming)
- WebFetch `https://clerk.com/pricing` (plan comparison)

Next.js 16 bundled docs (read-only): `node_modules/next/dist/docs/01-app/`
- `01-getting-started/14-metadata-and-og-images.md`
- `03-api-reference/03-file-conventions/01-metadata/{opengraph-image,sitemap,robots}.md`
- `03-api-reference/04-functions/generate-metadata.md`
- `02-guides/authentication-with-cache-components.md` and `keeping-pages-static.md` (listed, not read in full)

## 2. Current state in the repo (file:line)

| Area | State | Evidence |
|---|---|---|
| `/` | Redirect only. `HomeRedirect` calls `auth()` in Suspense, redirects to `/editor` or `/sign-in`. No landing content. | `app/page.tsx:7-17` |
| Root metadata | Title and description only. No `openGraph`, `twitter`, `metadataBase`, `robots`, `sitemap`, OG image. | `app/layout.tsx:23-26` |
| Root layout | `ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/sign-in"` inside `<body>`. | `app/layout.tsx:36` |
| Clerk appearance | Dark base theme and token variables only. No `options`, no `elements`, no layout keys. | `lib/clerk-appearance.ts:5-23` |
| Sign-in | Server gate in Suspense (`auth()` then redirect to `/editor`), then prebuilt `<SignIn path="/sign-in" />`. | `app/(auth)/sign-in/[[...sign-in]]/page.tsx:13-16` |
| Sign-up | Same pattern with `<SignUp path="/sign-up" />`. | `app/(auth)/sign-up/[[...sign-up]]/page.tsx:12-15` |
| Auth layout | Two-panel text-only layout (wordmark, tagline, three feature lines). Form in `<main>`. Desktop only split at `lg`. | `app/(auth)/layout.tsx:1-31` |
| Editor user menu | Prebuilt `<UserButton appearance={{ elements: { avatarBox } }}/>` wrapped in a hydration guard. | `components/editor/user-menu.tsx:3,15-28`; used at `app/editor/page.tsx:10` |
| Other UserButton mentions | Workspace presence stack always ends with `UserButton`. | `components/canvas/presence-stack.tsx:53-54`, `components/auth/recently-deleted-screen.tsx:14` (comment) |
| Middleware | `clerkMiddleware()` only; no protection logic. | `proxy.ts:5`, matcher `:7-16` |
| Auth helper | `SIGN_IN_PATH = '/sign-in'`, `signInUrl()` builds `redirect_url`. `requireUser()` does the real gating. | `lib/auth.ts:48, 64-67` |
| Images | `img.clerk.com` is the only remote image host (for avatars). | `next.config.ts:51-52` |
| cacheComponents | Enabled. | `next.config.ts:44` |
| Env | Clerk server key names: `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET` (`sk_`/`whsec_` prefixes). Publishable key is in `lib/env.public.ts`. Values not read. | `lib/env.ts:20-21` |

Spec state (F02 is in Verification, PR open; status.md):
- FR-003: auth layout is two-panel, "no gradients, images, cards, or scrolling hero".
- FR-004: sign-in/sign-up render `<SignIn />`/`<SignUp />`.
- FR-005: `/` redirects by session. A landing page at `/` conflicts with this FR and with AC-007.
- FR-006: `UserButton` in the editor navbar only.
- FR-007: `.env.example` documents `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` and fallback redirect keys.
- Reference 03-auth says "Keep Clerk's default user menu and profile flows intact. Do not rebuild or heavily customize Clerk internals." This directly conflicts with the owner's new goal (2). Treat it as a requirement change needing owner approval (CLAUDE.md §2).
- No F-number, decision or spec covers a marketing landing page. `context/product-requirements.md` has PRD-001 (sign up and sign in with Clerk) but no landing requirement. `features/AUDIT-2026-10-22.md` has no landing item.

## 3. Reference landing content in No_touch_ai

None. The only landing-adjacent material is `03-auth.md`, which forbids hero sections, cards and gradients on the auth pages. It contains no marketing copy, imagery or section design. `current-issues` notes are about the editor canvas and workspace. The `.zip` files are not expanded here.

## 4. Findings (CLAUDE.md §9 format)

### F-1 Custom sign-in (email + password, email code)
- Observed: `useSignIn()` exposes `signIn.password({emailAddress, password})`, status checks (`complete`, `needs_second_factor`, `needs_client_trust`), `signIn.mfa.sendEmailCode()`, `signIn.mfa.verifyEmailCode({code})`, `signIn.finalize({ navigate })`, `signIn.reset()`.
- Evidence: context7 `/clerk/clerk-docs` email-password-sign-in and device-trust partials.
- Mapping: new feature "custom auth UI" (or upgrade F02 FR-004). Replaces the prebuilt `<SignIn>` and keeps the server gate.
- Fit: app UI (client components) plus the existing server gate. No architecture change.
- Priority: high (core of goal 2).
- Risks: `needs_client_trust` (device verification) appears on new devices and must be handled in our UI. Clerk errors need mapping to our copy. Test with two-user E2E. Our `AuthFormFallback` and layout stay.

### F-2 Custom sign-up
- Observed: not read in this session (useSignUp docs were not queried).
- Mapping: same feature as F-1.
- Fit: app UI. Priority: high.
- Risks: unknown exact status set. Verify with the docs before implementing.

### F-3 OAuth (Google, GitHub)
- Observed: custom flow uses `signIn.sso({ strategy: 'oauth_google' | 'oauth_github', redirectUrl, redirectCallbackUrl })`. A callback route renders `<HandleSSOCallback />` (or `AuthenticateWithRedirectCallback`) with `navigateToApp` / `navigateToSignIn` / `navigateToSignUp`. Sign-up uses `signUp.authenticateWithRedirect` with `redirectUrl` and `redirectUrlComplete`.
- Evidence: oauth-connections.mdx; reference docs for `authenticateWithRedirect` and `<AuthenticateWithRedirectCallback />`.
- Mapping: same custom-auth feature.
- Fit: app UI plus one callback route. Needs the social connections enabled in the Clerk Dashboard (configuration change, owner approval).
- Priority: medium (only if owner wants social login).
- Risks: free plan allows up to 3 social connections (Pro: unlimited). Google and GitHub each need their own OAuth app credentials, which are external configuration.

### F-4 Forgot password
- Observed: `signIn.create({identifier})`, then `signIn.resetPasswordEmailCode.sendCode()`, `.verifyCode({code})`, `.submitPassword({password, signOutOfOtherSessions})`, then `signIn.finalize`.
- Evidence: forgot-password.mdx (Next.js, Expo and Android variants).
- Mapping: custom auth feature.
- Fit: app UI.
- Priority: medium (must exist once password sign-in is custom).
- Risks: reset email comes from Clerk and carries Clerk branding in the email body (not verified here). Account enumeration behaviour not checked.

### F-5 Session management and sign-out
- Observed: `useClerk().signOut({ redirectUrl: '/' })`. `afterSignOutUrl` is already set in the layout.
- Evidence: sign-out.mdx; `app/layout.tsx:36`.
- Mapping: F02 upgrade (user menu).
- Fit: app UI.
- Priority: high.
- Risks: none significant.

### F-6 User menu replacement (`UserButton`)
- Observed: `UserButton` renders Clerk's menu with "Manage account" (opens the Clerk account portal or modal) and "Sign out". Items can be reordered or replaced via `UserButton.MenuItems` / `UserButton.Action` / `UserButton.Link`. A custom menu can use `useUser()` for name, email and avatar and `useClerk().signOut()`.
- Evidence: user-button.mdx; `components/editor/user-menu.tsx:15-28`.
- Mapping: upgrade F02 FR-006 and F04/F11 presence slot (`components/canvas/presence-stack.tsx`). Affects F11 which expects `UserButton` inside `PresenceStack`.
- Fit: app UI. Cross-feature change (F04 slot contract, F11).
- Priority: high (any "Clerk-branded" menu violates goal 2; "Manage account" opens Clerk UI).
- Risks: a custom menu can't offer profile editing, password change, or MFA setup without building those screens too, or using Clerk's `<UserProfile>`/`openUserProfile`, which is prebuilt. `openUserProfile` was not verified in this session.

### F-7 Removing "Secured by Clerk" branding and plan limits
- Observed: the badge cannot be removed through `appearance.elements`. It is a Dashboard toggle: Settings > Branding > "Remove 'Secured by Clerk' branding". The pricing page says branding removal is on Pro and Business only. Free (Hobby) = No.
- Evidence: secured-by-clerk-branding.mdx; clerk.com/pricing (WebFetch).
- Mapping: needs owner decision. Upgrade F02 (or new feature "custom auth UI") plus a Dashboard change.
- Fit: external-service configuration. Requires owner authorization (CLAUDE.md §6). Also a billing decision.
- Priority: high if prebuilt components stay; not needed if F-1 to F-6 are built custom.
- Risks: Pro is paid. Free allows 50,000 MRU per app. Free has no MFA (Pro: yes). Upgrading does not remove the badge from custom-flow UIs because there are none.

### F-8 Development-mode banner and warnings
- Observed: prebuilt components show dev-instance warnings. `appearance.options.unsafe_disableDevelopmentModeWarnings` exists (boolean). The console warning can be silenced with `NEXT_PUBLIC_CLERK_UNSAFE_DISABLE_DEVELOPMENT_MODE_CONSOLE_WARNING`. The docs warn it is only for previewing production appearance.
- Evidence: appearance-prop options.mdx; clerk-provider props typedoc.
- Mapping: F02 upgrade (or moot once custom UI is built).
- Fit: app config only.
- Priority: low. The banner is a dev-instance artefact; production (live) keys remove it. Do not disable warnings in production.
- Risks: disabling the warning hides the real "dev keys in production" signal. The exact "Development mode" banner markup was not verified.

### F-9 Hosted pages avoidance
- Observed: Account Portal pages "cannot be customized beyond the options provided in the Clerk Dashboard". Clerk middleware accepts dynamic keys `signInUrl` and `signUpUrl`, so redirects can point to our routes.
- Evidence: account-portal/overview.mdx; clerk-middleware.mdx (dynamic keys).
- Mapping: F02 upgrade (configuration of redirect URLs) and F-1/F-3 design.
- Fit: app config (env var names already in FR-007) plus `proxy.ts` remains unchanged (no redirect logic per FR-001).
- Priority: high.
- Risks: `requireUser({ unauthenticated: 'redirect' })` redirects to `/sign-in` (`lib/auth.ts:48`). That path must stay our own page. Any prebuilt Clerk redirect that falls back to the hosted sign-in (not verified here) breaks goal 2. A production instance may require DNS for a custom domain (from memory, not verified this session).

### F-10 Landing page metadata, OG image, sitemap, robots
- Observed (Next.js 16 bundled docs): `opengraph-image` files are statically optimised by default unless they use request-time APIs. `sitemap.js` and `robots.js` are cached route handlers, same rule. `generateMetadata` may use `'use cache'` and must return strings, not `URL`.
- Mapping: new feature "landing page". Also upgrade F01 D-F01-7 metadata (the root layout already sets title and description).
- Fit: app UI and metadata. No architecture change.
- Priority: medium.
- Risks: `/` is currently a redirect. Once it becomes a landing page, the route must not read `auth()` at the top level. Use a Suspense child for any session check, or drop the redirect and let the header show "Sign in" / "Open editor" from a client-side `useAuth`. Keep the page static (no `cookies()`, `headers()` or `auth()` at top level) so it prerenders under cacheComponents. `metadataBase` must be a string if it goes through `'use cache'`.

### F-11 Landing page sections for a collaborative diagramming tool
Justified by the product (`context/product-requirements.md`, the auth layout copy in F02, and the features in F04-F14):
- Hero: "drawArc" name, one-line value ("Real-time collaborative system-design canvas." is already approved copy), primary CTA to sign up, secondary CTA to sign in.
- Feature grid (3-4 items, text plus icon, no decorative imagery): live cursors and presence, node-and-edge diagramming with React Flow, shareable projects with editor/viewer roles, autosave and recovery. Only claim what is shipped or specified.
- How it works (3 steps): create a project, invite teammates, diagram together.
- Closing CTA and footer (links to sign in, sign up, and legal pages if any exist).
- Not justified: pricing, testimonials, logo walls, customer stats. The product has no evidence for them.
- Fit: app UI. Priority: medium. Risks: marketing claims must match implemented features. Shipping copy before F05/F11 are live would overstate the product.

## 5. Could not verify
- Exact custom sign-up status set (`useSignUp`) and whether it is in the Next.js SDK 7.9.20 types in this repo.
- `openUserProfile` / `<UserProfile>` branding on Free (presumed branded; not read).
- Whether Clerk-sent emails (verification, reset) carry Clerk branding, and whether that can be changed on Free.
- Exact "Development mode" banner markup and whether it appears on custom-flow pages.
- Whether a prebuilt component ever redirects to the Account Portal when `signInUrl` is set (not read in full).
- Production instance DNS / custom domain requirement (from memory only).
- Exact Pro price (not read on the pricing page).
- Sections of `No_touch_ai` zips (not expanded).
- No build or runtime test of any option. Everything above is doc-based.

## 6. Recommendation
Zero-branding auth path:
1. Owner decision first (CLAUDE.md §2): approve replacing the reference-03-auth rule "keep Clerk's default user menu" and FR-005 (`/` redirect) with a landing page, and approve custom auth UI.
2. Build custom sign-in and sign-up with `useSignIn` / `useSignUp` (email+password, email-code second factor, forgot password). Keep the server gate (`auth()` in Suspense, `lib/auth.ts`) and `proxy.ts` unchanged. Add Google/GitHub OAuth only if the owner wants it (free plan caps social connections at 3).
3. Replace `UserButton` with a custom menu (`useUser` + `useClerk().signOut`). Keep F11 presence stack working by passing the custom menu through the existing slot.
4. Do not pay for Pro unless the owner wants prebuilt components or MFA. Custom flows carry no Clerk badge, so Pro is not required for zero-branding.
5. Add the landing page at `/` as a static page with metadata, `opengraph-image.tsx`, `robots.ts`, `sitemap.ts`. Keep auth reads out of the top level.

Effort (rough, for planning only): custom sign-in/sign-up/forgot-password with client-trust handling and tests ~3-4 dev days; custom user menu and F11 slot change ~1 day; landing page (static, four sections, metadata/OG/sitemap/robots) ~1-2 days; OAuth add-on ~1 day per provider plus Dashboard setup. Total ~5-7 days, assuming F02 is merged first.

Alternative if the owner wants speed: keep prebuilt components, upgrade to Pro for branding removal (Dashboard toggle), and set `unsafe_disableDevelopmentModeWarnings` only for preview. This is faster (~1 day) but still shows Clerk-hosted "Manage account" and profile UIs, and costs money.
