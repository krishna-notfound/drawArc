import type { NodeShape } from '@/types/canvas';

// Crockford base32, the ULID alphabet (no I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A ULID: 10 chars of millisecond timestamp + 16 chars of randomness from the Web Crypto API (available in
 * browsers, Node 22, and route handlers). Inline instead of a dependency (F06 Ruling); lexicographic order
 * within the same millisecond is not needed because ids only have to be unique across clients.
 */
export function ulid(now: number = Date.now()): string {
  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let random = '';
  for (const byte of bytes) random += ALPHABET[byte % 32];
  return time + random;
}

/** Node ids are `${shape}_${ulid}` (domain-model "Canvas schema v1"). */
export function newNodeId(shape: NodeShape): string {
  return `${shape}_${ulid()}`;
}

/** Edge ids are `e_${ulid}`. */
export function newEdgeId(): string {
  return `e_${ulid()}`;
}
