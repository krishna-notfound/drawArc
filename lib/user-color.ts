import { USER_COLORS, type UserColor } from '@/types/liveblocks.config';

/**
 * Deterministic presence colour for a user (FR-004): FNV-1a 32-bit hash of the id, modulo the palette.
 * Pure and isomorphic, so the auth route (token `userInfo.color`) and the client agree without a round-trip.
 */
export function userColor(userId: string): UserColor {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return USER_COLORS[(hash >>> 0) % USER_COLORS.length]!;
}
