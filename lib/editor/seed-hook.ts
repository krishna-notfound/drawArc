import 'server-only';

/**
 * Snapshot-seed hook point in the workspace gate (D-034). F04 shipped the signature; F13's implementation
 * (read the room, seed it from the Blob snapshot when it is empty) lives in `lib/liveblocks-flow.ts`.
 */
export { seedRoomIfEmpty } from '@/lib/liveblocks-flow';
export type { SeedContext, SeedInput as SeedProject, SeedResult } from '@/lib/liveblocks-flow';
