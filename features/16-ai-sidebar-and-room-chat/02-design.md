# F16 — Design

## Architecture and components

Dependency direction respected: `app/editor/[projectId]` (server gate, F04) → `components/ai/*` (client islands) → `hooks/useRoomChat.ts`, `hooks/useAiStatus.ts` → `lib/chat/*` (pure helpers, no React) → `@liveblocks/react`. Trigger.dev tasks (F17/F18) import only `lib/chat/server.ts` and `types/chat.ts`.

Files created:

| Path | Kind | Responsibility |
|---|---|---|
| `types/chat.ts` | types + Zod | `ChatMessageSchema`, `AiStatusSchema`, `CHAT_MAX_MESSAGES = 200`, `CHAT_MAX_CONTENT = 2000`, `AI_STATUS_STALE_MS = 600_000`, `AI_PARTICIPANT_ID = 'ai'` |
| `lib/chat/transport.ts` | pure | `trimToCap(list, cap)`, `sortMessages(msgs)`, `isStatusStale(status, now)`, `parseMessages(unknown[]) → { valid, invalidIds }` |
| `lib/chat/server.ts` | server (Node) | `appendChatMessage(roomId, msg)`, `setAiStatus(roomId, status)` via `liveblocks.mutateStorage` — used by F17/F18 tasks, never by components |
| `hooks/useRoomChat.ts` | client | `{ messages, send(content), canSend, sendError }` over `useStorage` + `useMutation` |
| `hooks/useAiStatus.ts` | client | `{ status, isRunning }` with stale guard |
| `components/ai/ai-sidebar.tsx` (F01 shell, body filled here) | client | F01 already provides the fixed right panel (`SidebarPanel`: slide, scrim, Esc, focus return), header "AI Workspace" / "Collaborate with drawArc", close button, and the open state via `useEditorChrome().aiOpen`; F04 mounts it in the workspace; F16 adds Tabs and the two panels, and receives `role`, `projectId` through the F04 `aiSidebar` slot |
| `components/ai/ChatPanel.tsx` | client | log + empty state + composer; the AI Architect tab |
| `components/ai/ChatMessageBubble.tsx` | client | one message, by role |
| `components/ai/ChatComposer.tsx` | client | textarea, counter, send button, Enter handling |
| `components/ai/AiStatusStrip.tsx` | client | strip above the composer |
| `components/ai/StarterChips.tsx` | client | three chips |
| `components/ai/SpecsPanel.tsx` | client | F16 placeholder; replaced by F18 |
| `components/editor/editor-navbar.tsx` (F04, modified) | client | the existing AI toggle gains a "running" dot driven by `useAiStatus()` |
| `app/editor/[projectId]/page.tsx` (F04, modified) | server | composes the `aiSidebar` slot with the F16 body and passes `role`, `projectId` |
| `types/liveblocks.config.ts` (F05, modified) | types | Storage gains `chat?` and `aiStatus?` (optional — rooms predate F16) |
| `components/editor/project-room.tsx` (F05, modified) | client | `initialStorage` gains `chat: new LiveList([])`, `aiStatus: new LiveObject({ state: 'idle', updatedAt })` |

Server vs client: everything in F16 is client-side rendering plus Liveblocks mutations; the only server code is `lib/chat/server.ts`, exercised by F17/F18 (and by L2 tests here, against the dev server).

## Domain model and TypeScript contracts

```ts
// types/chat.ts
import { z } from 'zod';

export const CHAT_MAX_MESSAGES = 200;
export const CHAT_MAX_CONTENT = 2000;
export const AI_STATUS_STALE_MS = 10 * 60 * 1000;
export const AI_PARTICIPANT_ID = 'ai' as const;

export const ChatMessageSchema = z.object({
  id: z.string().regex(/^m_[0-9A-HJKMNP-TV-Z]{26}$/),          // m_<ulid>
  senderId: z.string().min(1).max(64),                        // User.id, 'ai', or 'system'
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(CHAT_MAX_CONTENT),
  createdAt: z.string().datetime(),                           // ISO 8601, producer clock
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const AiStatusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('idle'), updatedAt: z.string().datetime() }),
  z.object({
    state: z.literal('running'),
    runId: z.string().min(1).max(64),
    kind: z.enum(['DESIGN', 'SPEC']),
    text: z.string().min(1).max(200),                         // latest status line only
    updatedAt: z.string().datetime(),
  }),
]);
export type AiStatus = z.infer<typeof AiStatusSchema>;
export const IDLE_STATUS = (): AiStatus => ({ state: 'idle', updatedAt: new Date().toISOString() });
```

```ts
// types/liveblocks.config.ts — additive change to the F05 declaration
declare global {
  interface Liveblocks {
    Presence: { cursor: { x: number; y: number } | null; thinking: boolean };
    Storage: {
      flow: LiveObject<FlowStorage>;                 // F06 (managed by @liveblocks/react-flow)
      chat?: LiveList<ChatMessage>;                  // F16 — optional: rooms created before F16 lack it
      aiStatus?: LiveObject<AiStatus>;               // F16
    };
    UserMeta: { id: string; info: { name: string; avatar: string | null; color: string } };
    RoomEvent: /* unchanged — F05 declaration: KICK | ROLE_CHANGED | CANVAS_REPLACED (domain-model.md) */ RoomEvent;
  }
}
```

Plain JSON values (no nested Live structures) are stored in the list so `useStorage` returns them as-is and Trigger.dev tasks can push them with `LiveList.push(plainObject)`.

Hook contracts:

```ts
// hooks/useRoomChat.ts
export function useRoomChat(): {
  messages: ChatMessage[];          // validated, sorted by createdAt then id
  send: (content: string) => Promise<void>;   // rejects with ChatSendError('EMPTY'|'TOO_LONG'|'READ_ONLY'|'RUN_ACTIVE'|'TRANSPORT')
  canSend: boolean;                 // self.canWrite && !isRunning
  sendError: string | null;         // last user-facing error, cleared on next keystroke
};
// hooks/useAiStatus.ts
export function useAiStatus(): { status: AiStatus; isRunning: boolean };
```

```ts
// lib/chat/server.ts (Node only; imported by trigger/*)
export async function appendChatMessage(roomId: string, msg: Omit<ChatMessage, 'id' | 'createdAt'> & Partial<Pick<ChatMessage, 'id' | 'createdAt'>>): Promise<ChatMessage>;
export async function setAiStatus(roomId: string, status: AiStatus): Promise<void>;
```
Both validate with the schemas before `mutateStorage`, create the keys when missing, and apply `trimToCap`.

## Data and state ownership

| State | Owner | Notes |
|---|---|---|
| Chat messages | Liveblocks Storage `chat` (data-ownership.md row "AI room chat") | Not mirrored to Postgres; retained per room (10 MB cap); cap 200 |
| Latest AI status | Liveblocks Storage `aiStatus` | Single LiveObject; F17/F18 overwrite it; F16 only reads |
| AI `thinking` flag | Liveblocks Presence of the `ai` participant (set by F17 via `setPresence`) | Ephemeral; F16 only renders |
| Sidebar open/closed, active tab, textarea draft, scroll position | Client memory (F01 `EditorShell`/`useEditorChrome` for open/closed; local state in `ai-sidebar.tsx`/`ChatPanel` for the rest) | Never synced |
| Role for UI affordances | Prop from the server gate (F04) + `useSelf().canWrite` (truth at the token level) | `canWrite` wins when they disagree (role changed mid-session) |

No new derived copies. Message order is derived at render time from `createdAt` (producer clock) with `id` tiebreak — justified because LiveList insertion order across concurrent clients is not guaranteed to match wall-clock and ULIDs are monotonic per producer only.

## API and integration contracts

No HTTP endpoints. Liveblocks contracts:

| Operation | Side | Mechanism | Permission |
|---|---|---|---|
| Read chat | client | `useStorage(root => root.chat ?? [])` → `parseMessages` | `*:read` (viewer) or `*:write` |
| Append chat | client | `useMutation(({ storage, self }, content) => …)`: validate, `storage.get('chat') ?? storage.set('chat', new LiveList([]))`, `push`, `trimToCap` | `*:write` only — Liveblocks rejects for viewers |
| Append chat | server (F17/F18) | `liveblocks.mutateStorage(roomId, ({ root }) => …)` in `lib/chat/server.ts` | secret key (Trigger.dev env) |
| Read status | client | `useStorage(root => root.aiStatus ?? null)` → `AiStatusSchema.safeParse` → stale guard | read |
| Write status | server only (F17/F18) | `setAiStatus` | secret key |
| AI presence | server only (F17) | `setPresence(roomId, { userId: 'ai', … })` | secret key |

Feeds variant (if T-001 verifies Feeds): `lib/chat/transport.ts` and the two hooks switch to the Feeds client/server APIs with the same return types; permissions become `feeds:read` for viewers and `feeds:write` for editors added to the F05 `session.allow` arrays (`['*:read']` already includes `feeds:read` per the wildcard semantics — re-verify in T-001). Schemas, components and tests are unchanged.

## Security and validation

Threats: (1) viewer posting — mitigated by the read token (server-enforced) plus UI; (2) oversized/malformed messages — mitigated by Zod on write (client and server helper) and on read (skip-and-log), cap of 200 × 2,000 chars; (3) spoofed `senderId` — a member could push a message with another member's id via devtools: the sidebar shows the name resolved from `senderId`, so impersonation inside a project one is already a member of is possible. Accepted for M2 (members are invited collaborators; chat is not security-relevant; Storage mutations carry no server-verified author). Recorded as risk R-11 in 04-implementation-plan.md; Feeds (if adopted) or a server-side append route would close it in a later feature. (4) Non-member access — impossible without a room token (F05/F12). (5) XSS — content is rendered as text (React escapes); no Markdown rendering in chat in M2.

Validation points: `ChatComposer` (length, emptiness) → `useRoomChat.send` (schema) → render (`parseMessages`). Server helper validates before `mutateStorage`. No rate limit on chat in M2 (members only; Liveblocks storage-update quota noted in F15 cost table).

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| Storage root is a `LiveObject`; `LiveList`/`LiveObject` nest and merge per structure | https://liveblocks.io/docs/products/sync/storage | 2026-10-22 |
| `mutateStorage(roomId, async ({ root }) => …)` edits Storage from the server with the same conflict resolution; not a transaction across `await` | https://liveblocks.io/docs/products/sync/server-side-editing | 2026-10-22 |
| `setPresence(roomId, { userId, userInfo, data, ttl })`, TTL 2–3599 s; "use Feeds for durable status" | https://liveblocks.io/docs/products/sync/agentic-editing | 2026-10-22 |
| `['*:read']` tokens cannot write Storage; resource scopes incl. `feeds:*` exist since 3.20.0 | https://liveblocks.io/docs/api-reference/authentication/permissions | 2026-10-22 |
| `useStorage` returns plain objects (3.18+); `useMutation` batches; `useSelf().canWrite` | https://liveblocks.io/docs/api-reference/liveblocks-react | 2026-10-22 |
| Limits: 2 MB per LiveObject, 10 MB per room (Free/Pro); offline edits queue and merge on reconnect | https://liveblocks.io/docs/pricing/limits , https://liveblocks.io/pricing | 2026-10-22 |
| Liveblocks dev server supports `mutateStorage` (v1.4.0+) so L2/L3 can exercise the server helper locally | https://liveblocks.io/changelog/week-15-2026 | 2026-10-22 |
| **UNVERIFIED** — Liveblocks Feeds API (client hooks, server append, retention, permissions semantics) | to verify in T-001 against https://liveblocks.io/docs | — |
| **UNVERIFIED** — `LiveList` behaviour with 200 plain-object entries under concurrent `push` + `delete(0)` (ordering after merge) | covered by TC-020 convergence test | — |
| **UNVERIFIED** — `useUser(userId)` hook from `@liveblocks/react` resolving through `resolveUsers` for arbitrary ids (research only confirms `resolveUsers` for built-in UI components) | fallback in FR-010: presence `info.name` → "Member"; T-005 checks the hook | — |
