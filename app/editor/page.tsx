import { Suspense } from 'react';

import { EditorHomeBody } from '@/components/editor/editor-home-body';
import { EditorShell } from '@/components/editor/editor-shell';
import { UserMenu, UserMenuPlaceholder } from '@/components/editor/user-menu';
import { requireUser } from '@/lib/auth';

// Gated server-side: requireUser() runs in a Suspense child (code-standards rule 2) and redirects signed-out
// visitors to /sign-in. Only the navbar's user slot waits for it, so the shell the visitor may already be
// using is never remounted when the gate resolves. The body is static and user-independent; F04 replaces
// it and must keep any user data inside a gated Suspense child.
async function EditorHomeGate() {
  await requireUser({ unauthenticated: 'redirect' });
  return <UserMenu />;
}

export default function EditorHomePage() {
  return (
    <EditorShell
      navbarRight={
        <Suspense fallback={<UserMenuPlaceholder />}>
          <EditorHomeGate />
        </Suspense>
      }
    >
      <EditorHomeBody />
    </EditorShell>
  );
}
