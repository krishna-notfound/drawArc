// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { initials } from '@/lib/initials';
import { overflowNames, presenceEntries, presenceLabel, samePresenceEntries, splitOverflow } from '@/lib/presence';
import { USER_COLORS } from '@/types/liveblocks.config';

const other = (id: string, name = `User ${id}`) => ({ id, info: { name, color: '#52A8FF' } });

describe('presence stack logic (F11 AC-008, AC-009, AC-013)', () => {
  it('drops the current user, dedupes by id in first-seen order and counts tabs', () => {
    const entries = presenceEntries(
      [other('u2', 'Grace Hopper'), other('me'), other('u1', 'Ada Lovelace'), other('u2', 'Grace Hopper'), other('me')],
      'me',
    );
    expect(entries.map((e) => [e.id, e.tabs])).toEqual([
      ['u2', 2],
      ['u1', 1],
    ]);
    expect(presenceLabel(entries.slice(1))).toBe('1 other person here: Ada Lovelace');
    expect(presenceLabel(entries)).toBe('2 other people here: Grace Hopper, Ada Lovelace');
  });

  it('falls back when info is missing (EC-009) and names are blank (EC-004)', () => {
    const [entry] = presenceEntries([{ id: 'x' }], 'me');
    expect(entry).toEqual({ id: 'x', name: '', avatar: null, color: USER_COLORS[0], tabs: 1 });
    expect(presenceLabel([entry!])).toBe('1 other person here: Someone');
  });

  it('shows 5 then "+N" with the hidden names, capped at 10 lines', () => {
    const entries = presenceEntries(
      Array.from({ length: 17 }, (_, i) => other(`u${i + 1}`)),
      'me',
    );
    const { shown, hidden } = splitOverflow(entries, 5);
    expect(shown.map((e) => e.id)).toEqual(['u1', 'u2', 'u3', 'u4', 'u5']);
    expect(hidden).toHaveLength(12);
    expect(overflowNames(hidden.slice(0, 2))).toEqual(['User u6', 'User u7']);
    expect(overflowNames(hidden)).toHaveLength(11);
    expect(overflowNames(hidden).at(-1)).toBe('and 2 more');
  });

  it('treats equal projections as equal so cursor moves do not re-render the stack', () => {
    const a = presenceEntries([other('u1'), other('u2')], 'me');
    expect(samePresenceEntries(a, presenceEntries([other('u1'), other('u2')], 'me'))).toBe(true);
    expect(samePresenceEntries(a, presenceEntries([other('u1'), other('u2'), other('u1')], 'me'))).toBe(false);
  });
});

describe('initials (F11 AC-017)', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    ['linus', 'L'],
    ['  grace   brewster hopper ', 'GB'],
    ['', '?'],
    ['李 雷', '李雷'],
  ])('%j → %j', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
