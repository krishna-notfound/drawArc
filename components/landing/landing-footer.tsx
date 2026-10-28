import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

import { LANDING_COPY } from './copy';
import { FOCUS_RING } from './landing-header';

// Links sit in a `div`, not a `nav`: the header's `nav` is the page's only navigation landmark (FR-002).
export function LandingFooter(): React.JSX.Element {
  const { footer, wordmark } = LANDING_COPY;
  return (
    <footer className="border-t border-surface-border py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 sm:px-8">
        <span className="text-copy-secondary">{wordmark}</span>
        <div className="flex items-center gap-6">
          <a
            href={footer.githubHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex items-center gap-1 text-copy-secondary', FOCUS_RING)}
          >
            {footer.github}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <Link href="/sign-in" className={cn('text-copy-secondary', FOCUS_RING)}>
            {footer.signIn}
          </Link>
        </div>
      </div>
    </footer>
  );
}
