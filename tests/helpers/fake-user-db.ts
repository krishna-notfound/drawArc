import type { UserDb } from '@/lib/users';
import type { User } from '@/lib/prisma';

type Where = { id?: string; clerkId?: string; email?: string };
type Fields = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * In-memory stand-in for `prisma.user` covering only the calls lib/users.ts makes. It enforces the two
 * unique constraints the way Postgres does, throwing `{ code: 'P2002' }` like Prisma's known request error.
 */
export function createFakeUserDb(initial: User[] = []) {
  const rows = new Map<string, User>(initial.map((row) => [row.id, { ...row }]));
  let seq = 0;
  let writes = 0;

  const find = (where: Where): User | undefined =>
    [...rows.values()].find(
      (row) =>
        (where.id === undefined || row.id === where.id) &&
        (where.clerkId === undefined || row.clerkId === where.clerkId) &&
        (where.email === undefined || row.email === where.email),
    );

  const assertUniqueEmail = (email: string | undefined, selfId: string | null) => {
    if (email === undefined) return;
    const owner = find({ email });
    if (owner && owner.id !== selfId) throw Object.assign(new Error('Unique constraint failed on email'), { code: 'P2002' });
  };

  const user = {
    async findUnique({ where }: { where: Where }) {
      return find(where) ?? null;
    },
    async update({ where, data }: { where: Where; data: Fields }) {
      const row = find(where);
      if (!row) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
      assertUniqueEmail(data.email, row.id);
      writes += 1;
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
    async upsert({ where, create, update }: { where: Where; create: Fields; update: Fields }) {
      const existing = find(where);
      if (existing) return user.update({ where: { id: existing.id }, data: update });
      assertUniqueEmail(create.email, null);
      writes += 1;
      seq += 1;
      const now = new Date();
      const row = {
        id: `user_${seq}`,
        name: null,
        avatarUrl: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        ...create,
      } as User;
      rows.set(row.id, row);
      return { ...row };
    },
  };

  return {
    db: { user } as unknown as UserDb,
    rows: () => [...rows.values()],
    writes: () => writes,
  };
}
