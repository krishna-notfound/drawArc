import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ createProject: vi.fn(), renameProject: vi.fn(), deleteProject: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('@/app/editor/actions', () => actions);
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const { ProjectDialogsHost } = await import('@/components/editor/project-dialogs');
const { useProjectDialogsContext } = await import('@/components/editor/project-dialogs-context');
const { ProjectDialogsProvider } = await import('@/hooks/useProjectDialogs');

const project = { id: 'cprj0000000000000000000001', name: 'Payments' };

function Openers() {
  const api = useProjectDialogsContext();
  return (
    <>
      <button type="button" onClick={() => api.openCreate()}>
        open create
      </button>
      <button type="button" onClick={() => api.openRename(project)}>
        open rename
      </button>
      <button type="button" onClick={() => api.openDelete(project)}>
        open delete
      </button>
    </>
  );
}

function setup(currentProjectId?: string) {
  render(
    <ProjectDialogsProvider currentProjectId={currentProjectId}>
      <Openers />
      <ProjectDialogsHost />
    </ProjectDialogsProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useProjectDialogs (AC-011, AC-012)', () => {
  it('submits once while pending, disables the form, then navigates to the new project', async () => {
    let resolve!: (value: unknown) => void;
    actions.createProject.mockReturnValue(new Promise((r) => (resolve = r)));
    const user = setup();
    await user.click(screen.getByText('open create'));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Payments');
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: /Creating/ }));

    expect(actions.createProject).toHaveBeenCalledExactlyOnceWith({ name: 'Payments' });
    expect(screen.getByRole('textbox', { name: 'Project name' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await act(async () => resolve({ ok: true, data: { id: project.id } }));
    expect(router.push).toHaveBeenCalledWith(`/editor/${project.id}`);
  });

  it('shows a field error linked to the input and keeps the dialog open', async () => {
    actions.renameProject.mockResolvedValue({
      ok: false,
      error: { code: 'VALIDATION', message: 'Please check the highlighted fields.', fieldErrors: { name: ['Name is required'] } },
    });
    const user = setup();
    await user.click(screen.getByText('open rename'));
    const input = screen.getByRole('textbox', { name: 'Project name' });
    expect(input).toHaveValue('Payments');
    await user.clear(input);
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Name is required')).toHaveAttribute('id', input.getAttribute('aria-describedby'));
    expect(input).toHaveFocus();
    expect(input).toBeEnabled();
  });

  it.each([
    ['a gone project', { ok: false, error: { code: 'FORBIDDEN', message: 'x' } }, 'That project no longer exists.'],
    [
      'an upstream failure',
      { ok: false, error: { code: 'UPSTREAM', message: 'Something went wrong. Please try again.' } },
      'Something went wrong. Please try again.',
    ],
    ['a rejected action (stale deploy)', 'reject', 'The app was updated. Please reload and try again.'],
  ])('maps %s on delete to a focused banner and keeps the dialog open', async (_label, result, message) => {
    if (result === 'reject') actions.deleteProject.mockRejectedValue(new Error('Failed to find Server Action'));
    else actions.deleteProject.mockResolvedValue(result);
    const user = setup(project.id);
    await user.click(screen.getByText('open delete'));
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(message);
    expect(banner).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Delete project' })).toBeEnabled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('returns to /editor after deleting the open project', async () => {
    actions.deleteProject.mockResolvedValue({ ok: true, data: { id: project.id } });
    const user = setup(project.id);
    await user.click(screen.getByText('open delete'));
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith('/editor'));
  });
});
