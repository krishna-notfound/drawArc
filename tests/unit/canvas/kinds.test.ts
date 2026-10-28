import { describe, expect, it, vi } from 'vitest';

import { canvasKinds, hasTextKind, textInserter, textMaxLength } from '@/lib/canvas/kinds';

// Against the real F22 types (no mock): the shim F10 v2 wrote to run without F22 resolves the real kind list.
describe('lib/canvas/kinds with F22 present (F10 AC-033, D-10j)', () => {
  it('reads the real NODE_KINDS and TEXT_MAX_LENGTH', () => {
    expect(hasTextKind()).toBe(true);
    expect(canvasKinds()).toContain('sticky');
    expect(textMaxLength()).toBe(500);
  });

  it('textInserter binds addNodeOfKind("text", position, { label }) and is null without that mutation', () => {
    const addNodeOfKind = vi.fn();
    const insert = textInserter({ addNodeOfKind })!;
    insert({ x: 1, y: 2 }, { label: 'plain words' });
    expect(addNodeOfKind).toHaveBeenCalledExactlyOnceWith('text', { x: 1, y: 2 }, { label: 'plain words' });
    expect(textInserter({})).toBeNull();
  });
});
