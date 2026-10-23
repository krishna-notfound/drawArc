# F16 — AI sidebar and room chat

| Field | Value |
|---|---|
| Milestone | M2 |
| Depends on | F11 (presence and cursors: `thinking` badge, `PresenceStack`), F01 (AI sidebar shell `components/ai/ai-sidebar.tsx`, `EditorShell`/`useEditorChrome`, shadcn Tabs/Textarea/Button/ScrollArea/Tooltip, tokens), F04 (mounts the shell in the workspace with `role`/`projectId` through the `aiSidebar` slot; AI toggle), F06 (room + `flow` Storage), F05 (room infrastructure, roles in `useSelf().canWrite`) |
| Depended on by | F17 (design agent writes status + chat through this feature's transport), F18 (Specs tab lives in this sidebar) |
| Product requirements | PRD-050, PRD-055 (UI half); NFR-002, NFR-006 |
| Status | see status.md |

## Purpose

F16 gives the workspace its right-hand **AI sidebar**: a floating panel with an "AI Architect" chat and a "Specs" tab, a room-scoped chat that every member of the project sees in real time, and a status strip that shows what the AI is doing while a run is active. It is the first M2 feature because F17 (the design agent) and F18 (spec generation) need a place to receive prompts and a transport to report progress; F16 builds the UI and the transport without any backend or Trigger.dev logic, so it can be verified entirely against the Liveblocks dev server. In F16 the Send action only appends a chat message; F17 extends it to start a run.

## Problem statement and goals

- Problem: a prompt-driven agent needs a shared, durable-enough place for prompts, replies and progress that all participants (including viewers) can see; presence alone is ephemeral and per-connection, and the canvas must not be used as a chat.
- G-1: a member can open the sidebar, type a message, and every other member sees it within 1 s (L3 test).
- G-2: viewers can read chat and status but cannot send (PRD-055), enforced by the Liveblocks read-only token, not only the UI.
- G-3: a status strip appears above the input only while a run is active and shows exactly the latest status text.
- G-4: every message rendered has passed Zod validation; a malformed message is skipped, never crashes the sidebar.
- G-5: the sidebar meets NFR-006 (keyboard-operable, visible focus, `aria-live` chat log).

## Scope

In scope:
- Body of F01's `components/ai/ai-sidebar.tsx` (floating right, header "AI Workspace" / "Collaborate with drawArc", close button already there; F16 adds tabs "AI Architect" / "Specs").
- AI Architect tab: scrollable chat log, empty state with three starter chips, auto-resizing textarea (72–160 px), Enter sends / Shift+Enter newline, send button.
- Specs tab: empty placeholder in F16 ("No specs yet"); F18 replaces it.
- Room-scoped chat transport (`ChatMessage` schema, append, subscription, 200-message cap) and AI status transport (`AiStatus`, latest only), both Zod-validated before render.
- `thinking` presence rendering for the AI participant (sidebar indicator + reuse of F11's cursor badge spinner and `PresenceStack`).
- Input disabled for viewers and while a run is active.
- Transport decision with a verification task (Liveblocks Feeds UNVERIFIED) and a fully specified Storage fallback.

Out of scope / non-goals:
- Starting a run, Trigger.dev, tokens, `useRealtimeRun` — F17.
- Specs list, preview, download — F18.
- Mirroring chat to Postgres, chat history beyond 200 messages, message editing/deletion, reactions, @mentions — never in M2 (data-ownership.md row "AI room chat").
- Direct messages or cross-project chat — never.
- Chat for anonymous share-link viewers — F20.

## User stories

- US-1: As an editor, I want to type a prompt in the AI sidebar so that I can later (F17) ask the agent to extend the diagram.
- US-2: As any member, I want to see the room's chat and the AI's status in real time so that I know what my collaborators and the agent are doing.
- US-3: As a viewer, I want to read chat and status without being able to post, so that read-only access stays read-only (PRD-055).
- US-4: As a member who reloads, I want the recent chat to still be there so that context survives a refresh.
- US-5 (abuse): As a non-member I must not be able to read or append to a project's chat even with the room id; as a viewer I must not be able to append even by crafting a Storage mutation (the read-only token rejects it).
- US-6 (abuse): As a malicious member I must not be able to crash other members' sidebars by writing a malformed or oversized message (validation skips it; the server-side cap and client-side cap bound size).

## Key decisions referenced

- D-012 (Liveblocks Storage is the real-time layer), D-015 (access tokens; viewer gets `*:read`), D-016 (dark theme tokens), D-018 (no new route handlers needed here).
- data-ownership.md row "AI room chat and status messages (M2)": Liveblocks owns it; "room-scoped feed or Storage list — decided in feature 16 after verifying the Feeds API".
- **PROPOSED F16-D1 — Chat and status transport.** Primary candidate: Liveblocks Feeds (**UNVERIFIED**: `feeds:*` permission strings exist since 3.20.0, but the Feeds API itself was not researched). Fallback, fully specified here and the design every test runs against: Liveblocks Storage with a `LiveList<ChatMessage>` under storage key `chat` (cap 200) and a `LiveObject<AiStatus>` under `aiStatus`, both siblings of `flow` in the room root. Rationale: Storage already carries permissions (read token cannot write), persists across reloads, is available in the local dev server used by L3, and is writable from Trigger.dev via `mutateStorage`. T-001 verifies Feeds; if Feeds is adopted, only `lib/chat/transport.ts` and `hooks/useRoomChat.ts` change — the schemas, UI and tests do not.
- **PROPOSED F16-D2 — Viewers cannot post chat messages.** PRD-055 says viewers "see status only"; a read token cannot write Storage anyway, so the UI and the transport agree. Rationale: one rule for all mutations; no second permission scope to manage.
- **PROPOSED F16-D3 — No new colour tokens.** The reference prompt 26 used `#62C073` for user bubbles and the send button; that hex is the `green` node colour pair, not a UI token. We use the existing tokens: `bg-ai` + `text-ai-foreground` for the send button and active tab (D-037, F01 D-F01-2a), `text-ai-text` for assistant bubble text, `text-success` for the "running" indicator in the status strip. Rationale: code-standards.md forbids hex outside `globals.css`/`types/canvas.ts`.

## Reference material

- context: ui-context.md (layout "AI sidebar floats right", sidebar surface rules, copy "AI Workspace — Collaborate with drawArc"), security-model.md (room access, read token), data-ownership.md (chat row), domain-model.md (Liveblocks room shape — extended here, see 02-design.md).
- Research: `research/liveblocks.md` §2 Storage model, §4 Presence (`setPresence` for agents, "use Feeds for durable status" — https://liveblocks.io/docs/products/sync/agentic-editing checked 2026-10-22), §5 permission strings incl. `feeds:*` (https://liveblocks.io/docs/api-reference/authentication/permissions checked 2026-10-22), §6 `mutateStorage` (https://liveblocks.io/docs/products/sync/server-side-editing checked 2026-10-22), §11 limits (2 MB per LiveObject, 10 MB per room — https://liveblocks.io/docs/pricing/limits checked 2026-10-22).
- Reference prompts (product intent only; our decisions override): `No_touch_ai/.../feature-specs/20-ai-sidebar-shell.md` (header, tabs, chips, bubble styles, textarea sizes), `24-ai-presence-state.md` (status feed, latest message only, thinking spinner), `25-sidebar-chat-feed.md` (chat feed separate from status, Zod validation), `26-ai-chat-functional.md` (status strip above input, input disabled while running).
