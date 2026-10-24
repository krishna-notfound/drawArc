'use client';

import { Share2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { ShareDialog, type ShareDialogProps } from '@/components/editor/share-dialog';
import { Button } from '@/components/ui/button';

export type ShareButtonProps = Omit<ShareDialogProps, 'open' | 'onOpenChange' | 'onCloseAutoFocus'>;

/** The workspace navbar's Share slot (FR-001): shown for every role; the dialog decides what each role may do. */
export function ShareButton(props: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="sm"
        aria-label="Share project"
        aria-haspopup="dialog"
        className="focus-visible:ring-2 focus-visible:ring-brand"
        onClick={() => setOpen(true)}
      >
        <Share2 aria-hidden="true" />
        Share
      </Button>
      <ShareDialog
        {...props}
        open={open}
        onOpenChange={setOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          buttonRef.current?.focus();
        }}
      />
    </>
  );
}
