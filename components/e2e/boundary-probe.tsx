import { e2eHooksEnabled } from '@/lib/env.public';

export type ProbeTarget = 'layout' | 'page' | 'segment';

export const PROBE_PARAM = '__f15_throw';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * E2E-only error-boundary probe (F15 AC-012/AC-013): throws a server render error when the URL carries
 * `?__f15_throw=<target>`. Active only in builds with test hooks (`NEXT_PUBLIC_E2E_HOOKS=1`), never in production.
 */
export async function throwIfProbed(searchParams: SearchParams, target: ProbeTarget): Promise<void> {
  if (!e2eHooksEnabled) return;
  if ((await searchParams)[PROBE_PARAM] === target) throw new Error(`E2E boundary probe: ${target}`);
}

/** The probe as a Suspense child, for pages whose own body does not read `searchParams`. */
export async function BoundaryProbe({ searchParams, target }: { searchParams: SearchParams; target: ProbeTarget }) {
  await throwIfProbed(searchParams, target);
  return null;
}
