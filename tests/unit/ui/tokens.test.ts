// @vitest-environment node
import { describe, expect, it } from 'vitest';

import tokens from '../../fixtures/ui/tokens.json';
import { blockBody, declarations, normalise, readGlobalsCss } from '../../helpers/globals-css';

const css = readGlobalsCss();
const root = new Map(declarations(blockBody(css, ':root')));
const theme = new Map(declarations(blockBody(css, '@theme inline')));

describe('design tokens on :root (AC-001)', () => {
  it('lists every ui-context token (18 rows incl. D-F01-2a)', () => {
    expect(tokens).toHaveLength(18);
  });

  it.each(tokens)('$variable is $value', ({ variable, value }) => {
    expect(root.get(variable)).toBe(normalise(value));
  });
});

describe('@theme inline utility mapping (AC-002)', () => {
  const expected: Record<string, string> = {
    '--color-base': '--bg-base',
    '--color-surface': '--bg-surface',
    '--color-elevated': '--bg-elevated',
    '--color-subtle': '--bg-subtle',
    '--color-surface-border': '--border-default',
    '--color-surface-subtle': '--border-subtle',
    '--color-copy-primary': '--text-primary',
    '--color-copy-secondary': '--text-secondary',
    '--color-copy-muted': '--text-muted',
    '--color-copy-faint': '--text-faint',
    '--color-brand': '--accent-primary',
    '--color-brand-dim': '--accent-primary-dim',
    '--color-ai': '--accent-ai',
    '--color-ai-text': '--accent-ai-text',
    '--color-ai-foreground': '--accent-ai-foreground',
    '--color-error': '--state-error',
    '--color-success': '--state-success',
    '--color-warning': '--state-warning',
    '--font-sans': '--font-geist-sans',
    '--font-mono': '--font-geist-mono',
  };

  it.each(Object.entries(expected))('%s maps to var(%s)', (utility, token) => {
    expect(theme.get(utility)).toBe(`var(${token})`);
  });

  it('does not map the reserved --color-accent-text (D-037)', () => {
    expect(theme.has('--color-accent-text')).toBe(false);
  });
});

describe('shadcn variables bound to tokens (AC-006)', () => {
  const shadcnColours = [
    '--background',
    '--foreground',
    '--card',
    '--card-foreground',
    '--popover',
    '--popover-foreground',
    '--primary',
    '--primary-foreground',
    '--secondary',
    '--secondary-foreground',
    '--muted',
    '--muted-foreground',
    '--accent',
    '--accent-foreground',
    '--destructive',
    '--border',
    '--input',
    '--ring',
  ];

  it.each(shadcnColours)('%s is a var(--…) reference', (name) => {
    expect(root.get(name)).toMatch(/^var\(--[a-z0-9-]+\)$/);
  });

  it('declares --radius', () => {
    expect(root.get('--radius')).toBe('0.75rem');
  });

  it('binds the shadcn hover surface to neutral tokens, not the AI accent (D-037)', () => {
    expect(root.get('--accent')).toBe('var(--bg-subtle)');
    expect(root.get('--accent-foreground')).toBe('var(--text-primary)');
  });

  it('has no hex literal between --background and --radius', () => {
    const body = blockBody(css, ':root');
    const shadcnBlock = body.slice(body.indexOf('--background:'), body.indexOf('--radius:'));
    expect(shadcnBlock.length).toBeGreaterThan(0);
    expect(shadcnBlock).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
