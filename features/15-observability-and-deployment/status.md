# F15 — Status

| Field | Value |
|---|---|
| Status | In Progress — code verified locally, PR open; production steps await owner authorization |
| Spec approved | 2026-10-24, owner ("yes do it") |
| Implementation authorized | 2026-10-24, owner — local code/config/docs only; every external step needs its own approval |
| Last verified | 2026-10-24, `b4f19d5` |

## History
- 2026-10-22 — drafted by planning session.
- 2026-10-22 — Gate 4 audit fixes applied (template headings added to 02-design, `lib/http.ts` folded into F00's `lib/errors.ts`, server-side seed wording in the recovery runbook, env inventory rows). See `features/AUDIT-2026-10-22.md`.

## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `4049a00` requestId through routes, actions, webhooks · `07dfb7b` recoverable error boundaries (focus, reference, Retry, Back to projects) · `db783f3` security headers, report-only CSP + `/api/csp-report`, bundle and pin checks, CI split into jobs · `3634e55` 500-node fixture + NFR-003/004 perf spec · `6feed45` release/recovery/dependency runbooks, `vercel.json` (region `sin1`) · `b4f19d5` Next control-flow errors pass through `withRequest`.

| Check | Result |
|---|---|
| Agent gate (local) | check 512/512, build OK, check:bundle clean (real values + secret patterns), check:pins pass, audit 0, e2e 69/71 (`ergonomics-collab:53`, `sharing:130` load flakes, pass alone) |
| Main-session review | identity/trailers clean, no secrets (CI sentinels only), clean merge with `main` |

AC mapping: verified locally 007–010, 012, 013, 018, 019, 021, 024, and 022/025 (workflow files); AC-014 decided (D-019 option A, below); need a deployment 001–006, 011, 015–017, 020, 023, 026, 027.

Decisions (2026-10-24, owner): D-019 option **A** — Vercel runtime logs only, no Sentry (T-013 not created); O-2 — stay on Liveblocks Free while non-commercial, upgrade before any commercial launch; preview e2e (AC-025) — `e2e-preview.yml` kept but not a required check; run manually against a preview for M1 sign-off (no `neonctl`, no protection bypass).

Rulings: expected errors (403, validation) log at `warn` per AC-011 (AC-009 text says `error`); error-page test probes gated by `NEXT_PUBLIC_E2E_HOOKS`, not `NODE_ENV`; existing `check:bundle` extended instead of a duplicate `scan:bundle`; preview e2e in its own workflow so skipped runs never count as passing required checks; production Clerk host omitted from CSP until the production domain exists.

Risk: a local dev-mode smoke run measured 500-node cold load p95 10.5 s and edit-to-peer p95 931 ms — not evidence, but NFR-003/004 budgets may be at risk on the preview.

## M1 acceptance run evidence
Commit: — · Date: — · Environment URL: — · Executed by: —

| Step | Actor(s) | Action | Expected | Evidence | Pass/Fail |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 7 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 8 | | | | | |

Owner sign-off: —

## Open issues
- D-019 (error-reporting SaaS) is OPEN; Option A is the baseline in this spec, Option B is T-013 (conditional).
- O-2 (Liveblocks plan; Free is non-commercial) must be answered before the first production deployment (T-007).
- UNVERIFIED items to resolve during T-009/T-010/T-014: Vercel request-id header name; Clerk script/connect and Liveblocks CSP hosts; Neon point-in-time restore procedure page; Liveblocks dashboard Storage export; `@axe-core/playwright` version.
- Preview webhooks: PROPOSED single preview alias for Clerk/Liveblocks webhooks (02-design.md); feature-branch previews rely on lazy `User` upsert only.
- External steps awaiting owner authorization (order and commands in `docs/runbooks/release.md`): Neon–Vercel integration with preview branches; Clerk production instance + env vars; Liveblocks env vars; `vercel git connect`; webhook endpoints + signing secrets; remove `BLOB_READ_WRITE_TOKEN` from deployed envs (OIDC); GitHub Actions secrets + branch protection; first-preview checks (AC-011 logs, CSP review, perf evidence, recovery rehearsal); merge, smoke, tag `m1-rc1`, M1 acceptance run.
