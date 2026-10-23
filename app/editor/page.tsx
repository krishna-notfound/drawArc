import { LayoutDashboard } from 'lucide-react';

import { EditorShell } from '@/components/editor/editor-shell';
import { EmptyState } from '@/components/editor/empty-state';

// F01 placeholder (D-F01-5): F02 gates this route, F04 owns its final content.
export default function EditorHomePage() {
  return (
    <EditorShell>
      <div className="flex h-full items-center justify-center overflow-y-auto p-6">
        <EmptyState
          as="h1"
          icon={LayoutDashboard}
          title="Create a project or open an existing one"
          description="Start a new architecture workspace, or choose a project from the sidebar."
        />
      </div>
    </EditorShell>
  );
}
