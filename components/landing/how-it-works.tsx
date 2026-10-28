import { LANDING_COPY } from './copy';

export function HowItWorks(): React.JSX.Element {
  return (
    <section aria-labelledby="steps-heading" className="py-16">
      <h2 id="steps-heading" className="text-2xl font-semibold text-copy-primary">
        {LANDING_COPY.stepsHeading}
      </h2>
      <ol className="mt-8 grid gap-6 md:grid-cols-3">
        {LANDING_COPY.steps.map((step, index) => (
          <li key={step.title}>
            <span aria-hidden="true" className="font-mono text-sm text-brand">
              0{index + 1}
            </span>
            <h3 className="mt-2 font-semibold text-copy-primary">{step.title}</h3>
            <p className="mt-1 text-sm text-copy-secondary">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
