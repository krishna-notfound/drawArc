import type { CSSProperties, ReactNode } from 'react';

import { NODE_COLORS, type NodeColorId, type NodeShape } from '@/types/canvas';

export interface ShapeRendererProps {
  shape: NodeShape;
  color: NodeColorId;
  selected?: boolean;
  /** Drag preview (F07 ghost): dashed brand outline. */
  ghost?: boolean;
  children?: ReactNode;
  className?: string;
}

type CssShape = 'rectangle' | 'pill' | 'circle';
type SvgShape = 'diamond' | 'hexagon' | 'cylinder';

const RADIUS: Record<CssShape, CSSProperties['borderRadius']> = { rectangle: 12, pill: 9999, circle: '50%' };

function outline(selected: boolean, ghost: boolean) {
  if (ghost) return { color: 'var(--accent-primary)', width: 1, dash: '4 3' };
  return selected
    ? { color: 'var(--accent-primary)', width: 2, dash: undefined }
    : { color: 'var(--border-default)', width: 1, dash: undefined };
}

/** SVG outlines on a 100 × 100 box; `preserveAspectRatio="none"` stretches them to the node's width/height. */
function SvgOutline({ shape, fill, width, dash }: { shape: SvgShape; fill: string; width: number; dash?: string }) {
  const stroke = { fill, stroke: 'currentColor', strokeWidth: width, strokeDasharray: dash, vectorEffect: 'non-scaling-stroke' } as const;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      {shape === 'diamond' ? <polygon points="50,0 100,50 50,100 0,50" {...stroke} /> : null}
      {shape === 'hexagon' ? <polygon points="25,0 75,0 100,50 75,100 25,100 0,50" {...stroke} /> : null}
      {shape === 'cylinder' ? (
        <>
          <path d="M0,10 A50,10 0 0 1 100,10 L100,90 A50,10 0 0 1 0,90 Z" {...stroke} />
          <ellipse cx="50" cy="10" rx="50" ry="10" {...stroke} />
        </>
      ) : null}
    </svg>
  );
}

/**
 * Pure presentational shape (FR-009), shared by canvas nodes and the palette drag ghost. Rectangle, pill and
 * circle are CSS boxes; diamond, hexagon and cylinder are inline SVG that scale with the node's size.
 */
export function ShapeRenderer({ shape, color, selected = false, ghost = false, children, className }: ShapeRendererProps) {
  const colors = NODE_COLORS[color];
  const line = outline(selected, ghost);
  const base = `relative flex h-full w-full items-center justify-center ${className ?? ''}`;

  switch (shape) {
    case 'rectangle':
    case 'pill':
    case 'circle':
      return (
        <div
          data-shape={shape}
          className={base}
          style={{
            background: colors.fill,
            color: colors.text,
            borderRadius: RADIUS[shape],
            border: `${line.width}px ${ghost ? 'dashed' : 'solid'} ${line.color}`,
          }}
        >
          {children}
        </div>
      );
    case 'diamond':
    case 'hexagon':
    case 'cylinder':
      return (
        <div data-shape={shape} className={base} style={{ color: colors.text }}>
          {/* The wrapper's `color` is the outline token for `currentColor`; the label resets it. */}
          <span className="absolute inset-0" style={{ color: line.color }}>
            <SvgOutline shape={shape} fill={colors.fill} width={line.width} dash={line.dash} />
          </span>
          {children}
        </div>
      );
    default: {
      const unreachable: never = shape;
      return unreachable;
    }
  }
}
