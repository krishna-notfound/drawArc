'use client';

// Replaces the root layout when it fails, so it renders its own <html> and <body>.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>drawArc could not load</h1>
          <button type="button" onClick={() => retry()}>
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
