# F17 — AI design agent

| Field | Value |
|---|---|
| Milestone | M2 |
| Depends on | F16 (sidebar, chat/status transport), F13 (`lib/blob.ts`, `getCanvas` — not used for writes, but the agent must respect the snapshot caps and the autosave path), F06 (`CanvasDocumentSchema`, `flow` storageKey), F05 (`lib/liveblocks.ts` node client, Presence/UserMeta), F03 (`requireProjectRole`, Prisma), F02 (`requireUser`), F11 (`thinking` badge) |
| Depended on by | F18 (reuses Trigger.dev setup, `TaskRun`, token route, status helpers, `readFlow`) |
| Product requirements | PRD-051, PRD-052, PRD-053, PRD-054, PRD-055; NFR-001, NFR-002, NFR-008, NFR-009 |
| Status | see status.md |

## Purpose

F17 turns a prompt typed in the AI sidebar into nodes and edges that appear in the live room for every participant. A route handler authorizes the request, records a `TaskRun`, and starts a Trigger.dev run; the run takes a version snapshot, announces itself through presence and the F16 status transport, asks an LLM for a **plan** expressed only in terms of the canvas tool surface, validates and lays the plan out deterministically, and applies it in one synchronous `mutateFlow` pass. It sits after F16 because it needs the chat/status transport, and after F13 because the canvas schema is frozen and the snapshot path must not be disturbed. It is the M2 exit criterion: "A prompt produces a valid diagram in the shared room, visible to all participants, with status and presence."

## Problem statement and goals

- Problem: an LLM call takes 10–60 s and must not run inside a Vercel request; its output is untrusted and must be validated against the frozen canvas schema and laid out without overlaps before it touches a shared room; every participant must see progress and failures, and a user's undo must never swallow the agent's work.
- G-1: ≥ 90 % of runs on the five canonical prompts produce a valid, non-overlapping diagram (project-overview.md success metric), measured by the live-provider check in 05-test-plan.md.
- G-2: p95 time from Send to "complete" status ≤ 60 s on the five prompts (live check).
- G-3: zero partial applies: a plan that fails validation changes nothing in the room (L2 test with a fake planner).
- G-4: every failure is reported to the room chat and the status strip returns to idle within 5 s of the failure (L3 with fake planner).
- G-5: viewers get 403 from the route; a non-member gets 403; a crafted `projectId` is never trusted (AUTHZ-MATRIX).

## Scope

In scope:
- Trigger.dev 4.7.x project setup (`trigger.config.ts`, `/trigger`, dev workflow, env, `syncVercelEnvVars`).
- `POST /api/ai/design` and `POST /api/ai/design/token`; `TaskRun` model + migration (separate authorization).
- `trigger/design-agent.ts` `schemaTask` with the run sequence (verify → snapshot → presence → read → plan → validate → layout → apply → report).
- Provider-agnostic planner contract `planDesign(input): Promise<DesignPlan>` with a `FakePlanner` for tests; SDK selection deferred to Gate 6 (D-006).
- Deterministic layout engine `lib/ai/layout.ts` with explicit grid/spacing rules and overlap rejection.
- Client: `useRealtimeRun` driving the status strip and input lock for the requester; `AiStatus` for everyone else; Send action now calls the route.
- Five canonical prompts as fixtures.

Out of scope / non-goals:
- Spec generation — F18. Cancelling a run — later M2 polish (listed in status.md open issues). Editing or deleting **pre-existing** nodes on request — a later feature (see F17-D1). Streaming partial LLM output to the UI — not needed (plan is applied atomically). Multi-turn agent memory beyond the last 20 chat messages — never in M2. Trigger.dev webhooks endpoint — not in M2 (task hooks update `TaskRun`). Rate limiting via Redis — never (DB count).

## User stories

- US-1: As an editor, I want to type "Design an e-commerce backend" and watch the agent add a laid-out diagram to our room so that we have a starting point to edit together.
- US-2: As any member, I want to see that the AI is working (status strip, thinking cursor, avatar) and read its summary when it finishes.
- US-3: As an editor, I want the agent to connect new nodes to nodes already on the canvas when my prompt refers to them so that extensions fit the existing diagram.
- US-4: As a user who presses Ctrl+Z after a run, I want to undo only my own last change, never the agent's whole diagram.
- US-5 (abuse): As a viewer or a non-member I must not be able to start a run, obtain a run token, or make the agent write into a project I cannot edit, even by sending another project's id.
- US-6 (abuse): As a prompt author I must not be able to make the agent emit shapes, colours, or counts outside the canvas schema, or produce overlapping nodes; invalid output is rejected and reported, never partially applied.

## Key decisions referenced

- D-006 (LLM SDK deferred; contract-only spec), D-009/D-022 (snapshot path unaffected), D-012 (Storage + `mutateFlow`), D-013 (agent writes are `origin: remote`, outside user undo stacks), D-015 (secret key only server-side), F16-D1 (F16 transport), security-model.md "Rate limiting" (≤ 10 AI runs/user/hour, 1 concurrent per project).
- **PROPOSED F17-D1 — Additive-only agent in M2.** The planner may add nodes and edges and may connect new nodes to existing ones, and may update/remove only nodes and edges created **in the same run** (by `ref`). Operations that update or remove a pre-existing node/edge are rejected by the validator and the whole plan is reported as invalid. Rationale: R-01 (same-key LWW with a user dragging a node; undo does not rebase) — the agent never races a human on the same key; the reference prompt's "move/resize/delete existing" is deferred until a locking or confirmation UX exists.
- **PROPOSED F17-D2 — One `mutateFlow` apply pass, plan computed outside it.** The graph is read first, the LLM is called outside any Liveblocks callback, and the validated, positioned plan is applied in one synchronous callback. Rationale: `mutateStorage` is not transactional across `await` (research §6), and its timeout and mid-callback concurrency semantics are UNVERIFIED — holding it open for a 30 s LLM call is not acceptable. Drift between read and apply is handled by apply-time existence checks (02-design.md).
- **PROPOSED F17-D3 — `TaskRun.runId` is nullable until Trigger.dev acknowledges the trigger.** The row is created first (so the idempotency key is the row id), then `tasks.trigger` is called; on trigger failure the row is marked `FAILED` with `failureReason`. `context/domain-model.md` now records `runId` as `string?, unique` and the `failureReason` column (Gate 4), so this is no longer a deviation — owner approval at Gate 5 still required.
- **PROPOSED F17-D4 — No automatic retries for the design task** (`retry: { maxAttempts: 1 }`): a retry would re-run the LLM and could double-apply. One planner retry *inside* the run (with the validation error fed back) is allowed instead.
- **Gate-6 decision (OPEN): SDK selection** — see 02-design.md "SDK selection".

## Reference material

- context: architecture-context.md "Collaboration architecture" (server-side writes), "Background tasks"; security-model.md (Trigger payloads trusted only after we enqueued them; task re-verifies `TaskRun` → project → requester role); domain-model.md `TaskRun`, canvas schema v1, id formats; ui-context.md node default sizes (layout engine uses them).
- Research (`research/services.md` §C, checked 2026-10-22): `@trigger.dev/sdk` 4.7.7 — https://trigger.dev/docs/guides/frameworks/nextjs ; `schemaTask` — https://trigger.dev/docs/tasks/schemaTask ; idempotency — https://trigger.dev/docs/idempotency ; concurrency — https://trigger.dev/docs/queue-concurrency ; metadata — https://trigger.dev/docs/runs/metadata ; Realtime hooks/auth — https://trigger.dev/docs/realtime/react-hooks/subscribe , https://trigger.dev/docs/realtime/auth ; env vars — https://trigger.dev/docs/deploy-environment-variables ; limits — https://trigger.dev/docs/limits. `research/liveblocks.md` §4, §6 (checked 2026-10-22): `setPresence` — https://liveblocks.io/docs/products/sync/agentic-editing ; `mutateFlow` — https://liveblocks.io/docs/api-reference/liveblocks-react-flow ; not-a-transaction — https://liveblocks.io/docs/products/sync/server-side-editing ; version history — https://liveblocks.io/docs/products/sync/version-history.
- Reference prompts (intent only): `22-design-agent-api.md`, `23-design-agent-logic.md`, `24-ai-presence-state.md`, `26-ai-chat-functional.md`. The reference used Gemini via `@ai-sdk/google`; D-006 overrides.
