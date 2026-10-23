import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom lacks ResizeObserver; Radix primitives (ScrollArea, Tooltip, Popper) construct one on mount.
if (typeof window !== 'undefined' && typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Syntactically valid placeholders for the keys F02 made required, so L1 never needs real secrets.
// Real values (e.g. in a shell) win; nothing here is ever sent anywhere.
const PLACEHOLDER_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://placeholder:placeholder@localhost:5432/drawarc_placeholder',
  DATABASE_URL_UNPOOLED: 'postgresql://placeholder:placeholder@localhost:5432/drawarc_placeholder',
  CLERK_SECRET_KEY: 'sk_test_placeholder',
  CLERK_WEBHOOK_SIGNING_SECRET: 'whsec_cGxhY2Vob2xkZXItd2ViaG9vay1zZWNyZXQ=',
  // base64("placeholder.clerk.accounts.dev$"): the shape Clerk parses publishable keys from.
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_cGxhY2Vob2xkZXIuY2xlcmsuYWNjb3VudHMuZGV2JA',
};
for (const [key, value] of Object.entries(PLACEHOLDER_ENV)) {
  if (!process.env[key]) process.env[key] = value;
}

afterEach(() => {
  cleanup();
});
