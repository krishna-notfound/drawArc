# CLAUDE.md — drawArc

drawArc is a real-time collaborative system-design canvas built with Next.js 16, React Flow, Liveblocks, Clerk, Neon PostgreSQL, Prisma, Vercel Blob, and Trigger.dev.

Development follows strict specification-driven development (SDD). The owner controls requirements, approvals, implementation scope, commits, and releases.

## 1. Every Session

1. Read `context/progress-tracker.md` and `context/README.md`.
2. Read only the context files and feature specifications relevant to the current task.
3. Inspect `git status`, the current branch, recent commits, and relevant files before making changes.
4. Confirm the current phase, approved scope, prerequisites, and authorized task.
5. If the task is not explicitly authorized, remain in planning mode.

If repository state conflicts with documentation, report the discrepancy before proceeding.

## 2. Specification-Driven Development

Every phase must have an approved specification defining:

- Goals, scope, and non-goals
- Functional and non-functional requirements
- Dependencies and architectural constraints
- Acceptance criteria
- Test and verification requirements
- Completion conditions

Use the existing `context/` and `features/` documentation as the planning baseline. Do not regenerate it wholesale or create unnecessary documents.

Before implementation, verify that the specification is approved, prerequisites are satisfied, and acceptance criteria are testable.

Implement only approved requirements. Any additional feature, dependency, requirement, or architectural change requires my explicit approval before proceeding.

## 3. Phase Gates and Owner Approval

Follow this workflow for every phase:

**Specify → Review → Get approval → Implement → Verify → Commit → Report → Request next-phase approval.**

Use these phase states:

- `Draft`
- `Awaiting Owner Input`
- `Awaiting Approval`
- `Approved`
- `In Progress`
- `Verification`
- `Blocked`
- `Completed`
- `Changes Requested`

Rules:

1. Never start a phase without explicit owner approval.
2. Never advance to the next phase automatically.
3. Completing a phase does not authorize the next phase.
4. Ask me explicitly whenever a requirement, decision, credential, configuration, or action requires my input.
5. For important decisions, explain the reason, available options, trade-offs, and your recommendation.
6. Resolve routine implementation details independently when the approved specification already provides sufficient guidance.
7. If blocked, stop the affected work and explain what is needed.
8. Record approved architectural decisions in `context/decision-log.md`.
9. Update `context/progress-tracker.md`, the relevant feature `status.md`, and affected context files only when authorized.

Never invent approval or treat silence as consent.

## 4. Architecture and Code Quality

- Follow `context/architecture-context.md`, `context/security-model.md`, and `context/code-standards.md`.
- Follow the project's Next.js 16 Cache Components rules. Before using an unfamiliar Next.js API, consult `node_modules/next/dist/docs/01-app/`.
- Use React Flow for diagramming and follow the approved collaboration and data-ownership design.
- Enforce server-side authorization and input validation.
- Preserve unrelated working-tree changes.
- Never modify `No_touch_ai/`.
- Leave generated blocks in `AGENTS.md` untouched.
- Avoid unrelated refactoring, unnecessary dependencies, speculative abstractions, and duplicate documentation.
- Never claim work is complete without verification evidence.

## 5. GitHub Identity and Commit Policy

**Every authorized development phase must be committed under my verified GitHub identity, never Claude's or an AI agent's identity.**

Before committing:

1. Inspect the current branch, `git status`, `git config user.name`, `git config user.email`, and recent commit authors.
2. Verify my intended author name and email from existing owner-authored commits or configuration I explicitly provided.
3. If my identity cannot be verified, stop and ask me. Never invent an email or use Claude's identity.
4. Inspect `git diff` and `git diff --cached`.
5. Stage only files belonging to the authorized phase.
6. Run the required quality checks and confirm the phase meets its completion conditions.

Commit requirements:

- Create a focused, descriptive commit after each completed and verified development phase, when authorized.
- Use conventional commit messages where appropriate, such as `feat(canvas): implement node selection`.
- Never commit secrets, environment files, unrelated changes, or unapproved work.
- Never amend, rewrite, reset, or force-push existing history without separate explicit approval.
- Never push to GitHub without explicit approval.
- Planning-only changes require explicit authorization before committing.
- If verification fails, the phase is incomplete, unrelated changes cannot be isolated, or identity is uncertain, stop before committing and report the blocker.

A commit does not mean the owner has accepted the phase.

## 6. External and Destructive Operations

Obtain separate explicit authorization before:

- Applying migrations to shared or production databases
- Deleting documents, collaboration rooms, blobs, or other data
- Changing external-service dashboards or configurations
- Deploying the application
- Pushing commits or changing remote Git state
- Performing irreversible or production-affecting operations

Never expose credentials, tokens, or secrets.

## 7. Testing and Verification

Available project commands may include:

- `npm run dev` — development server
- `npm run lint` — lint
- `npm run check` — project quality checks
- `npm run build` — production build
- `npm run e2e` — end-to-end tests when required

Check `package.json` before running commands. Follow the quality gates specified by the active feature. Do not assume a script exists or passed.

The definition of done requires:

- All approved requirements addressed
- Acceptance criteria verified or explicitly reported as unmet
- Required checks executed with actual results
- Changes reviewed for scope, security, and regressions
- Relevant authorized documentation updated
- Commit created under my verified identity, or the reason it could not be created reported
- Outstanding issues and limitations disclosed

Never mark a phase complete merely because code compiles or the planned files exist.

## 8. AI Workflow

Follow `context/ai-workflow-rules.md`.

Use `superpowers:brainstorming` for unresolved design questions and `superpowers:writing-plans` when an approved specification requires an implementation plan.

Do not start implementation during planning mode. Do not expand the planning package without a specific, justified need.

## 9. Required Task Report

Keep every report concise:

- **Phase:** current status and authorized scope
- **Changed:** files created or modified
- **Verification:** checks run and actual results
- **Acceptance:** criteria verified and unmet
- **Git:** commit hash, message, author, or reason no commit was created
- **Blockers:** outstanding issues and owner decisions
- **Next step:** what requires my explicit approval

## Final Rule

**Work on one approved phase at a time. Ask me when my input or action is required. Verify the work, commit under my verified GitHub identity, report honestly, and stop until I explicitly authorize the next phase.**