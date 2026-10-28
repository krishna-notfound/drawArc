import { LANDING_COPY } from './copy';
import { HeroIllustration } from './hero-illustration';
import { SessionCta } from './session-cta';

export function Hero(): React.JSX.Element {
  return (
    <section className="grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-copy-primary sm:text-5xl">
          {LANDING_COPY.headline}
        </h1>
        <p className="mt-4 max-w-prose text-lg text-copy-secondary">{LANDING_COPY.subline}</p>
        <div className="mt-8">
          <SessionCta variant="hero" />
        </div>
      </div>
      <HeroIllustration />
    </section>
  );
}
