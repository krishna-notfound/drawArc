'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { toDocument } from '@/lib/canvas/serialize';
import type { CanvasDocument, CanvasEdge, CanvasNode } from '@/types/canvas';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'readonly';

/** What `save()` did; the Save button opens the empty-canvas confirmation on `needs-confirm` (FR-008). */
export type SaveOutcome = 'saved' | 'unchanged' | 'needs-confirm' | 'skipped' | 'failed' | 'busy' | 'readonly';

/** The slice of React Flow's store the hook reads (`useStoreApi()` satisfies it). */
export interface FlowStoreLike {
  getState(): { nodes: CanvasNode[]; edges: CanvasEdge[] };
  subscribe(listener: (state: { nodes: CanvasNode[]; edges: CanvasEdge[] }, prev: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => void): () => void;
}

export interface AutosaveOptions {
  projectId: string;
  /** Owners/editors with a write token; `false` → `readonly`, no subscription. */
  enabled: boolean;
  /** From the gate's `SeedResult` (FR-005); guards against overwriting a snapshot with an empty canvas. */
  snapshotExists: boolean;
  /** From the gate's `SeedResult`. */
  initialSavedAt?: string | null;
  store: FlowStoreLike;
}

export interface AutosaveState {
  status: SaveStatus;
  lastSavedAt: Date | null;
  lastError: string | null;
  save: (opts?: { allowEmpty?: boolean }) => Promise<SaveOutcome>;
}

export const AUTOSAVE_DEBOUNCE_MS = 30_000;
export const AUTOSAVE_MAX_WAIT_MS = 60_000;
/** Browsers drop keepalive requests above 64 KB (P-13-5). */
export const KEEPALIVE_MAX_BYTES = 60_000;
const RETRY_BASE_MS = 10_000;
const MAX_RETRIES = 3;

type Reason = 'auto' | 'manual' | 'hidden' | 'pagehide' | 'retry';

const isEmpty = (doc: CanvasDocument) => doc.nodes.length === 0 && doc.edges.length === 0;

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Debounced client autosave of the canvas to the private Blob snapshot (FR-005–FR-008, D-009): ≥ 30 s after the
 * last change, at most 60 s after the first unsaved one, flushed when the tab is hidden or closed. It subscribes
 * to the React Flow store without re-rendering and never uploads an empty canvas over an existing snapshot.
 */
export function useAutosave({ projectId, enabled, snapshotExists, initialSavedAt = null, store }: AutosaveOptions): AutosaveState {
  const [status, setStatus] = useState<SaveStatus>(enabled ? 'idle' : 'readonly');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => (initialSavedAt ? new Date(initialSavedAt) : null));
  const [lastError, setLastError] = useState<string | null>(null);

  const ref = useRef({
    lastSavedJson: null as string | null,
    dirty: false,
    firstDirtyAt: 0,
    inFlight: false,
    changedDuringSave: false,
    retries: 0,
    stopped: !enabled,
    snapshotExists,
    debounce: undefined as ReturnType<typeof setTimeout> | undefined,
    retry: undefined as ReturnType<typeof setTimeout> | undefined,
  });
  const flushRef = useRef<(reason: Reason, opts?: { allowEmpty?: boolean }) => Promise<SaveOutcome>>(async () => 'readonly');

  const clearTimers = useCallback(() => {
    const s = ref.current;
    clearTimeout(s.debounce);
    clearTimeout(s.retry);
    s.debounce = undefined;
    s.retry = undefined;
  }, []);

  const readDocument = useCallback((): CanvasDocument => {
    const { nodes, edges } = store.getState();
    return toDocument(nodes, edges);
  }, [store]);

  const scheduleDebounce = useCallback(() => {
    const s = ref.current;
    clearTimeout(s.debounce);
    const delay = Math.max(0, Math.min(AUTOSAVE_DEBOUNCE_MS, s.firstDirtyAt + AUTOSAVE_MAX_WAIT_MS - Date.now()));
    s.debounce = setTimeout(() => void flushRef.current('auto'), delay);
  }, []);

  const markDirty = useCallback(() => {
    const s = ref.current;
    s.dirty = true;
    s.firstDirtyAt = Date.now();
    setStatus('dirty');
    scheduleDebounce();
  }, [scheduleDebounce]);

  const flush = useCallback(async (reason: Reason, opts: { allowEmpty?: boolean } = {}): Promise<SaveOutcome> => {
    const s = ref.current;
    if (s.stopped) return 'readonly';
    if (s.inFlight) return 'busy';
    clearTimers();

    const doc = readDocument();
    const json = JSON.stringify(doc);
    // A manual Save always uploads; automatic saves skip a document equal to the last one saved (FR-005).
    if (reason !== 'manual' && json === s.lastSavedJson) {
      s.dirty = false;
      setStatus('saved');
      return 'unchanged';
    }
    if (isEmpty(doc) && s.snapshotExists && !opts.allowEmpty) {
      if (reason === 'manual') return 'needs-confirm';
      s.dirty = false;
      setStatus('idle');
      return 'skipped';
    }

    const body = JSON.stringify(opts.allowEmpty ? { document: doc, allowEmpty: true } : { document: doc });
    const keepalive = reason === 'pagehide' && new TextEncoder().encode(body).length <= KEEPALIVE_MAX_BYTES;
    s.inFlight = true;
    s.changedDuringSave = false;
    setStatus('saving');
    let res: Response | null = null;
    try {
      res = await fetch(`/api/projects/${projectId}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
        ...(keepalive ? { keepalive: true } : {}),
      });
    } catch {
      res = null;
    } finally {
      s.inFlight = false;
    }
    if (s.stopped) return 'readonly';

    const retryLater = (message: string): SaveOutcome => {
      s.dirty = true;
      setStatus('error');
      setLastError(message);
      if (s.retries < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * 2 ** s.retries;
        s.retries += 1;
        s.retry = setTimeout(() => void flushRef.current('retry'), delay);
      }
      return 'failed';
    };

    if (!res) return retryLater('Network error — will retry.');
    if (res.ok) {
      const data = (await res.json()) as { savedAt: string };
      s.lastSavedJson = json;
      s.snapshotExists = true;
      s.retries = 0;
      setLastSavedAt(new Date(data.savedAt));
      setLastError(null);
      if (s.changedDuringSave && JSON.stringify(readDocument()) !== json) {
        markDirty();
      } else {
        s.dirty = false;
        setStatus('saved');
      }
      return 'saved';
    }
    if (res.status === 429) {
      // Another save landed moments ago (P-13-2): not an error, just try again when allowed.
      const seconds = Number(res.headers.get('Retry-After'));
      s.dirty = true;
      setStatus('dirty');
      s.debounce = setTimeout(() => void flushRef.current('retry'), (Number.isFinite(seconds) && seconds > 0 ? seconds : 10) * 1000);
      return 'busy';
    }
    if (res.status === 409) {
      s.dirty = false;
      s.snapshotExists = true;
      setStatus('idle');
      setLastError(null);
      return 'skipped';
    }
    if (res.status === 403) {
      // Downgraded or removed (EC-012): stop for good; F05 reloads the page with the new role.
      s.stopped = true;
      clearTimers();
      setStatus('readonly');
      return 'readonly';
    }
    if (res.status >= 400 && res.status < 500) {
      // Too large / invalid / signed out: retrying the same document cannot succeed; wait for the next change.
      s.dirty = true;
      setStatus('error');
      setLastError(res.status === 422 ? 'Diagram too large or invalid to save.' : await errorMessage(res, 'Could not save.'));
      return 'failed';
    }
    return retryLater('Save failed — will retry.');
  }, [projectId, readDocument, clearTimers, markDirty]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    if (!enabled) return;
    const s = ref.current;
    s.stopped = false;
    // Armed after Storage loaded (this mounts inside the suspended canvas): the current canvas is the baseline,
    // so opening (or a fresh seed) never counts as a change (EC-006).
    s.lastSavedJson = JSON.stringify(readDocument());
    const unsubscribe = store.subscribe((state, prev) => {
      if (s.stopped || (state.nodes === prev.nodes && state.edges === prev.edges)) return;
      if (s.inFlight) s.changedDuringSave = true;
      if (s.dirty) {
        s.retries = 0;
        clearTimeout(s.retry);
        scheduleDebounce();
        return;
      }
      if (JSON.stringify(toDocument(state.nodes, state.edges)) === s.lastSavedJson) return;
      s.retries = 0;
      markDirty();
    });

    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && s.dirty) void flushRef.current('hidden');
    };
    const onPageHide = () => {
      if (s.dirty) void flushRef.current('pagehide');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      s.stopped = true;
      clearTimers();
    };
  }, [enabled, store, readDocument, scheduleDebounce, markDirty, clearTimers]);

  const save = useCallback((opts?: { allowEmpty?: boolean }) => flushRef.current('manual', opts), []);

  return { status: enabled ? status : 'readonly', lastSavedAt, lastError, save };
}
