# F21 — Status

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
- Precondition: F06 verified with canvas schema v1 frozen; F13 migration pipeline verified with a v1 fixture.
- Precondition: F07 and F08 verified (palette, node-creation path, resize).
- Precondition: owner approves expanding D-008 from roadmap to scheduled; F14/F17 validators confirmed to reject unknown shapes.
- Precondition: `perfect-freehand` version, `getStroke` API, licence (MIT per whiteboard guide) and React 19 compatibility verified — UNVERIFIED on 2026-10-22.
- Precondition: measurement of snapshot size and drag frame time for 200 strokes to set the point/stroke caps (PROPOSED D-21b).
- Decisions to confirm: D-21a (no handles on freehand nodes), D-21c (resize scales render transform, not stored points).
