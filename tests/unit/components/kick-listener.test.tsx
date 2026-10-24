import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KickListener, RELOAD_DELAY_MS } from '@/components/editor/kick-listener';
import { ACCESS_CHANGED_COPY, UnloadGuardProvider } from '@/components/editor/unload-guard';

// The Liveblocks hooks are the seam: the test drives room events and connection status by hand.
const lb = vi.hoisted(() => ({
  logout: vi.fn(),
  status: 'connected' as string,
  onEvent: null as null | ((e: { event: unknown }) => void),
  checkMyAccess: vi.fn(),
}));
vi.mock('@liveblocks/react/suspense', () => ({
  useClient: () => ({ logout: lb.logout }),
  useRoom: () => ({ id: 'p1' }),
  useSelf: (select: (me: { id: string }) => unknown) => select({ id: 'me' }),
  useStatus: () => lb.status,
  useEventListener: (cb: (e: { event: unknown }) => void) => {
    lb.onEvent = cb;
  },
}));
vi.mock('@/app/editor/[projectId]/actions', () => ({ checkMyAccess: lb.checkMyAccess }));

const reload = vi.fn();
const realLocation = window.location;

beforeEach(() => {
  vi.useFakeTimers();
  lb.logout.mockClear();
  lb.status = 'connected';
  lb.checkMyAccess.mockReset().mockResolvedValue({ ok: true, data: { role: 'editor' } });
  reload.mockClear();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload } });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
});

const listener = (onReconnected?: () => void) => (
  <UnloadGuardProvider>
    <KickListener role="editor" onReconnected={onReconnected} />
  </UnloadGuardProvider>
);

function mount(onReconnected?: () => void) {
  return render(listener(onReconnected));
}

const emit = (event: unknown) => act(() => lb.onEvent?.({ event }));

describe('KickListener (F05 FR-013, FR-014)', () => {
  it.each([
    { type: 'KICK', userId: 'me' },
    { type: 'ROLE_CHANGED', userId: 'me', role: 'viewer' },
  ])('$type for me: overlay, unload prompt suppressed, logout, then a full reload (AC-016, AC-017)', (event) => {
    mount();
    emit(event);
    expect(screen.getByRole('status')).toHaveTextContent(ACCESS_CHANGED_COPY);
    expect(lb.logout).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();

    // The capturing listener installed by suppress() stops Liveblocks' own beforeunload handler.
    const liveblocksGuard = vi.fn();
    window.addEventListener('beforeunload', liveblocksGuard);
    window.dispatchEvent(new Event('beforeunload'));
    expect(liveblocksGuard).not.toHaveBeenCalled();
    window.removeEventListener('beforeunload', liveblocksGuard);

    act(() => vi.advanceTimersByTime(RELOAD_DELAY_MS));
    expect(reload).toHaveBeenCalledOnce();
    expect(RELOAD_DELAY_MS).toBeLessThanOrEqual(500);
  });

  it('ignores events for other users and canvas events (EC-013)', () => {
    mount();
    emit({ type: 'KICK', userId: 'someone-else' });
    emit({ type: 'ROLE_CHANGED', userId: 'someone-else', role: 'viewer' });
    emit({ type: 'CANVAS_REPLACED', byUserId: 'me' });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole('status')).toBeNull();
    expect(lb.logout).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('fires onReconnected on every reconnecting → connected transition, not on the first connect (AC-017b)', () => {
    const onReconnected = vi.fn();
    lb.status = 'connecting';
    const view = mount(onReconnected);
    const step = (status: string) => {
      lb.status = status;
      view.rerender(listener(onReconnected));
    };
    step('connected');
    expect(onReconnected).not.toHaveBeenCalled();
    step('reconnecting');
    step('connected');
    step('reconnecting');
    step('connected');
    expect(onReconnected).toHaveBeenCalledTimes(2);
  });

  // F12 FR-016 / D-032: a KICK missed while offline is caught by re-checking the role after the reconnect.
  it.each([
    ['the role is unchanged', { ok: true, data: { role: 'editor' } }, false],
    ['the role changed', { ok: true, data: { role: 'viewer' } }, true],
    ['access was revoked', { ok: false, error: { code: 'FORBIDDEN', message: 'x' } }, true],
  ])('re-verifies with checkMyAccess after a reconnect; reloads only when %s (F12 AC-022, AC-026)', async (_label, result, ejects) => {
    lb.checkMyAccess.mockResolvedValue(result);
    const view = mount();
    for (const status of ['reconnecting', 'connected']) {
      lb.status = status;
      view.rerender(listener());
    }
    await act(async () => {});
    expect(lb.checkMyAccess).toHaveBeenCalledExactlyOnceWith({ projectId: 'p1' });
    act(() => vi.advanceTimersByTime(RELOAD_DELAY_MS));
    expect(lb.logout).toHaveBeenCalledTimes(ejects ? 1 : 0);
    expect(reload).toHaveBeenCalledTimes(ejects ? 1 : 0);
  });
});
