import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectMembers } from '@/lib/projects/members';

const actions = vi.hoisted(() => ({ inviteMember: vi.fn(), changeMemberRole: vi.fn(), removeMember: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('@/app/editor/[projectId]/actions', () => actions);
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const { ShareDialog, MEMBER_DESCRIPTION } = await import('@/components/editor/share-dialog');

const projectId = 'cprj0000000000000000000001';
const members: ProjectMembers = {
  owner: { id: 'u-a', name: 'Ada Owner', email: 'ada@x.io', avatarUrl: null },
  members: [
    { id: 'm-b', email: 'bob@x.io', role: 'editor', status: 'active', name: 'Bob Builder', avatarUrl: null, invitedAt: '2026-10-01T00:00:00.000Z' },
    { id: 'm-c', email: 'c@x.io', role: 'viewer', status: 'pending', name: null, avatarUrl: null, invitedAt: '2026-10-02T00:00:00.000Z' },
  ],
};

function renderDialog(role: 'owner' | 'editor' | 'viewer' = 'owner', status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE') {
  render(<ShareDialog open onOpenChange={() => {}} projectId={projectId} projectStatus={status} role={role} members={members} />);
  return screen.getByRole('dialog', { name: 'Share project' });
}

const ok = <T,>(data: T) => ({ ok: true, data });
const fail = (error: Record<string, unknown>) => ({ ok: false, error: { message: 'Server says no.', ...error } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ShareDialog — what each role sees (F12 AC-002, AC-003, AC-004, AC-006)', () => {
  it('owner: invite form with defaults, rows in order with badges, role selects and remove buttons', () => {
    const dialog = renderDialog('owner');
    const email = within(dialog).getByLabelText('Email');
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('placeholder', 'name@example.com');
    expect(email).toHaveAttribute('maxLength', '254');
    expect(within(dialog).getByRole('combobox', { name: 'Role' })).toHaveTextContent('Editor');
    expect(within(dialog).getByRole('button', { name: 'Invite' })).toBeEnabled();

    const rows = within(dialog).getAllByRole('listitem');
    expect(rows.map((r) => r.dataset.status)).toEqual(['owner', 'active', 'pending']);
    expect(rows[0]).toHaveTextContent('Ada Owner');
    expect(rows[0]).toHaveTextContent('Owner');
    expect(rows[1]).toHaveTextContent('Bob Builder');
    expect(rows[1]).toHaveTextContent('bob@x.io');
    expect(within(rows[1]!).getByRole('combobox', { name: 'Role for Bob Builder' })).toHaveTextContent('Editor');
    expect(rows[2]).toHaveTextContent('Pending');
    expect(rows[2]).toHaveTextContent('C'); // initials from the email
    expect(within(rows[2]!).getByRole('combobox')).toHaveTextContent('Viewer');
    expect(within(dialog).getByRole('button', { name: 'Remove Bob Builder' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Remove c@x.io' })).toBeInTheDocument();
  });

  it.each(['editor', 'viewer'] as const)('%s: read-only list, no mutation controls in the DOM', (role) => {
    const dialog = renderDialog(role);
    expect(dialog).toHaveTextContent(MEMBER_DESCRIPTION);
    expect(within(dialog).queryByRole('button', { name: /invite/i })).toBeNull();
    expect(within(dialog).queryByLabelText('Email')).toBeNull();
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0);
    expect(dialog.querySelector('button[aria-label^="Remove"]')).toBeNull();
    expect(within(dialog).getAllByRole('listitem')[1]).toHaveTextContent('Editor');
    expect(within(dialog).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('archived: invite and role changes disabled with a hint; removal still offered (EC-014)', () => {
    const dialog = renderDialog('owner', 'ARCHIVED');
    expect(dialog).toHaveTextContent("Archived projects can't be shared.");
    expect(within(dialog).getByRole('button', { name: 'Invite' })).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Role for Bob Builder' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Remove Bob Builder' })).toBeEnabled();
  });
});

describe('ShareDialog — invite (F12 AC-005, AC-029)', () => {
  it('submits once while pending, then clears and refocuses the email field', async () => {
    let resolve!: (v: unknown) => void;
    actions.inviteMember.mockReturnValue(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    const dialog = renderDialog();
    const email = within(dialog).getByLabelText('Email');
    await user.type(email, 'new@x.io{Enter}');
    await user.click(within(dialog).getByRole('button', { name: /Invit/ }));
    expect(actions.inviteMember).toHaveBeenCalledExactlyOnceWith({ projectId, email: 'new@x.io', role: 'editor' });
    expect(within(dialog).getByRole('button', { name: 'Inviting…' })).toBeDisabled();

    await act(async () => resolve(ok({ ...members.members[1], email: 'new@x.io' })));
    expect(email).toHaveValue('');
    expect(email).toHaveFocus();
  });

  it.each([
    ['VALIDATION with an email field error', fail({ code: 'VALIDATION', fieldErrors: { email: ['Enter a valid email address'] } }), 'inline', 'Enter a valid email address'],
    ['SELF_INVITE', fail({ code: 'CONFLICT', reason: 'SELF_INVITE', message: 'You already own this project.' }), 'inline', 'You already own this project.'],
    ['RATE_LIMITED', fail({ code: 'RATE_LIMITED' }), 'banner', "You've sent too many invitations. Try again in an hour."],
    ['PROJECT_ARCHIVED', fail({ code: 'CONFLICT', reason: 'PROJECT_ARCHIVED' }), 'banner', 'This project is archived. Unarchive it to manage sharing.'],
    ['UPSTREAM', fail({ code: 'UPSTREAM' }), 'banner', 'Server says no.'],
  ])('maps %s to the %s message', async (_label, result, placement, copy) => {
    actions.inviteMember.mockResolvedValue(result);
    const user = userEvent.setup();
    const dialog = renderDialog();
    await user.type(within(dialog).getByLabelText('Email'), 'x@x.io{Enter}');
    if (placement === 'inline') {
      expect(await within(dialog).findByText(copy)).not.toHaveAttribute('role', 'alert');
      expect(within(dialog).getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    } else {
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(copy);
    }
  });
});

describe('ShareDialog — remove and role results (F12 AC-007, AC-008, AC-029)', () => {
  it('confirms inline, cancels, removes, and warns when the KICK was not delivered', async () => {
    actions.removeMember.mockResolvedValue(ok({ memberId: 'm-b', kickDelivered: false }));
    const user = userEvent.setup();
    const dialog = renderDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Remove Bob Builder' }));
    expect(dialog).toHaveTextContent('Remove Bob Builder?');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(within(dialog).getByRole('button', { name: 'Remove Bob Builder' })).toBeInTheDocument();
    expect(actions.removeMember).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Remove Bob Builder' }));
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(actions.removeMember).toHaveBeenCalledExactlyOnceWith({ projectId, memberId: 'm-b' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Access updated, but they may stay connected until they reload.');
  });

  it('shows "already removed" and refreshes the list on NOT_FOUND', async () => {
    actions.removeMember.mockResolvedValue(fail({ code: 'NOT_FOUND' }));
    const user = userEvent.setup();
    const dialog = renderDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Remove c@x.io' }));
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This member was already removed.');
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});

describe('ShareDialog — copy link (F12 AC-009, EC-016)', () => {
  const realClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  afterEach(() => {
    vi.useRealTimers();
    if (realClipboard) Object.defineProperty(navigator, 'clipboard', realClipboard);
  });
  const stubClipboard = (writeText: () => Promise<void>) =>
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(writeText) } });

  it('writes the project URL and shows "Copied!" for 2 s', async () => {
    vi.useFakeTimers();
    stubClipboard(() => Promise.resolve());
    const dialog = renderDialog('viewer');
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Copy link' })));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/editor/${projectId}`);
    expect(within(dialog).getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    expect(within(dialog).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('falls back to a read-only link field when the clipboard rejects', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    const dialog = renderDialog('viewer');
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Copy link' })));
    expect(dialog).toHaveTextContent("Couldn't copy — select the link below");
    expect(within(dialog).getByLabelText('Project link')).toHaveValue(`${window.location.origin}/editor/${projectId}`);
    expect(within(dialog).getByLabelText('Project link')).toHaveAttribute('readOnly');
  });
});
