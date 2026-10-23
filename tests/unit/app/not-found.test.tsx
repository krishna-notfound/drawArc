import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import NotFound from '@/app/not-found';

it('has a heading and a link home (F00 AC-025)', () => {
  render(<NotFound />);
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to drawArc home' })).toHaveAttribute('href', '/');
});
