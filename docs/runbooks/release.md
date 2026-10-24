# Release runbook

How drawArc goes from a pull request to production (F15 FR-014, F15-D4). Every step that changes an external
service (Vercel, Neon, Clerk, Liveblocks, GitHub settings) or deploys needs the owner's explicit authorization
first; this file only records the procedure.

## Environments

| Environment | Trigger | Database | Clerk | Liveblocks |
|---|---|---|---|---|
| Development | `npm run dev` | Neon branch `development` (`.env.local`) | Development instance | development secret key |
| Preview | every pull request (Vercel) | Neon branch `preview/<git-branch>`, created per deployment by the Neon integration | Development instance | development secret key |
| Production | merge to `main` (automatic, F15-D4) | Neon branch `production` | Production instance | production secret key |

There is no staging environment in M1. Functions run in `sin1` (Singapore), next to Neon `aws-ap-southeast-1`
(`vercel.json`). The Vercel build command is `prisma migrate deploy && next build` (`vercel.json`): pending
migrations are applied to the deployment's own branch before the build, and a failed migration fails the
deployment, so a broken migration never reaches a live URL (EC-001).

## Release procedure

1. Open a pull request. CI runs `check`, `build` (with `check:bundle`) and `audit` (`npm audit
   --audit-level=high`, `check:pins`); Vercel builds the preview.
2. When Vercel reports the preview ready, `.github/workflows/e2e-preview.yml` runs `npm run e2e:preview`
   (the full Playwright suite plus `perf.spec.ts`) against it.
3. All four checks green and reviewed: merge to `main`. Vercel deploys production automatically.
4. Run the smoke checklist below on the production URL.
5. Tag the deployed commit: `git tag m1-rcN <sha>` for a release candidate, `git tag m1` for the accepted
   release (only after the M1 acceptance run passes, D-002), then `git push origin <tag>` (a remote change:
   owner-authorized).
6. Record in `features/15-observability-and-deployment/status.md`: tag, commit, production deployment id.

Rollback: promote the previous production deployment (`vercel rollback <deployment-url>` or the dashboard).
Migrations are forward-only; a bad migration is fixed by a new migration, never by editing an applied one.

## Smoke checklist (production, after every release)

- [ ] `/` redirects to `/sign-in`; sign-in works with a real account.
- [ ] Create a project; it opens at `/editor/<id>`.
- [ ] The workspace connects (status pill "Connected"); `POST /api/liveblocks-auth` answered 200 (DevTools).
- [ ] `GET /api/projects/<id>/canvas` returns `document: null` for the new project, and a document after
      adding a node and waiting for the autosave (30 s) or pressing Save.
- [ ] Response headers on `/editor` include `Content-Security-Policy-Report-Only` and `X-Frame-Options: DENY`.

## Preview verification (AC-001 – AC-003)

Done once after the Vercel project and the Neon integration exist; evidence goes to `status.md`.

1. Branch `feat/15-t01` with any change, open a PR. Build log: the migrate step connects to a host **without**
   `-pooler` (`DATABASE_URL_UNPOOLED`). Neon console: branch `preview/feat/15-t01` exists. Close the PR and
   confirm the branch is removed per the integration's retention setting.
2. Probe migration: on a scratch branch, `npx prisma migrate dev --create-only --name f15_probe` against the
   development database, replace the SQL with `SELECT 1;`, open a PR. Build log shows `Applying migration
   ..._f15_probe`; the preview answers 200 on `/`. Never merge it.
3. Failing migration: on another scratch branch, a migration with invalid SQL. The deployment is marked
   failed and the previous preview URL keeps serving.

## E2E on preview (AC-025)

`.github/workflows/e2e-preview.yml` needs these repository secrets (GitHub → Settings → Secrets → Actions):
`E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD`, `E2E_USER_B_EMAIL`, `E2E_USER_B_PASSWORD`, `CLERK_DEV_SECRET_KEY`,
`CLERK_DEV_PUBLISHABLE_KEY`, `LIVEBLOCKS_DEV_SECRET_KEY`, `BLOB_READ_WRITE_TOKEN`, `E2E_PREVIEW_DATABASE_URL`.

Open points before the job can pass (owner decisions, see the F15 report):

- **Database for test helpers.** The specs seed rows directly, so they need the pull request's Neon preview
  branch. A single `E2E_PREVIEW_DATABASE_URL` secret only works for one fixed branch; resolving
  `preview/<branch>` per run needs the Neon API in CI (for example `neonctl connection-string`), which is a new
  tool and needs approval.
- **Deployment Protection.** Vercel protects previews by default; Playwright needs either protection disabled
  for previews or a Protection Bypass for Automation secret wired into the browser session.

Run locally against any preview: `E2E_BASE_URL=https://<preview-url> npm run e2e:preview` with `DATABASE_URL`
pointing at that preview's Neon branch.

## Performance evidence (AC-015 – AC-018, F15-D3)

1. `E2E_BASE_URL=<preview-url> npx playwright test tests/e2e/perf.spec.ts --project=preview`; copy the
   `[perf]` lines into `status.md` with the commit hash.
2. Manual Chrome profile of a 3 s node drag on the seeded project (DevTools → Performance, no CPU throttling),
   on the owner's machine. Save `docs/perf/<commit>.md` containing: commit, preview URL, machine (CPU, RAM,
   browser version), frame histogram, main-thread time, scripting %, and the `[perf]` lines.

## First deployment: owner-authorized steps, in order

Prepared by F15; nothing below has been executed. Each step is an external change and needs explicit owner
authorization. Vercel scope: team `personal-project-bc28c7b3`, project `drawarc` (D-047); the private Blob
store `drawarc-blob` is already connected. Values are typed into the CLI prompt and never written to the
repository.

1. **Decide O-2** (Liveblocks plan; Free is non-commercial) and **D-019** (error reporting: Option A logs only,
   recommended; Option B Sentry). Record both in `context/decision-log.md`.
2. **Neon integration.** Install the Neon integration for project `drawarc` in the Vercel dashboard
   (Integrations → Neon), connected to Neon project `lucky-mud-20214365` (the integration flavour that attaches
   an existing Neon project; confirm the name in Neon's docs on the day), with preview branching enabled for
   Preview deployments. It injects `DATABASE_URL` / `DATABASE_URL_UNPOOLED` per environment.
3. **Clerk production instance.** Create it (needs the production domain), note its keys. Then add Clerk keys:
   ```sh
   vercel env add CLERK_SECRET_KEY production          # sk_live_…
   vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production   # pk_live_…
   vercel env add CLERK_SECRET_KEY preview             # Development instance sk_test_…
   vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY preview      # Development instance pk_test_…
   ```
   Also add `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`,
   `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/editor`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/editor`
   to both environments. Add the production Frontend API host `https://clerk.<domain>` to `script-src` and
   `connect-src` in `next.config.ts` (a code change).
4. **Liveblocks keys.**
   ```sh
   vercel env add LIVEBLOCKS_SECRET_KEY production     # sk_prod_…
   vercel env add LIVEBLOCKS_SECRET_KEY preview        # sk_dev_…
   ```
5. **Connect the GitHub repository** (it was disconnected on purpose, D-047): `vercel git connect` in the linked
   checkout. From here, pull requests create previews and pushes to `main` deploy production.
6. **Webhooks** (stable URLs). Clerk Production instance → endpoint `https://<production-domain>/api/webhooks/clerk`
   (`user.created`, `user.updated`, `user.deleted`); Clerk Development instance → the preview alias
   `https://drawarc-preview.vercel.app/api/webhooks/clerk` if the alias is set up (feature-branch previews get
   no webhooks and rely on the lazy user upsert, F02). Liveblocks production and development projects →
   `…/api/webhooks/liveblocks` with `storageUpdated`, `userLeft`. Store each signing secret:
   ```sh
   vercel env add CLERK_WEBHOOK_SIGNING_SECRET production
   vercel env add CLERK_WEBHOOK_SIGNING_SECRET preview
   vercel env add LIVEBLOCKS_WEBHOOK_SECRET_KEY production
   vercel env add LIVEBLOCKS_WEBHOOK_SECRET_KEY preview
   ```
7. **Blob token scope.** On Vercel the app authenticates to Blob with OIDC (FR-005); remove the store token
   from the deployed environments: `vercel env rm BLOB_READ_WRITE_TOKEN preview` and `… production` (keep
   Development for `vercel env pull`). Confirm the store's access mode reads `private`.
8. **GitHub.** Add the Actions secrets listed under "E2E on preview"; make `check`, `build`, `audit` and
   `e2e-on-preview` required status checks on `main` (branch protection).
9. **First preview** (open the F15 pull request): run "Preview verification", the AC-011 log check (send
   `PUT /api/projects/<id>/canvas` with `{}` as user A; the runtime log line carries the response's
   `requestId`, `userId`, `projectId`, `level:"warn"`, `code:"VALIDATION"`), the CSP report review (AC-020),
   the performance evidence, and the recovery rehearsal (`docs/runbooks/recovery.md`).
10. **Release candidate**: merge, smoke checklist, tag `m1-rc1`, then the M1 acceptance run (F15 AC-027) on
    production; record everything in `status.md`.
