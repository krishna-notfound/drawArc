// Fails if a server secret reaches the client bundle (.next/static, what ships to browsers): the value of any
// server key set in the environment (CI sets unique SENTINEL values; locally the real values are checked), and
// anything shaped like a live secret key. Prints the file and the key or pattern name on a hit, never the value.
// Publishable keys (pk_) and NEXT_PUBLIC_* values are client-safe by design and are not matched (F15 EC-012).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Mirrors the service keys of ServerEnvSchema in lib/env.ts (a unit test keeps them in sync).
export const SERVER_KEYS = [
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'DATABASE_URL_TEST',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SIGNING_SECRET',
  'LIVEBLOCKS_SECRET_KEY',
  'LIVEBLOCKS_WEBHOOK_SECRET_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'TRIGGER_SECRET_KEY',
];

// Secret-shaped strings (F15 design "bundle scan"). The prefixes alone appear in SDK code (e.g. a
// `startsWith('sk_test_')` check), so a hit needs key material after the prefix.
export const SECRET_PATTERNS = [
  ['Clerk/Liveblocks secret key', /\bsk_(?:live|test|prod|dev)_[A-Za-z0-9]{20,}/],
  ['webhook signing secret', /\bwhsec_[A-Za-z0-9+/=]{20,}/],
  ['Vercel Blob read-write token', /\bvercel_blob_rw_[A-Za-z0-9_]{16,}/],
];

/** Shorter values (e.g. a local `sk_localdev`) would match unrelated text; real secrets are far longer. */
const MIN_VALUE_LENGTH = 12;

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

/** Returns one `file: name` line per hit; never includes the matched value. */
export function scanBundle(staticDir, env) {
  const values = SERVER_KEYS.map((key) => [key, env[key]]).filter(
    ([, value]) => typeof value === 'string' && value.length >= MIN_VALUE_LENGTH,
  );
  const hits = [];
  for (const file of files(staticDir)) {
    const content = readFileSync(file, 'utf8');
    for (const [key, value] of values) if (content.includes(value)) hits.push(`${file}: ${key}`);
    for (const [name, pattern] of SECRET_PATTERNS) if (pattern.test(content)) hits.push(`${file}: ${name}`);
  }
  return { hits, checkedValues: values.length };
}

function main() {
  const staticDir = join(process.cwd(), '.next', 'static');
  if (!existsSync(staticDir)) {
    console.error('check:bundle: .next/static not found — run build first');
    return 1;
  }
  const { hits, checkedValues } = scanBundle(staticDir, process.env);
  for (const hit of hits) console.error(`check:bundle: ${hit}`);
  if (hits.length > 0) return 1;
  console.log(
    `check:bundle: ${checkedValues} server values and ${SECRET_PATTERNS.length} secret patterns checked, none found in .next/static`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
