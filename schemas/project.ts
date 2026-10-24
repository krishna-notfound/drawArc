import { z } from 'zod';

export const DEFAULT_PROJECT_NAME = 'Untitled Project';

/** Project ids are Prisma `cuid()`s; anything else is rejected before a query runs (EC-001). */
export const ProjectIdSchema = z.cuid();
export const ProjectNameSchema = z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer');
export const ProjectDescriptionSchema = z.string().trim().max(500, 'Description must be 500 characters or fewer');

export const CreateProjectInput = z.object({
  name: z
    .string()
    .trim()
    .max(100, 'Name must be 100 characters or fewer')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : DEFAULT_PROJECT_NAME)),
  description: ProjectDescriptionSchema.optional(),
});

export const RenameProjectInput = z.object({
  projectId: ProjectIdSchema,
  name: ProjectNameSchema,
  description: ProjectDescriptionSchema.nullable().optional(),
});

export const ProjectIdInput = z.object({ projectId: ProjectIdSchema });

export type CreateProjectInput = z.infer<typeof CreateProjectInput>;
export type RenameProjectInput = z.infer<typeof RenameProjectInput>;
export type ProjectIdInput = z.infer<typeof ProjectIdInput>;
