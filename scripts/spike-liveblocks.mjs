// F05 T-001 spike (R-05): answers FR-018 (a), (b), (e), (f) against the Liveblocks dev server.
// (c) and (d) are answered from the @liveblocks/react-flow source (see the F05 report).
// Dev server: start `liveblocks dev --no-persist --no-check --port 1153` (needs Bun), then run
// `node scripts/spike-liveblocks.mjs`; the dev server accepts only the secret 'sk_localdev'.
// Cloud (Liveblocks Development project): `SPIKE_TARGET=cloud node --env-file=.env.local scripts/spike-liveblocks.mjs`.
// Nothing secret is printed; the throwaway room is deleted at the end.
import { Liveblocks } from '@liveblocks/node';
import { mutateFlow } from '@liveblocks/react-flow/node';

const baseUrl = process.env.SPIKE_LIVEBLOCKS_BASE_URL ?? 'http://localhost:1153';
const cloud = process.env.SPIKE_TARGET === 'cloud';
const liveblocks = new Liveblocks(cloud ? { secret: process.env.LIVEBLOCKS_SECRET_KEY } : { secret: 'sk_localdev', baseUrl });
console.log('target:', cloud ? 'Liveblocks cloud (development project)' : baseUrl);
const room = `cspike${Date.now().toString(36)}`.padEnd(25, '0').slice(0, 25);
const out = (label, value) => console.log(`${label}:`, JSON.stringify(value));

await liveblocks.getOrCreateRoom(room, { defaultAccesses: [] });

// (e) access tokens minted through the node client against the dev server.
const session = liveblocks.prepareSession('user_spike', { userInfo: { name: 'Spike', avatar: null, color: '#52A8FF' } });
session.allow(room, ['*:read']);
const auth = await session.authorize();
const token = JSON.parse(auth.body).token;
const claims = token ? JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) : null;
out('(e) authorize status', auth.status);
out('(e) token claims (perms, uid, info)', claims && { perms: claims.perms, uid: claims.uid, info: claims.ui });

// (a) mutateStorage: changes are visible inside the callback at once and persisted once the promise resolves.
let seenInside;
await liveblocks.mutateStorage(room, ({ root }) => {
  root.set('probe', 1);
  seenInside = root.get('probe');
});
out('(a) value read inside callback right after set', seenInside);
out('(a) storage after await', (await liveblocks.getStorageDocument(room, 'json')).probe);

// (b) mutateFlow.updateNode(partial) merge depth vs updateNodeData.
await mutateFlow({ client: liveblocks, roomId: room }, (flow) => {
  flow.addNode({ id: 'n1', type: 'service', position: { x: 0, y: 0 }, data: { label: 'A', color: 'blue', meta: { a: 1, b: 2 } } });
});
await mutateFlow({ client: liveblocks, roomId: room }, (flow) => flow.updateNode('n1', { data: { label: 'B' } }));
out('(b) data after updateNode(id, { data: { label } })', (await liveblocks.getStorageDocument(room, 'json')).flow.nodes.n1.data);
await mutateFlow({ client: liveblocks, roomId: room }, (flow) => {
  flow.updateNode('n1', { data: { label: 'B', color: 'blue', meta: { a: 1, b: 2 } } });
  flow.updateNodeData('n1', { meta: { a: 9 } });
});
out('(b) data after updateNodeData(id, { meta: { a } })', (await liveblocks.getStorageDocument(room, 'json')).flow.nodes.n1.data);
out('Storage JSON shape', await liveblocks.getStorageDocument(room, 'json'));

// (f) deleteStorageDocument on the dev server.
try {
  await liveblocks.deleteStorageDocument(room);
  out('(f) storage after deleteStorageDocument', await liveblocks.getStorageDocument(room, 'json'));
} catch (err) {
  out('(f) deleteStorageDocument failed', String(err));
}

// Helpers F05 ships: broadcastEvent and deleteRoom on the dev server.
try {
  await liveblocks.broadcastEvent(room, { type: 'KICK', userId: 'user_spike' });
  out('broadcastEvent (no one connected)', 'ok');
} catch (err) {
  out('broadcastEvent failed', String(err));
}
await liveblocks.deleteRoom(room);
await liveblocks.deleteRoom(room);
out('deleteRoom twice (missing room does not throw)', 'ok');
