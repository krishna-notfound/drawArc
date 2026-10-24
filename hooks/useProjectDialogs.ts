'use client';

import { useRouter } from 'next/navigation';
import { createElement, type ReactNode, useCallback, useMemo, useRef, useState, useTransition } from 'react';

import { createProject, deleteProject, renameProject } from '@/app/editor/actions';
import {
  type DialogProject,
  type DialogState,
  type ProjectDialogsApi,
  ProjectDialogsContext,
} from '@/components/editor/project-dialogs-context';
import type { ActionError, ActionResult } from '@/lib/errors';

export type { DialogProject, DialogState, ProjectDialogsApi } from '@/components/editor/project-dialogs-context';

export const STALE_APP_MESSAGE = 'The app was updated. Please reload and try again.';
export const PROJECT_GONE_MESSAGE = 'That project no longer exists.';

// A rejected action promise (network failure, "Failed to find Server Action" after a deploy, EC-007).
function toClientError(): ActionResult<never> {
  return { ok: false, error: { code: 'UPSTREAM', message: STALE_APP_MESSAGE } };
}

// Missing and foreign projects are the same FORBIDDEN to F03 (no existence leak). From the owner's own list
// either one means the project is gone, so both read "no longer exists" (EC-004).
function isGone(error: ActionError): boolean {
  return error.code === 'NOT_FOUND' || (error.code === 'FORBIDDEN' && !error.reason);
}

/**
 * Dialog/form state for Create, Rename and Delete (D-027: `useTransition` + direct action calls, not
 * `useActionState`). One instance serves a page through `ProjectDialogsProvider`.
 */
export function useProjectDialogs(currentProjectId?: string): ProjectDialogsApi {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  // useTransition's flag updates on the next render; the ref also stops a second submit in the same tick.
  const inFlight = useRef(false);
  const opener = useRef<HTMLElement | null>(null);

  const open = useCallback((next: Exclude<DialogState, null>, from?: HTMLElement | null) => {
    if (inFlight.current) return;
    opener.current = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setDialog(next);
    setName(next.kind === 'rename' ? next.project.name : '');
    setError(null);
  }, []);

  const openCreate = useCallback((from?: HTMLElement | null) => open({ kind: 'create' }, from), [open]);
  const openRename = useCallback(
    (project: DialogProject, from?: HTMLElement | null) => open({ kind: 'rename', project }, from),
    [open],
  );
  const openDelete = useCallback(
    (project: DialogProject, from?: HTMLElement | null) => open({ kind: 'delete', project }, from),
    [open],
  );
  const restoreFocus = useCallback(() => {
    if (opener.current?.isConnected) opener.current.focus();
    opener.current = null;
  }, []);
  const close = useCallback(() => {
    if (inFlight.current) return;
    setDialog(null);
    setError(null);
  }, []);

  const submit = useCallback(() => {
    if (inFlight.current || !dialog) return;
    inFlight.current = true;
    const current = dialog;
    setError(null);
    startTransition(async () => {
      const result: ActionResult<{ id: string }> =
        current.kind === 'create'
          ? await createProject({ name }).catch(toClientError)
          : current.kind === 'rename'
            ? await renameProject({ projectId: current.project.id, name }).catch(toClientError)
            : await deleteProject({ projectId: current.project.id }).catch(toClientError);
      inFlight.current = false;
      // Updates after an await must be marked again so they commit together with `pending` turning false
      // (otherwise the error renders while the form is still disabled and the field cannot take focus).
      startTransition(() => {
        if (!result.ok) {
          if (current.kind !== 'create' && isGone(result.error)) {
            setError({ code: 'NOT_FOUND', message: PROJECT_GONE_MESSAGE });
            router.refresh();
          } else {
            setError(result.error);
          }
          return;
        }
        setDialog(null);
        if (current.kind === 'create') router.push(`/editor/${result.data.id}`);
        if (current.kind === 'delete' && current.project.id === currentProjectId) router.push('/editor');
      });
    });
  }, [dialog, name, router, currentProjectId]);

  return useMemo(
    () => ({ dialog, name, pending, error, openCreate, openRename, openDelete, close, restoreFocus, setName, submit }),
    [dialog, name, pending, error, openCreate, openRename, openDelete, close, restoreFocus, submit],
  );
}

export function ProjectDialogsProvider({ currentProjectId, children }: { currentProjectId?: string; children: ReactNode }) {
  const api = useProjectDialogs(currentProjectId);
  return createElement(ProjectDialogsContext.Provider, { value: api }, children);
}
