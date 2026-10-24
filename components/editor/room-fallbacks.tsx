'use client';

import { Button } from '@/components/ui/button';

/** Shown inside `ClientSideSuspense` until the room is connected (also the server render). */
export function RoomLoading() {
  return (
    <div
      role="status"
      className="flex h-full min-h-[50vh] w-full flex-1 items-center justify-center bg-base bg-[radial-gradient(var(--border-default)_1px,transparent_1px)] bg-size-[20px_20px]"
    >
      <p className="text-sm text-copy-muted">Connecting to project…</p>
    </div>
  );
}

export type RoomErrorKind = 'no-access' | 'room-full' | 'generic';

const COPY: Record<RoomErrorKind, { title: string; body: string; action: string }> = {
  'no-access': {
    title: 'You no longer have access',
    body: 'Your access to this project was removed or the project was deleted.',
    action: 'Back to projects',
  },
  'room-full': {
    title: 'This project is full (10 people)',
    body: 'This project already has 10 people connected. Ask someone to leave or try again later.',
    action: 'Try again',
  },
  generic: {
    title: 'Could not connect to this project',
    body: 'Something went wrong while connecting to the collaboration service.',
    action: 'Retry',
  },
};

/** Centred panel with one primary action; replaces the room on connection errors (FR-010). */
export function RoomError({ kind, onAction }: { kind: RoomErrorKind; onAction: () => void }) {
  const copy = COPY[kind];
  return (
    <div role="alert" className="flex h-full min-h-[50vh] w-full flex-1 items-center justify-center bg-base p-4">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <h2 className="text-base font-semibold text-copy-primary">{copy.title}</h2>
        <p className="text-sm text-copy-secondary">{copy.body}</p>
        <Button onClick={onAction} className="mt-2">
          {copy.action}
        </Button>
      </div>
    </div>
  );
}
