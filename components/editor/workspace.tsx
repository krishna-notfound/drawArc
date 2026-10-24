'use client';

import { Sparkles } from 'lucide-react';

import { CanvasPlaceholder } from '@/components/canvas/canvas-placeholder';
import { SeedWarningBanner } from '@/components/canvas/seed-warning-banner';
import { useEditorChrome } from '@/components/editor/editor-chrome';
import { EditorShell } from '@/components/editor/editor-shell';
import { IconButton } from '@/components/editor/icon-button';
import { ProjectDialogsHost } from '@/components/editor/project-dialogs';
import { SaveButton } from '@/components/editor/save-button';
import { NO_SEED, SaveProvider } from '@/components/editor/save-context';
import { UserMenu } from '@/components/editor/user-menu';
import { Badge } from '@/components/ui/badge';
import type { WorkspaceProps } from '@/components/editor/workspace-props';
import { ProjectDialogsProvider } from '@/hooks/useProjectDialogs';

export type { WorkspaceProps } from '@/components/editor/workspace-props';

function AiToggle() {
  const { aiOpen, toggleAi } = useEditorChrome();
  return (
    <IconButton label="Toggle AI sidebar" aria-expanded={aiOpen} aria-controls="ai-sidebar" onClick={toggleAi}>
      <Sparkles className="h-5 w-5" />
    </IconButton>
  );
}

function ProjectTitle({ name, archived }: { name: string; archived: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="min-w-0 truncate text-sm font-medium" title={name} data-slot="project-name">
        {name}
      </h1>
      {archived ? (
        <Badge variant="outline" className="shrink-0">
          Archived
        </Badge>
      ) : null}
    </div>
  );
}

/** The full-viewport workspace layout (FR-013), composed from F01's EditorShell. Slots: see WorkspaceProps (D-028). */
export function Workspace({
  project,
  role,
  seed = NO_SEED,
  sidebar,
  canvas,
  shareSlot,
  importSlot,
  saveStatusSlot,
  presenceSlot,
  aiSidebar,
}: WorkspaceProps) {
  return (
    <ProjectDialogsProvider currentProjectId={project.id}>
      {/* F13: the canvas island's autosave and the navbar Save button share this provider. */}
      <SaveProvider initial={seed} role={role}>
        <EditorShell
          openSidebarOnDesktop
          navbarCenter={<ProjectTitle name={project.name} archived={project.status === 'ARCHIVED'} />}
          navbarRight={
            <>
              {saveStatusSlot ?? <SaveButton />}
              {importSlot ?? null}
              {shareSlot ?? null}
              <AiToggle />
              <div data-slot="presence" className="flex items-center">
                {presenceSlot ?? <UserMenu />}
              </div>
            </>
          }
          sidebar={{ lists: sidebar }}
          aiSidebar={aiSidebar ?? null}
        >
          <SeedWarningBanner warning={seed.warning} />
          {canvas ?? <CanvasPlaceholder projectId={project.id} />}
        </EditorShell>
      </SaveProvider>
      <ProjectDialogsHost />
    </ProjectDialogsProvider>
  );
}
