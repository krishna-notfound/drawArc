import type { User } from '@/lib/prisma';
import type { CanvasDocument, PersistedEdge, PersistedNode } from '@/types/canvas';

/** A complete `User` row with deterministic values; override what the test is about. */
export function makeUser(overrides: Partial<User> = {}): User {
  const createdAt = new Date('2026-10-23T00:00:00.000Z');
  return {
    id: 'user_test_a',
    clerkId: 'user_clerk_test_a',
    email: 'user-a@example.com',
    name: 'User A',
    avatarUrl: 'https://img.clerk.com/user-a',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    ...overrides,
  };
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A deterministic, valid ULID for index `n` (left-padded Crockford base32). */
export function testUlid(n: number): string {
  let out = '';
  let rest = n;
  do {
    out = CROCKFORD[rest % 32] + out;
    rest = Math.floor(rest / 32);
  } while (rest > 0);
  return out.padStart(26, '0');
}

/**
 * A valid `CanvasDocument` with `nodes` rectangles laid out on a grid and `edges` edges chaining consecutive
 * nodes (edges ≤ nodes − 1). Deterministic, so fixtures and round-trip tests are stable.
 */
export function makeCanvasDocument({ nodes = 5, edges = Math.max(0, nodes - 1) } = {}): CanvasDocument {
  const nodeList: PersistedNode[] = Array.from({ length: nodes }, (_, i) => ({
    id: `rectangle_${testUlid(i + 1)}`,
    type: 'canvasNode',
    position: { x: (i % 25) * 220, y: Math.floor(i / 25) * 120 },
    width: 180,
    height: 80,
    data: { label: `Node ${i + 1}`, shape: 'rectangle', color: 'neutral' },
  }));
  const edgeList: PersistedEdge[] = Array.from({ length: Math.min(edges, Math.max(0, nodes - 1)) }, (_, i) => ({
    id: `e_${testUlid(i + 1)}`,
    type: 'canvasEdge',
    source: nodeList[i].id,
    target: nodeList[i + 1].id,
    sourceHandle: 'right',
    targetHandle: 'left',
    ...(i % 2 === 0 ? { data: { label: `edge ${i + 1}` } } : {}),
  }));
  return { schemaVersion: 1, nodes: nodeList, edges: edgeList };
}
