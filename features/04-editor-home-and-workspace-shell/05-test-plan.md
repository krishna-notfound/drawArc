# F04 — Test Plan

Layers per `context/testing-strategy.md`. L1 renders synchronous client components with Testing Library (jsdom); Server Components and pages are L3 only. L3 runs with `@clerk/testing` (`clerkSetup()` global setup, `setupClerkTestingToken({ page })` per test), one context per user, Liveblocks dev server not needed for F04 (no room yet). Mocks at L1: `next/navigation` `useRouter` (push spy), `app/editor/actions` (vi.fn per action), `@clerk/nextjs` `UserButton` (stub).

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L3 | `tests/e2e/editor-home.spec.ts` | A signed in, no projects | goto `/editor` | heading, description, "New Project"; tabs "(0)"; "No projects yet" + "Create your first project to get started."; no console errors |
| TC-002 | AC-002 | L3 | `tests/e2e/editor-home.spec.ts` | A signed in | `instant(page, () => page.goto('/editor'))` | navbar + empty state in shell; build log clean (CI) |
| TC-003 | AC-003 | L1 | `tests/unit/project-sidebar.test.tsx` | 3 owned (one 100-char), 2 shared, `currentProjectId` | render | `aria-current`, truncation/`title`, hrefs, badges 3/2 |
| TC-004 | AC-004 | L1 | `tests/unit/project-sidebar.test.tsx` | 0 owned, 2 shared | render; click "Shared with me" | empty copy; then 2 items |
| TC-005 | AC-005 | L1 | `tests/unit/project-sidebar.test.tsx` | 1 owned, 1 shared | query actions buttons; open | exactly one; menu "Rename", "Delete" |
| TC-006 | AC-006 | L1 | `tests/unit/project-dialogs.test.tsx` | provider with `dialog = { kind: 'create' }` | render | title, label, placeholder, maxLength, focus, no `/slug/i`, buttons |
| TC-007 | AC-007 | L3 | `tests/e2e/editor-home.spec.ts` | A | click New Project; type "Payments"; Enter | URL `/editor/<cuid>`; navbar "Payments"; sidebar highlight, "(1)" |
| TC-008 | AC-008 | L3 | `tests/e2e/editor-home.spec.ts` | A owns "Payments" | dropdown → Rename; assert prefill/selection/description; type "Billing"; Enter; repeat with same name | closes; sidebar + navbar "Billing"; same-name rename closes without error |
| TC-009 | AC-009 | L1 | `tests/unit/project-dialogs.test.tsx` | `dialog = { kind: 'delete', project }` | render | title, description, no input, destructive class |
| TC-010 | AC-010 | L3 | `tests/e2e/editor-home.spec.ts` | A on `/editor/{id}` | sidebar → Delete → confirm; goto `/editor/{id}` | URL `/editor`; item gone; AccessDenied |
| TC-011 | AC-011 | L1 | `tests/unit/use-project-dialogs.test.tsx` | `createProject` mock resolves in 200 ms | `submit()` ×2 + Enter within 50 ms | one call; `pending`; disabled controls; `push('/editor/{id}')` |
| TC-012 | AC-012 | L1 | `tests/unit/use-project-dialogs.test.tsx` | mocks for VALIDATION / NOT_FOUND / UPSTREAM / rejection | submit each | field error with `aria-describedby`; banners with exact copy; dialog open; focus moved |
| TC-013 | AC-013 | L3 | `tests/e2e/editor-home.spec.ts` | A | create → rename → delete without reload | sidebar reflects each within 2 s |
| TC-014 | AC-014 | L0 | CI + `tests/unit/gate-order.test.ts` (source-order assertion run by `vitest run`) | — | `tsc --noEmit`; `npm run build`; grep gate source | no type errors; no `blocking-prerender-runtime` for `/editor/[projectId]`; `requireProjectRole` < `seedRoomIfEmpty` < `<Workspace` in source order |
| TC-015 | AC-015 | L3 | `tests/e2e/workspace-gate.spec.ts` | A owns P | goto `/editor/{P}` | navbar name; highlight; canvas placeholder; no console errors; `instant()` shell has navbar frame |
| TC-016 | AC-016 | L3 | `tests/e2e/workspace-gate.spec.ts` | anonymous context | goto `/editor/{P}`; sign in as A | redirected with `redirect_url`; then workspace |
| TC-017 | AC-017 | L3 | `tests/e2e/workspace-gate.spec.ts` | B signed in; P exists | goto 3 URLs; capture status + `main.innerHTML` | 200 ×3; identical HTML; copy + link present |
| TC-018 | AC-018 | L3 | `tests/e2e/workspace-gate.spec.ts` | B editor of P (member row inserted via factory), B on `/editor` with sidebar listing P; row deleted via factory | click prefetched link; also reload `/editor/{P}` | AccessDenied both times |
| TC-019 | AC-019 | L1 | `tests/unit/access-denied.test.tsx` | — | render | icon, h1, text, link href, centring classes |
| TC-020 | AC-020 | L1 | `tests/unit/workspace.test.tsx` | marker slots; then no `presenceSlot` | render; toggle AI | markers in header / top-right / `main` / `aside`; no default user button beside `presenceSlot`; `UserMenu` present when the slot is absent; `main` has no border/rounded/p- classes |
| TC-021 | AC-021 | L1 | `tests/unit/workspace.test.tsx` | status ARCHIVED / ACTIVE | render | badge present / absent |
| TC-022 | AC-022 | L1 | `tests/unit/island-props.test.ts` | — | call `toIslandProps`; `expectTypeOf` | exact keys; role mapping |
| TC-023 | AC-023 | L3 | `tests/e2e/workspace-error.spec.ts` | Playwright project `broken-db` (env `DATABASE_URL` → closed port) | goto `/editor/{P}` as A | error boundary copy; "Try again" present |
| TC-024 | AC-024 | L3 | `tests/e2e/editor-home.spec.ts` | A with one project | open each dialog via keyboard; Tab cycle; Esc | focus trapped; returns to opener |
| TC-025 | AC-025 | L3 | `tests/e2e/editor-home.spec.ts` | sidebar + Create dialog open | `new AxeBuilder({ page }).analyze()` | no serious/critical violations |
| TC-026 | AC-026 | L3 | `tests/e2e/editor-home.spec.ts` (project `mobile`, 390×844) | A with one project | toggle sidebar; tap scrim; reopen; tap item | scrim visible/hidden; navigation; sidebar off-screen when closed |
| TC-027 | AC-027 | L0 | `tests/unit/no-router-hooks-in-editor.test.ts` | — | grep sources | zero matches |

## AUTHZ-MATRIX

F04 adds no Server Actions or route handlers. The page gate is covered by the page-level matrix below (testing-strategy "non-member → AccessDenied page"):

| Caller | `/editor/{existing, not member}` | `/editor/{missing cuid}` | `/editor/{malformed}` | `/editor/{member viewer}` | `/editor/{member editor}` | `/editor/{owner}` |
|---|---|---|---|---|---|---|
| unauthenticated | redirect sign-in | redirect sign-in | redirect sign-in | redirect sign-in | redirect sign-in | redirect sign-in |
| signed-in | AccessDenied (200) | AccessDenied (200) | AccessDenied (200) | workspace, island role `viewer` | workspace, island role `editor` | workspace, island role `owner` |

Covered by TC-015, TC-016, TC-017, TC-018 (the three identical cases) and, for viewer/editor roles, by F12's E2E once invitations exist (recorded there as F12/TC-0xx; F04 verifies owner + non-member only).

## Collaboration / concurrency cases

F04 has no room. Cross-tab cases: TC-012 (NOT_FOUND after delete elsewhere), TC-018 (revoked access + prefetch). The KICK-triggered reload path is F12's test.

## Not tested automatically (and why)

- Visual layout fidelity (flush canvas, radii, shadows): manual check against `ui-context.md` on the preview URL, recorded in status.md with a screenshot path.
- Reduced-motion behaviour: manual (OS setting) — Playwright `reducedMotion: 'reduce'` could be added later.
- Default sidebar open state by viewport width: covered indirectly by TC-026 (mobile closed) and TC-015 (desktop open).
- Build-time Cache Components validation is asserted by `npm run build` in CI rather than a test file (no API to assert it from Vitest).
- EC-018 (stale prefilled rename, last write wins): documented, not tested.
