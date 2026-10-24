import { Lock } from 'lucide-react';
import Link from 'next/link';

/**
 * The one page a signed-in visitor sees for a malformed id, a missing project, or a project they are not a
 * member of (FR-011, FR-012). It takes no props, so all three render identical HTML — no existence oracle.
 */
export function AccessDenied() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <Lock className="h-8 w-8 text-copy-muted" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-copy-primary">You can&apos;t open this project</h1>
      <p className="max-w-sm text-sm text-copy-secondary">
        It may not exist, or you haven&apos;t been invited. Ask the owner to share it with you.
      </p>
      <Link
        href="/editor"
        className="mt-2 rounded-md text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
      >
        Back to projects
      </Link>
    </main>
  );
}
