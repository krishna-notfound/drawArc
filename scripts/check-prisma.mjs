// Runs `prisma validate` once a schema exists (F02 introduces it); until then the gate step is skipped.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const cwd = process.cwd();

if (!existsSync(join(cwd, 'prisma', 'schema.prisma'))) {
  console.log('prisma validate: skipped (no schema yet)');
  process.exit(0);
}

try {
  createRequire(join(cwd, 'noop.js')).resolve('prisma/package.json');
} catch {
  console.error('prisma validate: schema present but prisma is not installed');
  process.exit(1);
}

const result = spawnSync('npx', ['prisma', 'validate'], { cwd, stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
