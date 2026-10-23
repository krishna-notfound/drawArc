'use client';

// Structure only; F01 applies design tokens.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof globalThis.Error && 'digest' in error ? String(error.digest) : undefined;

  return (
    <main>
      <h1>Something went wrong</h1>
      {digest ? <p>Reference: {digest}</p> : null}
      <button type="button" onClick={() => retry()}>
        Try again
      </button>
    </main>
  );
}
