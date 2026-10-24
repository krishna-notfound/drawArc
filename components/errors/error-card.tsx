'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';

/**
 * The user-visible reference for a caught error: Next forwards server errors as a generic `Error` with
 * `digest` (matching the server log line); a client-thrown value has none. Never the message (F15 copy rule).
 */
export function errorReference(error: unknown): string | undefined {
  if (!(error instanceof Error) || !('digest' in error)) return undefined;
  const digest = (error as Error & { digest?: unknown }).digest;
  return typeof digest === 'string' || typeof digest === 'number' ? String(digest) : undefined;
}

interface ErrorCardProps {
  title: string;
  error: unknown;
  retry: () => void;
}

/**
 * Shared recoverable error card (F15 FR-008): heading (focused on mount so screen readers announce it; the
 * next Tab lands on Retry), the reference, Retry, and "Back to projects". No stack, env name or path.
 */
export function ErrorCard({ title, error, retry }: ErrorCardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reference = errorReference(error);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="w-full max-w-md rounded-3xl border border-surface-border bg-surface p-8 text-center">
      <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
        {title}
      </h1>
      <p className="mt-3 text-sm text-copy-secondary">
        The error has been recorded.
        {reference ? (
          <>
            {' '}
            <span className="font-mono text-copy-muted">Reference: {reference}</span>
          </>
        ) : null}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button type="button" className="focus-visible:ring-2 focus-visible:ring-brand" onClick={() => retry()}>
          Retry
        </Button>
        <Button asChild variant="outline" className="focus-visible:ring-2 focus-visible:ring-brand">
          <Link href="/editor">Back to projects</Link>
        </Button>
      </div>
    </section>
  );
}
