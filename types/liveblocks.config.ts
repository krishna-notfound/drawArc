import type { LiveMap, LiveObject, LsonObject } from '@liveblocks/client';

/**
 * Presence colours, one per user, equal to the non-neutral `NODE_COLORS[*].text` values (P-05-6). They live
 * here because F05 precedes `types/canvas.ts`; F06 adds a test asserting both palettes stay equal.
 */
export const USER_COLORS = ['#52A8FF', '#BF7AF0', '#FF990A', '#FF6166', '#F75F8F', '#62C073', '#0AC7B4'] as const;
export type UserColor = (typeof USER_COLORS)[number];

/** The member was removed: leave the room (security-model "Revocation"). */
export type KickEvent = { type: 'KICK'; userId: string };
/** The member's role changed: re-authenticate to get a token for the new role (P-05-2). */
export type RoleChangedEvent = { type: 'ROLE_CHANGED'; userId: string; role: 'editor' | 'viewer' };
/** Emitted by F14 after a template replaced the canvas; not handled in F05. */
export type CanvasReplacedEvent = { type: 'CANVAS_REPLACED'; byUserId: string; templateName?: string };

/** One React Flow node or edge as `@liveblocks/react-flow` stores it (the whole object, LSON-encoded). */
type FlowItem = LiveObject<LsonObject>;

// Room shape per context/domain-model.md "Liveblocks room shape". Every Liveblocks hook is typed from it.
declare global {
  interface Liveblocks {
    Presence: { cursor: { x: number; y: number } | null; thinking: boolean };
    // Managed by @liveblocks/react-flow under storageKey 'flow' and never hand-edited (F17 mutateFlow uses the
    // same key). Spike T-001 confirmed the stored shape: `{ flow: { nodes: { [id]: Node }, edges: { [id]: Edge } } }`.
    // Optional because both `useLiveblocksFlow` and `mutateFlow` create it on first use, so a new room has none.
    Storage: { flow?: LiveObject<{ nodes: LiveMap<string, FlowItem>; edges: LiveMap<string, FlowItem> }> };
    // `avatar` is omitted (not null) when the user has none: Liveblocks' user info cannot hold null and drops it.
    UserMeta: { id: string; info: { name: string; avatar?: string; color: string } };
    RoomEvent: KickEvent | RoleChangedEvent | CanvasReplacedEvent;
  }
}
