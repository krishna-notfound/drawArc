import { dark } from '@clerk/ui/themes';

// Clerk components follow the drawArc tokens from app/globals.css; no colour literals here (ui-context).
// Variable names are Clerk 7.9 (Core 3) `Variables`; Clerk derives its shades from CSS variables itself.
export const clerkAppearance = {
  theme: dark,
  variables: {
    colorPrimary: 'var(--accent-primary)',
    colorPrimaryForeground: 'var(--bg-base)',
    colorBackground: 'var(--bg-surface)',
    colorForeground: 'var(--text-primary)',
    colorMutedForeground: 'var(--text-secondary)',
    colorMuted: 'var(--bg-subtle)',
    colorInput: 'var(--bg-elevated)',
    colorInputForeground: 'var(--text-primary)',
    colorBorder: 'var(--border-default)',
    colorNeutral: 'var(--text-muted)',
    colorDanger: 'var(--state-error)',
    colorSuccess: 'var(--state-success)',
    colorWarning: 'var(--state-warning)',
    borderRadius: '0.75rem',
    fontFamily: 'var(--font-geist-sans)',
  },
} as const;
