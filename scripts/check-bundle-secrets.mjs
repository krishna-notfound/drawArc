// Fails if any server secret set to a SENTINEL value (by CI) appears in the client bundle (.next/static).
// Prints the file and key name on a hit, never the value.
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

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

function main() {
  const staticDir = join(process.cwd(), '.next', 'static');
  if (!existsSync(staticDir)) {
    console.error('check:bundle: .next/static not found — run build first');
    return 1;
  }

  const sentinels = SERVER_KEYS.map((key) => [key, process.env[key]]).filter(
    ([, value]) => typeof value === 'string' && value.includes('SENTINEL'),
  );
  if (sentinels.length === 0) {
    console.log('check:bundle: no sentinel values set; nothing to check');
    return 0;
  }

  let leaks = 0;
  for (const file of files(staticDir)) {
    const content = readFileSync(file, 'utf8');
    for (const [key, value] of sentinels) {
      if (content.includes(value)) {
        console.error(`check:bundle: ${file}: ${key}`);
        leaks += 1;
      }
    }
  }
  if (leaks > 0) return 1;
  console.log(`check:bundle: ${sentinels.length} sentinel secrets checked, none found in .next/static`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
