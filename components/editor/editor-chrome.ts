'use client';

import { createContext, useContext } from 'react';

export interface EditorChrome {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  aiOpen: boolean;
  toggleAi: () => void;
  setAiOpen: (open: boolean) => void;
}

// Lives apart from EditorShell so the sidebar list (rendered inside the shell) can read it without an
// import cycle.
export const EditorChromeContext = createContext<EditorChrome | null>(null);

export function useEditorChrome(): EditorChrome {
  const chrome = useContext(EditorChromeContext);
  if (!chrome) throw new Error('useEditorChrome() must be used inside <EditorShell>.');
  return chrome;
}

/** `null` outside EditorShell (isolated component tests). */
export function useOptionalEditorChrome(): EditorChrome | null {
  return useContext(EditorChromeContext);
}

/** Below Tailwind's `lg` breakpoint the project sidebar overlays content and closes after navigation. */
export function isBelowLg(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023.98px)').matches;
}
