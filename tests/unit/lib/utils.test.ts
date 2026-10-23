import { expect, it } from 'vitest';

import { cn } from '@/lib/utils';

it('merges and de-duplicates Tailwind classes (F00 AC-022)', () => {
  expect(cn('p-2', { hidden: false }, 'p-4')).toBe('p-4');
});
