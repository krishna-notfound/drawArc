'use client';

import { createContext, useContext } from 'react';

import type { ActionError } from '@/lib/errors';
import type { ProjectListItem } from '@/lib/projects/queries';

/** The fields of a list row the dialogs need (F03 `ProjectListItem`). */
export type DialogProject = Pick<ProjectListItem, 'id' | 'name'>;

export type DialogState =
  | null
  | { kind: 'create' }
  | { kind: 'rename'; project: DialogProject }
  | { kind: 'delete'; project: DialogProject };

export interface ProjectDialogsApi {
  dialog: DialogState;
  name: string;
  pending: boolean;
  error: ActionError | null;
  /** `opener` receives focus when the dialog closes; defaults to the focused element at open time. */
  openCreate(opener?: HTMLElement | null): void;
  openRename(project: DialogProject, opener?: HTMLElement | null): void;
  openDelete(project: DialogProject, opener?: HTMLElement | null): void;
  close(): void;
  /** For the dialogs' `onCloseAutoFocus`: programmatic dialogs have no Radix trigger to return to (FR-016). */
  restoreFocus(): void;
  setName(value: string): void;
  submit(): void;
}

// Kept apart from hooks/useProjectDialogs.ts (which imports the Server Actions) so the F01 sidebar can read
// the context without pulling the actions module into its tests.
export const ProjectDialogsContext = createContext<ProjectDialogsApi | null>(null);

export function useProjectDialogsContext(): ProjectDialogsApi {
  const api = useContext(ProjectDialogsContext);
  if (!api) throw new Error('useProjectDialogsContext() must be used inside <ProjectDialogsProvider>.');
  return api;
}

export function useOptionalProjectDialogs(): ProjectDialogsApi | null {
  return useContext(ProjectDialogsContext);
}
