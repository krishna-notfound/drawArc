import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RecentlyDeletedScreen } from '@/components/auth/recently-deleted-screen';

describe('RecentlyDeletedScreen (FR-018, AC-035)', () => {
  it('explains the hold and names the date the email becomes available again', () => {
    render(<RecentlyDeletedScreen availableAt={new Date('2026-11-08T14:30:00.000Z')} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'This email belonged to an account deleted recently',
    );
    expect(screen.getByText(/you can sign up again with it on/i)).toHaveTextContent(
      'You can sign up again with it on November 8, 2026 at 14:30 UTC.',
    );
  });
});
