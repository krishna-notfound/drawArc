'use client';

import { type ReactNode } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

// Client-side providers; rendered inside ClerkProvider (app/layout.tsx). drawArc is dark-only (D-016), so the
// toaster's theme is fixed rather than read from next-themes.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      {children}
      <Toaster theme="dark" />
    </TooltipProvider>
  );
}
