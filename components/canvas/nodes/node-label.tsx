import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';

/**
 * Typography shared by the resting label and the editor's textarea (F08 FR-014), so opening the editor causes no
 * visual jump: Geist Sans 14 px / 1.3, 8 px padding, centred, newlines preserved. Colour is inherited from the
 * shape (`NODE_COLORS[color].text`).
 */
export const LABEL_TYPOGRAPHY = 'p-2 font-sans text-sm leading-[1.3] text-center whitespace-pre-wrap break-words';

export const LABEL_PLACEHOLDER = 'Double-click to label';

export interface NodeLabelProps {
  label: string;
  /** Show the faint "Double-click to label" hint for an empty label (editors only). */
  showPlaceholder: boolean;
  /** Kept in the layout but invisible while the editor overlays it (no layout shift, FR-009). */
  hidden?: boolean;
  /** Typography from `data.text` (`textStyle`); overrides the default size, weight and alignment. */
  style?: CSSProperties;
  /** Replaces the default typography and 5-line clamp (text and sticky nodes lay their label out themselves). */
  className?: string;
  /** The faint hint for an empty label (editors only); defaults to "Double-click to label". */
  placeholder?: string;
}

/** The node's label at rest (FR-009, FR-014): up to 5 lines, overflow hidden; the stored text stays intact. */
export function NodeLabel({ label, showPlaceholder, hidden = false, style, className, placeholder = LABEL_PLACEHOLDER }: NodeLabelProps) {
  if (!label) {
    return (
      <span
        aria-hidden="true"
        style={style}
        data-slot="node-label-placeholder"
        className={cn(className ?? LABEL_TYPOGRAPHY, 'relative min-h-[1em] text-copy-faint select-none', hidden && 'invisible')}
      >
        {showPlaceholder ? placeholder : null}
      </span>
    );
  }
  return (
    <span
      data-slot="node-label"
      style={style}
      className={cn(className ?? [LABEL_TYPOGRAPHY, 'line-clamp-5 max-h-full overflow-hidden'], 'relative', hidden && 'invisible')}
    >
      {label}
    </span>
  );
}
