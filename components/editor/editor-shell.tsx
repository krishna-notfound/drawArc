'use client';

import { type ReactNode, useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { AiSidebar } from '@/components/ai/ai-sidebar';
import { type EditorChrome, EditorChromeContext } from '@/components/editor/editor-chrome';
import { EditorNavbar } from '@/components/editor/editor-navbar';
import { ProjectSidebar, type ProjectSidebarProps } from '@/components/editor/project-sidebar';

export { type EditorChrome, useEditorChrome } from '@/components/editor/editor-chrome';

export interface EditorShellProps {
  navbarCenter?: ReactNode;
  navbarRight?: ReactNode;
  sidebar?: Pick<ProjectSidebarProps, 'onNewProject' | 'myProjects' | 'shared' | 'lists'>;
  /** F04: the project sidebar starts open at >= 1024 px until the user toggles it (overrides D-F01-4). */
  openSidebarOnDesktop?: boolean;
  /** Content for AiSidebar; the panel is mounted only when defined. */
  aiSidebar?: ReactNode;
  children: ReactNode;
}

// Below Tailwind's `md` breakpoint (48rem) only one panel may be open at a time (EC-012).
function isBelowMd(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767.98px)').matches;
}

const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribeDesktop(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function isDesktop(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_QUERY).matches;
}

export function EditorShell({
  navbarCenter,
  navbarRight,
  sidebar,
  openSidebarOnDesktop = false,
  aiSidebar,
  children,
}: EditorShellProps) {
  // SSR and the first client render are closed on every viewport (no hydration branch). With
  // `openSidebarOnDesktop` the desktop default is derived from the media query until the user chooses.
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => false);
  const [sidebarChoice, setSidebarChoice] = useState<boolean | null>(null);
  const sidebarOpen = sidebarChoice ?? (openSidebarOnDesktop && desktop);
  const setSidebarOpen = useCallback((open: boolean) => setSidebarChoice(open), []);
  const [aiOpen, setAiOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const aiOpenerRef = useRef<HTMLElement | null>(null);

  const toggleSidebar = useCallback(() => {
    const next = !sidebarOpen;
    setSidebarChoice(next);
    if (next && isBelowMd()) setAiOpen(false);
  }, [sidebarOpen]);

  const toggleAi = useCallback(() => {
    const next = !aiOpen;
    if (next) aiOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAiOpen(next);
    if (next && isBelowMd()) setSidebarChoice(false);
  }, [aiOpen]);

  const chrome = useMemo<EditorChrome>(
    () => ({ sidebarOpen, toggleSidebar, setSidebarOpen, aiOpen, toggleAi, setAiOpen }),
    [sidebarOpen, toggleSidebar, setSidebarOpen, aiOpen, toggleAi],
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
      <ProjectSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        openerRef={toggleRef}
        // The default desktop open must not pull focus into the panel on page load.
        focusOnOpen={sidebarChoice !== null}
        {...sidebar}
      />
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
