'use client';

import type { XYPosition } from '@xyflow/react';
import { type KeyboardEvent, type MouseEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_SIZES, type NodeShape } from '@/types/canvas';

/** Pointer travel (px) that turns a press into a drag; less is a click (FR-002, FR-007). */
export const DRAG_THRESHOLD_PX = 4;

export interface ShapeDragState {
  shape: NodeShape;
  /** Pointer position (client px); the ghost is centred here. */
  x: number;
  y: number;
  /** Ghost size: the shape's default size at the current zoom. */
  width: number;
  height: number;
  overPane: boolean;
}

export interface ShapeDragOptions {
  /** The React Flow root (`.react-flow`) that drops must land inside. */
  getContainer(): HTMLElement | null;
  getZoom(): number;
  /** A drag ended over the flow pane at `client`. */
  onDrop(shape: NodeShape, client: XYPosition): void;
  /** A click or Enter/Space without a drag: place the shape at the viewport centre. */
  onPlace(shape: NodeShape): void;
}

export interface ShapeButtonProps {
  onPointerDown(e: PointerEvent<HTMLElement>): void;
  onPointerMove(e: PointerEvent<HTMLElement>): void;
  onPointerUp(e: PointerEvent<HTMLElement>): void;
  onPointerCancel(e: PointerEvent<HTMLElement>): void;
  onLostPointerCapture(e: PointerEvent<HTMLElement>): void;
  onClick(e: MouseEvent<HTMLElement>): void;
  onKeyDown(e: KeyboardEvent<HTMLElement>): void;
}

interface Session {
  shape: NodeShape;
  pointerId: number;
  target: HTMLElement;
  startX: number;
  startY: number;
  dragging: boolean;
}

/**
 * True when `el` is part of the flow pane inside `container`. The ghost has `pointer-events: none`, so
 * `elementFromPoint` sees through it to whatever is under the pointer (FR-013).
 */
export function isInsidePane(el: Element | null, container: HTMLElement | null): boolean {
  return Boolean(el && container?.contains(el) && el.closest('.react-flow__pane'));
}

/**
 * Pointer-events drag from a palette button (D-07b): pointer capture keeps the gesture on the button wherever the
 * pointer goes, so no ancestor drop target has to cooperate (reference bug: parent swallowing DnD events). The
 * ghost state is rAF-throttled; cancel paths are pointercancel, lost capture, Escape and window blur.
 */
export function useShapeDrag({ getContainer, getZoom, onDrop, onPlace }: ShapeDragOptions) {
  const [drag, setDrag] = useState<ShapeDragState | null>(null);
  const session = useRef<Session | null>(null);
  const latest = useRef<ShapeDragState | null>(null);
  const frame = useRef<number | null>(null);
  // A drag is followed by a `click` on the captured button; it must not also place a shape.
  const suppressClick = useRef(false);
  const options = useRef({ getContainer, getZoom, onDrop, onPlace });
  useEffect(() => {
    options.current = { getContainer, getZoom, onDrop, onPlace };
  });

  const end = useCallback(() => {
    const s = session.current;
    session.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    latest.current = null;
    document.documentElement.classList.remove('shape-dragging');
    setDrag(null);
    if (s?.target.hasPointerCapture?.(s.pointerId)) s.target.releasePointerCapture(s.pointerId);
    return s;
  }, []);

  const cancel = useCallback(() => {
    if (!session.current) return;
    end();
    suppressClick.current = true; // a cancelled press must not turn into a click placement
  }, [end]);

  // Escape and window blur cancel an active gesture; listeners live only while a button is pressed.
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    if (!pressed) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancel();
        setPressed(false);
      }
    };
    const onBlur = () => {
      cancel();
      setPressed(false);
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, [pressed, cancel]);

  useEffect(
    () => () => {
      end();
    },
    [end],
  );

  const buttonProps = useCallback(
    (shape: NodeShape): ShapeButtonProps => ({
      onPointerDown(e) {
        if (e.button !== 0 || !e.isPrimary) return;
        suppressClick.current = false;
        session.current = {
          shape,
          pointerId: e.pointerId,
          target: e.currentTarget,
          startX: e.clientX,
          startY: e.clientY,
          dragging: false,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        setPressed(true);
      },
      onPointerMove(e) {
        const s = session.current;
        if (!s || e.pointerId !== s.pointerId) return;
        if (!s.dragging) {
          if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) < DRAG_THRESHOLD_PX) return;
          s.dragging = true;
          suppressClick.current = true;
          document.documentElement.classList.add('shape-dragging');
        }
        const { getContainer: container, getZoom: zoom } = options.current;
        const z = zoom();
        latest.current = {
          shape: s.shape,
          x: e.clientX,
          y: e.clientY,
          width: DEFAULT_SIZES[s.shape].width * z,
          height: DEFAULT_SIZES[s.shape].height * z,
          overPane: isInsidePane(document.elementFromPoint(e.clientX, e.clientY), container()),
        };
        frame.current ??= requestAnimationFrame(() => {
          frame.current = null;
          setDrag(latest.current);
        });
      },
      onPointerUp(e) {
        const s = session.current;
        if (!s || e.pointerId !== s.pointerId) return;
        end();
        setPressed(false);
        if (!s.dragging) return; // a click: `onClick` places the shape
        const over = document.elementFromPoint(e.clientX, e.clientY);
        if (isInsidePane(over, options.current.getContainer())) {
          options.current.onDrop(s.shape, { x: e.clientX, y: e.clientY });
        }
      },
      onPointerCancel() {
        cancel();
        setPressed(false);
      },
      onLostPointerCapture() {
        cancel();
        setPressed(false);
      },
      onClick() {
        // Mouse click (no drag) and keyboard Enter/Space both arrive here (FR-007).
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        options.current.onPlace(shape);
      },
      onKeyDown(e) {
        if (e.key === 'Enter' || e.key === ' ') suppressClick.current = false;
      },
    }),
    [end, cancel],
  );

  return { drag, buttonProps };
}
