'use client';

import { Bot, Sparkles, X } from 'lucide-react';
import { type ReactNode, type RefObject } from 'react';

import { EmptyState } from '@/components/editor/empty-state';
import { IconButton } from '@/components/editor/icon-button';
import { SidebarPanel } from '@/components/editor/sidebar-panel';

export interface AiSidebarProps {
  open: boolean;
  onClose: () => void;
  openerRef?: RefObject<HTMLElement | null>;
  /** F16 replaces the placeholder body. */
  children?: ReactNode;
}

export function AiSidebar({ open, onClose, openerRef, children }: AiSidebarProps) {
  return (
    <SidebarPanel id="ai-sidebar" side="right" open={open} onClose={onClose} label="AI Workspace" openerRef={openerRef}>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-surface-border pr-2 pl-4">
        <Bot className="h-5 w-5 shrink-0 text-ai-text" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">AI Workspace</h2>
          <p className="truncate text-xs text-copy-secondary">Collaborate with drawArc</p>
        </div>
        <IconButton label="Close AI sidebar" onClick={onClose} data-sidebar-close>
          <X className="h-5 w-5" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {children ?? <EmptyState as="h3" icon={Sparkles} title="The AI design agent arrives in a later release." />}
      </div>
    </SidebarPanel>
  );
}
