import type { NodeProps } from '@xyflow/react';

import type { CanvasNode as CanvasNodeType } from '@/types/canvas';

import { warnOnce } from './warn-once';

/**
 * Placeholder for kinds the schema reserves for later features (`line`, `freehand`, `frame`, `image`; F22 FR-018).
 * Selectable and deletable like any node, but no editor, no handles and no resizer, so a document written by a
 * newer feature never crashes an older client. Warns once per id.
 */
export function ReservedKindNode({ id, kind }: NodeProps<CanvasNodeType> & { kind: 'line' | 'freehand' | 'frame' | 'image' }) {
  warnOnce(id, `is a reserved ${kind} node; rendering a placeholder`);
  return (
    <div
      aria-label={`${kind} (unsupported)`}
      className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[4px] border border-dashed border-surface-subtle text-xs text-copy-faint select-none"
    >
      <span className="font-medium">{kind}</span>
      <span>Not supported in this version</span>
    </div>
  );
}
