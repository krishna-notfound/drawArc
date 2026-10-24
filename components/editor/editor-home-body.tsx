import { LayoutDashboard } from 'lucide-react';

import { EmptyState } from '@/components/editor/empty-state';
import { NewProjectButton } from '@/components/editor/project-dialogs';

/** Editor home content (FR-001). Static apart from the client New Project button, so it is in the prerendered shell. */
export function EditorHomeBody() {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <EmptyState
        as="h1"
        icon={LayoutDashboard}
        title="Create a project or open an existing one"
        description="Start a new architecture workspace, or choose a project from the sidebar."
        action={<NewProjectButton />}
      />
    </div>
  );
}
