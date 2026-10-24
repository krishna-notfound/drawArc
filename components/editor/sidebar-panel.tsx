'use client';

import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface SidebarPanelProps {
  id: string;
  side: 'left' | 'right';
  open: boolean;
  onClose: () => void;
  /** aria-label of the <aside>. */
  label: string;
  /** Focus returns here on close. */
  openerRef?: RefObject<HTMLElement | null>;
  /** Move focus into the panel when it opens (default). False for an automatic, non-user open (F04). */
  focusOnOpen?: boolean;
  children: ReactNode;
  className?: string;
}

/** Marks the element that receives focus when the panel opens. */
export const SIDEBAR_CLOSE_ATTRIBUTE = 'data-sidebar-close';

/**
 * Floating panel shared by the project and AI sidebars (D-F01-3). It floats over
 * content (`position: fixed`) and, when closed, sits fully off-screen, hidden from
 * assistive tech, inert, and shadowless, so nothing peeks into the viewport.
 */
export function SidebarPanel({
  id,
  side,
  open,
  onClose,
  label,
  openerRef,
  focusOnOpen = true,
  children,
  className,
}: SidebarPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const panel = panelRef.current;
    if (open && !wasOpen.current && focusOnOpen) {
      const closeButton = panel?.querySelector<HTMLElement>(`[${SIDEBAR_CLOSE_ATTRIBUTE}]`);
      (closeButton ?? panel)?.focus();
    } else if (!open && wasOpen.current) {
      const active = document.activeElement;
      // Restore only if focus was in the panel (or was dropped to <body> when the panel went inert);
      // if the user has moved on — e.g. into the other sidebar — leave focus where it is.
      const focusWasInPanel = !active || active === document.body || (panel?.contains(active) ?? false);
      const opener = openerRef?.current;
      if (focusWasInPanel && opener?.isConnected) {
        opener.focus();
      } else if (focusWasInPanel && active instanceof HTMLElement && active !== document.body) {
        // The opener is gone (EC-006): drop focus to <body> rather than leave it in a closed panel.
        active.blur();
      }
    }
    wasOpen.current = open;
  }, [open, openerRef, focusOnOpen]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    // DOM containment excludes portalled content (dialogs, menus) whose events bubble through React.
    if (event.key === 'Escape' && panelRef.current?.contains(event.target as Node)) {
      onClose();
    }
  }

  return (
    <>
      {open ? (
        <div
          data-scrim
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-x-0 top-14 bottom-0 z-20 bg-base/60 animate-in fade-in-0 md:hidden motion-reduce:animate-none"
        />
      ) : null}
      <aside
        ref={panelRef}
        id={id}
        role="complementary"
        aria-label={label}
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        data-state={open ? 'open' : 'closed'}
        data-side={side}
        onKeyDown={handleKeyDown}
        className={cn(
          'fixed top-14 bottom-0 z-30 flex w-[85vw] max-w-80 flex-col bg-base/95 outline-none',
          'motion-reduce:transition-none motion-reduce:duration-0',
          side === 'left' ? 'left-0 border-r border-surface-border' : 'right-0 border-l border-surface-border',
          open
            ? 'visible translate-x-0 shadow-xl [transition:transform_200ms_ease-out,visibility_0s]'
            : cn(
                // `shadow-none` still composes transparent shadow layers; `[box-shadow:none]` paints nothing at all (EC-001).
                'invisible shadow-none [box-shadow:none] [transition:transform_200ms_ease-out,visibility_0s_200ms]',
                side === 'left' ? '-translate-x-full' : 'translate-x-full',
              ),
          className,
        )}
      >
        {children}
      </aside>
    </>
  );
}
