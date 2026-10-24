'use client';

import { Loader2, Plus } from 'lucide-react';
import { type FormEvent, type RefObject, useLayoutEffect, useRef } from 'react';

import { AppDialog } from '@/components/editor/app-dialog';
import { useProjectDialogsContext } from '@/components/editor/project-dialogs-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ActionError } from '@/lib/errors';

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-brand';
const NAME_INPUT_ID = 'project-name';
const NAME_ERROR_ID = 'project-name-error';

function ErrorBanner({ message, bannerRef }: { message: string; bannerRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={bannerRef}
      role="alert"
      tabIndex={-1}
      data-slot="dialog-error"
      className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-copy-primary outline-none"
    >
      {message}
    </div>
  );
}

/** Moves focus to the field error or the banner whenever a new error arrives (FR-016). */
function useErrorFocus(error: ActionError | null) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldError = error?.fieldErrors?.name?.[0] ?? null;
  // Layout effect: focus must land before Radix's FocusScope reacts to the same commit (it refocuses the
  // dialog container when focus is on <body> after nodes are removed, e.g. the pending spinner).
  useLayoutEffect(() => {
    if (!error) return;
    if (fieldError) inputRef.current?.focus();
    else bannerRef.current?.focus();
  }, [error, fieldError]);
  return { bannerRef, inputRef, fieldError, bannerMessage: error && !fieldError ? error.message : null };
}

function PendingLabel({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
  if (!pending) return <>{idle}</>;
  return (
    <>
      <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {busy}
    </>
  );
}

/** Create and Rename share one name form; only the copy and the action differ. */
function NameDialog({ kind }: { kind: 'create' | 'rename' }) {
  const { dialog, name, pending, error, close, restoreFocus, setName, submit } = useProjectDialogsContext();
  const { bannerRef, inputRef, fieldError, bannerMessage } = useErrorFocus(error);
  const open = dialog?.kind === kind;
  const current = dialog?.kind === 'rename' ? dialog.project.name : '';

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return; // EC-017
    submit();
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) close();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restoreFocus();
      }}
      title={kind === 'create' ? 'Create project' : 'Rename project'}
      description={kind === 'rename' ? `Renaming "${current}".` : undefined}
    >
      <form className="grid gap-4" onSubmit={onSubmit} noValidate>
        {bannerMessage ? <ErrorBanner message={bannerMessage} bannerRef={bannerRef} /> : null}
        <div className="grid gap-2">
          <label htmlFor={NAME_INPUT_ID} className="text-sm font-medium">
            Project name
          </label>
          <Input
            ref={inputRef}
            id={NAME_INPUT_ID}
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            placeholder="Untitled Project"
            maxLength={100}
            autoComplete="off"
            autoFocus
            disabled={pending}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? NAME_ERROR_ID : undefined}
            className={FOCUS_RING}
          />
          {fieldError ? (
            <p id={NAME_ERROR_ID} className="text-sm text-error">
              {fieldError}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className={FOCUS_RING} disabled={pending} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" className={FOCUS_RING} disabled={pending}>
            {kind === 'create' ? (
              <PendingLabel pending={pending} idle="Create" busy="Creating…" />
            ) : (
              <PendingLabel pending={pending} idle="Save" busy="Saving…" />
            )}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}

export function CreateProjectDialog() {
  return <NameDialog kind="create" />;
}

export function RenameProjectDialog() {
  return <NameDialog kind="rename" />;
}

export function DeleteProjectDialog() {
  const { dialog, pending, error, close, restoreFocus, submit } = useProjectDialogsContext();
  const { bannerRef, bannerMessage } = useErrorFocus(error);
  const open = dialog?.kind === 'delete';
  const projectName = dialog?.kind === 'delete' ? dialog.project.name : '';

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) close();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restoreFocus();
      }}
      title="Delete project?"
      description={`"${projectName}" and its canvas, members, and room will be permanently deleted. This can't be undone.`}
      footer={
        <>
          <Button type="button" variant="outline" className={FOCUS_RING} disabled={pending} autoFocus onClick={close}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" className={FOCUS_RING} disabled={pending} onClick={submit}>
            <PendingLabel pending={pending} idle="Delete project" busy="Deleting…" />
          </Button>
        </>
      }
    >
      {bannerMessage ? <ErrorBanner message={bannerMessage} bannerRef={bannerRef} /> : null}
    </AppDialog>
  );
}

/** Mounted once per page inside ProjectDialogsProvider. */
export function ProjectDialogsHost() {
  return (
    <>
      <CreateProjectDialog />
      <RenameProjectDialog />
      <DeleteProjectDialog />
    </>
  );
}

/** The editor-home empty state's primary action (FR-001). */
export function NewProjectButton() {
  const { openCreate } = useProjectDialogsContext();
  return (
    <Button type="button" className={FOCUS_RING} onClick={(event) => openCreate(event.currentTarget)}>
      <Plus className="h-5 w-5" aria-hidden="true" />
      New Project
    </Button>
  );
}
