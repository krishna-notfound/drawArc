'use client';

import { Loader2, X } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MemberRoleValue } from '@/hooks/useShareDialog';
import type { MemberListItem } from '@/lib/projects/members';

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-brand';
const ROLE_LABEL: Record<MemberRoleValue, string> = { editor: 'Editor', viewer: 'Viewer' };

export function initialsOf(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : (source[0] ?? '?');
  return letters.toUpperCase();
}

function PersonAvatar({ name, email, avatarUrl }: { name: string | null; email: string; avatarUrl: string | null }) {
  return (
    <Avatar className="size-8 shrink-0">
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className="text-xs">{initialsOf(name, email)}</AvatarFallback>
    </Avatar>
  );
}

function Identity({ name, email, showEmail }: { name: string | null; email: string; showEmail: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium" title={name ?? email}>
        {name ?? email}
      </p>
      {name && showEmail && email ? <p className="truncate text-xs text-copy-muted">{email}</p> : null}
    </div>
  );
}

export function OwnerRow({ owner }: { owner: { name: string | null; email: string; avatarUrl: string | null } }) {
  return (
    <li className="flex items-center gap-3 py-2" data-slot="member-row" data-status="owner">
      <PersonAvatar {...owner} />
      <Identity name={owner.name} email={owner.email} showEmail />
      <Badge variant="secondary">Owner</Badge>
    </li>
  );
}

export interface MemberRowProps {
  member: MemberListItem;
  /** Owner view: role select and remove; otherwise the role is plain text (FR-002). */
  manage: boolean;
  /** Archived project: role changes are disabled, removal still works (D-033). */
  archived?: boolean;
  busy?: boolean;
  onChangeRole?: (role: MemberRoleValue) => void;
  onRemove?: () => void;
}

/** One member in the Share dialog (FR-004–FR-006): bound members show their profile, pending ones the email. */
export function MemberRow({ member, manage, archived = false, busy = false, onChangeRole, onRemove }: MemberRowProps) {
  const [confirming, setConfirming] = useState(false);
  const label = member.name ?? member.email;
  const pending = member.status === 'pending';

  if (confirming) {
    return (
      <li className="flex flex-wrap items-center gap-2 py-2" data-slot="member-row" data-status={member.status}>
        <p className="min-w-0 flex-1 truncate text-sm">Remove {label}?</p>
        <Button type="button" variant="outline" size="sm" className={FOCUS_RING} autoFocus onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className={FOCUS_RING}
          onClick={() => {
            setConfirming(false);
            onRemove?.();
          }}
        >
          Remove
        </Button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 py-2" data-slot="member-row" data-status={member.status} aria-busy={busy || undefined}>
      <PersonAvatar name={member.name} email={member.email} avatarUrl={member.avatarUrl} />
      <Identity name={member.name} email={member.email} showEmail={manage} />
      {pending ? <Badge variant="outline">Pending</Badge> : null}
      {busy ? <Loader2 className="size-4 animate-spin text-copy-muted motion-reduce:animate-none" aria-label="Updating" /> : null}
      {manage ? (
        <>
          <Select value={member.role} onValueChange={(value) => onChangeRole?.(value as MemberRoleValue)} disabled={busy || archived}>
            <SelectTrigger size="sm" className={`w-28 ${FOCUS_RING}`} aria-label={`Role for ${label}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={FOCUS_RING}
            aria-label={`Remove ${label}`}
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            <X aria-hidden="true" />
          </Button>
        </>
      ) : (
        <span className="text-sm text-copy-secondary">{ROLE_LABEL[member.role]}</span>
      )}
    </li>
  );
}
