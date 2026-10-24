'use client';

import { shallow, useOther } from '@liveblocks/react/suspense';
import type { CursorsCursorProps } from '@liveblocks/react-flow';
import { Loader2 } from 'lucide-react';

import { displayName } from '@/lib/presence';
import { USER_COLORS } from '@/types/liveblocks.config';

/**
 * One remote participant's cursor (FR-003), rendered by `<Cursors/>` for other connections only — the current
 * connection never gets one. `<Cursors/>` positions the wrapper in flow coordinates (translate only, so the glyph
 * keeps its screen size at any zoom) and passes just the ids, so name/colour/thinking are read here.
 * Decorative (`aria-hidden`): names are announced by the avatar stack.
 */
export function CanvasCursor({ userId, connectionId }: CursorsCursorProps) {
  const { name, color, thinking } = useOther(
    connectionId,
    (other) => ({
      name: displayName(other.info?.name ?? ''),
      color: other.info?.color ?? USER_COLORS[0],
      thinking: other.presence.thinking,
    }),
    shallow,
  );
  return (
    // Absolute so each wrapper has no height and every cursor starts at the layer's origin.
    <div data-testid="remote-cursor" data-user-id={userId} aria-hidden="true" className="pointer-events-none absolute top-0 left-0">
      <svg width="16" height="16" viewBox="0 0 16 16" className="block" focusable="false">
        <path
          d="M1.5 1.5v12l3.4-3.1 2.3 4.9 2.1-1-2.3-4.8h4.7z"
          fill={color}
          stroke="var(--bg-base)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      <div
        data-slot="cursor-badge"
        className="absolute top-4 left-4 flex max-w-48 items-center gap-1 rounded-xl px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap"
        style={{ backgroundColor: color, color: 'var(--bg-base)' }}
      >
        {thinking ? (
          <span title="Thinking…" data-slot="cursor-thinking" className="flex shrink-0">
            <Loader2 className="size-3 motion-safe:animate-spin" />
          </span>
        ) : null}
        <span className="truncate">{name}</span>
      </div>
    </div>
  );
}
