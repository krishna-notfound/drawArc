# Feature Specification Template

Every feature lives in `features/NN-kebab-name/` and contains the numbered files below plus `status.md`. Files `00`–`05` are required for every M1–M3 feature; `06` is added when the feature is planned for implementation. Deferred (future) features contain only `00-overview.md` and `status.md`. Keep each file reviewable (target ≤ 250 lines); split a section into `0Na-…` only when it is genuinely large.

IDs are scoped to the feature: `FR-001`, `AC-001`, `T-001`, `TC-001`. Reference across features as `F06/FR-001`. IDs are never renumbered; retired IDs are marked `(withdrawn)`.

---

## `00-overview.md`

```markdown
# F<NN> — <Feature name>

| Field | Value |
|---|---|
| Milestone | M1 / M2 / M3 / Future |
| Depends on | F<NN> (what it consumes), … |
| Depended on by | … |
| Product requirements | PRD-xxx, … (from context/product-requirements.md) |
| Status | see status.md |

## Purpose
One paragraph: what this feature lets a user (or the system) do, and why it exists in this position of the dependency order.

## Problem statement and goals
- Problem: …
- Goals (G-1 …): measurable outcomes.

## Scope
In scope: bullets. Out of scope / non-goals: bullets, each with the feature that owns it instead (or "never").

## User stories
- US-1: As a <role>, I want … so that …
- (Include the failure/abuse story: "As a non-member I must not be able to …")

## Key decisions referenced
D-xxx … from context/decision-log.md. Decisions introduced by this feature are listed here as PROPOSED with a one-line rationale and must be copied into the decision log on approval.

## Reference material
Links to context files, research facts (with date), and `No_touch_ai/` prompts this feature drew on, including any `current-issues` bug it must prevent.
```

## `01-requirements.md`

```markdown
# F<NN> — Requirements

## Functional requirements
| ID | Requirement (shall-statement, testable) | Priority (must/should) | Source (PRD/US) | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The system shall … | must | PRD-021, US-1 | AC-001, AC-002 |

## Non-functional requirements exercised
| NFR | How this feature meets it |
|---|---|
| NFR-001 | … |

## UX and interaction behaviour
Prose + tables for states, inputs, outputs, copy, keyboard, and responsive behaviour. Reference ui-context.md rather than restating tokens.

## Error handling and edge cases
| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | … | … | AC-0xx |
Include: concurrency, offline/reconnect, permission change mid-use, empty/huge inputs, duplicate submits, external-service failure.
```

## `02-design.md`

```markdown
# F<NN> — Design

## Architecture and components
Where it sits in the dependency direction; files created/modified (paths from architecture-context.md); server vs client responsibilities; diagram if useful.

## Domain model and TypeScript contracts
Exact types/interfaces/Zod schemas introduced or changed (code blocks). Reference domain-model.md for shared types; do not redefine them.

## Data and state ownership
Which system owns each piece of state this feature touches (must agree with data-ownership.md). Any new derived copy needs a justification.

## API and integration contracts
Routes / Server Actions / Liveblocks events / Trigger.dev tasks: method, path, auth requirement, minimum role, request schema, response schema, error codes.

## Security and validation
Threats specific to this feature; which checks run where; what is validated; rate limits. Must satisfy security-model.md.

## Verified library facts this design relies on
| Fact | Source URL | Date checked |
|---|---|---|
Mark UNVERIFIED items and the fallback design.
```

## `03-acceptance-criteria.md`

```markdown
# F<NN> — Acceptance Criteria

| ID | Given / When / Then | Verifies | Verification method (layer + how) |
|---|---|---|---|
| AC-001 | Given …, when …, then … | FR-001 | L3 Playwright `tests/e2e/<file>.spec.ts` |
| AC-002 | … | FR-001, EC-003 | L1 Vitest `tests/unit/<file>.test.ts` |
| AC-0xx | Authorization matrix for every new endpoint | FR-… | L2 `AUTHZ-MATRIX` |

Every FR appears in at least one AC. Every AC has exactly one layer. Manual verification is allowed only for visual/perf criteria and must say what a human checks and records.
```

## `04-implementation-plan.md`

```markdown
# F<NN> — Implementation Plan (outline)

Dependencies to be installed (exact pins). Environment variables added. Migrations (if any — each requires separate authorization).

| Task | Deliverable | Satisfies | Files | Done when |
|---|---|---|---|---|
| T-001 | … | FR-001, FR-002 | `lib/...` | AC-001 passes |

Tasks are ordered, each independently reviewable, each ≤ ~1 day. This is an outline; the detailed step-by-step plan is produced at Gate 6 with `superpowers:writing-plans` into `docs/superpowers/plans/` and must trace back to these task IDs.
```

## `05-test-plan.md`

```markdown
# F<NN> — Test Plan

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L1 | tests/unit/… | fixture X | … | … |

Collaboration/concurrency cases (if the feature touches the room) and the AUTHZ-MATRIX cases (if it adds endpoints) are mandatory sections. State what is **not** tested automatically and why.
```

## `06-review-checklist.md` (added at Gate 6)

```markdown
# F<NN> — Review and Release Checklist
- [ ] Spec approved (date, by owner) and unchanged since, or changes logged
- [ ] All FR ↔ AC ↔ TC links present
- [ ] `npm run check` output attached; `npm run build` passes
- [ ] L3 tests run against preview URL (link) — output attached
- [ ] Authorization matrix passed for every new endpoint
- [ ] No new dependency outside the plan; pins respected
- [ ] context/ and decision-log updated where the feature changed them
- [ ] Owner review notes addressed
- [ ] status.md updated with evidence
```

## `status.md`

```markdown
# F<NN> — Status

| Field | Value |
|---|---|
| Status | drafted / reviewed / approved / planned / in-progress / verified / released / deferred |
| Spec approved | — (date, owner) |
| Implementation authorized | — (task IDs, date) |
| Last verified | — (commit, date, command output summary) |

## History
- 2026-10-22 — drafted by planning session.

## Evidence
Links/paths to run logs, preview URLs, PRs.

## Open issues
- …
```
