import { readFileSync } from 'node:fs';

import { Children, isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import GlobalError from '@/app/global-error';

it('renders its own html and body (F00 AC-024)', () => {
  const element = GlobalError({ error: new Error('x'), retry: () => {} }) as ReactElement<{ children?: unknown }>;
  expect(element.type).toBe('html');
  const children = Children.toArray(element.props.children as never);
  expect(children.some((child) => isValidElement(child) && child.type === 'body')).toBe(true);
});

it('loads the global stylesheet and uses tokens and a shadcn Button (F01 AC-024)', () => {
  expect(readFileSync('app/global-error.tsx', 'utf8')).toMatch(/import ['"]\.\/globals\.css['"]/);
  const markup = renderToStaticMarkup(<GlobalError error={new Error('x')} retry={() => {}} />);
  expect(markup).toContain('drawArc could not load');
  expect(markup).toMatch(/<body[^>]*class="[^"]*\bbg-base\b[^"]*\btext-copy-primary\b/);
  expect(markup).toMatch(/<button[^>]*class="[^"]*\binline-flex\b[^"]*"[^>]*>Reload<\/button>/);
});
