import type { ReactNode } from 'react';

import type { ProjectRole } from '@/lib/access';
import type { SeedResult } from '@/lib/editor/seed-hook';
import type { WorkspaceCurrentUser } from '@/lib/editor/island-props';

export type { EditorIslandProps, WorkspaceCurrentUser } from '@/lib/editor/island-props';

/**
 * Slot contract (D-028). The server page composes the slots; later features pass real nodes and never edit
 * this layout or the gate:
 * - `canvas`         F06 `<CanvasEditor {...islandProps}/>` (default: CanvasPlaceholder)
 * - `presenceSlot`   F11 `<PresenceStack/>`, which contains the UserButton and so replaces the default UserMenu
 * - `shareSlot`      F12 Share button + dialog
 * - `saveStatusSlot` F13 save status; F13 also renders `seed.warning` inside its canvas-area banner
 * - `importSlot`     F14 Import button
 * - `aiSidebar`      F16 AI sidebar body (default: F01 AiSidebar placeholder body)
 */
export interface WorkspaceProps {
  project: { id: string; name: string; status: 'ACTIVE' | 'ARCHIVED' };
  /** Real role (owner/editor/viewer) for chrome affordances; access was decided by the server gate. */
  role: ProjectRole;
  currentUser: WorkspaceCurrentUser;
  /** `<Suspense><ProjectSidebarData currentProjectId/></Suspense>` */
  sidebar: ReactNode;
  canvas?: ReactNode;
  shareSlot?: ReactNode;
  importSlot?: ReactNode;
  saveStatusSlot?: ReactNode;
  presenceSlot?: ReactNode;
  aiSidebar?: ReactNode;
  /** F13 (D-034): result of the gate's seed step. */
  seed?: SeedResult;
}
