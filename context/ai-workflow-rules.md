# drawArc — AI Workflow Rules

> APPROVED in substance by the owner's planning brief (2026-10-22). This file is binding for every Claude Code session and every subagent.

## Roles

- **Owner** (human): final decision-maker. Approves specs, authorizes tasks, reviews code, approves architecture changes.
- **AI session**: engineering partner. Researches, proposes, specifies, and — only when authorized — implements a bounded task and reports honestly.

## Gates

| Gate | Name | Output | Who advances it |
|---|---|---|---|
| 1 | Discovery | Repository discovery report | AI reports → owner acknowledges |
| 2 | Product & architecture planning | Decisions (logged), research, feature graph | Owner answers decision questions |
| 3 | Specification drafting | `context/` + `features/` packages | AI drafts |
| 4 | Specification review | Consistency audit, open issues | AI audits, owner reads |
| 5 | Human approval | Approved feature list in `progress-tracker.md` | **Owner only** |
| 6 | Authorized implementation planning | Bounded task from an approved spec; implementation plan | Owner names the task; AI plans via `superpowers:writing-plans` |
| 7 | Implementation & verification | Code, tests, run logs, report | AI implements; owner reviews |

Rules between gates:
- Approval of one feature authorizes only that feature. Approval of the architecture does **not** authorize migrations, external-service configuration, or deployment — each is a separately authorized task.
- No destructive or production-affecting operation (dropping tables, deleting Blob objects/rooms in a shared environment, changing Vercel/Clerk/Liveblocks dashboards) without explicit, task-specific authorization.
- Hidden complexity discovered mid-task returns the work to the previous gate; say so, don't push through.

## Every session, before acting

1. Read `CLAUDE.md`, then `context/progress-tracker.md`, then the context files the task needs (index in `context/README.md`).
2. Inspect the actual repository state (`git status`, relevant files). Do not assume the tracker is current if the tree disagrees — report the discrepancy.
3. Identify the active task and its authorization status in the tracker. If none is authorized, you are in planning mode: no production code.
4. For an implementation task: read the feature's spec package, its `status.md`, and the specs it depends on.

## Research

- Verify library behaviour against official documentation **current for the pinned version**; for Next.js use the local docs in `node_modules/next/dist/docs/`.
- Record URL, date checked, and the finding in the feature spec or decision log. Never invent APIs or guarantees; mark unverifiable claims UNVERIFIED and design around them.
- Use `superpowers:brainstorming` for any design question that is not settled by an approved spec; use `superpowers:writing-plans` to turn an approved spec into an implementation plan; use the Next.js skill/docs before touching Next APIs.

## Implementing (Gate 7 only)

- Work on exactly the authorized task; the plan's task boundary is the scope. If something outside it must change to proceed, stop and ask.
- Follow [code-standards.md](code-standards.md), [security-model.md](security-model.md), and the feature's architecture section. Deviations require an owner decision and a decision-log entry.
- TDD where the plan specifies tests: write the failing test, run it, implement, run it green. Record the actual run output.
- Preserve unrelated working-tree changes; never revert or reformat files you were not asked to touch.
- Never modify `No_touch_ai/`.
- Keep `AGENTS.md`'s generated Next.js block as the dev server writes it.

## Reporting (every task, every gate)

Report, in this order, with no omissions:

1. **Changed files** (created / modified / deleted).
2. **Checks run** — the exact commands and their real output summary (pass/fail counts, first failure). If a check was not run, say "not run" and why.
3. **Acceptance criteria status** — each AC in scope: verified (how) / not verified.
4. **Limitations and known issues**.
5. **Decisions made or needed** — anything that should go in the decision log.
6. **Next step** and what the owner must approve.

Never claim verification you did not perform. Never mark a PROPOSED decision as APPROVED. Never mark a feature's status beyond what `status.md` evidence supports.

## Updating project memory (when authorized by the task)

- `context/progress-tracker.md`: current gate, authorized task, completed/verified work, blockers, next step.
- `features/NN-*/status.md`: status transitions with evidence (commands, dates, commit hashes).
- `context/decision-log.md`: new decisions with status and alternatives.
- Other context files only when the approved task changes what they describe; note the change in the report.

## Approval vocabulary

The owner approves by saying so explicitly for a named artifact ("approve feature 06", "approve the architecture as proposed"). Silence, questions, or "looks good so far" are not approval. When in doubt, ask one precise question.
