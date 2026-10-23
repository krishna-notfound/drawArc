import { Children, isValidElement, type ReactElement } from 'react';
import { expect, it } from 'vitest';

import GlobalError from '@/app/global-error';

it('renders its own html and body (F00 AC-024)', () => {
  const element = GlobalError({ error: new Error('x'), retry: () => {} }) as ReactElement<{ children?: unknown }>;
  expect(element.type).toBe('html');
  const children = Children.toArray(element.props.children as never);
  expect(children.some((child) => isValidElement(child) && child.type === 'body')).toBe(true);
});
