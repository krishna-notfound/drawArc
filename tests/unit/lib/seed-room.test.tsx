import { readFileSync } from 'node:fs';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type createFakeLogger } from '@/tests/helpers/fake-logger';
import type { CanvasDocument } from '@/types/canvas';

// Seams: the Liveblocks node client (`lib/liveblocks.ts`), `mutateFlow`, and `lib/blob.ts`.
const h = vi.hoisted(() => ({
  getStorageDocument: vi.fn(),
  getOrCreateRoom: vi.fn(),
  getCanvas: vi.fn(),
  mutateFlow: vi.fn(),
  logger: null as unknown as ReturnType<typeof createFakeLogger>,
}));
vi.mock('@/lib/liveblocks', () => ({
  getLiveblocks: () => ({ getStorageDocument: h.getStorageDocument, getOrCreateRoom: h.getOrCreateRoom }),
}));
vi.mock('@liveblocks/react-flow/node', () => ({ mutateFlow: h.mutateFlow }));
vi.mock('@/lib/blob', () => ({ getCanvas: h.getCanvas }));
vi.mock('@/lib/logger', async () => {
  const { createFakeLogger: make } = await import('@/tests/helpers/fake-logger');
  h.logger = make();
  return { logger: h.logger };
});

const { seedRoomIfEmpty } = await import('@/lib/liveblocks-flow');
const { SeedWarningBanner, SEED_WARNING_COPY } = await import('@/components/canvas/seed-warning-banner');

const small = JSON.parse(readFileSync('tests/fixtures/canvas/v1-small.json', 'utf8')) as CanvasDocument;
const PROJECT = { id: 'cproject000000000000000001', canvasBlobPath: 'canvas/cproject000000000000000001.json', canvasSchemaVersion: 1 };
const CTX = { userId: 'user_1', requestId: 'req_1' };
const emptyRoom = { flow: { nodes: {}, edges: {} } };

/** Runs the real callback against a recording flow, like `mutateFlow` would inside one storage transaction. */
function recordingFlow() {
  const calls: [string, { id: string }][] = [];
  h.mutateFlow.mockImplementation(async (_opts: unknown, cb: (flow: unknown) => unknown) => {
    const result = cb({ addNode: (n: { id: string }) => calls.push(['node', n]), addEdge: (e: { id: string }) => calls.push(['edge', e]) });
    expect(result).toBeUndefined(); // synchronous callback: no await inside (FR-010)
  });
  return calls;
}

describe('seedRoomIfEmpty (F13 FR-010, FR-016)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getStorageDocument.mockResolvedValue(emptyRoom);
    h.getCanvas.mockResolvedValue({ json: small, size: 1 });
  });

  it('seeds an empty room from the snapshot in one mutateFlow pass, nodes then edges, unchanged (AC-020)', async () => {
    const calls = recordingFlow();
    const result = await seedRoomIfEmpty({ ...PROJECT, canvasSavedAt: new Date('2026-10-24T14:02:00Z') }, CTX);

    expect(result).toEqual({ seeded: true, snapshotExists: true, savedAt: '2026-10-24T14:02:00.000Z', warning: null });
    expect(h.mutateFlow).toHaveBeenCalledTimes(1);
    expect(h.mutateFlow.mock.calls[0]![0]).toMatchObject({ roomId: PROJECT.id, storageKey: 'flow' });
    expect(calls.map(([kind, item]) => [kind, item.id])).toEqual([
      ...small.nodes.map((n) => ['node', n.id]),
      ...small.edges.map((e) => ['edge', e.id]),
    ]);
    expect(calls.filter(([kind]) => kind === 'node').map(([, n]) => n)).toEqual(small.nodes);
  });

  it.each([
    ['one node', { flow: { nodes: { n1: {} }, edges: {} } }],
    ['one edge only', { flow: { nodes: {}, edges: { e1: {} } } }],
  ])('never overwrites a non-empty room (%s) (AC-021)', async (_, storage) => {
    h.getStorageDocument.mockResolvedValue(storage);
    const result = await seedRoomIfEmpty(PROJECT, CTX);
    expect(result).toMatchObject({ seeded: false, snapshotExists: true, warning: null });
    expect(h.getCanvas).not.toHaveBeenCalled();
    expect(h.mutateFlow).not.toHaveBeenCalled();
  });

  it('makes no Liveblocks or Blob call when the project has no snapshot', async () => {
    const result = await seedRoomIfEmpty({ ...PROJECT, canvasBlobPath: null }, CTX);
    expect(result).toEqual({ seeded: false, snapshotExists: false, savedAt: null, warning: null });
    expect(h.getStorageDocument).not.toHaveBeenCalled();
    expect(h.getCanvas).not.toHaveBeenCalled();
  });

  it.each([
    ['getStorageDocument', () => h.getStorageDocument.mockRejectedValue(new Error('liveblocks down'))],
    ['mutateFlow', () => h.mutateFlow.mockRejectedValue(new Error('liveblocks down'))],
  ])('a Liveblocks REST failure (%s) resolves SEED_FAILED and logs, never throws (AC-029)', async (step, arrange) => {
    arrange();
    const result = await seedRoomIfEmpty(PROJECT, CTX);
    expect(result).toMatchObject({ seeded: false, snapshotExists: true, warning: 'SEED_FAILED' });
    expect(h.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PROJECT.id, userId: 'user_1', requestId: 'req_1', step }),
      expect.any(String),
    );
  });

  it('an invalid stored snapshot resolves SNAPSHOT_INVALID without writing (AC-029)', async () => {
    h.getCanvas.mockResolvedValue({ json: { ...small, schemaVersion: 99 }, size: 1 });
    const result = await seedRoomIfEmpty(PROJECT, CTX);
    expect(result).toMatchObject({ seeded: false, snapshotExists: true, warning: 'SNAPSHOT_INVALID' });
    expect(h.mutateFlow).not.toHaveBeenCalled();
  });
});

describe('SeedWarningBanner (AC-029)', () => {
  it('shows the retry copy as a dismissible status and nothing without a warning', async () => {
    const { rerender } = render(<SeedWarningBanner warning="SEED_FAILED" />);
    expect(screen.getByRole('status')).toHaveTextContent(SEED_WARNING_COPY.SEED_FAILED);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();

    rerender(<SeedWarningBanner key="fresh" warning={null} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
