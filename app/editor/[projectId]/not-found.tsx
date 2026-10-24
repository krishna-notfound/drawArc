import Link from 'next/link';

import { Button } from '@/components/ui/button';

// notFound() from routes nested under a project (F15 FR-008). Missing or foreign projects never land here: the
// workspace gate renders AccessDenied for both (F04), so this page cannot reveal whether a project exists.
export default function ProjectNotFound() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-base p-6 text-center text-copy-primary">
      <h1 className="text-xl font-semibold">Project not found</h1>
      <Button asChild className="focus-visible:ring-2 focus-visible:ring-brand">
        <Link href="/editor">Back to projects</Link>
      </Button>
    </main>
  );
}
