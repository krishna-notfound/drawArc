import { Clock } from 'lucide-react';

import { EmptyState } from '@/components/editor/empty-state';

const AVAILABLE_AT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'UTC',
  hourCycle: 'h23',
});

/**
 * Shown instead of the editor when the signed-in Clerk account's email still belongs to an account deleted
 * less than EMAIL_REUSE_HOLD_DAYS ago (FR-018). The navbar keeps the UserButton, so the user can sign out.
 */
export function RecentlyDeletedScreen({ availableAt }: { availableAt: Date }) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <EmptyState
        as="h1"
        icon={Clock}
        title="This email belonged to an account deleted recently"
        description={`You can sign up again with it on ${AVAILABLE_AT.format(availableAt)} UTC. To continue now, sign out from the account menu and use a different email.`}
      />
    </div>
  );
}
