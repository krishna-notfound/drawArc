import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SidebarPanel } from '@/components/editor/sidebar-panel';

function Panel({ open, onClose = () => {} }: { open: boolean; onClose?: () => void }) {
  return (
    <SidebarPanel id="test-panel" side="left" open={open} onClose={onClose} label="Test panel">
      <button type="button" data-sidebar-close>
        Close panel
      </button>
      <button type="button">Inner action</button>
    </SidebarPanel>
  );
}

function WithOpener({ showOpener = true }: { showOpener?: boolean }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      {showOpener ? (
        <button type="button" ref={openerRef} onClick={() => setOpen(true)}>
          Opener
        </button>
      ) : null}
      <button type="button" onClick={() => setOpen(true)}>
        Fallback opener
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        Close from elsewhere
      </button>
      <SidebarPanel id="p" side="left" open={open} onClose={() => setOpen(false)} label="Panel" openerRef={openerRef}>
        <button type="button" data-sidebar-close onClick={() => setOpen(false)}>
          Close
        </button>
      </SidebarPanel>
    </>
  );
}

describe('SidebarPanel closed state (AC-012, FR-009)', () => {
  it('is aria-hidden, inert, off-screen, invisible and shadowless', () => {
    render(<Panel open={false} />);
    const aside = document.getElementById('test-panel') as HTMLElement;
    expect(aside).toHaveAttribute('id', 'test-panel');
    expect(aside).toHaveAttribute('aria-hidden', 'true');
    expect(aside).toHaveAttribute('inert');
    expect(aside).toHaveAttribute('data-state', 'closed');
    expect(aside).toHaveAttribute('data-side', 'left');
    expect(aside).toHaveClass('fixed', 'top-14', 'bottom-0', 'left-0', 'z-30', '-translate-x-full', 'invisible', 'shadow-none');
    expect(aside.className).toContain('[transition:transform_200ms_ease-out,visibility_0s_200ms]');
    expect(document.querySelector('[data-scrim]')).toBeNull();
  });

  it('mirrors to the right side with translate-x-full', () => {
    render(
      <SidebarPanel id="r" side="right" open={false} onClose={() => {}} label="Right">
        <span />
      </SidebarPanel>,
    );
    const aside = document.getElementById('r') as HTMLElement;
    expect(aside).toHaveAttribute('data-side', 'right');
    expect(aside).toHaveClass('right-0', 'border-l', 'translate-x-full');
  });

  it('disables the transition under reduced motion (FR-011)', () => {
    render(<Panel open={false} />);
    const aside = document.getElementById('test-panel') as HTMLElement;
    expect(aside).toHaveClass('motion-reduce:transition-none', 'motion-reduce:duration-0');
  });
});

describe('SidebarPanel open state (AC-012, FR-010)', () => {
  it('is exposed, not inert, on-screen, and focuses its close button', () => {
    render(<Panel open />);
    const aside = screen.getByRole('complementary', { name: 'Test panel' });
    expect(aside).toHaveAttribute('aria-hidden', 'false');
    expect(aside).not.toHaveAttribute('inert');
    expect(aside).toHaveAttribute('data-state', 'open');
    expect(aside).toHaveClass('translate-x-0', 'visible', 'shadow-xl');
    expect(screen.getByRole('button', { name: 'Close panel' })).toHaveFocus();
  });

  it('renders a mobile-only scrim that closes the panel', async () => {
    const onClose = vi.fn();
    render(<Panel open onClose={onClose} />);
    const scrim = document.querySelector('[data-scrim]');
    expect(scrim).not.toBeNull();
    expect(scrim).toHaveClass('fixed', 'z-20', 'md:hidden', 'motion-reduce:animate-none');
    await userEvent.click(scrim as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SidebarPanel Escape handling (AC-013)', () => {
  it('closes on Escape only when focus is inside the panel', async () => {
    const onClose = vi.fn();
    render(
      <>
        <button type="button">Outside</button>
        <Panel open onClose={onClose} />
      </>,
    );
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Close panel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => screen.getByRole('button', { name: 'Outside' }).focus());
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SidebarPanel focus return (AC-014, EC-006)', () => {
  it('returns focus to the opener when closed with Escape', async () => {
    const user = userEvent.setup();
    render(<WithOpener />);
    await user.click(screen.getByRole('button', { name: 'Opener' }));
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Opener' })).toHaveFocus();
  });

  it('does not steal focus back to the opener when focus has moved elsewhere', async () => {
    const user = userEvent.setup();
    render(<WithOpener />);
    await user.click(screen.getByRole('button', { name: 'Opener' }));
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Close from elsewhere' }));
    expect(document.getElementById('p')).toHaveAttribute('data-state', 'closed');
    expect(screen.getByRole('button', { name: 'Close from elsewhere' })).toHaveFocus();
  });

  it('falls back to body without throwing when the opener is gone', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<WithOpener />);
    await user.click(screen.getByRole('button', { name: 'Opener' }));
    rerender(<WithOpener showOpener={false} />);
    expect(screen.queryByRole('button', { name: 'Opener' })).toBeNull();
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(document.body);
  });
});
