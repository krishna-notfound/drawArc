'use client';

import { ErrorCard } from '@/components/errors/error-card';

// Root segment boundary (F15 FR-008): uncaught render errors below the root layout. The server already logged
// the error with its digest, which the card shows as the reference.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-base p-6 text-copy-primary">
      <ErrorCard title="Something went wrong" error={error} retry={retry} />
    </main>
  );
}
