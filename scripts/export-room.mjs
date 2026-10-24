// Recovery runbook helper (F15 FR-012): copies one project room's Liveblocks Storage to a local file before a
// risky operation or during an incident. Read-only against Liveblocks.
//
//   node scripts/export-room.mjs <projectId>
//
// Uses LIVEBLOCKS_SECRET_KEY from the shell or .env.local (the development project locally; pass the production
// key in the shell only for a production incident). Writes exports/<projectId>-<iso>.json (git-ignored) in the
// plain-LSON format, which `initializeStorageDocument` accepts if a room ever has to be restored from it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Liveblocks } from '@liveblocks/node';
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'], quiet: true });

const roomId = process.argv[2];
// Room ids are project cuids (F05); anything else is refused before a request is made.
if (!roomId || !/^c[a-z0-9]{24}$/.test(roomId)) {
  console.error('usage: node scripts/export-room.mjs <projectId>   (a project cuid)');
  process.exit(2);
}
const secret = process.env.LIVEBLOCKS_SECRET_KEY;
if (!secret) {
  console.error('export-room: LIVEBLOCKS_SECRET_KEY is not set');
  process.exit(2);
}

const liveblocks = new Liveblocks({ secret });
try {
  const storage = await liveblocks.getStorageDocument(roomId, 'plain-lson');
  mkdirSync('exports', { recursive: true });
  const file = join('exports', `${roomId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, `${JSON.stringify(storage, null, 2)}\n`);
  console.log(`export-room: wrote ${file}`);
} catch (err) {
  console.error(`export-room: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
