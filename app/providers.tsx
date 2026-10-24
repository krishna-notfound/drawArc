'use client';

import { type ReactNode } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';

// Client-side providers; rendered inside ClerkProvider (app/layout.tsx).
export function Providers({ children }: { children: ReactNode }) {
  return <TooltipProvider delayDuration={300}>{children}</TooltipProvider>;
}
