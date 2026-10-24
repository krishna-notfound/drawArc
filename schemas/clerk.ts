import { z } from 'zod';

/** What drawArc keeps of a Clerk user (the `User` row's Clerk-derived fields). */
export const ClerkUserInputSchema = z.object({
  clerkId: z.string().min(1),
  email: z.email(),
  name: z.string().min(1).nullable(),
  avatarUrl: z.string().min(1).nullable(),
});
export type ClerkUserInput = z.infer<typeof ClerkUserInputSchema>;

// Webhook payloads are signature-verified but still parsed before use (NFR-002). Only the fields we read
// are declared; nullable/optional are lenient on purpose so a cosmetic Clerk change cannot drop a delivery.
export const ClerkWebhookUserSchema = z.object({
  id: z.string().min(1),
  email_addresses: z.array(z.object({ id: z.string(), email_address: z.string() })),
  primary_email_address_id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  username: z.string().nullish(),
  image_url: z.string().nullish(),
});
export type ClerkWebhookUser = z.infer<typeof ClerkWebhookUserSchema>;

export const ClerkDeletedSchema = z.object({
  id: z.string().min(1).optional(),
  deleted: z.boolean().optional(),
});
