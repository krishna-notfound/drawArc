// @vitest-environment node
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const eslint = new ESLint({ overrideConfigFile: 'eslint.config.mjs' });

async function ruleIds(code: string, filePath: string): Promise<(string | null)[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.map((message) => message.ruleId) ?? [];
}

// Loading the Next.js ESLint config is slow on first use; warm it once instead of racing the default 5 s timeout.
beforeAll(async () => {
  await eslint.lintText('export {};\n', { filePath: 'lib/warmup.ts' });
}, 60_000);

describe('ESLint rules (F00 FR-008)', { timeout: 20_000 }, () => {
  it('bans console outside scripts/ (AC-011)', async () => {
    expect(await ruleIds("console.log('x');\n", 'lib/x.ts')).toContain('no-console');
    expect(await ruleIds("console.log('x');\n", 'scripts/x.mjs')).not.toContain('no-console');
  });

  it('bans process.env outside the allow-list (AC-012)', async () => {
    const code = 'export const x = process.env.FOO;\n';
    expect(await ruleIds(code, 'components/x.ts')).toContain('no-restricted-syntax');
    expect(await ruleIds(code, 'lib/env.ts')).not.toContain('no-restricted-syntax');
  });

  it('still bans process.env inside app/ where segment exports are also banned', async () => {
    expect(await ruleIds('export const x = process.env.FOO;\n', 'app/x/page.tsx')).toContain('no-restricted-syntax');
  });

  it('bans computed process.env access in lib/env.public.ts (EC-003)', async () => {
    expect(await ruleIds("const k = 'A';\nexport const x = process.env[k];\n", 'lib/env.public.ts')).toContain(
      'no-restricted-syntax',
    );
  });

  it.each(['runtime', 'dynamic', 'revalidate', 'fetchCache', 'dynamicParams'])(
    'bans `export const %s` under app/ (AC-013)',
    async (name) => {
      expect(await ruleIds(`export const ${name} = 'x';\n`, 'app/x/page.tsx')).toContain('no-restricted-syntax');
    },
  );

  it('allows other exports such as metadata under app/ (AC-013)', async () => {
    expect(await ruleIds('export const metadata = {};\n', 'app/x/page.tsx')).not.toContain('no-restricted-syntax');
  });

  it('stops lib/ from importing UI layers (AC-014)', async () => {
    const code = "import { x } from '@/components/ui/button';\nexport default x;\n";
    expect(await ruleIds(code, 'lib/foo.ts')).toContain('no-restricted-imports');
    expect(await ruleIds(code, 'components/foo.tsx')).not.toContain('no-restricted-imports');
  });
});
