'use client';

import { useRouter } from 'next/navigation';
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';

import { changeMemberRole, inviteMember, removeMember } from '@/app/editor/[projectId]/actions';
import type { ActionError, ActionResult } from '@/lib/errors';

export type MemberRoleValue = 'editor' | 'viewer';
export interface ShareNotice {
  tone: 'error' | 'warning';
  message: string;
}

export const SHARE_COPY = {
  rateLimited: "You've sent too many invitations. Try again in an hour.",
  archived: 'This project is archived. Unarchive it to manage sharing.',
  memberGone: 'This member was already removed.',
  notDelivered: 'Access updated, but they may stay connected until they reload.',
  staleApp: 'Something went wrong. Please reload the page and try again.',
} as const;

const COPIED_MS = 2000;
const INVITE_KEY = 'invite';

function toClientError(): ActionResult<never> {
  return { ok: false, error: { code: 'UPSTREAM', message: SHARE_COPY.staleApp } };
}

/** FR-019: field errors stay inline under the email input; everything else becomes a banner. */
function inviteFieldError(error: ActionError): string | null {
  if (error.code === 'VALIDATION') return error.fieldErrors?.email?.[0] ?? null;
  if (error.code === 'CONFLICT' && (error.reason === 'SELF_INVITE' || error.reason === 'DUPLICATE_MEMBER')) return error.message;
  return null;
}

function bannerFor(error: ActionError): string {
  if (error.code === 'RATE_LIMITED') return SHARE_COPY.rateLimited;
  if (error.reason === 'PROJECT_ARCHIVED') return SHARE_COPY.archived;
  if (error.code === 'NOT_FOUND') return SHARE_COPY.memberGone;
  return error.message;
}

/**
 * Share dialog state (D-027 pattern: `useTransition` + direct action calls). Each row and the invite form has
 * its own pending key; the list itself comes from server props, which `updateTag` refreshes in the same
 * response. State lives as long as the dialog body, so closing the dialog resets it.
 */
export function useShareDialog(projectId: string, emailRef: RefObject<HTMLInputElement | null>) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const inFlight = useRef(new Set<string>());
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRoleValue>('editor');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ShareNotice | null>(null);
  const [focusEmail, setFocusEmail] = useState(0);

  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const copiedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  // After a successful invite the input is enabled again in the same commit; focus it then (FR UX table).
  useLayoutEffect(() => {
    if (focusEmail) emailRef.current?.focus();
  }, [focusEmail, emailRef]);

  const run = useCallback(
    <T>(key: string, call: () => Promise<ActionResult<T>>, done: (result: ActionResult<T>) => void) => {
      if (inFlight.current.has(key)) return;
      inFlight.current.add(key);
      setBusy((prev) => new Set(prev).add(key));
      setNotice(null);
      startTransition(async () => {
        const result = await call().catch(toClientError);
        inFlight.current.delete(key);
        // Marked again so the result commits together with the refreshed server props.
        startTransition(() => {
          setBusy((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          done(result);
        });
      });
    },
    [],
  );

  const memberFailed = useCallback(
    (error: ActionError) => {
      setNotice({ tone: 'error', message: bannerFor(error) });
      if (error.code === 'NOT_FOUND') router.refresh();
    },
    [router],
  );

  const invite = useCallback(() => {
    setEmailError(null);
    run(INVITE_KEY, () => inviteMember({ projectId, email, role }), (result) => {
      if (result.ok) {
        setEmail('');
        setFocusEmail((n) => n + 1);
        return;
      }
      const field = inviteFieldError(result.error);
      if (field) setEmailError(field);
      else setNotice({ tone: 'error', message: bannerFor(result.error) });
    });
  }, [projectId, email, role, run]);

  const changeRole = useCallback(
    (memberId: string, next: MemberRoleValue) =>
      run(memberId, () => changeMemberRole({ projectId, memberId, role: next }), (result) => {
        if (!result.ok) memberFailed(result.error);
        else if (!result.data.kickDelivered) setNotice({ tone: 'warning', message: SHARE_COPY.notDelivered });
      }),
    [projectId, run, memberFailed],
  );

  const remove = useCallback(
    (memberId: string) =>
      run(memberId, () => removeMember({ projectId, memberId }), (result) => {
        if (!result.ok) memberFailed(result.error);
        else if (!result.data.kickDelivered) setNotice({ tone: 'warning', message: SHARE_COPY.notDelivered });
      }),
    [projectId, run, memberFailed],
  );

  const copyLink = useCallback(async () => {
    const url = `${window.location.origin}/editor/${projectId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyFallback(null);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Permission denied or an insecure context (EC-016): let the user copy it by hand.
      setCopyFallback(url);
    }
  }, [projectId]);

  return {
    email,
    setEmail,
    role,
    setRole,
    emailError,
    notice,
    inviting: busy.has(INVITE_KEY),
    isBusy: (memberId: string) => busy.has(memberId),
    invite,
    changeRole,
    remove,
    copied,
    copyFallback,
    copyLink,
  };
}
