'use client';

import { type ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface IconButtonProps extends Omit<ComponentProps<typeof Button>, 'aria-label'> {
  /** Accessible name and tooltip text (FR-020). */
  label: string;
}

/** Icon-only chrome button: aria-label, tooltip, brand focus ring, `h-5 w-5` icon. */
export function IconButton({ label, className, variant = 'ghost', size = 'icon', ...props }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          aria-label={label}
          className={cn(
            'focus-visible:ring-2 focus-visible:ring-brand',
            // shadcn Button forces `size-4` on unsized icons; chrome buttons use `h-5 w-5` (ui-context "Icons").
            "[&_svg:not([class*='size-'])]:size-5",
            // shadcn's `transition-all` also animates the inherited `visibility`, which keeps a close button
            // unfocusable for a frame after its SidebarPanel opens; transition only the visual properties.
            'transition-[color,background-color,border-color,box-shadow]',
            className,
          )}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
