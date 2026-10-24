'use client';

import { memo } from 'react';

import { AppDialog } from '@/components/editor/app-dialog';
import { SHORTCUT_ROWS } from '@/lib/canvas/shortcuts';

/** Renders the rows' backtick spans as keys. */
function InputCell({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) =>
        i % 2 === 1 ? (
          <kbd key={i} className="rounded border border-surface-border bg-subtle px-1 font-mono text-xs text-copy-primary">
            {part}
          </kbd>
        ) : (
          part
        ),
      )}
    </>
  );
}

export interface ShortcutCheatSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  canEdit: boolean;
  /** Opened programmatically (no Radix trigger): the opener decides where focus goes back (AC-020). */
  onCloseAutoFocus?(event: Event): void;
}

/**
 * "Keyboard shortcuts" dialog (FR-010), opened by `?` or the pane context menu. Read-only members see only the
 * navigation rows (FR-011).
 */
export const ShortcutCheatSheet = memo(function ShortcutCheatSheet({
  open,
  onOpenChange,
  canEdit,
  onCloseAutoFocus,
}: ShortcutCheatSheetProps) {
  const rows = canEdit ? SHORTCUT_ROWS : SHORTCUT_ROWS.filter((row) => row.viewerVisible);

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Keyboard shortcuts"
      description="Shortcuts are ignored while typing in a text field."
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <div className="max-h-[60vh] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-border text-xs text-copy-muted">
              <th scope="col" className="py-1.5 pr-4 font-medium">
                Action
              </th>
              <th scope="col" className="py-1.5 font-medium">
                Input
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.action} className="border-b border-surface-border/50 align-top last:border-0">
                <th scope="row" className="py-1.5 pr-4 font-normal whitespace-nowrap text-copy-primary">
                  {row.action}
                </th>
                <td className="py-1.5 text-copy-secondary">
                  <InputCell text={row.input} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppDialog>
  );
});
