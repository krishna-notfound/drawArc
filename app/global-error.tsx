'use client';

// global-error replaces the root layout, so it must load the stylesheet itself.
import './globals.css';

import { ErrorCard } from '@/components/errors/error-card';

// Replaces the root layout when it fails (EC-007), so it renders its own <html> and <body> and depends on
// nothing the layout provides (fonts, providers, Clerk).
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-base text-copy-primary">
        <main className="flex flex-1 flex-col items-center justify-center p-6">
          <ErrorCard title="Something went wrong" error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
