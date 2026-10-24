// Dependency pin policy D-023 (F15 FR-013, AC-024): `@xyflow/react` ~12.12, every `@liveblocks/*` on one exact
// version, the Prisma trio ~7.10. Run by `npm run check:pins` in CI's audit job; the unit test reuses checkPins.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PRISMA = ['prisma', '@prisma/client', '@prisma/adapter-neon'];

/** Returns one message per violation (empty when the policy holds). Absent packages are not required. */
export function checkPins(pkg) {
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  const failures = [];

  const xyflow = all['@xyflow/react'];
  if (xyflow && !/^~12\.12\.\d+$/.test(xyflow)) failures.push(`@xyflow/react must be ~12.12.x (found ${xyflow})`);

  const liveblocks = Object.entries(all).filter(([name]) => name.startsWith('@liveblocks/'));
  for (const [name, range] of liveblocks) {
    if (!/^\d+\.\d+\.\d+$/.test(range)) failures.push(`${name} must be an exact version (found ${range})`);
  }
  if (new Set(liveblocks.map(([, range]) => range)).size > 1) {
    failures.push(`all @liveblocks/* packages must share one version (found ${liveblocks.map(([n, r]) => `${n}@${r}`).join(', ')})`);
  }

  for (const name of PRISMA) {
    const range = all[name];
    if (range && !/^~7\.10\.\d+$/.test(range)) failures.push(`${name} must be ~7.10.x (found ${range})`);
  }
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = checkPins(JSON.parse(readFileSync('package.json', 'utf8')));
  for (const failure of failures) console.error(`check:pins: ${failure}`);
  if (failures.length === 0) console.log('check:pins: dependency pins match D-023');
  process.exit(failures.length === 0 ? 0 : 1);
}
