# F16 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The workspace shall render an AI sidebar as a floating panel fixed to the right edge (width 380 px ≥ 640 px viewport, full width below), opened/closed by the navbar "AI" toggle, fully off-screen when closed (`translateX(100%)`), with a backdrop scrim and tap-outside close on mobile. | must | PRD-050, ui-context.md layout | AC-001, AC-002 |
| FR-002 | The sidebar header shall show a bot icon, the title "AI Workspace", the subtitle "Collaborate with drawArc", and a close button with `aria-label="Close AI sidebar"`. | must | ui-context.md copy, US-1 | AC-003 |
| FR-003 | The sidebar shall contain two shadcn Tabs: "AI Architect" (default) and "Specs"; the active tab uses the AI accent (`bg-ai text-ai-foreground`, D-037), inactive tabs `text-copy-muted`; the selected tab persists while the sidebar is open and resets to "AI Architect" on reload. | must | PRD-050, D-037 | AC-004, AC-004b |
| FR-004 | When the chat has zero messages the AI Architect tab shall show an empty state: bot icon (`h-8 w-8`), the text "Describe the system you want to design, or pick a starting point.", and exactly three starter chips with the labels `Design an e-commerce backend`, `Create a chat app architecture`, `Build a CI/CD pipeline`; clicking a chip inserts its text into the textarea and focuses it (it does not send). | must | PRD-050, reference 20 | AC-005 |
| FR-005 | The input shall be a textarea that auto-resizes between 72 px and 160 px (scroll inside above 160 px), accepts at most 2,000 characters (counter shown from 1,800), sends on Enter, inserts a newline on Shift+Enter, and ignores Enter while an IME composition is in progress. | must | PRD-050, reference 20 | AC-006, AC-007 |
| FR-006 | Send shall be rejected (no message, no transport call) when the trimmed content is empty, when the user's role is viewer, or when a run is active; the button is disabled in those states with a tooltip stating the reason. | must | PRD-055, EC-002 | AC-008, AC-009 |
| FR-007 | A successful Send shall append a `ChatMessage` `{ id, senderId: self.id, role: 'user', content, createdAt }` to the room-scoped chat so that every connected member receives it without a refresh, then clear the textarea. | must | PRD-050, US-2 | AC-010, AC-011 |
| FR-008 | Every message shall be validated with `ChatMessageSchema` before render; invalid entries are skipped and counted in a `logger.warn` once per entry, never thrown. | must | NFR-002, US-6 | AC-012 |
| FR-009 | The chat shall keep at most 200 messages: an append that would exceed the cap removes the oldest entries in the same mutation. | must | EC-004 | AC-013 |
| FR-010 | Messages shall render in `createdAt` order with bubble styles by role: user — right-aligned `bg-brand-dim border-2 border-brand/50 text-copy-primary`; assistant — left-aligned `bg-elevated border border-surface-border text-ai-text`; system — centred `text-copy-muted` text-xs; each shows sender display name (self → "You", `ai` → "drawArc AI", other member → name resolved by Liveblocks `useUser(senderId)` over F05's `resolveUsers` / `GET /api/users/resolve`, falling back to the sender's presence `info.name` and then "Member") and a relative timestamp. | must | PRD-050 | AC-014 |
| FR-011 | The chat log shall auto-scroll to the newest message when the user is within 48 px of the bottom, and otherwise show a "New messages" pill that scrolls down on click. | should | UX | AC-015 |
| FR-012 | While `AiStatus.state === 'running'` the sidebar shall show a status strip directly above the input containing a `text-success` pulsing dot, the latest `AiStatus.text` (single line, truncated), and `role="status"`; it is hidden when idle. | must | PRD-050, reference 24/26 | AC-016 |
| FR-013 | The sidebar shall treat a `running` status older than 10 minutes (`updatedAt`) as idle (stale-run guard) so a crashed run never locks the input forever. | must | EC-005 | AC-017 |
| FR-014 | The sidebar shall surface the AI participant's presence: when any `others` entry has `presence.thinking === true` a small spinner appears next to the title; F11's cursor badge spinner and `PresenceStack` render the `ai` participant through the existing presence path with no F16-specific code. | must | PRD-052 (visibility), F11 | AC-018 |
| FR-015 | The sidebar shall work when the room's Storage has no `chat`/`aiStatus` keys yet (rooms created before F16): reads treat missing keys as empty/idle; the first Send creates the keys. | must | EC-001 | AC-019 |
| FR-016 | A viewer's attempt to write chat via a crafted Storage mutation shall be rejected by Liveblocks (read token) and surface in the sidebar as a non-fatal error toast "You have read-only access." | must | PRD-055, US-5 | AC-020 |
| FR-017 | The sidebar shall be keyboard-operable: Tab order header → tabs → chat log → textarea → send; Esc closes the sidebar when focus is inside it and no dialog is open; focus returns to the navbar toggle. | must | NFR-006 | AC-021 |
| FR-018 | The Specs tab in F16 shall show the empty state "No specs yet — generate one from the AI Architect tab (coming in M3)." and no controls. | must | scope | AC-022 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-001 | No new endpoints. Write authority is the Liveblocks token issued by F05 after `requireProjectRole`; a viewer's token cannot write Storage. |
| NFR-002 | `ChatMessageSchema` and `AiStatusSchema` (Zod) parse every entry before render and before append. |
| NFR-003 | Chat append → remote render measured in the two-context L3 test (< 1 s target; Liveblocks default throttle 100 ms). |
| NFR-004 | Chat capped at 200 messages × ≤ 2,000 chars ≈ 400 KB worst case, far under the 2 MB per-LiveObject and 10 MB per-room limits. |
| NFR-006 | Keyboard order, `aria-live="polite"` log, `role="status"` strip, visible focus rings, tooltips on icon-only buttons, reduced-motion respected for the slide and the pulsing dot. |
| NFR-007 | All transport types inferred from Zod schemas. |

## UX and interaction behaviour

| State | Chat area | Input | Send button | Status strip |
|---|---|---|---|---|
| Empty, editor | empty state + chips | enabled | disabled (empty) | hidden |
| Messages, editor | log | enabled | enabled when non-empty | hidden |
| Viewer | log or empty state (chips hidden) | disabled, placeholder "Viewers can read the chat but not post." | disabled, tooltip same text | as per status |
| Run active (any role) | log | disabled, placeholder "drawArc AI is working…" | disabled with spinner | visible, latest text |
| Disconnected (`useStatus !== 'connected'`) | log (last known) | enabled; send queues locally (Liveblocks offline queue) | enabled | unchanged |
| Storage keys missing | empty state | enabled | per content | hidden |

Copy: textarea placeholder "Describe the system you want to design…"; send button `aria-label="Send message"`; counter "1,850 / 2,000".
Keyboard: Enter send; Shift+Enter newline; Esc closes sidebar; `?` cheat-sheet (F10) ignored while focus is in the textarea (code-standards.md).
Responsive: < 640 px the sidebar is full-width with a scrim; chat log uses `ScrollArea`; the strip wraps to one line and truncates with an ellipsis.
Reduced motion: slide transition and pulsing dot disabled under `prefers-reduced-motion`.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Room created before F16: `root.chat` / `root.aiStatus` undefined | Treated as `[]` / `{ state: 'idle' }`; first append calls `root.set('chat', new LiveList([]))` inside the same mutation | AC-019 |
| EC-002 | Send with whitespace-only content or > 2,000 chars | No append; textarea keeps content; button disabled; counter turns `text-error` above 2,000 | AC-008 |
| EC-003 | Double submit (Enter held, or click + Enter within 300 ms) | Single append: a `sending` ref guards re-entry until the mutation returns | AC-011 |
| EC-004 | 201st message | Oldest removed in the same mutation; log shows 200 | AC-013 |
| EC-005 | `aiStatus.state === 'running'` but `updatedAt` > 10 min old (task crashed) | Strip hidden, input enabled; `logger.warn` once | AC-017 |
| EC-006 | Malformed entry in the list (wrong shape, content > 2,000, unknown role) | Skipped; others render; one `logger.warn` per bad id | AC-012 |
| EC-007 | Viewer crafts a mutation via devtools | Liveblocks rejects the write (read token); `useErrorListener` maps the error to the toast "You have read-only access." | AC-020 |
| EC-008 | Role downgraded editor → viewer mid-session (F05/F12 `ROLE_CHANGED` → `client.logout()` + full reload with a read token) | After the reload `useSelf().canWrite` is false and the server `role` prop is `viewer`; input disabled within the 5 s budget | AC-009 |
| EC-009 | Offline send (`useStatus` = `reconnecting`) | Message appears locally and is delivered on reconnect (Liveblocks queue); status pill from F05 shows offline | AC-023 |
| EC-010 | Two members send simultaneously | Both messages present for both; order by `createdAt` with id tiebreak (LiveList insertion order may differ) | AC-024 |
| EC-011 | Sidebar closed while a run is active | Strip state unaffected; reopening shows it; navbar toggle shows a dot while running | AC-016 |
| EC-012 | Storage exceeding limits (room near 10 MB) | Out of F16 control; the 200 cap bounds chat; NFR-004 assertion in F15 includes chat | — (F15) |
