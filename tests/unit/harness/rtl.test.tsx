import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

it('renders with jest-dom matchers under jsdom (F00 AC-008)', () => {
  render(<button type="button">Hello</button>);
  expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument();
});
