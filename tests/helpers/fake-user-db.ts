import type { UserDb } from '@/lib/users';
import type { User } from '@/lib/prisma';

type Where = { id?: string; clerkId?: string; email?: string };
type Fields = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;

const uniqueViolation = (field: string) =>
  Object.assign(new Error(`Unique constraint failed on ${field}`), { code: 'P2002' });

/**
 * In-memory stand-in for `prisma.user` covering only the calls lib/users.ts makes. It enforces the two
 * unique constraints the way Postgres does, throwing `{ code: 'P2002' }` like Prisma's known request error.
 * `$transaction` runs the callback against the same store (no rollback; enough for the single-writer L1 cases).
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

  const assertUnique = (data: Fields, selfId: string | null) => {
    for (const field of ['email', 'clerkId'] as const) {
      const value = data[field];
      if (value === undefined) continue;
      const owner = find({ [field]: value });
      if (owner && owner.id !== selfId) throw uniqueViolation(field);
    }
  };

  const user = {
    async findUnique({ where }: { where: Where }) {
      return find(where) ?? null;
    },
    async create({ data }: { data: Fields }) {
      assertUnique(data, null);
      writes += 1;
      seq += 1;
      const now = new Date();
      const row = { id: `user_${seq}`, name: null, avatarUrl: null, deletedAt: null, createdAt: now, updatedAt: now, ...data } as User;
      rows.set(row.id, row);
      return { ...row };
    },
    async update({ where, data }: { where: Where; data: Fields }) {
      const row = find(where);
      if (!row) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
      assertUnique(data, row.id);
      writes += 1;
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
    async updateMany({ where, data }: { where: Where & { deletedAt?: { not: null } }; data: Fields }) {
      const { deletedAt, ...unique } = where;
      const row = find(unique);
      if (!row || (deletedAt && row.deletedAt === null)) return { count: 0 };
      await user.update({ where: { id: row.id }, data });
      return { count: 1 };
    },
    async upsert({ where, create, update }: { where: Where; create: Fields; update: Fields }) {
      const existing = find(where);
      if (existing) return user.update({ where: { id: existing.id }, data: update });
      return user.create({ data: create });
    },
  };

  const db = {
    user,
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(db);
    },
  };

  return {
    db: db as unknown as UserDb,
    rows: () => [...rows.values()],
    writes: () => writes,
  };
}
