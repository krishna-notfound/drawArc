import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AppDialog, ConfirmDialog, type ConfirmDialogProps } from '@/components/editor/app-dialog';

describe('AppDialog (AC-021)', () => {
  it('renders title, description, body and footer in a rounded-3xl dialog over a blurred overlay', () => {
    render(
      <AppDialog open onOpenChange={() => {}} title="T" description="D" footer={<button type="button">F</button>}>
        <p>Body</p>
      </AppDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'T' });
    expect(dialog).toHaveAccessibleDescription('D');
    expect(dialog).toHaveClass('rounded-3xl');
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'F' })).toBeInTheDocument();
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay?.className).toMatch(/\bbackdrop-blur/);
  });

  it('calls onOpenChange(false) on Escape', async () => {
    const onOpenChange = vi.fn();
    render(<AppDialog open onOpenChange={onOpenChange} title="T" />);
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('omits the description when none is given', () => {
    render(<AppDialog open onOpenChange={() => {}} title="Only title" />);
    expect(screen.getByRole('dialog', { name: 'Only title' })).not.toHaveAttribute('aria-describedby');
  });
});

function renderConfirm(props: Partial<ConfirmDialogProps> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Delete project?"
      description="This cannot be undone."
      confirmLabel="Delete"
      destructive
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe('ConfirmDialog (AC-022, EC-008)', () => {
  it('has no input, a destructive confirm button, and focuses Cancel on open', () => {
    renderConfirm();
    const dialog = screen.getByRole('dialog', { name: 'Delete project?' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    expect(dialog.querySelector('input, textarea')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('data-variant', 'destructive');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('uses the default variant when not destructive and a custom cancel label', () => {
    renderConfirm({ destructive: false, cancelLabel: 'Keep' });
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('data-variant', 'default');
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
  });

  it('calls onConfirm once when the confirm button is clicked', async () => {
    const { onConfirm } = renderConfirm();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes via Cancel', async () => {
    const { onOpenChange } = renderConfirm();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables both buttons while pending, but Escape still closes', async () => {
    const { onConfirm, onOpenChange } = renderConfirm({ pending: true });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
