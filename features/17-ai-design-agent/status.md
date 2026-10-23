# F17 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — (T-002 migration and the four external-service changes must be named individually) |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer). LLM SDK left open per D-006; planner specified as a provider-agnostic contract with a fake planner for all automated tests.
- 2026-10-22 — Gate 4 audit fixes applied (archived → 403 `FORBIDDEN`/`PROJECT_ARCHIVED` per F03, `TaskRun` fields aligned with domain-model, `lib/liveblocks-flow.ts` extended from F13, FR links, EC-002 completed). See `features/AUDIT-2026-10-22.md`.

## Evidence
- (none yet) — Trigger.dev smoke-run screenshot (T-001), T-004 spike notes, `npm run check`, L2/L3 logs, `docs/perf/ai-runs-<commit>.md` (AC-030).

## Open issues
- **SDK selection (Gate 6):** Anthropic SDK direct vs Vercel AI SDK `generateObject` — table in 02-design.md; versions UNVERIFIED.
- F17-D1 additive-only agent (no edits to pre-existing nodes in M2) — confirm; the reference prompt wanted move/resize/delete.
- F17-D3 `TaskRun.runId` nullable and `failureReason` — now recorded in `context/domain-model.md` (Gate 4); confirm at Gate 5.
- F17-D4 no automatic task retries; one in-run planner retry — confirm.
- Layout constants (260 × 170 px pitch, 24 px padding, 120 px gap from the existing bbox, 50 shifts) are PROPOSED; tune after the live check.
- Rate limit scope: 10 runs/user/hour counts DESIGN and SPEC together (F18) — confirm.
- Cancel-run button not in scope; stale guard (10 min) is the only recovery for a hung run — accept or schedule.
- `@trigger.dev/build` package name for `syncVercelEnvVars` UNVERIFIED (T-001).
