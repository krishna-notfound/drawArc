'use client';

import { type ReactNode } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';

// F02 nests this inside ClerkProvider.
export function Providers({ children }: { children: ReactNode }) {
  return <TooltipProvider delayDuration={300}>{children}</TooltipProvider>;
}
