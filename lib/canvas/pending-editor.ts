/**
 * "Open the editor on mount" flags (F22 02-design, text node lifecycle). `addNodeOfKind` sets one when it creates an
 * empty text node; the node's component takes it exactly once on mount. Module-level and never synced: a remote
 * client that receives the node never sees the flag, so only the creator's editor opens.
 */
const pending = new Set<string>();

export function requestEditorOpen(id: string): void {
  pending.add(id);
}

/** True exactly once per `requestEditorOpen(id)`. */
export function takeEditorOpen(id: string): boolean {
  return pending.delete(id);
}
