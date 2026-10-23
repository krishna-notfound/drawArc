# drawArc — Context Index

This directory is the durable memory of the project. A fresh Claude Code session (or a new human contributor) must be able to answer four questions from these files alone: **what drawArc is, what is approved, what remains, and what it is allowed to do.**

Read in this order for any task. Stop when you have what the task needs; do not read everything for a one-file change.

| # | File | Answers | Read when |
|---|---|---|---|
| 1 | [progress-tracker.md](progress-tracker.md) | Current gate, authorized task, blockers | **Always first** |
| 2 | [project-overview.md](project-overview.md) | What drawArc is, who it serves, milestones, success | Always |
| 3 | [product-requirements.md](product-requirements.md) | Product-level requirements (`PRD-*`, `NFR-*`), scope, non-goals | Any feature work |
| 4 | [architecture-context.md](architecture-context.md) | Stack, module boundaries, dependency direction, verified library facts | Any code or spec work |
| 5 | [domain-model.md](domain-model.md) | Entities, relationships, invariants, canvas schema v1 | Data, API, canvas work |
| 6 | [data-ownership.md](data-ownership.md) | Which system is authoritative for each data category | Anything that stores or syncs state |
| 7 | [security-model.md](security-model.md) | Trust boundaries, authz rules, room access, revocation | Any route, action, auth, sharing work |
| 8 | [ui-context.md](ui-context.md) | Theme tokens, layout, canvas visuals, component rules | Any UI work |
| 9 | [code-standards.md](code-standards.md) | Conventions, Next 16 Cache Components rules, validation, errors | Any code |
| 10 | [testing-strategy.md](testing-strategy.md) | Test layers, tools, quality gate commands | Any implementation task |
| 11 | [ai-workflow-rules.md](ai-workflow-rules.md) | Gates 1–7, authorization, reporting format | Always, before acting |
| 12 | [decision-log.md](decision-log.md) | Every significant decision, its status, alternatives | Before proposing a change to anything above |
| 13 | [glossary.md](glossary.md) | Canonical terms | When a term is ambiguous |
| 14 | [feature-spec-template.md](feature-spec-template.md) | Structure every `features/NN-*/` package follows | Writing or reviewing a spec |

Feature specifications live in [`../features/`](../features/README.md), numbered in dependency order.

## Conventions used across these files

- **APPROVED** — the owner explicitly approved it (date in the decision log). Do not change without a new approval.
- **PROPOSED** — recommended by the planning process; treat as the working assumption but it is open to challenge until approved.
- **VERIFIED** — a fact checked against official documentation on the date given, with the URL in the research notes.
- **UNVERIFIED** — a claim we could not confirm; do not build on it without checking.
- Requirement IDs: product level `PRD-###` / `NFR-###` (in `product-requirements.md`); feature level `FR-###`, `AC-###`, `T-###`, `TC-###` scoped to a feature folder and referenced externally as `F06/FR-001`.
- Dates are absolute (`2026-10-22`), never relative.

## Research notes

The technical facts in these documents were verified on 2026-10-22 against official docs for React Flow 12.12.0, Liveblocks 3.24.4, Clerk 7.9.19, Prisma 7.10.1, Neon serverless 1.2.0, Trigger.dev 4.7.7, Vercel Blob 2.8.2, and the Next.js 16.4.2 docs shipped in `node_modules/next/dist/docs/`. The condensed findings are embedded in `architecture-context.md`; the decision log cites them. Re-verify before relying on any version-specific claim once a dependency is upgraded.

## Reference material (read-only)

`../No_touch_ai/` contains the course material drawArc was derived from ("How Real Engineers Build — Liveblocks, Trigger.dev", 2026-05-01). It is a **reference, not a source of truth**: its feature prompts informed our specs, and its `current-issues/*.md` files record real bugs that our acceptance criteria now guard against. Never modify that directory.
