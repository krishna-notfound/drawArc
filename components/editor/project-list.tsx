'use client';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';

import { isBelowLg, useOptionalEditorChrome } from '@/components/editor/editor-chrome';
import { type ProjectDialogsApi, useOptionalProjectDialogs } from '@/components/editor/project-dialogs-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ProjectListItem } from '@/lib/projects/queries';
import { cn } from '@/lib/utils';

export interface ProjectListProps {
  items: ProjectListItem[];
  currentProjectId?: string;
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function relativeTime(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

/** Owner-only actions menu; Rename/Delete dialogs return focus to this trigger (FR-016). */
function RowActions({ project, dialogs }: { project: ProjectListItem; dialogs: ProjectDialogsApi }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              ref={triggerRef}
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Project actions"
              className="shrink-0 focus-visible:ring-2 focus-visible:ring-brand [&_svg:not([class*='size-'])]:size-5"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Project actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => dialogs.openRename(project, triggerRef.current)}>
          <Pencil aria-hidden="true" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => dialogs.openDelete(project, triggerRef.current)}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Sidebar rows (FR-002, FR-003). Only owned rows get the actions menu; shared rows render none at all. */
export function ProjectList({ items, currentProjectId }: ProjectListProps) {
  const chrome = useOptionalEditorChrome();
  const dialogs = useOptionalProjectDialogs();

  return (
    <ul className="flex flex-col gap-1 py-2">
      {items.map((project) => {
        const current = project.id === currentProjectId;
        return (
          <li
            key={project.id}
            data-project-id={project.id}
            className={cn(
              'group flex items-center gap-1 rounded-xl pr-1 hover:bg-subtle',
              current && 'bg-subtle ring-1 ring-surface-border',
            )}
          >
            <Link
              href={`/editor/${project.id}`}
              prefetch={true}
              aria-current={current ? 'page' : undefined}
              onClick={() => {
                if (isBelowLg()) chrome?.setSidebarOpen(false);
              }}
              className="flex min-w-0 flex-1 flex-col rounded-xl px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className="truncate text-sm font-medium text-copy-primary" title={project.name}>
                {project.name}
              </span>
              <span className="truncate text-xs text-copy-secondary">
                {project.role !== 'owner' && project.ownerName ? `${project.ownerName} · ` : null}
                <time dateTime={project.updatedAt} suppressHydrationWarning>
                  {relativeTime(project.updatedAt)}
                </time>
              </span>
            </Link>
            {project.role === 'owner' && dialogs ? <RowActions project={project} dialogs={dialogs} /> : null}
          </li>
        );
      })}
    </ul>
  );
}
