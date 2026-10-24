'use client';

import { ErrorCard } from '@/components/errors/error-card';

// Unexpected gate failures (e.g. the database is unreachable, EC-014). The server already logged the error
// with its digest, so nothing is logged here; the server message is never shown (FR-015).
export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex h-dvh flex-col items-center justify-center bg-base p-6 text-copy-primary">
      <ErrorCard title="Something went wrong loading this project." error={error} retry={retry} />
    </main>
  );
}
