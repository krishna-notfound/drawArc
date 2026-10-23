'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { type ReactNode, type RefObject } from 'react';

import { IconButton } from '@/components/editor/icon-button';

export interface EditorNavbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  toggleRef?: RefObject<HTMLButtonElement | null>;
  /** Defaults to the product name; plain strings truncate and expose a title. */
  center?: ReactNode;
  right?: ReactNode;
}

export function EditorNavbar({ sidebarOpen, onToggleSidebar, toggleRef, center = 'drawArc', right }: EditorNavbarProps) {
  const label = sidebarOpen ? 'Close projects sidebar' : 'Open projects sidebar';
  const Icon = sidebarOpen ? PanelLeftClose : PanelLeftOpen;

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-surface-border bg-base/95 px-2 backdrop-blur">
      <div className="flex flex-1 items-center">
        <IconButton
          ref={toggleRef}
          label={label}
          aria-expanded={sidebarOpen}
          aria-controls="project-sidebar"
          onClick={onToggleSidebar}
        >
          <Icon className="h-5 w-5" />
        </IconButton>
      </div>
      <div className="flex min-w-0 max-w-[60%] justify-center">
        {typeof center === 'string' ? (
          <span className="min-w-0 truncate font-medium" title={center}>
            {center}
          </span>
        ) : (
          center
        )}
      </div>
      <div className="flex flex-1 items-center justify-end gap-2">{right}</div>
    </header>
  );
}
