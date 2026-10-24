import type { AuthUser } from '@/lib/auth';
import type { MemberRole, PrismaClient, Project, ProjectStatus } from '@/lib/generated/prisma/client';

/**
 * DB-backed factories for the F03 L2 suites. Every row a suite writes carries its `prefix` (in clerkId and
 * email) so parallel files never touch each other's data and `cleanup` removes exactly what was made.
 */
export function createSeed(db: PrismaClient, prefix: string) {
  let n = 0;

  async function makeUser(label: string, overrides: { deletedAt?: Date | null; email?: string } = {}): Promise<AuthUser> {
    const row = await db.user.create({
      data: {
        clerkId: `${prefix}${label}_${++n}`,
        email: overrides.email ?? `${prefix}${label}_${n}@example.com`,
        name: `User ${label}`,
        avatarUrl: null,
        deletedAt: overrides.deletedAt ?? null,
      },
    });
    return { id: row.id, clerkId: row.clerkId, email: row.email, name: row.name, avatarUrl: row.avatarUrl };
  }

  function makeProject(owner: AuthUser, data: { name?: string; status?: ProjectStatus; canvasBlobPath?: string } = {}): Promise<Project> {
    return db.project.create({ data: { ownerId: owner.id, name: data.name ?? 'Seed project', ...data } });
  }

  /** A bound member when `user` is given, else an email-only (pending) invitation for `email`. */
  function makeMember(project: Project, role: MemberRole, who: { user?: AuthUser; email?: string }) {
    const email = (who.email ?? who.user?.email ?? '').toLowerCase();
    return db.projectMember.create({
      data: {
        projectId: project.id,
        email,
        role,
        userId: who.user?.id ?? null,
        acceptedAt: who.user ? new Date() : null,
        invitedById: project.ownerId,
      },
    });
  }

  async function cleanup(): Promise<void> {
    await db.project.deleteMany({ where: { owner: { clerkId: { startsWith: prefix } } } });
    await db.user.deleteMany({ where: { clerkId: { startsWith: prefix } } });
  }

  return { makeUser, makeProject, makeMember, cleanup };
}

/** A well-formed cuid that no row has. */
export function missingProjectId(): string {
  return `cmissing${Math.random().toString(36).slice(2, 12).padEnd(10, '0')}0000000`;
}
