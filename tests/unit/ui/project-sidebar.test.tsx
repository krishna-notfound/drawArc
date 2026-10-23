import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProjectSidebar, type ProjectSidebarProps } from '@/components/editor/project-sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

function renderSidebar(props: Partial<ProjectSidebarProps> = {}) {
  return render(
    <TooltipProvider delayDuration={0}>
      <ProjectSidebar open onClose={() => {}} {...props} />
    </TooltipProvider>,
  );
}

describe('ProjectSidebar content (AC-017)', () => {
  it('composes the left SidebarPanel with id project-sidebar and label Projects', () => {
    renderSidebar();
    const aside = screen.getByRole('complementary', { name: 'Projects' });
    expect(aside).toHaveAttribute('id', 'project-sidebar');
    expect(aside).toHaveAttribute('data-side', 'left');
  });

  it('shows the header, close button, and tabs with My Projects selected', () => {
    renderSidebar();
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close projects sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'My Projects' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Shared with me' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first project to get started.')).toBeInTheDocument();
  });

  it('switches to Shared with me with ArrowRight', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole('tab', { name: 'My Projects' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Shared with me' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Nothing shared with you yet')).toBeInTheDocument();
    expect(screen.getByText('Projects others share with you will appear here.')).toBeInTheDocument();
  });

  it('replaces the empty state with the supplied lists', async () => {
    const user = userEvent.setup();
    renderSidebar({ myProjects: <ul data-testid="list" />, shared: <ul data-testid="shared-list" /> });
    expect(screen.getByTestId('list')).toBeInTheDocument();
    expect(screen.queryByText('No projects yet')).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Shared with me' }));
    expect(screen.getByTestId('shared-list')).toBeInTheDocument();
    expect(screen.queryByText('Nothing shared with you yet')).toBeNull();
  });

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn();
    renderSidebar({ onClose });
    await userEvent.click(screen.getByRole('button', { name: 'Close projects sidebar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps inactive tab text readable (secondary text token, not muted)', () => {
    renderSidebar();
    expect(screen.getByRole('tab', { name: 'Shared with me' })).toHaveClass('dark:text-copy-secondary');
    expect(screen.getByRole('tab', { name: 'Shared with me' })).not.toHaveClass('dark:text-muted-foreground');
  });
});

describe('ProjectSidebar New Project button (AC-018, EC-007)', () => {
  it('is disabled with a sign-in tooltip when no handler is supplied', async () => {
    const user = userEvent.setup();
    renderSidebar();
    const button = screen.getByRole('button', { name: 'New Project' });
    expect(button).toBeDisabled();
    await user.hover(button.parentElement as HTMLElement);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Sign in to create a project');
  });

  it('is enabled, full-width, has a Plus icon, and calls the handler once', async () => {
    const onNewProject = vi.fn();
    renderSidebar({ onNewProject });
    const button = screen.getByRole('button', { name: 'New Project' });
    expect(button).toBeEnabled();
    expect(button).toHaveClass('w-full');
    expect(button.querySelector('svg.lucide-plus')).not.toBeNull();
    await userEvent.click(button);
    expect(onNewProject).toHaveBeenCalledTimes(1);
  });
});
