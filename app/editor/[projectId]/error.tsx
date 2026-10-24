'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

// Unexpected gate failures (e.g. the database is unreachable, EC-014). The server already logged the error
// with its digest, so nothing is logged here; the server message is never shown (FR-015).
export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof globalThis.Error && 'digest' in error ? String(error.digest) : undefined;

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-base p-6 text-center text-copy-primary">
      <h1 className="text-xl font-semibold">Something went wrong loading this project.</h1>
      {digest ? <p className="font-mono text-sm text-copy-secondary">Reference: {digest}</p> : null}
      <div className="flex gap-2">
        <Button type="button" className="focus-visible:ring-2 focus-visible:ring-brand" onClick={() => retry()}>
          Try again
        </Button>
        <Button asChild variant="outline" className="focus-visible:ring-2 focus-visible:ring-brand">
          <Link href="/editor">Back to projects</Link>
        </Button>
      </div>
    </main>
  );
}
