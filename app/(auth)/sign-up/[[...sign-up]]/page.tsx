import { SignUp } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { AuthFormFallback } from '@/components/auth/auth-form-fallback';

export const metadata: Metadata = { title: 'Sign up' };

// See the sign-in page: session read in a Suspense child, signed-in visitors go to the editor (FR-004).
async function SignUpGate() {
  const { userId } = await auth();
  if (userId) redirect('/editor');
  return <SignUp path="/sign-up" />;
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthFormFallback />}>
      <SignUpGate />
    </Suspense>
  );
}
