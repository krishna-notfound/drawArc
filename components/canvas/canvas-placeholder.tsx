import type { EditorIslandProps } from '@/lib/editor/island-props';

/**
 * Canvas slot placeholder (FR-013). It already receives the F06 island props; F06 swaps it for the real
 * editor in the gate without touching the layout. The data attributes expose the resolved island role.
 */
export function CanvasPlaceholder({ projectId, role }: Partial<EditorIslandProps>) {
  return (
    <div
      data-slot="canvas-placeholder"
      data-project-id={projectId}
      data-role={role}
      className="flex h-full w-full items-center justify-center bg-[radial-gradient(var(--color-surface-border)_1px,transparent_1px)] [background-size:20px_20px]"
    >
      <p className="text-sm text-copy-secondary">Your canvas will appear here.</p>
    </div>
  );
}
