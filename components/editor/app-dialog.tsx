'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';

export interface AppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /**
   * Radix focuses the Dialog.Trigger on close; dialogs opened programmatically (no trigger) pass this to
   * restore focus to their opener instead (F04).
   */
  onCloseAutoFocus?: (event: Event) => void;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
}

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-brand';

/**
 * Dialog pattern (D-F01-8). Composed from the Radix/shadcn parts rather than shadcn's
 * `DialogContent`, which renders its own un-blurred overlay and a corner close button.
 * Focus trap, focus restore and Esc stay the Radix defaults.
 */
export function AppDialog({ open, onOpenChange, title, description, children, footer, onCloseAutoFocus }: AppDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-base/60 backdrop-blur-sm motion-reduce:animate-none" />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          onCloseAutoFocus={onCloseAutoFocus}
          // Without a description Radix expects aria-describedby to be explicitly absent.
          {...(description ? {} : { 'aria-describedby': undefined })}
          className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-3xl border border-surface-border bg-elevated p-6 text-copy-primary shadow-xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg motion-reduce:animate-none"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/** Confirmation without inputs; destructive actions use the destructive button variant. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          {/* First focusable element, so Radix focuses Cancel on open; autoFocus makes it explicit. */}
          <Button
            type="button"
            variant="outline"
            className={FOCUS_RING}
            disabled={pending}
            autoFocus
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            className={FOCUS_RING}
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
