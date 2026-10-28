import {
  BG_BASE_HEX,
  HEX_COLOR_RE,
  type HexColor,
  NODE_COLORS,
  NODE_COLOR_IDS,
  type NodeColorId,
  type NodeKind,
  PURE_TEXT,
} from '@/types/canvas';

/**
 * Colour resolution shared by every node renderer and F08 v2 (D-063). Pure TypeScript: palette ids map to the
 * `NODE_COLORS` pairs, a `#rrggbb` hex is its own fill with a derived pure white/black text colour.
 */
export function isHexColor(value: string): value is HexColor {
  return HEX_COLOR_RE.test(value);
}

function isPaletteId(value: string): value is NodeColorId {
  return (NODE_COLOR_IDS as readonly string[]).includes(value);
}

// WCAG 2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const warned = new Set<string>();

/**
 * Fill and text colour for a stored `color`. A malformed value (EC-015) falls back to the neutral pair with one
 * warning per distinct value; the result is always a validated `#rrggbb` or a palette pair, never raw input.
 */
export function resolveColor(color: string): { fill: string; text: string; custom: boolean } {
  if (isPaletteId(color)) return { ...NODE_COLORS[color], custom: false };
  if (isHexColor(color)) {
    const dark = contrastRatio(color, PURE_TEXT.dark) >= contrastRatio(color, PURE_TEXT.light);
    return { fill: color, text: dark ? PURE_TEXT.dark : PURE_TEXT.light, custom: true };
  }
  if (!warned.has(color)) {
    warned.add(color);
    // eslint-disable-next-line no-console
    console.warn(`Unknown node colour ${JSON.stringify(color)}; rendering neutral.`);
  }
  return { ...NODE_COLORS.neutral, custom: false };
}

/**
 * Whether a colour is legible for its kind. Filled kinds are legible by construction (palette pairs, derived
 * pure black/white); the borderless `text` kind draws the colour itself on `--bg-base`, so it is checked at 4.5:1.
 */
export function textContrastOk(kind: NodeKind, color: string): boolean {
  if (kind !== 'text') return true;
  const textColour = isHexColor(color) ? color : resolveColor(color).text;
  return contrastRatio(textColour, BG_BASE_HEX) >= 4.5;
}
