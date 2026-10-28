/** Moves focus to a just-created node once React Flow has rendered it (F07 FR-008). */
export function focusNodeWhenRendered(container: HTMLElement | null, id: string, framesLeft = 30): void {
  requestAnimationFrame(() => {
    const el = container?.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
    if (el instanceof HTMLElement) el.focus({ preventScroll: true });
    else if (framesLeft > 0) focusNodeWhenRendered(container, id, framesLeft - 1);
  });
}
