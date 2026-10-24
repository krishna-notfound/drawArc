'use client';

import Image from 'next/image';
import { useState } from 'react';

import { initials } from '@/lib/initials';
import { displayName } from '@/lib/presence';
import { cn } from '@/lib/utils';

export interface PresenceAvatarProps {
  name: string;
  avatar: string | null;
  color: string;
  className?: string;
}

/**
 * A 32 px participant avatar (FR-006, FR-009; P-11-4): the Clerk image (only `img.clerk.com` is allowed by
 * `images.remotePatterns`) or, without one or when it fails to load, initials on an elevated disc. A `--bg-base`
 * ring separates overlapping avatars and an outline in the user's colour ties the avatar to their cursor.
 */
export function PresenceAvatar({ name, avatar, color, className }: PresenceAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const label = displayName(name);
  const frame = cn(
    'block size-8 shrink-0 rounded-full ring-2 ring-(--bg-base) outline-2 outline-offset-2 outline-solid',
    className,
  );
  if (avatar && failedSrc !== avatar) {
    return (
      <Image
        src={avatar}
        alt={label}
        width={32}
        height={32}
        className={cn(frame, 'object-cover')}
        style={{ outlineColor: color }}
        onError={() => setFailedSrc(avatar)}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(frame, 'flex items-center justify-center bg-elevated text-xs font-medium text-copy-primary')}
      style={{ outlineColor: color }}
    >
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  );
}
