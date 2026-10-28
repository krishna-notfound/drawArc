import { readFileSync } from 'node:fs';

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type FlowStoreLike, useAutosave } from '@/hooks/useAutosave';
import { fromDocument, toDocument } from '@/lib/canvas/serialize';
import type { CanvasDocument, CanvasEdge, CanvasNode } from '@/types/canvas';

const small = JSON.parse(readFileSync('tests/fixtures/canvas/v1-small.json', 'utf8')) as CanvasDocument;

type State = { nodes: CanvasNode[]; edges: CanvasEdge[] };

/** A React Flow store stand-in: `set` replaces the arrays and notifies like zustand. */
function fakeStore(initial: State) {
  let state = initial;
  const listeners = new Set<(s: State, p: State) => void>();
  return {
    getState: () => state,
    subscribe: (listener: (s: State, p: State) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next: Partial<State>) {
      const prev = state;
      state = { ...state, ...next };
      act(() => listeners.forEach((listener) => listener(state, prev)));
    },
  } satisfies FlowStoreLike & { set: (next: Partial<State>) => void };
}

const base = () => fromDocument(small);
const moved = (nodes: CanvasNode[], dx: number) =>
  nodes.map((node, i) => (i === 0 ? { ...node, position: { x: node.position.x + dx, y: node.position.y } } : node));

const ok = () => new Response(JSON.stringify({ savedAt: '2026-10-24T14:02:00.000Z', schemaVersion: 1, size: 1, pointerUpdated: true }));
let fetchMock: ReturnType<typeof vi.fn>;
const body = (call: number) => JSON.parse(fetchMock.mock.calls[call]![1].body as string) as { document: CanvasDocument; allowEmpty?: boolean };
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

function setup(opts: { snapshotExists?: boolean; enabled?: boolean; state?: State } = {}) {
  const store = fakeStore(opts.state ?? base());
  const hook = renderHook(() =>
    useAutosave({ projectId: 'cproj', enabled: opts.enabled ?? true, snapshotExists: opts.snapshotExists ?? false, store }),
  );
  return { store, hook };
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async () => ok());
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useAutosave debounce (F13 AC-013, AC-014)', () => {
  it('ignores mount and no-op store updates, then saves 30 s after the last change', async () => {
    const { store, hook } = setup();
    store.set({ nodes: [...store.getState().nodes] }); // new array identity, same content (e.g. measured)
    expect(hook.result.current.status).toBe('idle');

    store.set({ nodes: moved(store.getState().nodes, 40) });
    expect(hook.result.current.status).toBe('dirty');
    await advance(29_999);
    expect(fetchMock).not.toHaveBeenCalled();
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/projects/cproj/canvas');
    expect(body(0).document).toEqual(toDocument(store.getState().nodes, store.getState().edges));
    expect(hook.result.current.status).toBe('saved');
  });

  it('continuous editing saves at the 60 s max-wait', async () => {
    const { store } = setup();
    for (let t = 0; t < 60_000; t += 10_000) {
      store.set({ nodes: moved(store.getState().nodes, 5) });
      await advance(10_000 - (t === 50_000 ? 1 : 0));
    }
    expect(fetchMock).not.toHaveBeenCalled();
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips the upload when the document is back to the last saved one', async () => {
    const { store, hook } = setup();
    const original = store.getState().nodes;
    store.set({ nodes: moved(original, 40) });
    store.set({ nodes: original });
    await advance(30_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe('saved');
  });
});

describe('useAutosave flush on hide / close (AC-015)', () => {
  const hide = () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
  };
  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('flushes at once on visibilitychange→hidden (normal fetch) and on pagehide (keepalive ≤ 60 KB)', async () => {
    const { store } = setup();
    store.set({ nodes: moved(store.getState().nodes, 40) });
    hide();
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1].keepalive).toBeUndefined();

    store.set({ nodes: moved(store.getState().nodes, 40) });
    act(() => void window.dispatchEvent(new Event('pagehide')));
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![1].keepalive).toBe(true);
  });

  it('does not use keepalive for a document over 60 KB', async () => {
    const big = base();
    const nodes = Array.from({ length: 250 }, (_, i) => ({
      ...big.nodes[0]!,
      id: `rectangle_${String(i).padStart(26, '0')}`,
      data: { ...big.nodes[0]!.data, label: 'x'.repeat(400) },
    }));
    const { store } = setup({ state: { nodes, edges: [] } });
    store.set({ nodes: moved(nodes, 40) });
    act(() => void window.dispatchEvent(new Event('pagehide')));
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]![1].body as string).length).toBeGreaterThan(100_000);
    expect(fetchMock.mock.calls[0]![1].keepalive).toBeUndefined();
  });
});

describe('useAutosave guards and server answers (AC-016, AC-017, AC-018)', () => {
  it('never autosaves an empty canvas over a snapshot; a manual save needs confirmation, then sends allowEmpty', async () => {
    const { store, hook } = setup({ snapshotExists: true });
    store.set({ nodes: [], edges: [] });
    await advance(30_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe('idle');

    let outcome: string | undefined;
    await act(async () => void (outcome = await hook.result.current.save()));
    expect(outcome).toBe('needs-confirm');
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => void (await hook.result.current.save({ allowEmpty: true })));
    expect(body(0)).toEqual({ document: { schemaVersion: 2, nodes: [], edges: [] }, allowEmpty: true });
  });

  it('429 reschedules at Retry-After without an error; 5xx backs off 10/20/40 s then waits for the next change', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '6' } }));
    const { store, hook } = setup();
    store.set({ nodes: moved(store.getState().nodes, 40) });
    await advance(30_000);
    expect(hook.result.current.status).toBe('dirty');
    expect(hook.result.current.lastError).toBeNull();
    await advance(6_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockImplementation(async () => new Response('{}', { status: 500 }));
    store.set({ nodes: moved(store.getState().nodes, 40) });
    await advance(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(hook.result.current.status).toBe('error');
    for (const [wait, total] of [[10_000, 4], [20_000, 5], [40_000, 6]] as const) {
      await advance(wait - 1);
      expect(fetchMock).toHaveBeenCalledTimes(total - 1);
      await advance(1);
      expect(fetchMock).toHaveBeenCalledTimes(total);
    }
    await advance(300_000);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('403 turns read-only and stops; a disabled (viewer) hook never subscribes', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 403 }));
    const { store, hook } = setup();
    store.set({ nodes: moved(store.getState().nodes, 40) });
    await advance(30_000);
    expect(hook.result.current.status).toBe('readonly');
    store.set({ nodes: moved(store.getState().nodes, 40) });
    await advance(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const viewer = setup({ enabled: false });
    expect(viewer.hook.result.current.status).toBe('readonly');
    viewer.store.set({ nodes: moved(viewer.store.getState().nodes, 40) });
    await advance(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
