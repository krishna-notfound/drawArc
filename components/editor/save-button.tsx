'use client';

import { AlertCircle, Check, Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/editor/app-dialog';
import { useSaveState } from '@/components/editor/save-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const SAVED_FLASH_MS = 3_000;

/** "14:02" — 24-hour, zero-padded, local time. */
export function formatSavedTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export const EMPTY_SAVE_COPY = {
  title: 'Save an empty canvas?',
  description: 'This replaces the last saved diagram for everyone.',
  confirm: 'Save empty',
} as const;

/**
 * Navbar Save status and button (F13 FR-009): text plus icon in every state, hidden for viewers and read-only
 * sessions. A manual Save of an empty canvas over an existing snapshot asks first (FR-008, P-13-1).
 */
export function SaveButton() {
  const { status, lastSavedAt, save, role, mounted } = useSaveState();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [flashing, setFlashing] = useState(false);

  // "Saved · HH:MM" for 3 s after each save, then "Saved".
  const savedKey = lastSavedAt?.getTime() ?? 0;
  const [seenKey, setSeenKey] = useState(savedKey);
  if (savedKey !== seenKey) {
    setSeenKey(savedKey);
    setFlashing(status === 'saved');
  }
  useEffect(() => {
    if (!flashing) return;
    const timer = setTimeout(() => setFlashing(false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashing, seenKey]);

  if (role === 'viewer' || status === 'readonly') return null;

  const onClick = async () => {
    if ((await save()) === 'needs-confirm') setConfirmOpen(true);
  };

  let icon = <Save aria-hidden="true" />;
  let label = 'Save';
  if (status === 'saving') {
    icon = <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />;
    label = 'Saving…';
  } else if (status === 'saved') {
    icon = <Check aria-hidden="true" />;
    label = flashing && lastSavedAt ? `Saved · ${formatSavedTime(lastSavedAt)}` : 'Saved';
  } else if (status === 'error') {
    icon = <AlertCircle aria-hidden="true" />;
    label = 'Error · Retry';
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-slot="save-button"
        data-status={status}
        disabled={!mounted || status === 'saving'}
        title={lastSavedAt ? `Last saved ${lastSavedAt.toLocaleString()}` : 'Autosaves 30 s after your last change'}
        className={cn('focus-visible:ring-2 focus-visible:ring-brand', status === 'error' && 'text-error')}
        onClick={() => void onClick()}
      >
        {icon}
        <span aria-live="polite">{label}</span>
        {status === 'dirty' ? <span aria-hidden="true" className="size-1.5 rounded-full bg-copy-muted" /> : null}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={EMPTY_SAVE_COPY.title}
        description={EMPTY_SAVE_COPY.description}
        confirmLabel={EMPTY_SAVE_COPY.confirm}
        destructive
        onConfirm={async () => {
          setConfirmOpen(false);
          await save({ allowEmpty: true });
        }}
      />
    </>
  );
}
