import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

// `/` only routes: signed-in users to the editor, everyone else to sign-in (FR-005). The session read sits
// in a Suspense child because Cache Components forbids request data at the page's top level.
async function HomeRedirect(): Promise<never> {
  const { userId } = await auth();
  redirect(userId ? '/editor' : '/sign-in');
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeRedirect />
    </Suspense>
  );
}
