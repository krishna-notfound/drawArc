import { del } from '@vercel/blob';

/** Removes the snapshot a spec's project wrote to the private Blob store (BLOB_READ_WRITE_TOKEN from .env.local). */
export function deleteSnapshot(projectId: string): Promise<void> {
  return del(`canvas/${projectId}.json`);
}
