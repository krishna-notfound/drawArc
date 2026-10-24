const FEATURES = [
  'Node-and-edge architecture diagrams with live cursors',
  'Invite teammates by email as editors or viewers',
  'Autosaved projects you can reopen anywhere',
];

// Two panels from 1024px (product intro + Clerk form), form only below. Text only: no images, cards, gradients.
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-1">
      <section
        aria-labelledby="auth-wordmark"
        className="hidden flex-1 flex-col justify-center gap-6 border-r border-surface-border px-16 lg:flex"
      >
        <h1 id="auth-wordmark" className="text-4xl font-semibold tracking-tight text-copy-primary">
          drawArc
        </h1>
        <p className="max-w-md text-lg text-copy-secondary">Real-time collaborative system-design canvas.</p>
        <ul className="flex max-w-md flex-col gap-3 text-sm text-copy-secondary">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              {feature}
            </li>
          ))}
        </ul>
      </section>
      <main className="flex flex-1 items-center justify-center px-4 py-8">{children}</main>
    </div>
  );
}
