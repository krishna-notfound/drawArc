'use client';

import { UserButton } from '@clerk/nextjs';
import { useSyncExternalStore } from 'react';

const appearance = { elements: { avatarBox: 'h-8 w-8' } };
const subscribe = () => () => {};

/** Same footprint as UserMenu, shown in the static shell until the auth gate resolves. */
export function UserMenuPlaceholder() {
  return <div aria-hidden="true" data-slot="user-menu-placeholder" className="h-8 w-8 rounded-full bg-subtle" />;
}

/** Clerk's account menu for the editor home navbar (manage account, sign out → /sign-in via ClerkProvider). */
export function UserMenu() {
  // Server HTML never contains the UserButton (Clerk renders it only once clerk-js has loaded), so when this
  // streamed boundary hydrated after clerk-js was ready, React reported a hydration mismatch. Hydrate the
  // placeholder first and mount the UserButton right after.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <div className="flex h-8 w-8 items-center justify-center">
      {hydrated ? <UserButton appearance={appearance} /> : <UserMenuPlaceholder />}
    </div>
  );
}
