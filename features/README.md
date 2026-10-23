# drawArc — Feature Specifications

Numbered in dependency order. Each folder follows [`context/feature-spec-template.md`](../context/feature-spec-template.md). A feature is **approved** only when the owner says so and `status.md` records it — the existence of the files means nothing by itself.

## Dependency graph

```
00 product-foundation
└─ 01 app-shell-and-design-system
   └─ 02 authentication-and-users
      └─ 03 projects-data-layer-and-api
         ├─ 04 editor-home-and-workspace-shell
         │   └─ 06 base-collaborative-canvas  ◄── 05 realtime-room-infrastructure
         │        ├─ 07 shapes-and-node-creation
         │        │   ├─ 08 node-editing ──┐
         │        │   └─ 09 edges-and-connections ─┤
         │        │                                 └─ 10 canvas-ergonomics-and-keyboard
         │        ├─ 11 presence-and-cursors
         │        ├─ 13 persistence-and-recovery
         │        └─ 14 starter-templates (needs 07, 09)
         └─ 12 sharing-and-access-control (needs 04, 05)
15 observability-and-deployment (needs 00–14; closes M1)
16 ai-sidebar-and-room-chat (M2; needs 11)
└─ 17 ai-design-agent (M2; needs 16, 13)
   └─ 18 spec-generation (M3; needs 17)
19 import-export · 20 public-share-links · 21 freehand-strokes  (Future; overview only)
```

## Index

| # | Folder | Milestone | Depends on | Product requirements |
|---|---|---|---|---|
| 00 | `00-product-foundation` | M1 | — | PRD-040, NFR-007, NFR-008, NFR-010 |
| 01 | `01-app-shell-and-design-system` | M1 | 00 | PRD-020 (chrome), NFR-006 |
| 02 | `02-authentication-and-users` | M1 | 01 | PRD-001, PRD-002, PRD-011 |
| 03 | `03-projects-data-layer-and-api` | M1 | 02 | PRD-003, NFR-001, NFR-002 |
| 04 | `04-editor-home-and-workspace-shell` | M1 | 03 | PRD-004, PRD-005, PRD-014 |
| 05 | `05-realtime-room-infrastructure` | M1 | 03 | PRD-012, PRD-013, PRD-030, PRD-032 |
| 06 | `06-base-collaborative-canvas` | M1 | 04, 05 | PRD-020, PRD-030 |
| 07 | `07-shapes-and-node-creation` | M1 | 06 | PRD-021 |
| 08 | `08-node-editing` | M1 | 07 | PRD-022, PRD-023, PRD-024 |
| 09 | `09-edges-and-connections` | M1 | 07 | PRD-025, PRD-026 |
| 10 | `10-canvas-ergonomics-and-keyboard` | M1 | 08, 09 | PRD-022, PRD-027 |
| 11 | `11-presence-and-cursors` | M1 | 06 | PRD-031 |
| 12 | `12-sharing-and-access-control` | M1 | 04, 05 | PRD-010, PRD-012, PRD-013 |
| 13 | `13-persistence-and-recovery` | M1 | 06, 04 (gate seed hook), 05 (node client) | PRD-033, PRD-034, NFR-005 |
| 14 | `14-starter-templates` | M1 | 07, 09 | PRD-028 |
| 15 | `15-observability-and-deployment` | M1 | 00–14 | PRD-040, PRD-041, NFR-003, NFR-004, NFR-009 |
| 16 | `16-ai-sidebar-and-room-chat` | M2 | 11 | PRD-050, PRD-055 |
| 17 | `17-ai-design-agent` | M2 | 16, 13 | PRD-051–PRD-055 |
| 18 | `18-spec-generation` | M3 | 17 | PRD-060, PRD-061 |
| 19 | `19-import-export` | Future | 13 | — |
| 20 | `20-public-share-links` | Future | 12 | — |
| 21 | `21-freehand-strokes` | Future | 07 | — |

## Status vocabulary

`drafted` → `reviewed` (Gate 4 audit done) → `approved` (owner, Gate 5) → `planned` (Gate 6 plan exists) → `in-progress` → `verified` (all AC evidence recorded) → `released` (on production). `deferred` for future packages. Status lives only in each `status.md`; `context/progress-tracker.md` summarises it.

## Recommended first implementation milestone

Feature `00` task T-001 (toolchain + quality gate), then `01`, `02`, `03` in order. The first demonstrable checkpoint is `04` (a signed-in user creates a project and opens an empty workspace behind a server-side access gate). The first collaborative checkpoint is `06` (two users see each other's nodes).
