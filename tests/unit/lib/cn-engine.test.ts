import { cn as shadcnCn } from 'cn';
import { expect, it } from 'vitest';

import { cn } from '@/lib/utils';

it('lib/utils re-exports the `cn` package so one class-merge engine ships (D-041)', () => {
  expect(cn).toBe(shadcnCn);
});
