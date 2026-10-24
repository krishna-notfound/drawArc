import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import ErrorPage from '@/app/error';

it('shows the digest, hides the raw message, focuses the heading, and retries (F00 AC-023, F15 FR-008)', () => {
  const retry = vi.fn();
  render(<ErrorPage error={Object.assign(new Error('secret detail'), { digest: 'abc123' })} retry={retry} />);
  const heading = screen.getByRole('heading', { name: 'Something went wrong' });
  expect(heading).toHaveFocus();
  expect(screen.getByText('Reference: abc123')).toHaveClass('font-mono');
  expect(screen.queryByText(/secret detail/)).toBeNull();
  expect(screen.getByRole('link', { name: 'Back to projects' })).toHaveAttribute('href', '/editor');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('omits the reference when the thrown value has no digest', () => {
  render(<ErrorPage error="not an Error" retry={() => {}} />);
  expect(screen.queryByText(/Reference:/)).toBeNull();
});

it('styles the retry action as a shadcn Button with tokens (F01 AC-024)', () => {
  render(<ErrorPage error={new Error('x')} retry={() => {}} />);
  expect(screen.getByRole('button', { name: 'Retry' })).toHaveClass('inline-flex');
  expect(screen.getByRole('main')).toHaveClass('bg-base', 'text-copy-primary');
});
