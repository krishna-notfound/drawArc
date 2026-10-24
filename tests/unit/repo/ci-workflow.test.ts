// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { SERVER_KEYS } from '../../../scripts/check-bundle-secrets.mjs';

interface Step {
  uses?: string;
  run?: string;
  with?: Record<string, string>;
}
interface Job {
  if?: string;
  env?: Record<string, string>;
  steps: Step[];
}
interface Workflow {
  on: { push: { branches: string[] }; pull_request?: unknown } | string;
  jobs: Record<string, Job>;
}

const workflow = parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as Workflow;
const preview = parse(readFileSync('.github/workflows/e2e-preview.yml', 'utf8')) as Workflow;
const runs = (job: Job | undefined) => (job?.steps ?? []).filter((step) => step.run).map((step) => step.run);

describe('.github/workflows/ci.yml (F00 AC-016, F15 AC-025)', () => {
  it('runs on pushes to main/master and on pull requests', () => {
    const on = workflow.on as { push: { branches: string[] } };
    expect(on.push.branches).toEqual(['main', 'master']);
    expect(workflow.on).toHaveProperty('pull_request');
  });

  it('has the check, build and audit jobs, each on the Node version from .nvmrc', () => {
    expect(Object.keys(workflow.jobs)).toEqual(['check', 'build', 'audit']);
    for (const job of Object.values(workflow.jobs)) {
      const setupNode = job.steps.find((step) => step.uses?.startsWith('actions/setup-node'));
      expect(setupNode?.with?.['node-version-file']).toBe('.nvmrc');
    }
  });

  it('runs the quality gate, the build plus bundle scan, and the audit plus pin check', () => {
    expect(runs(workflow.jobs.check)).toEqual(['npm ci', 'npm run check']);
    expect(runs(workflow.jobs.build)).toEqual(['npm ci', 'npm run build', 'npm run check:bundle']);
    expect(runs(workflow.jobs.audit)).toEqual(['npm audit --audit-level=high', 'npm run check:pins']);
  });

  // Without these, check:bundle would only pattern-scan and never prove the server values stay out.
  it('builds and scans with a sentinel value for every server secret', () => {
    SERVER_KEYS.forEach((key) => expect(workflow.jobs.build?.env?.[key]).toContain('SENTINEL'));
  });
});

describe('.github/workflows/e2e-preview.yml (F15 AC-025)', () => {
  it('runs e2e-on-preview only for successful Vercel preview deployments, against their URL', () => {
    expect(preview.on).toBe('deployment_status');
    const job = preview.jobs['e2e-on-preview'];
    expect(job?.if).toContain("deployment_status.state == 'success'");
    expect(job?.if).toContain("'Preview'");
    expect(job?.env?.E2E_BASE_URL).toContain('github.event.deployment_status');
    expect(runs(job)).toContain('npm run e2e:preview');
  });
});
