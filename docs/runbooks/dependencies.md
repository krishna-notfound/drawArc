# Dependency update policy

Applies to every package in `package.json` (F15 FR-013, NFR-010, D-023).

## Pins

- `@xyflow/react`: `~12.12.x` (React Flow 13 is pre-release).
- Every `@liveblocks/*` package: one identical exact version (they are released together and must match).
- `prisma`, `@prisma/client`, `@prisma/adapter-neon`: `~7.10.x`.
- `next` and `eslint-config-next` / `@next/playwright`: the same exact version.
- Everything else: the caret or tilde range recorded at install time, with `package-lock.json` committed; installs use `npm ci`.

`npm run check:pins` enforces the first three rules and runs in CI's `audit` job; the unit suite runs the same
check against `package.json`.

## Routine

- **Monthly review** (first week of the month): `npm outdated`, read the changelogs of anything with a new
  minor or major, and list candidate upgrades in the session notes of `context/progress-tracker.md`.
- **Security**: `npm audit --audit-level=high` runs on every pull request. A high or critical finding blocks the
  merge until it is fixed by an upgrade, or the owner records a dated exception (package, advisory, reason,
  expiry date) in `context/decision-log.md` (F15 EC-016).
- **One upgrade per task**: each upgrade is its own branch and pull request, with the full check run
  (`npm run check`, `npm run build`, `npm run check:bundle`, `npm run e2e`) and its changelog notes in the PR.
  Never mix an upgrade with feature work.
- **Majors** (Next.js, React, React Flow, Liveblocks, Prisma, Clerk) need owner approval first, a re-read of
  the vendor's migration guide, and a re-verification of the facts in `context/architecture-context.md`
  that depend on the package.
- **New dependencies** need owner approval and a decision-log line (what it replaces, why it is needed).
- Renovate / Dependabot are not configured in M1.
