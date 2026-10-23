import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorShell, useEditorChrome } from '@/components/editor/editor-shell';
import { TooltipProvider } from '@/components/ui/tooltip';

// The root layout's Providers supplies TooltipProvider in the app.
function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: TooltipProvider });
}

function mockViewport(width: number) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const max = /max-width:\s*([\d.]+)px/.exec(query);
      return {
        matches: max ? width <= Number(max[1]) : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
  );
}

function AiToggle() {
  const { aiOpen, toggleAi } = useEditorChrome();
  return (
    <button type="button" onClick={toggleAi}>
      {aiOpen ? 'Hide AI' : 'Show AI'}
    </button>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EditorShell (AC-020, FR-014)', () => {
  it('renders navbar, a closed project sidebar, no AI sidebar, and children in main', () => {
    mockViewport(1280);
    render(
      <EditorShell>
        <p>Page content</p>
      </EditorShell>,
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(document.getElementById('project-sidebar')).toHaveAttribute('data-state', 'closed');
    expect(document.getElementById('ai-sidebar')).toBeNull();
    const main = screen.getByRole('main');
    expect(main).toHaveClass('relative', 'pt-14', 'min-h-dvh');
    expect(main).toHaveTextContent('Page content');
  });

  it('opens the project sidebar from the navbar toggle', async () => {
    mockViewport(1280);
    render(
      <EditorShell>
        <p>Page</p>
      </EditorShell>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open projects sidebar' }));
    expect(document.getElementById('project-sidebar')).toHaveAttribute('data-state', 'open');
    expect(screen.getByRole('button', { name: 'Close projects sidebar', expanded: true })).toBeInTheDocument();
  });

  it('mounts the AI sidebar only when aiSidebar is provided, closed, and toggleAi opens it', async () => {
    mockViewport(1280);
    render(
      <EditorShell aiSidebar={<p>AI body</p>}>
        <AiToggle />
      </EditorShell>,
    );
    const ai = document.getElementById('ai-sidebar');
    expect(ai).toHaveAttribute('data-state', 'closed');
    await userEvent.click(screen.getByRole('button', { name: 'Show AI' }));
    expect(ai).toHaveAttribute('data-state', 'open');
    expect(screen.getByText('AI body')).toBeInTheDocument();
  });

  it('keeps both panels open on desktop', async () => {
    mockViewport(1280);
    render(
      <EditorShell aiSidebar={<p>AI body</p>}>
        <AiToggle />
      </EditorShell>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open projects sidebar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show AI' }));
    expect(document.getElementById('project-sidebar')).toHaveAttribute('data-state', 'open');
    expect(document.getElementById('ai-sidebar')).toHaveAttribute('data-state', 'open');
  });

  it('on mobile, opening one panel closes the other (EC-012)', async () => {
    mockViewport(390);
    render(
      <EditorShell aiSidebar={<p>AI body</p>}>
        <AiToggle />
      </EditorShell>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open projects sidebar' }));
    expect(document.getElementById('project-sidebar')).toHaveAttribute('data-state', 'open');
    await userEvent.click(screen.getByRole('button', { name: 'Show AI', hidden: true }));
    expect(document.getElementById('ai-sidebar')).toHaveAttribute('data-state', 'open');
    expect(document.getElementById('project-sidebar')).toHaveAttribute('data-state', 'closed');
    await userEvent.click(screen.getByRole('button', { name: 'Open projects sidebar' }));
    expect(document.getElementById('project-sidebar')).toHaveAttribute('data-state', 'open');
    expect(document.getElementById('ai-sidebar')).toHaveAttribute('data-state', 'closed');
  });

  it('passes navbar slots and sidebar props through', () => {
    mockViewport(1280);
    render(
      <EditorShell navbarCenter="My diagram" navbarRight={<span>User</span>} sidebar={{ onNewProject: () => {} }}>
        <p>Page</p>
      </EditorShell>,
    );
    expect(screen.getByText('My diagram')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Project', hidden: true })).toBeEnabled();
  });

  it('useEditorChrome throws outside EditorShell', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<AiToggle />)).toThrow(/EditorShell/);
  });
});
