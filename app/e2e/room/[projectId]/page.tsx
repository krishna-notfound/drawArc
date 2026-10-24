import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ProjectRoom } from '@/components/editor/project-room';
import { requireProjectRole } from '@/lib/access';
import { publicEnv } from '@/lib/env.public';
import { AccessError } from '@/lib/errors';

async function roleOrNull(projectId: string) {
  try {
    return (await requireProjectRole(projectId, 'viewer')).role;
  } catch (err) {
    if (err instanceof AccessError) return null;
    throw err;
  }
}

// Test-only page (F05 Ruling): lets Playwright join a project room before F06 mounts ProjectRoom in the
// workspace. NEXT_PUBLIC_E2E_HOOKS is inlined at build time, so without it this route is always a 404.
async function RoomGate({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const role = await roleOrNull(projectId);
  if (!role) return <p className="p-4 text-sm text-copy-muted">You can&apos;t open this project</p>;
  return (
    <ProjectRoom projectId={projectId} role={role}>
      <p className="p-4 text-sm text-copy-muted">Room connected</p>
    </ProjectRoom>
  );
}

export default function E2eRoomPage({ params }: PageProps<'/e2e/room/[projectId]'>) {
  if (publicEnv.NEXT_PUBLIC_E2E_HOOKS !== '1') notFound();
  return (
    <main className="flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <RoomGate params={params} />
      </Suspense>
    </main>
  );
}
