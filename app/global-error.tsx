'use client';

// global-error replaces the root layout, so it must load the stylesheet itself.
import './globals.css';

import { Button } from '@/components/ui/button';

// Replaces the root layout when it fails, so it renders its own <html> and <body>.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-base text-copy-primary">
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-semibold">drawArc could not load</h1>
          <Button type="button" className="focus-visible:ring-2 focus-visible:ring-brand" onClick={() => retry()}>
            Reload
          </Button>
        </main>
      </body>
    </html>
  );
}
