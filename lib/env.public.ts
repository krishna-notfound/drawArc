import { z } from 'zod';

// Literal `process.env.NEXT_PUBLIC_*` references so Next.js can inline them into the client bundle.
const publicRaw = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, // F02
  NEXT_PUBLIC_LIVEBLOCKS_BASE_URL: process.env.NEXT_PUBLIC_LIVEBLOCKS_BASE_URL, // tests only (F05)
  NEXT_PUBLIC_E2E_HOOKS: process.env.NEXT_PUBLIC_E2E_HOOKS, // tests only (F05): enables the test-only room page
};

export const PublicEnvSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  NEXT_PUBLIC_LIVEBLOCKS_BASE_URL: z.url().optional(),
  NEXT_PUBLIC_E2E_HOOKS: z.enum(['1']).optional(),
});

export type PublicEnv = z.infer<typeof PublicEnvSchema>;

/**
 * Validates `raw` against `schema`, treating empty strings as unset.
 * The error names keys and issue codes only — never values.
 */
export function parseEnv<S extends z.ZodObject>(
  schema: S,
  raw: Record<string, string | undefined>,
  scope: string,
): z.infer<S> {
  const input: Record<string, string | undefined> = {};
  for (const key of Object.keys(schema.shape)) {
    const value = raw[key];
    input[key] = value === '' ? undefined : value;
  }
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')} (${issue.code})`).join(', ');
    throw new Error(`Invalid environment (${scope}): ${issues}`);
  }
  return result.data;
}

export const publicEnv: PublicEnv = parseEnv(PublicEnvSchema, publicRaw, 'public');

/**
 * E2E-only canvas test hooks (F07: `window.__rf`, `window.__canvasMutations`): on only in builds with
 * `NEXT_PUBLIC_E2E_HOOKS=1`. A literal reference (not `publicEnv`) so the value is a build-time constant and
 * production bundles drop the hooks.
 */
export const e2eHooksEnabled: boolean = process.env.NEXT_PUBLIC_E2E_HOOKS === '1';
