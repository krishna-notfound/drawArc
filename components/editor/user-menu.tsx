'use client';

import { UserButton } from '@clerk/nextjs';

const appearance = { elements: { avatarBox: 'h-8 w-8' } };

/** Clerk's account menu for the editor home navbar (manage account, sign out → /sign-in via ClerkProvider). */
export function UserMenu() {
  return (
    <div className="flex h-8 w-8 items-center justify-center">
      <UserButton appearance={appearance} />
    </div>
  );
}

/** Same footprint as UserMenu, shown in the static shell until the auth gate resolves. */
export function UserMenuPlaceholder() {
  return <div aria-hidden="true" data-slot="user-menu-placeholder" className="h-8 w-8 rounded-full bg-subtle" />;
}
