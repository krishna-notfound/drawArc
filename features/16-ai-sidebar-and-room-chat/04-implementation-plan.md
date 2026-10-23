# F16 — Implementation Plan (outline)

**Dependencies to be installed:** none new. Uses `@liveblocks/client`/`react` 3.24.4 (F05), shadcn Tabs/Textarea/Button/ScrollArea/Tooltip (F01), `lucide-react` (F01), `ulid` (already a dependency from F07 for node ids; if F07 chose another id helper, reuse it — ids here are `m_<ulid>`), `@axe-core/playwright` (added by F01/F04 for a11y smoke; if absent, add `@axe-core/playwright@^4` as a dev dependency in T-009).

**Environment variables added:** none.

**Migrations:** none (no Postgres change).

**Pre-condition:** M1 acceptance run passed and the owner approved the start of M2 (D-002). F11 verified (cursor badge spinner on `presence.thinking`).

| Task | Deliverable | Satisfies | Files | Done when |
|---|---|---|---|---|
| T-001 | **Verify Liveblocks Feeds** against https://liveblocks.io/docs (client hooks, server-side append from `@liveblocks/node`, retention, how `feeds:read/write` interact with `*:read`/`*:write`, dev-server support, plan limits). Write the result into `02-design.md` "Verified library facts" with URLs + date, and record the transport choice in `status.md`. If Feeds is adopted, update only the Feeds-variant paragraph in 02-design.md and T-003/T-004; schemas, components and tests stay. If not verifiable in ≤ 2 h, proceed with the Storage fallback (F16-D1). | FR-007, FR-012, F16-D1, AC-026 | `features/16-…/02-design.md`, `status.md` | Reviewer confirms the row is VERIFIED or REJECTED with evidence |
| T-002 | `types/chat.ts` schemas and constants; `lib/chat/transport.ts` pure helpers (`parseMessages`, `trimToCap`, `sortMessages`, `isStatusStale`) with unit tests | FR-008, FR-009, FR-013 | `types/chat.ts`, `lib/chat/transport.ts`, `tests/unit/lib/chat/transport.test.ts` | AC-012, AC-013 pass; `npm run check` green |
| T-003 | Storage typing and room initialisation: extend `types/liveblocks.config.ts` (optional `chat`, `aiStatus`), add `initialStorage` entries in `components/editor/project-room.tsx`; confirm F06's `useLiveblocksFlow` is unaffected (storageKey `flow` untouched) | FR-015 | `types/liveblocks.config.ts`, `components/editor/project-room.tsx` | AC-019 (L2) passes; F06 L3 smoke still green |
| T-004 | `lib/chat/server.ts` (`appendChatMessage`, `setAiStatus`) over `liveblocks.mutateStorage` from `lib/liveblocks.ts` (F05 node client); integration tests against the Liveblocks dev server | FR-007 (server path), FR-012 | `lib/chat/server.ts`, `tests/integration/chat-transport.test.ts` | AC-025 passes |
| T-005 | `hooks/useRoomChat.ts` and `hooks/useAiStatus.ts` (useStorage selectors, useMutation append with cap and key creation, re-entry guard, `useErrorListener` mapping for read-only writes, stale guard) with unit tests using Liveblocks' testing utilities or a mocked `useStorage/useMutation` seam | FR-006, FR-007, FR-013, FR-016 | `hooks/useRoomChat.ts`, `hooks/useAiStatus.ts`, `tests/unit/hooks/useRoomChat.test.tsx`, `tests/unit/hooks/useAiStatus.test.tsx` | AC-008, AC-011, AC-017 pass |
| T-006 | Sidebar body: fill F01's `components/ai/ai-sidebar.tsx` (keep its `SidebarPanel`, header, close/Esc + focus return; add Tabs and the two panels) + `SpecsPanel.tsx` placeholder; compose the `aiSidebar` slot in `app/editor/[projectId]/page.tsx`; running dot on the AI toggle in `components/editor/editor-navbar.tsx` | FR-001, FR-002, FR-003, FR-017, FR-018 | `components/ai/ai-sidebar.tsx`, `components/ai/SpecsPanel.tsx`, `app/editor/[projectId]/page.tsx`, `components/editor/editor-navbar.tsx` | AC-003, AC-004, AC-022 (L1) pass; F01's `ai-sidebar.test.tsx` and F04's shell tests still green |
| T-007 | Composer and chips: `components/ai/ChatComposer.tsx` (auto-resize 72–160 px, counter, Enter/Shift+Enter/IME, disabled states + tooltips), `components/ai/StarterChips.tsx` | FR-004, FR-005, FR-006 | `components/ai/ChatComposer.tsx`, `components/ai/StarterChips.tsx`, `tests/unit/components/ai/ChatComposer.test.tsx` | AC-005, AC-006, AC-007 pass |
| T-008 | Log and bubbles: `components/ai/ChatPanel.tsx` (empty state, ScrollArea, auto-scroll + "New messages" pill, `role="log" aria-live="polite"`), `ChatMessageBubble.tsx`, `AiStatusStrip.tsx` (pulsing dot `text-success`, `role="status"`), hex-literal grep assertion | FR-010, FR-011, FR-012, FR-014 (header spinner) | `components/ai/ChatPanel.tsx`, `components/ai/ChatMessageBubble.tsx`, `components/ai/AiStatusStrip.tsx`, `tests/unit/components/ai/*.test.tsx` | AC-014, AC-015, AC-016 pass |
| T-009 | E2E: `tests/e2e/ai-sidebar.spec.ts` (open/close, mobile scrim, tab reset on reload, keyboard order, axe), `tests/e2e/ai-chat.spec.ts` (two contexts: send/receive ≤ 1 s, viewer disabled, downgrade ≤ 5 s, read-only toast, offline send, concurrent order), `tests/e2e/ai-presence.spec.ts` (dev-server `setPresence` for `ai`) | FR-001, FR-007, FR-014, FR-016, FR-017 | `tests/e2e/ai-sidebar.spec.ts`, `tests/e2e/ai-chat.spec.ts`, `tests/e2e/ai-presence.spec.ts` | AC-001, AC-002, AC-004b, AC-009, AC-010, AC-018, AC-020, AC-021, AC-023, AC-024 pass against the local stack |
| T-010 | Context updates: add the Storage keys to `context/domain-model.md` "Liveblocks room shape", copy F16-D1/F16-D2/F16-D3 into `context/decision-log.md` on approval, update `context/progress-tracker.md`; record evidence in `status.md` | FR-015 (Storage keys record), FR-007 | `context/domain-model.md`, `context/decision-log.md`, `context/progress-tracker.md`, `features/16-…/status.md` | Reviewer sign-off |

Order: T-001 → T-002 → T-003 → T-004 → T-005 → T-006 → T-007 → T-008 → T-009 → T-010. T-006/T-007/T-008 can be reviewed independently; T-009 needs all of them.

## Risks introduced or touched

| ID | Risk | Mitigation |
|---|---|---|
| R-11 (new) | `senderId` is client-supplied in the Storage transport; a member can impersonate another member inside a project they already belong to | Accepted for M2 (documented in 02-design.md); Feeds (if it carries a server-verified author) or a server-side append route in a later feature; chat is never security-relevant |
| R-05 | Liveblocks React Flow package co-exists with sibling Storage keys — `useLiveblocksFlow` must ignore `chat`/`aiStatus` | T-003 runs the F06 smoke test; keys are siblings, not inside `flow` |
| R-12 (new) | Rooms created before F16 lack keys; `initialStorage` applies only on first creation | Optional types + create-on-first-write (FR-015, AC-019) |

## Gate 6 notes

The detailed plan (`docs/superpowers/plans/16-ai-sidebar-and-room-chat.md`) must trace to T-001…T-010 and must not add dependencies beyond those listed above.
