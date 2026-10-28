import type { Metadata } from 'next';

import { FeatureGrid } from '@/components/landing/feature-grid';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingHeader } from '@/components/landing/landing-header';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

const TITLE = 'drawArc — Collaborative system-design canvas and whiteboard';

// Static metadata (not `generateMetadata`) so `/` stays prerendered and crawlers see it without streaming.
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: SITE_DESCRIPTION,
  openGraph: { type: 'website', siteName: SITE_NAME, url: '/', title: TITLE, description: SITE_DESCRIPTION },
  twitter: { card: 'summary_large_image', title: TITLE, description: SITE_DESCRIPTION },
};

// Prerendered for every visitor: no request-time API here. The session-aware CTA is a client island (`SessionCta`).
export default function Home(): React.JSX.Element {
  return (
    <>
      <LandingHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-8">
        <Hero />
        <FeatureGrid />
        <HowItWorks />
      </main>
      <LandingFooter />
    </>
  );
}
