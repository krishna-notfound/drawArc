# F20 — Status

| Field | Value |
|---|---|
| Status | deferred |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted (overview only) by planning session.

## Evidence
None. Overview only; files 01–05 are written when the feature is scheduled.

## Open issues
- Precondition: F12 verified (KICK ≤ 5 s E2E) and F05 auth-route AUTHZ tests exist as the regression baseline.
- Precondition: owner decision superseding D-007 and amending PRD-014; `ShareLink` migration separately authorized.
- Precondition: O-2 resolved — paid Liveblocks plan before any public URL (Free is non-commercial; 3,000 anonymous connections/month cap; 10 connections/room).
- Precondition: decisions D-20b (specs hidden from guests — PROPOSED yes) and D-20c (guest cap 7/room — PROPOSED) recorded.
- Precondition: rate-limit mechanism chosen without Redis/KV.
- Re-run AUTHZ-MATRIX for every F03/F13/F18 read endpoint with the share-link principal when specified.
