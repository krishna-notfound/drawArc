# F18 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — (T-002 migration and the Trigger.dev env change must be named individually) |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer). Depends on F17's Gate-6 SDK decision; all automated tests use the fake spec writer.
- 2026-10-22 — Gate 4 audit fixes applied (archived → 403 `FORBIDDEN`/`PROJECT_ARCHIVED` per F03, `sizeBytes` aligned with domain-model, FR/AC links). See `features/AUDIT-2026-10-22.md`.

## Evidence
- (none yet) — T-001 renderer verification, T-003 Blob-from-Trigger spike, `npm run check`, L2/L3 logs, `docs/perf/spec-runs-<commit>.md` (AC-027).

## Open issues
- F18-D1 graph read server-side only (reference prompt 27 sent nodes/edges from the client) — confirm.
- F18-D2 one active run per project across DESIGN and SPEC — confirm (alternative: allow a spec run during a design run; rejected because the strip shows one status and the spec would describe a half-written diagram).
- F18-D3 `react-markdown` + `remark-gfm` without `rehype-raw`; versions UNVERIFIED — pin in T-001.
- F18-D4 caps (300 nodes / 600 edges input; 200 chars … 512 KB output; 50 chat messages) — confirm.
- `ProjectSpec.sizeBytes` is now in `context/domain-model.md` (Gate 4) — confirm at Gate 5.
- Trigger.dev needs `BLOB_READ_WRITE_TOKEN` (no OIDC outside Vercel) — confirm the token is acceptable in the Trigger.dev env; UNVERIFIED usage path (T-003).
- Per-spec deletion and an orphan-blob sweep are not in M3 — accept or schedule.
