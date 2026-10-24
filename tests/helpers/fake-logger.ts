import { vi } from 'vitest';

import type { Logger } from '@/lib/logger';

export function createFakeLogger() {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger satisfies Logger;
}
