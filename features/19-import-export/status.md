# F19 — Status

| Field | Value |
|---|---|
| Status | deferred |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted (overview only) by planning session.
- 2026-10-22 — Gate 4 audit: aligned the `fitView`-after-import note with F14 D-14d / F06 FR-009. See `features/AUDIT-2026-10-22.md`.

## Evidence
None. Overview only; files 01–05 are written when the feature is scheduled.

## Open issues
- Precondition: F13 verified (schema, migrations, `getCanvas`, caps with L1 tests).
- Precondition: F14 verified (replace-canvas mechanism and `CANVAS_REPLACED` event reusable).
- Precondition: owner decision-log entry adding import/export to scope; choose replace-only vs replace+merge (PROPOSED: replace-only).
- Precondition: research `html-to-image` and `@xyflow/react` `getNodesBounds` / `getViewportForBounds` (UNVERIFIED on 2026-10-22); decide PNG-only vs PNG+SVG.
- Precondition: performance budget for exporting the 500-node fixture (NFR-004).
