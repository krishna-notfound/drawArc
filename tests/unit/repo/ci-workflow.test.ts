// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { SERVER_KEYS } from '../../../scripts/check-bundle-secrets.mjs';

interface Step {
  uses?: string;
  run?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
}
interface Workflow {
  on: { push: { branches: string[] }; pull_request?: unknown };
  jobs: Record<string, { steps: Step[] }>;
}

const workflow = parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as Workflow;
const steps = Object.values(workflow.jobs)[0]?.steps ?? [];

describe('.github/workflows/ci.yml (F00 AC-016)', () => {
  it('runs on pushes to main/master and on pull requests', () => {
    expect(workflow.on.push.branches).toEqual(['main', 'master']);
    expect(workflow.on).toHaveProperty('pull_request');
  });

  it('uses the Node version from .nvmrc', () => {
    const setupNode = steps.find((step) => step.uses?.startsWith('actions/setup-node'));
    expect(setupNode?.with?.['node-version-file']).toBe('.nvmrc');
  });

  it('runs the quality gate steps in order', () => {
    expect(steps.filter((step) => step.run).map((step) => step.run)).toEqual([
      'npm ci',
      'npm run check',
      'npm run build',
      'npm run check:bundle',
      'npm audit --audit-level=high',
    ]);
  });

  it('builds with a sentinel value for every server secret', () => {
    const build = steps.find((step) => step.run === 'npm run build');
    SERVER_KEYS.forEach((key) => expect(build?.env?.[key]).toContain('SENTINEL'));
  });

  // Without these, check:bundle prints "no sentinel values set" and passes without checking anything.
  it('gives the bundle check the same sentinel secrets as the build (review finding)', () => {
    const build = steps.find((step) => step.run === 'npm run build');
    const bundleCheck = steps.find((step) => step.run === 'npm run check:bundle');
    SERVER_KEYS.forEach((key) => expect(bundleCheck?.env?.[key]).toBe(build?.env?.[key]));
  });
});
