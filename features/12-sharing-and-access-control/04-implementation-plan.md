# F12 — Implementation Plan (outline)

**Dependencies to be installed**: none new at runtime (`@liveblocks/node`, `@liveblocks/react` come from F05; Zod from F00). Generated: `npx shadcn@latest add select` → `components/ui/select.tsx` (do not edit). Dev: `@axe-core/playwright` if F04/D-029 approved.

**Environment variables**: none new (`LIVEBLOCKS_SECRET_KEY` from F05; E2E users from testing-strategy).

**Migrations**: none — `ProjectMember` and its indexes ship with F03's migration. (`countRecentInvites` uses the existing `(email)`/`(userId)` indexes plus a sequential filter on `invitedById`; if the query plan proves slow, an index `(invitedById, invitedAt)` would be a separate, authorised migration.)

**Cross-feature prerequisites** (now specified in F02/F05 — verify they shipped before T-001): F02 binds pending rows in both the lazy upsert and the `user.created` webhook; F05 exposes `useUnloadGuard().suppress()`, mounts `kick-listener.tsx` with the `onReconnected` hook point inside `ProjectRoom`, exposes `data-role`/`data-can-write`/`data-connection-status` on the room root, and returns 403 `{ error: 'forbidden' }` from the auth route for non-members.

| Task | Deliverable | Satisfies | Files | Done when |
|---|---|---|---|---|
| T-001 | `schemas/member.ts` (email normalisation, role enum, id schemas) + unit tests; `lib/projects/members.ts` (`listProjectMembers` with `'use cache'`/tag, `countRecentInvites`) + integration test. | FR-008, FR-009 (validation) | `schemas/member.ts`, `lib/projects/members.ts`, `tests/unit/member-schemas.test.ts`, `tests/integration/members-list.test.ts` | AC-010 passes; schema tests green |
| T-002 | `lib/projects/member-service.ts`: `inviteMemberCore`, `changeMemberRoleCore`, `removeMemberCore`, `broadcastKick` / `broadcastRoleChanged` (wrappers over F05 `kickUser` / `notifyRoleChanged`, boolean result), role mapping helpers. | FR-009–FR-012, D-030, D-033 | `lib/projects/member-service.ts` | type-checks; used by T-003 |
| T-003 | `app/editor/[projectId]/actions.ts`: `inviteMember`, `changeMemberRole`, `removeMember`, `checkMyAccess` following the F03 action skeleton; integration tests with `requireUser` seam, `next/cache` stub, `lib/liveblocks.ts` spy (ordering, retries, tags). | FR-009–FR-013, FR-018 | `app/editor/[projectId]/actions.ts`, `tests/integration/member-actions.test.ts` | AC-012–AC-020 pass |
| T-004 | AUTHZ-MATRIX suite for the four actions (unauthenticated, non-member foreign/missing, viewer, editor, owner) incl. identical-FORBIDDEN assertion. | FR-013, FR-018 | `tests/integration/authz-matrix.members.test.ts` | AC-021, AC-028 pass |
| T-005 | `useShareDialog` hook (per-action pending/error, `startTransition`, copy-link state with 2 s timer and clipboard fallback) and `ShareDialog`/`MemberRow`/`ShareButton` components; shadcn `Select` generated; unit tests for owner vs non-owner DOM, invite form, rows, confirm-remove, copy link, error mapping. | FR-001–FR-007, FR-019 | `hooks/useShareDialog.ts`, `components/editor/share-dialog.tsx`, `components/editor/member-row.tsx`, `components/editor/share-button.tsx`, `components/ui/select.tsx`, `tests/unit/share-dialog.test.tsx`, `tests/unit/member-row.test.tsx` | AC-002–AC-009, AC-029 pass |
| T-006 | Wire into F04's gate: `listProjectMembers(project.id)` after `requireProjectRole`, pass `shareSlot`; confirm same-response refresh of the open dialog; archived-project disabled state. | FR-001, FR-008, EC-014 | `app/editor/[projectId]/page.tsx` (modified) | AC-001 passes locally; reviewer excerpt for AC-011 |
| T-007 | Extract `hooks/useKickListener.ts` from F05's `components/editor/kick-listener.tsx` (KICK + ROLE_CHANGED → overlay copy, `suppress()`, `client.logout()`, reload ≤ 500 ms) and add the reconnect `checkMyAccess` verification on F05's `onReconnected` hook point; F05's component becomes a thin host (already mounted — nothing new is mounted); unit tests with mocked Liveblocks hooks and fake timers (F05's `kick-listener.test.tsx` stays green). | FR-014, FR-015, FR-016, D-031, D-032 | `hooks/useKickListener.ts`, `components/editor/kick-listener.tsx` (F05, modified), `tests/unit/use-kick-listener.test.tsx` | AC-022 passes |
| T-008 | E2E `tests/e2e/sharing.spec.ts`: AC-001, AC-023–AC-027, AC-030 (two Clerk contexts, Liveblocks dev server, offline toggling, 5 s timing assertions, B's `User` row deletion fixture for AC-027). Mark the F06-dependent sub-assertions of AC-024 as `test.fixme` until F06 lands, then enable. | FR-001, FR-014–FR-017 | `tests/e2e/sharing.spec.ts`, `tests/factories.ts` (`deleteUserByEmail`) | all L3 ACs pass against a preview deployment; timing numbers recorded in status.md |
| T-009 | Evidence and hand-off: `npm run check`, `npm run build`, `npm run e2e` logs; decision-log entries D-030–D-033 drafted; note the (invitedById, invitedAt) index decision; update F15's M1 acceptance checklist pointers to TC-024/TC-025/TC-027. | FR-015, FR-017 (acceptance-run evidence) | `features/12-.../status.md` | reviewer sign-off |

Sequencing: T-001 → T-002 → T-003 → T-004 (server complete, testable without UI) → T-005 → T-006 (dialog usable) → T-007 → T-008 → T-009. T-005 can start in parallel with T-003 using mocked actions. Each ≤ 1 day; T-005 and T-008 are the largest.

Hand-offs this feature creates:
- F15 (M1 acceptance run) executes steps 2 and 6 through TC-024/TC-025/TC-027.
- F16/F17 reuse `checkMyAccess`-style role gating pattern for run start (viewer → status only).
- F20 (public links) extends `getProjectRole`, not this dialog; the dialog gains a "link access" section then.

This is an outline; the detailed step-by-step plan is produced at Gate 6 with `superpowers:writing-plans` into `docs/superpowers/plans/` and must trace back to these task IDs.
