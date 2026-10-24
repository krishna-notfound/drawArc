import { z } from 'zod';

import { ProjectIdSchema } from './project';

/** Emails are compared after `trim().toLowerCase()` only — no provider-specific alias folding (F12 non-goal). */
export const EmailSchema = z.string().trim().toLowerCase().min(3).max(254).pipe(z.email('Enter a valid email address'));
/** UI/API vocabulary; the owner is never a member, so `'owner'` is not assignable (security-model). */
export const MemberRoleSchema = z.enum(['editor', 'viewer']);
export const MemberIdSchema = z.cuid();

export const InviteMemberInput = z.object({ projectId: ProjectIdSchema, email: EmailSchema, role: MemberRoleSchema });
export const ChangeMemberRoleInput = z.object({ projectId: ProjectIdSchema, memberId: MemberIdSchema, role: MemberRoleSchema });
export const RemoveMemberInput = z.object({ projectId: ProjectIdSchema, memberId: MemberIdSchema });
export const CheckMyAccessInput = z.object({ projectId: ProjectIdSchema });

export type MemberRoleInput = z.infer<typeof MemberRoleSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberInput>;
export type ChangeMemberRoleInput = z.infer<typeof ChangeMemberRoleInput>;
export type RemoveMemberInput = z.infer<typeof RemoveMemberInput>;
