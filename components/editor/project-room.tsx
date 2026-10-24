'use client';

import type { ResolveUsersArgs } from '@liveblocks/client';
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
  useErrorListener,
  useRoom,
  useSelf,
  useStatus,
} from '@liveblocks/react/suspense';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import type { ProjectRole } from '@/lib/access';
import { publicEnv } from '@/lib/env.public';
import { userColor } from '@/lib/user-color';

import { ConnectionStatus } from './connection-status';
import { KickListener } from './kick-listener';
import { RoomError, type RoomErrorKind, RoomLoading } from './room-fallbacks';
import { UnloadGuardProvider, useUnloadGuard } from './unload-guard';

export interface ProjectRoomProps {
  projectId: string;
  /** The caller's role from the server gate; mirrored as `data-role` for tests (the token decides writes). */
  role: ProjectRole;
  /** F12 hook point: runs after every reconnect (see `KickListener`). */
  onReconnected?: () => void;
  children: ReactNode;
}

const INITIAL_PRESENCE: Liveblocks['Presence'] = { cursor: null, thinking: false };

type UserInfo = Liveblocks['UserMeta']['info'];

/** `resolveUsers` backend (FR-008): unknown or unrelated ids resolve to `undefined`, never an error. */
async function resolveUsers({ userIds }: ResolveUsersArgs): Promise<(UserInfo | undefined)[]> {
  const response = await fetch(`/api/users/resolve?ids=${encodeURIComponent(userIds.join(','))}`);
  if (!response.ok) return userIds.map(() => undefined);
  const { users } = (await response.json()) as { users: { id: string; name: string; avatar: string | null }[] };
  const byId = new Map(users.map((user) => [user.id, user]));
  return userIds.map((id) => {
    const user = byId.get(id);
    if (!user) return undefined;
    return { name: user.name, ...(user.avatar ? { avatar: user.avatar } : {}), color: userColor(id) };
  });
}

/**
 * The project's Liveblocks room (FR-009): connection, room, suspense boundary, error fallbacks, connection
 * pill and revocation listener. The room id is the project id; the token comes from /api/liveblocks-auth.
 */
export function ProjectRoom({ projectId, role, onReconnected, children }: ProjectRoomProps) {
  return (
    <UnloadGuardProvider>
      <LiveblocksProvider
        authEndpoint="/api/liveblocks-auth"
        throttle={50}
        lostConnectionTimeout={5000}
        preventUnsavedChanges
        resolveUsers={resolveUsers}
        baseUrl={publicEnv.NEXT_PUBLIC_LIVEBLOCKS_BASE_URL}
      >
        <RoomProvider id={projectId} initialPresence={INITIAL_PRESENCE}>
          <RoomErrorBoundary>
            <ClientSideSuspense fallback={<RoomLoading />}>
              <ConnectedRoom role={role} onReconnected={onReconnected}>
                {children}
              </ConnectedRoom>
            </ClientSideSuspense>
          </RoomErrorBoundary>
        </RoomProvider>
      </LiveblocksProvider>
    </UnloadGuardProvider>
  );
}

function ConnectedRoom({ role, onReconnected, children }: Omit<ProjectRoomProps, 'projectId'>) {
  const canWrite = useSelf((me) => me.canWrite);
  const status = useStatus();
  return (
    <div
      data-slot="project-room"
      data-role={role}
      data-can-write={String(canWrite)}
      data-connection-status={status}
      className="relative flex h-full w-full flex-1 flex-col"
    >
      <KickListener onReconnected={onReconnected} />
      <ConnectionStatus />
      {children}
    </div>
  );
}

/** Maps Liveblocks room connection error codes to a fallback (FR-010). */
export function errorKindFor(code: number): RoomErrorKind | 'reload' {
  if (code === -1 || code === 4001) return 'no-access';
  if (code === 4005) return 'room-full';
  if (code === 4006) return 'reload';
  return 'generic';
}

/**
 * Replaces the room with a fallback on connection errors: -1/4001 (no access) → `/editor`, 4005 (room full),
 * 4006 (room id changed) → reload, anything else → Retry. Ignored once a forced reload is under way.
 */
export function RoomErrorBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  const room = useRoom();
  const guard = useUnloadGuard();
  const [kind, setKind] = useState<RoomErrorKind | null>(null);

  useErrorListener((error) => {
    if (error.context.type !== 'ROOM_CONNECTION_ERROR' || guard.isSuppressed()) return;
    const next = errorKindFor(error.context.code);
    if (next === 'reload') window.location.reload();
    else setKind(next);
  });

  useEffect(() => {
    if (kind === 'no-access') router.replace('/editor');
  }, [kind, router]);

  if (!kind) return children;
  const onAction = () => {
    if (kind === 'no-access') {
      router.replace('/editor');
      return;
    }
    setKind(null);
    room.reconnect();
  };
  return <RoomError kind={kind} onAction={onAction} />;
}
