'use client';

import { useOthers, useSelf } from '@liveblocks/react/suspense';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { UserMenu } from '@/components/editor/user-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  displayName,
  overflowNames,
  presenceEntries,
  presenceLabel,
  type PresenceEntry,
  samePresenceEntries,
  splitOverflow,
} from '@/lib/presence';

import { PresenceAvatar } from './presence-avatar';

// The workspace's presence slot sits in the navbar, outside the Liveblocks room (which lives in the canvas
// island), so it cannot call `useOthers`. The slot renders an empty target; `PresenceOthers`, mounted inside the
// room, portals the avatars into it. A one-value store hands the target element across the two trees.
let target: HTMLElement | null = null;
const targetListeners = new Set<() => void>();

function setTarget(element: HTMLElement | null) {
  target = element;
  targetListeners.forEach((listener) => listener());
}

function subscribeTarget(listener: () => void) {
  targetListeners.add(listener);
  return () => targetListeners.delete(listener);
}

const getTarget = () => target;
const getServerTarget = () => null;

const COMPACT_QUERY = '(max-width: 767px)';

function subscribeCompact(listener: () => void) {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

const getCompact = () => window.matchMedia(COMPACT_QUERY).matches;
const getServerCompact = () => false;

/**
 * The workspace presence corner (FR-007, FR-012), passed as F04's `presenceSlot`: the others' avatars (portalled in
 * by `PresenceOthers`, so the corner holds only the Clerk `UserButton` until someone else is here) followed by the
 * `UserButton`, always last.
 */
export function PresenceStack() {
  return (
    <div data-testid="presence-stack" className="flex items-center gap-2">
      <div ref={setTarget} data-slot="presence-others" className="flex items-center gap-2 empty:hidden" />
      <UserMenu />
    </div>
  );
}

/**
 * The avatar stack (FR-005–FR-009). Must render inside the room. Others only (the own id comes from the room
 * token, so the user's other tabs are dropped too), one avatar per user id (P-11-3), viewers included; at most
 * 5 (3 under 768 px) then "+N"; the divider only when someone else is here. Avatars are focusable for their
 * tooltips but have no actions.
 */
export function PresenceOthers() {
  const selfId = useSelf((me) => me.id);
  const element = useSyncExternalStore(subscribeTarget, getTarget, getServerTarget);
  const compact = useSyncExternalStore(subscribeCompact, getCompact, getServerCompact);
  const entries = useOthers((others) => presenceEntries(others, selfId), samePresenceEntries);
  if (!element || entries.length === 0) return null;
  const { shown, hidden } = splitOverflow(entries, compact ? 3 : 5);
  return createPortal(
    <>
      <div role="group" aria-label={presenceLabel(entries)} data-testid="presence-avatars" className="flex items-center -space-x-2">
        {shown.map((entry) => (
          <AvatarWithTooltip key={entry.id} entry={entry} />
        ))}
        {hidden.length > 0 ? <OverflowChip hidden={hidden} /> : null}
      </div>
      <div data-testid="presence-divider" aria-hidden="true" className="h-6 w-px bg-surface-border" />
    </>,
    element,
  );
}

const FOCUS_RING = 'rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand';

function AvatarWithTooltip({ entry }: { entry: PresenceEntry }) {
  const name = displayName(entry.name);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} data-testid="presence-avatar" data-user-id={entry.id} className={`${FOCUS_RING} flex`}>
          <PresenceAvatar name={entry.name} avatar={entry.avatar} color={entry.color} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {name}
        {entry.tabs > 1 ? ` (${entry.tabs} tabs)` : ''}
      </TooltipContent>
    </Tooltip>
  );
}

function OverflowChip({ hidden }: { hidden: PresenceEntry[] }) {
  const names = overflowNames(hidden);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="img"
          aria-label={`${hidden.length} more: ${names.join(', ')}`}
          data-testid="presence-overflow"
          className={`${FOCUS_RING} flex size-8 items-center justify-center bg-elevated text-xs font-medium text-copy-secondary ring-2 ring-(--bg-base)`}
        >
          +{hidden.length}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="whitespace-pre-line">
        {names.join('\n')}
      </TooltipContent>
    </Tooltip>
  );
}
