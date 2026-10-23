import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EditorNavbar } from '@/components/editor/editor-navbar';
import { TooltipProvider } from '@/components/ui/tooltip';

function renderNavbar(props: Partial<Parameters<typeof EditorNavbar>[0]> = {}) {
  return render(
    <TooltipProvider delayDuration={0}>
      <EditorNavbar sidebarOpen={false} onToggleSidebar={() => {}} {...props} />
    </TooltipProvider>,
  );
}

describe('EditorNavbar (AC-009)', () => {
  it('is a fixed h-14 top bar above the sidebars', () => {
    renderNavbar();
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('fixed', 'top-0', 'inset-x-0', 'h-14', 'z-40', 'bg-base/95', 'border-b', 'border-surface-border', 'backdrop-blur');
  });

  it('renders the closed toggle with PanelLeftOpen', () => {
    renderNavbar();
    const toggle = screen.getByRole('button', { name: 'Open projects sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'project-sidebar');
    expect(toggle.querySelector('svg.lucide-panel-left-open')).not.toBeNull();
  });

  it('renders the open toggle with PanelLeftClose', () => {
    renderNavbar({ sidebarOpen: true });
    const toggle = screen.getByRole('button', { name: 'Close projects sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle.querySelector('svg.lucide-panel-left-close')).not.toBeNull();
  });

  it('calls onToggleSidebar and shows a tooltip on focus', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderNavbar({ onToggleSidebar: onToggle });
    await user.tab();
    const toggle = screen.getByRole('button', { name: 'Open projects sidebar' });
    expect(toggle).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Open projects sidebar');
    await user.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('forwards toggleRef to the toggle button', () => {
    const ref = { current: null as HTMLButtonElement | null };
    renderNavbar({ toggleRef: ref });
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Open projects sidebar' }));
  });

  it('shows "drawArc" in the center by default and renders the right slot', () => {
    renderNavbar({ right: <span>Right slot</span> });
    expect(screen.getByText('drawArc')).toHaveClass('truncate');
    expect(screen.getByText('Right slot')).toBeInTheDocument();
  });

  it('truncates a long center string and exposes it as a title (EC-009)', () => {
    const long = 'x'.repeat(200);
    renderNavbar({ center: long });
    const center = screen.getByText(long);
    expect(center).toHaveClass('truncate');
    expect(center).toHaveAttribute('title', long);
  });

  it('shows a visible focus ring on the toggle (FR-020)', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: 'Open projects sidebar' })).toHaveClass(
      'focus-visible:ring-2',
      'focus-visible:ring-brand',
    );
  });
});
