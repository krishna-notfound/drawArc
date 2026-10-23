import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AiSidebar } from '@/components/ai/ai-sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

function renderAi(props: Partial<Parameters<typeof AiSidebar>[0]> = {}) {
  return render(
    <TooltipProvider delayDuration={0}>
      <AiSidebar open onClose={() => {}} {...props} />
    </TooltipProvider>,
  );
}

describe('AiSidebar placeholder (AC-019)', () => {
  it('renders header copy, Bot icon, close button, and the default empty state', () => {
    renderAi();
    const aside = screen.getByRole('complementary', { name: 'AI Workspace' });
    expect(aside).toHaveAttribute('id', 'ai-sidebar');
    expect(aside).toHaveAttribute('data-side', 'right');
    expect(screen.getByRole('heading', { name: 'AI Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Collaborate with drawArc')).toBeInTheDocument();
    expect(aside.querySelector('svg.lucide-bot')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Close AI sidebar' })).toBeInTheDocument();
    expect(screen.getByText('The AI design agent arrives in a later release.')).toBeInTheDocument();
  });

  it('uses translate-x-full when closed', () => {
    renderAi({ open: false });
    const aside = document.getElementById('ai-sidebar') as HTMLElement;
    expect(aside).toHaveClass('translate-x-full');
    expect(aside).toHaveAttribute('aria-hidden', 'true');
  });

  it('replaces the placeholder body with children', () => {
    renderAi({ children: <p>Chat goes here</p> });
    expect(screen.getByText('Chat goes here')).toBeInTheDocument();
    expect(screen.queryByText('The AI design agent arrives in a later release.')).toBeNull();
  });

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn();
    renderAi({ onClose });
    await userEvent.click(screen.getByRole('button', { name: 'Close AI sidebar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
