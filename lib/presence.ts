import { USER_COLORS } from '@/types/liveblocks.config';

/** Shown when a participant has no name (EC-004/EC-009). */
export const FALLBACK_NAME = 'Someone';

/** One collaborator in the avatar stack: a user, however many connections (tabs) they have open. */
export interface PresenceEntry {
  id: string;
  /** As received; may be empty (initials then show "?"). Use `displayName` for labels. */
  name: string;
  avatar: string | null;
  color: string;
  tabs: number;
}

/** The part of a Liveblocks `other` the stack reads. `info` is optional: resolve can fail (EC-009). */
export interface PresenceSource {
  id: string;
  info?: { name?: string; avatar?: string; color?: string };
}

export function displayName(name: string): string {
  return name.trim() || FALLBACK_NAME;
}

/**
 * Others → stack entries (FR-005, P-11-3): the current user's own connections (other tabs) are dropped, the rest
 * are de-duplicated by user id in first-seen order, and `tabs` counts each user's connections.
 */
export function presenceEntries(others: readonly PresenceSource[], selfId: string): PresenceEntry[] {
  const byId = new Map<string, PresenceEntry>();
  for (const other of others) {
    if (other.id === selfId) continue;
    const seen = byId.get(other.id);
    if (seen) {
      seen.tabs += 1;
      continue;
    }
    byId.set(other.id, {
      id: other.id,
      name: other.info?.name ?? '',
      avatar: other.info?.avatar ?? null,
      color: other.info?.color ?? USER_COLORS[0],
      tabs: 1,
    });
  }
  return [...byId.values()];
}

/** Equality for the `useOthers` selector, so cursor moves (presence only) never re-render the stack. */
export function samePresenceEntries(a: readonly PresenceEntry[], b: readonly PresenceEntry[]): boolean {
  return (
    a.length === b.length &&
    a.every((entry, i) => {
      const other = b[i]!;
      return (
        entry.id === other.id &&
        entry.name === other.name &&
        entry.avatar === other.avatar &&
        entry.color === other.color &&
        entry.tabs === other.tabs
      );
    })
  );
}

/** At most `max` avatars; the rest go behind the "+N" chip. */
export function splitOverflow<T>(entries: readonly T[], max: number): { shown: T[]; hidden: T[] } {
  return { shown: entries.slice(0, max), hidden: entries.slice(max) };
}

/** The stack's accessible name (FR-008): "1 other person here: Ada" / "3 other people here: Ada, Grace, Linus". */
export function presenceLabel(entries: readonly PresenceEntry[]): string {
  const noun = entries.length === 1 ? 'other person' : 'other people';
  return `${entries.length} ${noun} here: ${entries.map((entry) => displayName(entry.name)).join(', ')}`;
}

/** Tooltip lines for the "+N" chip: up to 10 names, then "and N more". */
export function overflowNames(hidden: readonly PresenceEntry[], limit = 10): string[] {
  const names = hidden.slice(0, limit).map((entry) => displayName(entry.name));
  return hidden.length > limit ? [...names, `and ${hidden.length - limit} more`] : names;
}
