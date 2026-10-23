import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import ErrorPage from '@/app/error';

it('shows the digest, hides the raw message, and retries (F00 AC-023)', () => {
  const retry = vi.fn();
  render(<ErrorPage error={Object.assign(new Error('secret detail'), { digest: 'abc123' })} retry={retry} />);
  expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
  expect(screen.getByText('Reference: abc123')).toBeInTheDocument();
  expect(screen.queryByText(/secret detail/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('omits the reference line when the thrown value has no digest', () => {
  render(<ErrorPage error="not an Error" retry={() => {}} />);
  expect(screen.queryByText(/Reference:/)).toBeNull();
});
