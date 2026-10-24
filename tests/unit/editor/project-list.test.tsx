import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { type ProjectDialogsApi, ProjectDialogsContext } from '@/components/editor/project-dialogs-context';
import { ProjectList } from '@/components/editor/project-list';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ProjectListItem } from '@/lib/projects/queries';

const now = new Date().toISOString();
const owned: ProjectListItem = { id: 'cown0000000000000000000001', name: 'Mine', updatedAt: now, role: 'owner', ownerName: 'A' };
const shared: ProjectListItem = { id: 'cshr0000000000000000000001', name: 'Theirs', updatedAt: now, role: 'editor', ownerName: 'B' };

function dialogsApi(): ProjectDialogsApi {
  return {
    dialog: null,
    name: '',
    pending: false,
    error: null,
    openCreate: vi.fn(),
    openRename: vi.fn(),
    openDelete: vi.fn(),
    close: vi.fn(),
    restoreFocus: vi.fn(),
    setName: vi.fn(),
    submit: vi.fn(),
  };
}

describe('ProjectList owner-only actions (AC-005, FR-003)', () => {
  it('renders the actions menu only on owned rows and opens Rename/Delete for that project', async () => {
    const api = dialogsApi();
    render(
      <TooltipProvider>
        <ProjectDialogsContext.Provider value={api}>
          <ProjectList items={[owned, shared]} currentProjectId={owned.id} />
        </ProjectDialogsContext.Provider>
      </TooltipProvider>,
    );

    const buttons = screen.getAllByRole('button', { name: 'Project actions' });
    expect(buttons).toHaveLength(1);
    const trigger = buttons[0]!;
    expect(trigger.closest('li')).toHaveAttribute('data-project-id', owned.id);
    expect(screen.getByRole('link', { name: /Theirs/ }).closest('li')!.querySelector('button')).toBeNull();
    expect(screen.getByRole('link', { name: /Mine/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Theirs/ })).toHaveAttribute('href', `/editor/${shared.id}`);

    const user = userEvent.setup();
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    expect(api.openRename).toHaveBeenCalledWith(owned, trigger);
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(api.openDelete).toHaveBeenCalledWith(owned, trigger);
  });
});
