# F16 — Test Plan

Layers and commands per `context/testing-strategy.md`. L3 runs against the local stack (`next dev` + `npx liveblocks dev --no-persist` on port 1153, two Clerk test users A/B) and, before milestone sign-off, against the preview URL.

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-012 | L1 | `tests/unit/lib/chat/transport.test.ts` | array: 1 valid message + 3 invalid (`tests/fixtures/chat/mixed.json`) | `parseMessages(input)` | `{ valid: [1 msg], invalidIds: [3 ids or indexes] }`; no throw |
| TC-002 | AC-013 | L1 | `tests/unit/lib/chat/transport.test.ts` | 200 messages with ascending `createdAt` + 1 new | `trimToCap([...200, new], 200)` | length 200; oldest removed; order preserved |
| TC-003 | AC-013 | L1 | `tests/unit/lib/chat/transport.test.ts` | messages with equal `createdAt`, different ids | `sortMessages` | sorted by `createdAt` then `id` ascending; stable |
| TC-004 | AC-017 | L1 | `tests/unit/hooks/useAiStatus.test.tsx` | mocked `useStorage` returning running status with `updatedAt = now − 11 min` | render hook | `isRunning === false`; a second status with `now − 1 min` → `true` |
| TC-005 | AC-008 | L1 | `tests/unit/hooks/useRoomChat.test.tsx` | mocked `useMutation` spy | `send('   ')` | rejects `ChatSendError('EMPTY')`; mutation spy not called |
| TC-006 | AC-011 | L1 | `tests/unit/hooks/useRoomChat.test.tsx` | mutation resolves after 200 ms | call `send('a')` twice within 300 ms | mutation spy called once; second call rejects `('IN_FLIGHT')` or resolves no-op (document which) |
| TC-007 | AC-003 | L1 | `tests/unit/components/ai/AiSidebar.test.tsx` | render with `open`, role editor | query text/aria | "AI Workspace", "Collaborate with drawArc", svg icon, close button present |
| TC-008 | AC-004 | L1 | `tests/unit/components/ai/AiSidebar.test.tsx` | render | click "Specs" | Specs panel rendered; tab `data-state="active"` with `bg-ai` (no `bg-accent`); inactive `text-copy-muted` |
| TC-009 | AC-005 | L1 | `tests/unit/components/ai/ChatPanel.test.tsx` | `messages: []`, `send` spy | query chips; click first | exactly 3 chips with exact labels; textarea value = label; focus on textarea; `send` not called |
| TC-010 | AC-006 | L1 | `tests/unit/components/ai/ChatComposer.test.tsx` | jsdom `scrollHeight` stubbed 40 / 300 px | type short then long text | height clamped 72 → 160; counter appears at 1,800; `text-error` at 2,001; send disabled |
| TC-011 | AC-007 | L1 | `tests/unit/components/ai/ChatComposer.test.tsx` | `send` spy | Enter; Shift+Enter; Enter with `isComposing` | one call for Enter; newline for Shift+Enter; none during composition |
| TC-012 | AC-014 | L1 | `tests/unit/components/ai/ChatMessageBubble.test.tsx` | three messages (user/self, assistant/ai, user/unknown id) | render | class sets per role; sender labels "You" / "drawArc AI" / "Member"; `grep -r "#[0-9a-fA-F]{3,6}" components/ai` returns nothing (executed via `fs` read in test) |
| TC-013 | AC-015 | L1 | `tests/unit/components/ai/ChatPanel.test.tsx` | 50 messages; `scrollTop` stubbed | append message with scroll at top / at bottom | pill appears / auto-scroll called |
| TC-014 | AC-016 | L1 | `tests/unit/components/ai/AiStatusStrip.test.tsx` | running status / idle status | render | `role="status"` with text present / absent; textarea `disabled` while running |
| TC-015 | AC-022 | L1 | `tests/unit/components/ai/SpecsPanel.test.tsx` | render | query | placeholder text; zero `button` elements |
| TC-016 | AC-019 | L2 | `tests/integration/chat-transport.test.ts` | dev server room with only `flow` | `appendChatMessage` once; read `getStorageDocument` | `chat` created with 1 entry; `aiStatus` absent |
| TC-017 | AC-025 | L2 | `tests/integration/chat-transport.test.ts` | dev server room | `appendChatMessage` valid; `setAiStatus` running; `appendChatMessage` with 2,001 chars | valid entry with `m_` id + ISO date; status equals input; invalid rejects `ZodError`, document unchanged |
| TC-018 | AC-025 (cap) | L2 | `tests/integration/chat-transport.test.ts` | room pre-filled with 200 messages | `appendChatMessage` | list length 200; oldest gone |
| TC-019 | AC-001, AC-002, AC-004b, AC-021 | L3 | `tests/e2e/ai-sidebar.spec.ts` | user A, fresh project | toggle open/close; mobile scrim tap; Specs tab + reload; Tab sequence; Esc; axe scan | bounding boxes, focus order, tab reset, no serious/critical axe violations |
| TC-020 | AC-010, AC-024 | L3 | `tests/e2e/ai-chat.spec.ts` | A owner, B editor, two contexts | A sends "ping"; A and B send simultaneously | B sees "ping" ≤ 1 s with A's name; after 2 s both logs identical order |
| TC-021 | AC-009 | L3 | `tests/e2e/ai-chat.spec.ts` | B viewer; then A downgrades B from editor | inspect B's composer | disabled + placeholder; after downgrade disabled ≤ 5 s |
| TC-022 | AC-020 | L3 | `tests/e2e/ai-chat.spec.ts` | B viewer | `page.evaluate` runs a Storage mutation via the exposed room (test hook `window.__drawarcRoom`, dev builds only) | Liveblocks rejects; toast "You have read-only access." ≤ 2 s; A's log unchanged |
| TC-023 | AC-023 | L3 | `tests/e2e/ai-chat.spec.ts` | B offline | B sends; B online | A sees message ≤ 5 s after reconnect |
| TC-024 | AC-018 | L3 | `tests/e2e/ai-presence.spec.ts` | dev server: `setPresence(room, { userId: 'ai', userInfo: { name: 'drawArc AI', avatar: null, color }, data: { thinking: true, cursor: { x: 100, y: 100 } }, ttl: 30 })` from the test via `@liveblocks/node` pointed at the dev server | observe sidebar, `PresenceStack`, cursor badge; then set `thinking: false` | spinner/avatar/badge spinner present, then absent |
| TC-025 | AC-026 | Manual | `features/16-…/status.md` | T-001 outcome | reviewer reads 02-design.md row and status.md | Feeds row resolved; transport recorded |

## Collaboration / concurrency cases (mandatory — feature touches the room)

- Two members send within 100 ms → convergence (TC-020).
- Offline send and reconnect (TC-023).
- Role downgrade mid-session (TC-021).
- Cap under concurrent appends: two clients each push when the list has 199 entries → both see 200 entries and no duplicate removal beyond cap − 1 (added to TC-020 as a step; UNVERIFIED LiveList merge ordering is the reason this is tested rather than assumed).
- Server append (dev server `mutateStorage`) while a client is typing → client's draft untouched, message appears (covered inside TC-024 by appending a message after setting presence).

## AUTHZ-MATRIX

Not applicable: no new endpoints. Liveblocks permission behaviour for viewer/editor is proven by F05's matrix and re-exercised by TC-021/TC-022.

## Not tested automatically (and why)

- Visual fidelity of bubbles, slide animation, pulsing dot — manual review in the Gate 6 checklist (screenshots attached to status.md).
- Behaviour on rooms near the 10 MB cap — not reproducible cheaply; F15's NFR-004 size assertion includes the chat list.
- Feeds transport (if adopted after T-001) — tests above are transport-agnostic through the hooks; the L2 file is the only one that changes.
- `prefers-reduced-motion` — manual check in Chrome emulation.
