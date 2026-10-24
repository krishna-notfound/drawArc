import 'server-only';

/** What the workspace gate passes to the seed step (D-034). */
export interface SeedProject {
  id: string;
  canvasBlobPath: string | null;
  canvasSchemaVersion: number | null;
}

/** F13 FR-016: the seed step never throws; failures become `warning`. */
export interface SeedResult {
  seeded: boolean;
  snapshotExists: boolean;
  savedAt: string | null;
  warning: 'SEED_FAILED' | 'SNAPSHOT_INVALID' | null;
}

/**
 * Snapshot-seed hook point in the workspace gate (D-034), owned by F13. F04 ships this no-op stub with the
 * final signature; F13 moves the real implementation (read the room, seed from the Blob snapshot when it is
 * empty) into `lib/liveblocks-flow.ts` and makes this module re-export it.
 */
export async function seedRoomIfEmpty(project: SeedProject): Promise<SeedResult> {
  return { seeded: false, snapshotExists: project.canvasBlobPath !== null, savedAt: null, warning: null };
}
