// Single source for every user-visible landing string; pure data (no React) so tests/e2e/landing.spec.ts can import it.
export type FeatureId = 'collaboration' | 'shapes' | 'text' | 'templates' | 'sharing' | 'ai';

interface Feature {
  readonly id: FeatureId;
  readonly title: string;
  readonly body: string;
  readonly comingSoon?: true;
}

interface Step {
  readonly title: string;
  readonly body: string;
}

const FEATURES: readonly Feature[] = [
  {
    id: 'collaboration',
    title: 'Real-time collaboration',
    body: 'Live cursors, presence and instant sync. Everyone edits the same canvas at once.',
  },
  {
    id: 'shapes',
    title: 'Shapes & connectors',
    body: 'Six shapes, resizable and colour-coded, joined by labelled connectors.',
  },
  {
    id: 'text',
    title: 'Text & labels',
    body: 'Double-click any shape or connector to write. Enter commits, Esc cancels.',
  },
  {
    id: 'templates',
    title: 'Starter templates',
    body: 'Begin from a ready-made architecture template instead of a blank canvas.',
  },
  {
    id: 'sharing',
    title: 'Sharing & roles',
    body: 'Invite teammates by email as editors or viewers. Autosave keeps every project safe.',
  },
  {
    id: 'ai',
    title: 'AI design agent',
    body: 'Describe a system in plain English and let the agent draft it on your canvas.',
    comingSoon: true,
  },
];

const STEPS: readonly Step[] = [
  { title: 'Create a project', body: 'Sign in and start a new project from the editor.' },
  { title: 'Invite your team', body: 'Share it by email with editor or viewer access.' },
  { title: 'Diagram together', body: 'Drop shapes, connect them, label them. Changes sync live.' },
];

export const LANDING_COPY = {
  wordmark: 'drawArc',
  headline: 'Design systems together, in real time.',
  subline:
    'drawArc is a real-time collaborative system-design canvas and whiteboard. Sketch architectures with shapes, connectors and text, and edit them with your team on one shared canvas.',
  cta: { open: 'Open the editor', signIn: 'Sign in', projects: 'Go to your projects' },
  featuresHeading: 'Built for system design',
  stepsHeading: 'How it works',
  comingSoon: 'Coming soon',
  features: FEATURES,
  steps: STEPS,
  footer: { github: 'GitHub', githubHref: 'https://github.com/krishna-notfound/drawArc', signIn: 'Sign in' },
} as const;
