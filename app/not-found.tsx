import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-base p-6 text-center text-copy-primary">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Button asChild className="focus-visible:ring-2 focus-visible:ring-brand">
        <Link href="/">Go to drawArc home</Link>
      </Button>
    </main>
  );
}
