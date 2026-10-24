import { cache, Suspense } from 'react';

import { RecentlyDeletedScreen } from '@/components/auth/recently-deleted-screen';
import { EditorHomeBody } from '@/components/editor/editor-home-body';
import { EditorShell } from '@/components/editor/editor-shell';
import { UserMenu, UserMenuPlaceholder } from '@/components/editor/user-menu';
import { requireUser } from '@/lib/auth';
import { EmailHeldError } from '@/lib/users';

// One gate per request, shared by both boundaries below (React `cache` is request-scoped). requireUser()
// redirects signed-out visitors to /sign-in; an email still held after an account deletion (FR-018) is an
// expected outcome with its own screen, not an error page.
const gateEditorHome = cache(async (): Promise<{ heldUntil: Date | null }> => {
  try {
    await requireUser({ unauthenticated: 'redirect' });
    return { heldUntil: null };
  } catch (err) {
    if (err instanceof EmailHeldError) return { heldUntil: err.availableAt };
    throw err;
  }
});

async function EditorHomeUserSlot() {
  await gateEditorHome();
  return <UserMenu />;
}

async function EditorHomeContent() {
  const { heldUntil } = await gateEditorHome();
  return heldUntil ? <RecentlyDeletedScreen availableAt={heldUntil} /> : <EditorHomeBody />;
}

// Session reads happen only in Suspense children (code-standards rule 2). The shell stays mounted while the
// gate resolves; the body's fallback is the same static content, so nothing visibly changes for most users.
// F04 replaces the body and must keep user data inside gated Suspense children.
export default function EditorHomePage() {
  return (
    <EditorShell
      navbarRight={
        <Suspense fallback={<UserMenuPlaceholder />}>
          <EditorHomeUserSlot />
        </Suspense>
      }
    >
      <Suspense fallback={<EditorHomeBody />}>
        <EditorHomeContent />
      </Suspense>
    </EditorShell>
  );
}
