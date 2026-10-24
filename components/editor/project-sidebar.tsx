'use client';

import { FolderOpen, Plus, Users, X } from 'lucide-react';
import { type ReactNode, type RefObject } from 'react';

import { EmptyState } from '@/components/editor/empty-state';
import { IconButton } from '@/components/editor/icon-button';
import { useOptionalProjectDialogs } from '@/components/editor/project-dialogs-context';
import { SidebarPanel } from '@/components/editor/sidebar-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface ProjectSidebarProps {
  open: boolean;
  onClose: () => void;
  openerRef?: RefObject<HTMLElement | null>;
  /** See SidebarPanel; false for the automatic desktop open (F04). */
  focusOnOpen?: boolean;
  /**
   * Absent → falls back to the page's ProjectDialogsProvider (F04); with neither, the New Project button is
   * aria-disabled with a sign-in tooltip (EC-007).
   */
  onNewProject?: () => void;
  /** Static list content for the default tabs; undefined → empty state. */
  myProjects?: ReactNode;
  shared?: ReactNode;
  /** F04: the whole tabs region, streamed from the server (`<ProjectSidebarData/>` in Suspense). */
  lists?: ReactNode;
}

export interface ProjectSidebarTabsProps {
  myProjects?: ReactNode;
  shared?: ReactNode;
  /** Counts shown in the tab badges once the lists are known. */
  myCount?: number;
  sharedCount?: number;
}

// shadcn's inactive trigger uses the muted token (≈4.3:1 on bg-subtle); secondary text keeps it ≥ 4.5:1.
const TRIGGER_CLASS = 'dark:text-copy-secondary focus-visible:ring-2 focus-visible:ring-brand';
const NEW_PROJECT_CLASS = "w-full focus-visible:ring-2 focus-visible:ring-brand [&_svg:not([class*='size-'])]:size-5";

function CountBadge({ count }: { count?: number }) {
  if (count === undefined) return null;
  return (
    <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 tabular-nums">
      {count}
    </Badge>
  );
}

/** "My Projects" / "Shared with me" tabs with per-tab empty copy (F01) and counts (F04). */
export function ProjectSidebarTabs({ myProjects, shared, myCount, sharedCount }: ProjectSidebarTabsProps) {
  return (
    <Tabs defaultValue="my-projects" className="flex min-h-0 flex-1 flex-col px-3 pt-3">
      <TabsList className="w-full">
        <TabsTrigger value="my-projects" className={TRIGGER_CLASS}>
          My Projects
          <CountBadge count={myCount} />
        </TabsTrigger>
        <TabsTrigger value="shared" className={TRIGGER_CLASS}>
          Shared with me
          <CountBadge count={sharedCount} />
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
  );
}

export function ProjectSidebar({
  open,
  onClose,
  openerRef,
  focusOnOpen,
  onNewProject: onNewProjectProp,
  myProjects,
  shared,
  lists,
}: ProjectSidebarProps) {
  const dialogs = useOptionalProjectDialogs();
  const onNewProject = onNewProjectProp ?? (dialogs ? () => dialogs.openCreate() : undefined);
  return (
    <SidebarPanel
      id="project-sidebar"
      side="left"
      open={open}
      onClose={onClose}
      label="Projects"
      openerRef={openerRef}
      focusOnOpen={focusOnOpen}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-surface-border pr-2 pl-4">
        <h2 className="text-sm font-semibold">Projects</h2>
        <IconButton label="Close projects sidebar" onClick={onClose} data-sidebar-close>
          <X className="h-5 w-5" />
        </IconButton>
      </div>

      {lists ?? <ProjectSidebarTabs myProjects={myProjects} shared={shared} />}

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
