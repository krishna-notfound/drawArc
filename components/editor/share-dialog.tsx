'use client';

import { Link as LinkIcon, Loader2, UserPlus } from 'lucide-react';
import { type FormEvent, useId, useRef } from 'react';

import { AppDialog } from '@/components/editor/app-dialog';
import { MemberRow, OwnerRow } from '@/components/editor/member-row';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type MemberRoleValue, type ShareNotice, useShareDialog } from '@/hooks/useShareDialog';
import type { ProjectRole } from '@/lib/access';
import type { ProjectMembers } from '@/lib/projects/members';

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-brand';

export const OWNER_DESCRIPTION = "Invite people by email. They'll see this project under Shared with me after they sign in.";
export const MEMBER_DESCRIPTION = 'People with access to this project.';

export interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Focus target on close (the Share button); the dialog is opened without a Radix trigger. */
  onCloseAutoFocus?: (event: Event) => void;
  projectId: string;
  projectStatus: 'ACTIVE' | 'ARCHIVED';
  role: ProjectRole;
  members: ProjectMembers;
}

/** Share project dialog (FR-001–FR-007, FR-019). Owners manage access; editors and viewers only see it. */
export function ShareDialog({ open, onOpenChange, onCloseAutoFocus, role, ...body }: ShareDialogProps) {
  const isOwner = role === 'owner';
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title="Share project"
      description={isOwner ? OWNER_DESCRIPTION : MEMBER_DESCRIPTION}
    >
      {/* Rendered only while open, so its state (banners, confirmations, copied flag) resets on close. */}
      <ShareDialogBody {...body} isOwner={isOwner} onDone={() => onOpenChange(false)} />
    </AppDialog>
  );
}

function Notice({ notice }: { notice: ShareNotice }) {
  const tone = notice.tone === 'error' ? 'border-error/40 bg-error/10' : 'border-warning/40 bg-warning/10';
  return (
    <div role="alert" data-slot="share-notice" data-tone={notice.tone} className={`rounded-xl border px-3 py-2 text-sm text-copy-primary ${tone}`}>
      {notice.message}
    </div>
  );
}

function ShareDialogBody({
  projectId,
  projectStatus,
  members,
  isOwner,
  onDone,
}: Omit<ShareDialogProps, 'open' | 'onOpenChange' | 'onCloseAutoFocus' | 'role'> & { isOwner: boolean; onDone: () => void }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const share = useShareDialog(projectId, emailRef);
  const archived = projectStatus === 'ARCHIVED';
  const emailId = useId();
  const emailErrorId = `${emailId}-error`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (share.inviting || archived) return;
    share.invite();
  }

  return (
    <div className="grid min-w-0 gap-4">
      {share.notice ? <Notice notice={share.notice} /> : null}

      {isOwner ? (
        <form className="grid gap-2" onSubmit={onSubmit} noValidate>
          <label htmlFor={emailId} className="text-sm font-medium">
            Email
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              ref={emailRef}
              id={emailId}
              name="email"
              type="email"
              value={share.email}
              onChange={(event) => share.setEmail(event.target.value)}
              placeholder="name@example.com"
              maxLength={254}
              autoComplete="off"
              autoFocus
              disabled={share.inviting || archived}
              aria-invalid={share.emailError ? true : undefined}
              aria-describedby={share.emailError ? emailErrorId : undefined}
              className={`min-w-0 flex-1 ${FOCUS_RING}`}
            />
            <Select value={share.role} onValueChange={(value) => share.setRole(value as MemberRoleValue)} disabled={share.inviting || archived}>
              <SelectTrigger className={`w-full sm:w-28 ${FOCUS_RING}`} aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" className={FOCUS_RING} disabled={share.inviting || archived}>
              {share.inviting ? (
                <>
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Inviting…
                </>
              ) : (
                <>
                  <UserPlus aria-hidden="true" />
                  Invite
                </>
              )}
            </Button>
          </div>
          {share.emailError ? (
            <p id={emailErrorId} className="text-sm text-error">
              {share.emailError}
            </p>
          ) : null}
          {archived ? <p className="text-sm text-copy-muted">Archived projects can&apos;t be shared.</p> : null}
        </form>
      ) : null}

      <ul aria-label="People with access" className="grid max-h-80 divide-y divide-surface-border overflow-y-auto">
        <OwnerRow owner={members.owner} />
        {members.members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            manage={isOwner}
            archived={archived}
            busy={share.isBusy(member.id)}
            onChangeRole={(next) => share.changeRole(member.id, next)}
            onRemove={() => share.remove(member.id)}
          />
        ))}
      </ul>
      {members.members.length === 0 ? <p className="text-sm text-copy-muted">No one else has access yet.</p> : null}

      {share.copyFallback ? (
        <div className="grid gap-2">
          <p className="text-sm text-copy-secondary">Couldn&apos;t copy — select the link below</p>
          <Input readOnly value={share.copyFallback} aria-label="Project link" onFocus={(event) => event.currentTarget.select()} className={FOCUS_RING} />
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className={FOCUS_RING} onClick={() => void share.copyLink()}>
          <LinkIcon aria-hidden="true" />
          {share.copied ? 'Copied!' : 'Copy link'}
        </Button>
        <Button type="button" className={FOCUS_RING} onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
