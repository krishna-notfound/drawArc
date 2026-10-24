import Link from 'next/link';

import { Button } from '@/components/ui/button';

// Unmatched URLs and root-level notFound() (F15 FR-008).
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-base p-6 text-center text-copy-primary">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Button asChild className="focus-visible:ring-2 focus-visible:ring-brand">
        <Link href="/editor">Back to projects</Link>
      </Button>
    </main>
  );
}
