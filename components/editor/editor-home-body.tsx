import { LayoutDashboard } from 'lucide-react';

import { EmptyState } from '@/components/editor/empty-state';

/** Editor home content (F01 placeholder, D-F01-5; F04 replaces it). Static, so it is in the prerendered shell. */
export function EditorHomeBody() {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <EmptyState
        as="h1"
        icon={LayoutDashboard}
        title="Create a project or open an existing one"
        description="Start a new architecture workspace, or choose a project from the sidebar."
      />
    </div>
  );
}
