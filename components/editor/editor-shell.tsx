'use client';

import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { AiSidebar } from '@/components/ai/ai-sidebar';
import { EditorNavbar } from '@/components/editor/editor-navbar';
import { ProjectSidebar, type ProjectSidebarProps } from '@/components/editor/project-sidebar';

export interface EditorShellProps {
  navbarCenter?: ReactNode;
  navbarRight?: ReactNode;
  sidebar?: Pick<ProjectSidebarProps, 'onNewProject' | 'myProjects' | 'shared'>;
  /** Content for AiSidebar; the panel is mounted only when defined. */
  aiSidebar?: ReactNode;
  children: ReactNode;
}

export interface EditorChrome {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  aiOpen: boolean;
  toggleAi: () => void;
}

const EditorChromeContext = createContext<EditorChrome | null>(null);

export function useEditorChrome(): EditorChrome {
  const chrome = useContext(EditorChromeContext);
  if (!chrome) throw new Error('useEditorChrome() must be used inside <EditorShell>.');
  return chrome;
}

// Below Tailwind's `md` breakpoint (48rem) only one panel may be open at a time (EC-012).
function isBelowMd(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767.98px)').matches;
}

export function EditorShell({ navbarCenter, navbarRight, sidebar, aiSidebar, children }: EditorShellProps) {
  // Both panels start closed on every viewport: deterministic SSR, no media-query hydration branch (D-F01-4).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const aiOpenerRef = useRef<HTMLElement | null>(null);

  const toggleSidebar = useCallback(() => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    if (next && isBelowMd()) setAiOpen(false);
  }, [sidebarOpen]);

  const toggleAi = useCallback(() => {
    const next = !aiOpen;
    if (next) aiOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAiOpen(next);
    if (next && isBelowMd()) setSidebarOpen(false);
  }, [aiOpen]);

  const chrome = useMemo(
    () => ({ sidebarOpen, toggleSidebar, aiOpen, toggleAi }),
    [sidebarOpen, toggleSidebar, aiOpen, toggleAi],
  );

  return (
    <EditorChromeContext.Provider value={chrome}>
      <EditorNavbar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        toggleRef={toggleRef}
        center={navbarCenter}
        right={navbarRight}
      />
      <ProjectSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} openerRef={toggleRef} {...sidebar} />
      {aiSidebar !== undefined ? (
        <AiSidebar open={aiOpen} onClose={() => setAiOpen(false)} openerRef={aiOpenerRef}>
          {aiSidebar}
        </AiSidebar>
      ) : null}
      {/* Definite height (viewport minus the navbar via pt-14) so a height:100% child such as React Flow fills it. */}
      <main className="relative h-dvh pt-14">{children}</main>
    </EditorChromeContext.Provider>
  );
}
