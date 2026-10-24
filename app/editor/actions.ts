'use server';

import { updateTag } from 'next/cache';

import { requireProjectRole } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { type ActionResult, toActionError } from '@/lib/errors';
import type { ProjectStatus } from '@/lib/generated/prisma/client';
import { defaultExternals } from '@/lib/projects/externals';
import { createProjectCore, deleteProjectCore, renameProjectCore, setProjectStatusCore } from '@/lib/projects/service';
import { ownedTag, projectTag } from '@/lib/projects/tags';
import { CreateProjectInput, ProjectIdInput, RenameProjectInput } from '@/schemas/project';

// Every action: authenticate → parse → authorize → mutate → updateTag, and never throws for an expected
// failure (code-standards rule 5). Inputs are `unknown`: a Server Action is a public endpoint.

type Ctx = { op: string; userId?: string; projectId?: string };
type StatusResult = ActionResult<{ id: string; status: ProjectStatus }>;

export async function createProject(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx: Ctx = { op: 'createProject' };
  try {
    const { user } = await requireUser();
    ctx.userId = user.id;
    const input = CreateProjectInput.parse(raw ?? {});
    const data = await createProjectCore({ user }, input, defaultExternals);
    updateTag(ownedTag(user.id));
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toActionError(err, ctx) };
  }
}

export async function renameProject(
  raw: unknown,
): Promise<ActionResult<{ id: string; name: string; description: string | null }>> {
  const ctx: Ctx = { op: 'renameProject' };
  try {
    const { user } = await requireUser();
    ctx.userId = user.id;
    const input = RenameProjectInput.parse(raw);
    ctx.projectId = input.projectId;
    const { project } = await requireProjectRole(input.projectId, 'owner');
    const data = await renameProjectCore({ user, project }, input);
    updateTag(projectTag(project.id));
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toActionError(err, ctx) };
  }
}

async function setStatus(op: string, raw: unknown, status: ProjectStatus): Promise<StatusResult> {
  const ctx: Ctx = { op };
  try {
    const { user } = await requireUser();
    ctx.userId = user.id;
    const input = ProjectIdInput.parse(raw);
    ctx.projectId = input.projectId;
    const { project } = await requireProjectRole(input.projectId, 'owner');
    const data = await setProjectStatusCore({ user, project }, status);
    updateTag(projectTag(project.id));
    updateTag(ownedTag(user.id));
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toActionError(err, ctx) };
  }
}

export async function archiveProject(raw: unknown): Promise<StatusResult> {
  return setStatus('archiveProject', raw, 'ARCHIVED');
}

export async function unarchiveProject(raw: unknown): Promise<StatusResult> {
  return setStatus('unarchiveProject', raw, 'ACTIVE');
}

export async function deleteProject(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx: Ctx = { op: 'deleteProject' };
  try {
    const { user } = await requireUser();
    ctx.userId = user.id;
    const input = ProjectIdInput.parse(raw);
    ctx.projectId = input.projectId;
    const { project } = await requireProjectRole(input.projectId, 'owner');
    const data = await deleteProjectCore({ user, project }, defaultExternals);
    updateTag(projectTag(project.id));
    updateTag(ownedTag(user.id));
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toActionError(err, ctx) };
  }
}
