import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Heading element for `title`; pick the level that fits the surrounding outline. */
  as?: 'h1' | 'h2' | 'h3';
}

export function EmptyState({ icon: Icon, title, description, action, as: Heading = 'h2' }: EmptyStateProps) {
  return (
    <div data-slot="empty-state" className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <Icon className="h-8 w-8 text-copy-muted" aria-hidden="true" />
      <Heading className="text-base font-semibold text-copy-primary">{title}</Heading>
      {description ? <p className="max-w-sm text-sm text-copy-secondary">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
