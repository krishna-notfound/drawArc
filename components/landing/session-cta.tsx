'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

import { LANDING_COPY } from './copy';

export interface SessionCtaProps {
  variant: 'hero' | 'header';
}

// `transition-all` comes from the shadcn Button; Tailwind v4 keeps a 150 ms duration under `transition-none`,
// so `duration-0` is what actually zeroes the computed `transition-duration` (AC-012).
const MOTION = 'motion-reduce:transition-none motion-reduce:duration-0';

/**
 * The only client code on `/`. `useAuth()` stays `isLoaded: false` on the server and on the first client render, so
 * the prerendered HTML and hydration both carry the signed-out set; the signed-in swap happens after hydration
 * (EC-008). The `min-w-*` slots keep each button's box identical across the label swap (AC-005).
 */
export function SessionCta({ variant }: SessionCtaProps): React.JSX.Element {
  const auth = useAuth();
  const signedIn = auth.isLoaded && auth.isSignedIn;
  const { cta } = LANDING_COPY;

  if (variant === 'header') {
    return (
      <div className="flex min-h-8 items-center">
        {signedIn ? (
          <Button asChild size="sm" className={`min-w-44 ${MOTION}`}>
            <Link href="/editor">{cta.projects}</Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline" className={`min-w-44 ${MOTION}`}>
            <Link href="/sign-in">{cta.signIn}</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-11 flex-wrap gap-3">
      <Button asChild size="lg" className={`min-w-48 ${MOTION}`}>
        <Link href="/editor">{signedIn ? cta.projects : cta.open}</Link>
      </Button>
      {signedIn ? null : (
        <Button asChild size="lg" variant="outline" className={`min-w-48 ${MOTION}`}>
          <Link href="/sign-in">{cta.signIn}</Link>
        </Button>
      )}
    </div>
  );
}
