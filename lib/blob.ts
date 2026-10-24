import 'server-only';

import { del, get, put } from '@vercel/blob';

import type { CanvasDocument } from '@/types/canvas';

import { logger } from './logger';

/**
 * Canvas snapshots in the private Vercel Blob store (D-009, D-022). One deterministic pathname per project,
 * overwritten in place; reads bypass the CDN (`useCache: false`) so a read after an overwrite is never stale.
 * The pathname is derived from the authorized project id only, never from user input, and blob URLs never
 * leave the server (security-model "Snapshot and artifact access").
 */
export const canvasPathname = (projectId: string): string => `canvas/${projectId}.json`;

/** The stored blob is not JSON (EC-008). */
export class BlobCorruptError extends Error {
  constructor(cause: unknown) {
    super('Stored canvas snapshot is not valid JSON', { cause });
    this.name = 'BlobCorruptError';
  }
}

export async function putCanvas(projectId: string, doc: CanvasDocument): Promise<{ pathname: string; size: number }> {
  const pathname = canvasPathname(projectId);
  const body = JSON.stringify(doc);
  await put(pathname, body, {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
  });
  return { pathname, size: Buffer.byteLength(body) };
}

/** Parsed JSON (unvalidated) or `null` when no snapshot exists; throws `BlobCorruptError` for non-JSON content. */
export async function getCanvas(projectId: string): Promise<{ json: unknown; size: number } | null> {
  const result = await get(canvasPathname(projectId), { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const text = await new Response(result.stream).text();
  try {
    return { json: JSON.parse(text) as unknown, size: Buffer.byteLength(text) };
  } catch (err) {
    throw new BlobCorruptError(err);
  }
}

/** Best effort (invariant 7): a missing snapshot is a no-op and failures are logged, never thrown. */
export async function deleteCanvas(projectId: string): Promise<void> {
  try {
    await del(canvasPathname(projectId));
  } catch (err) {
    logger.error({ projectId, op: 'deleteCanvas', err }, 'blob deleteCanvas failed');
  }
}
