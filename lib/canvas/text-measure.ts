import type { TextStyle } from '@/lib/canvas/text-style';

/** Text node padding (4 px 6 px, F22 UX) and sticky padding (12 px, D-22c); part of every measured box. */
export const TEXT_PADDING = { x: 6, y: 4 } as const;
export const STICKY_PADDING = { x: 12, y: 12 } as const;

export interface MeasureInput {
  text: string;
  style: TextStyle;
  padding: { x: number; y: number };
  /** Border-box width to wrap at; absent = no wrapping (auto-width text). */
  width?: number;
}

const MIRROR_SLOT = 'text-mirror';

/** One hidden mirror per document, appended to `body` outside the React Flow transform, so no zoom division. */
function mirrorOf(doc: Document): HTMLElement {
  const existing = doc.querySelector<HTMLElement>(`[data-slot="${MIRROR_SLOT}"]`);
  if (existing) return existing;
  const mirror = doc.createElement('span');
  mirror.dataset.slot = MIRROR_SLOT;
  mirror.setAttribute('aria-hidden', 'true');
  mirror.className = 'font-sans';
  Object.assign(mirror.style, {
    position: 'absolute',
    left: '-99999px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    boxSizing: 'border-box',
    overflowWrap: 'break-word',
  });
  doc.body.appendChild(mirror);
  return mirror;
}

/**
 * Border-box size (content + padding, rounded up) of `text` in the node typography. DOM-based on purpose: canvas
 * `measureText` fails under some privacy modes (research 01§X10). Only the editing client measures; the result is
 * stored on the node so collaborators render it as-is (F22 FR-010).
 */
export function measureText(input: MeasureInput, doc: Document = document): { width: number; height: number } {
  const mirror = mirrorOf(doc);
  const { style, padding, width } = input;
  mirror.style.fontSize = `${style.fontSize}px`;
  mirror.style.lineHeight = String(style.lineHeight);
  mirror.style.fontWeight = String(style.fontWeight);
  mirror.style.padding = `${padding.y}px ${padding.x}px`;
  mirror.style.whiteSpace = width === undefined ? 'pre' : 'pre-wrap';
  mirror.style.width = width === undefined ? 'auto' : `${width}px`;
  mirror.textContent = input.text || ' ';
  const rect = mirror.getBoundingClientRect();
  return { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
}

const fontsReadyByDocument = new WeakMap<Document, Promise<void>>();

/** Resolves once `document.fonts.ready` has (cached per document), so the first measurement uses the real font. */
export function fontsReady(doc: Document = document): Promise<void> {
  let ready = fontsReadyByDocument.get(doc);
  if (!ready) {
    ready = (doc.fonts?.ready ?? Promise.resolve()).then(() => undefined);
    fontsReadyByDocument.set(doc, ready);
  }
  return ready;
}
