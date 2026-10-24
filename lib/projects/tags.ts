// Cache tag scheme (D-026): per-user list tags plus one tag per listed project, so a rename or delete
// invalidates every member's list with a single `updateTag('project:{id}')`. Tags are stored in plain
// text, so they carry ids only — never an email.
export const ownedTag = (userId: string) => `projects:owned:${userId}`;
export const sharedTag = (userId: string) => `projects:shared:${userId}`;
export const projectTag = (projectId: string) => `project:${projectId}`;
