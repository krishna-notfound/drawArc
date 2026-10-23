import { render } from '@testing-library/react';
import { FolderOpen } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { AiSidebar } from '@/components/ai/ai-sidebar';
import { EditorNavbar } from '@/components/editor/editor-navbar';
import { EmptyState } from '@/components/editor/empty-state';
import { ProjectSidebar } from '@/components/editor/project-sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

const SIZES = ['h-4 w-4', 'h-5 w-5', 'h-8 w-8'];

function sizeOf(svg: SVGElement): string[] {
  const classes = new Set((svg.getAttribute('class') ?? '').split(/\s+/));
  return SIZES.filter((pair) => pair.split(' ').every((cls) => classes.has(cls)));
}

describe('icon size conventions (AC-007, FR-006)', () => {
  it('every lucide icon in F01 chrome uses exactly one allowed size pair', () => {
    const { container } = render(
      <TooltipProvider>
        <EditorNavbar sidebarOpen={false} onToggleSidebar={() => {}} />
        <ProjectSidebar open onClose={() => {}} onNewProject={() => {}} />
        <AiSidebar open onClose={() => {}} />
        <EmptyState icon={FolderOpen} title="Empty" />
      </TooltipProvider>,
    );
    const icons = Array.from(container.ownerDocument.querySelectorAll<SVGElement>('svg.lucide'));
    expect(icons.length).toBeGreaterThanOrEqual(7);
    for (const icon of icons) {
      expect(sizeOf(icon), icon.getAttribute('class') ?? '').toHaveLength(1);
    }
  });

  it('uses h-5 w-5 for toggle, close and Plus icons and h-8 w-8 for empty-state icons', () => {
    render(
      <TooltipProvider>
        <EditorNavbar sidebarOpen={false} onToggleSidebar={() => {}} />
        <ProjectSidebar open onClose={() => {}} onNewProject={() => {}} />
        <AiSidebar open onClose={() => {}} />
      </TooltipProvider>,
    );
    for (const selector of ['svg.lucide-panel-left-open', 'svg.lucide-x', 'svg.lucide-plus', 'svg.lucide-bot']) {
      document.querySelectorAll<SVGElement>(selector).forEach((svg) => expect(sizeOf(svg)).toEqual(['h-5 w-5']));
    }
    const emptyStateIcons = document.querySelectorAll<SVGElement>('[data-slot="empty-state"] svg.lucide');
    expect(emptyStateIcons.length).toBeGreaterThanOrEqual(2);
    emptyStateIcons.forEach((svg) => expect(sizeOf(svg)).toEqual(['h-8 w-8']));
  });
});
