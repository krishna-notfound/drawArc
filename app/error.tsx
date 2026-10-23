'use client';

import { Button } from '@/components/ui/button';

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof globalThis.Error && 'digest' in error ? String(error.digest) : undefined;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-base p-6 text-center text-copy-primary">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      {digest ? <p className="font-mono text-sm text-copy-secondary">Reference: {digest}</p> : null}
      <Button type="button" className="focus-visible:ring-2 focus-visible:ring-brand" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
