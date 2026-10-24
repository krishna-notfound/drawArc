import { randomBytes } from 'node:crypto';

import { neon } from '@neondatabase/serverless';

/**
 * Direct rows in the database the dev server uses (DATABASE_URL), so room specs do not depend on the project
 * UI. Rows are removed by `deleteProject` (members cascade).
 */
function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return neon(url);
}

/** A cuid-shaped id (`c` + 24 lowercase alphanumerics), as the auth route requires. */
function cuidLike(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return `c${Array.from(randomBytes(24), (byte) => alphabet[byte % alphabet.length]).join('')}`;
}

export async function createProjectFor(ownerEmail: string, name = 'E2E room'): Promise<string> {
  const id = cuidLike();
  const rows = await sql()`
    INSERT INTO "Project" (id, "ownerId", name, "updatedAt")
    SELECT ${id}, u.id, ${name}, now() FROM "User" u WHERE u.email = ${ownerEmail.toLowerCase()} AND u."deletedAt" IS NULL
    RETURNING id`;
  if (rows.length !== 1) throw new Error('E2E owner has no User row yet (sign in once first)');
  return id;
}

export async function addMember(projectId: string, email: string, role: 'EDITOR' | 'VIEWER'): Promise<void> {
  await sql()`
    INSERT INTO "ProjectMember" (id, "projectId", email, "userId", role, "invitedById", "acceptedAt")
    SELECT ${cuidLike()}, p.id, ${email.toLowerCase()}, u.id, ${role}::"MemberRole", p."ownerId", now()
    FROM "Project" p LEFT JOIN "User" u ON u.email = ${email.toLowerCase()} WHERE p.id = ${projectId}`;
}

export async function deleteProject(projectId: string): Promise<void> {
  await sql()`DELETE FROM "Project" WHERE id = ${projectId}`;
}
