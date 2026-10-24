import { randomUUID } from 'node:crypto';

import { neon } from '@neondatabase/serverless';

/**
 * Direct fixtures against the dev server's database (DATABASE_URL from .env.local) for states the UI cannot
 * reach yet: another user's project, memberships (F12), archived projects. Rows are prefixed `e2e-f04` and
 * removed by `cleanup()`. Note: the users' cached sidebar lists are not invalidated by these writes.
 */
function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required for e2e fixtures (.env.local)');
  return neon(url);
}

/** A cuid-shaped id (`c` + 24 base-36 characters) that passes the app's z.cuid() check. */
export function fakeCuid(): string {
  return `c${randomUUID().replaceAll('-', '').slice(0, 24)}`;
}

export interface Fixtures {
  userIdByEmail(email: string): Promise<string>;
  createUser(): Promise<{ id: string; email: string }>;
  createProject(ownerId: string, name: string, status?: 'ACTIVE' | 'ARCHIVED'): Promise<string>;
  addMember(projectId: string, user: { id: string; email: string }, invitedById: string, role: 'EDITOR' | 'VIEWER'): Promise<void>;
  removeMembers(projectId: string): Promise<void>;
  deleteProjectById(projectId: string): Promise<void>;
  cleanup(): Promise<void>;
}

export function fixtures(): Fixtures {
  const db = sql();
  const users: string[] = [];
  const projects: string[] = [];

  return {
    async userIdByEmail(email) {
      const rows = await db`SELECT id FROM "User" WHERE email = ${email.toLowerCase()} AND "deletedAt" IS NULL`;
      const id = rows[0]?.id as string | undefined;
      if (!id) throw new Error(`no user row for ${email}; the setup project signs user A in first`);
      return id;
    },
    async createUser() {
      const id = fakeCuid();
      const email = `e2e-f04-${id}@example.test`;
      await db`INSERT INTO "User" (id, "clerkId", email, name, "updatedAt") VALUES (${id}, ${`e2e-f04-${id}`}, ${email}, 'E2E Owner', now())`;
      users.push(id);
      return { id, email };
    },
    async createProject(ownerId, name, status = 'ACTIVE') {
      const id = fakeCuid();
      await db`INSERT INTO "Project" (id, "ownerId", name, status, "updatedAt") VALUES (${id}, ${ownerId}, ${name}, ${status}::"ProjectStatus", now())`;
      projects.push(id);
      return id;
    },
    async addMember(projectId, user, invitedById, role) {
      await db`INSERT INTO "ProjectMember" (id, "projectId", email, "userId", role, "invitedById", "acceptedAt") VALUES (${fakeCuid()}, ${projectId}, ${user.email.toLowerCase()}, ${user.id}, ${role}::"MemberRole", ${invitedById}, now())`;
    },
    async removeMembers(projectId) {
      await db`DELETE FROM "ProjectMember" WHERE "projectId" = ${projectId}`;
    },
    async deleteProjectById(projectId) {
      await db`DELETE FROM "Project" WHERE id = ${projectId}`;
    },
    async cleanup() {
      if (projects.length) await db`DELETE FROM "Project" WHERE id = ANY(${projects})`;
      if (users.length) await db`DELETE FROM "User" WHERE id = ANY(${users})`;
    },
  };
}
