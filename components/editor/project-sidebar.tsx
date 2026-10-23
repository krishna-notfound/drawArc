'use client';

import { FolderOpen, Plus, Users, X } from 'lucide-react';
import { type ReactNode, type RefObject } from 'react';

import { EmptyState } from '@/components/editor/empty-state';
import { IconButton } from '@/components/editor/icon-button';
import { SidebarPanel } from '@/components/editor/sidebar-panel';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface ProjectSidebarProps {
  open: boolean;
  onClose: () => void;
  openerRef?: RefObject<HTMLElement | null>;
  /** Absent → the New Project button is aria-disabled with a sign-in tooltip (EC-007). */
  onNewProject?: () => void;
  /** F04 supplies the lists; undefined → empty state. */
  myProjects?: ReactNode;
  shared?: ReactNode;
}

// shadcn's inactive trigger uses the muted token (≈4.3:1 on bg-subtle); secondary text keeps it ≥ 4.5:1.
const TRIGGER_CLASS = 'dark:text-copy-secondary focus-visible:ring-2 focus-visible:ring-brand';
const NEW_PROJECT_CLASS = "w-full focus-visible:ring-2 focus-visible:ring-brand [&_svg:not([class*='size-'])]:size-5";

export function ProjectSidebar({ open, onClose, openerRef, onNewProject, myProjects, shared }: ProjectSidebarProps) {
  return (
    <SidebarPanel id="project-sidebar" side="left" open={open} onClose={onClose} label="Projects" openerRef={openerRef}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-surface-border pr-2 pl-4">
        <h2 className="text-sm font-semibold">Projects</h2>
        <IconButton label="Close projects sidebar" onClick={onClose} data-sidebar-close>
          <X className="h-5 w-5" />
        </IconButton>
      </div>

      <Tabs defaultValue="my-projects" className="flex min-h-0 flex-1 flex-col px-3 pt-3">
        <TabsList className="w-full">
          <TabsTrigger value="my-projects" className={TRIGGER_CLASS}>
            My Projects
          </TabsTrigger>
          <TabsTrigger value="shared" className={TRIGGER_CLASS}>
            Shared with me
          </TabsTrigger>
        </TabsList>
        <TabsContent value="my-projects" className="min-h-0">
          <ScrollArea className="h-full">
            {myProjects ?? (
              <EmptyState
                as="h3"
                icon={FolderOpen}
                title="No projects yet"
                description="Create your first project to get started."
              />
            )}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="shared" className="min-h-0">
          <ScrollArea className="h-full">
            {shared ?? (
              <EmptyState
                as="h3"
                icon={Users}
                title="Nothing shared with you yet"
                description="Projects others share with you will appear here."
              />
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <div className="shrink-0 border-t border-surface-border p-3">
        {onNewProject ? (
          <Button type="button" className={NEW_PROJECT_CLASS} onClick={onNewProject}>
            <Plus className="h-5 w-5" />
            New Project
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* aria-disabled, not `disabled`: it stays focusable and keeps pointer events, so the tooltip works. */}
              <Button
                type="button"
                aria-disabled="true"
                className={`${NEW_PROJECT_CLASS} cursor-not-allowed opacity-50`}
              >
                <Plus className="h-5 w-5" />
                New Project
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sign in to create a project</TooltipContent>
          </Tooltip>
        )}
      </div>
    </SidebarPanel>
  );
}
