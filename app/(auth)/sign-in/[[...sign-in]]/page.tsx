import { SignIn } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { AuthFormFallback } from '@/components/auth/auth-form-fallback';

export const metadata: Metadata = { title: 'Sign in' };

// The session is read inside the Suspense child (Cache Components); a signed-in visitor is sent to the
// editor before the form ever renders (FR-004, EC-010).
async function SignInGate() {
  const { userId } = await auth();
  if (userId) redirect('/editor');
  return <SignIn path="/sign-in" />;
}

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthFormFallback />}>
      <SignInGate />
    </Suspense>
  );
}
