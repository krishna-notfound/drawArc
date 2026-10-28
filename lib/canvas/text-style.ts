import { DEFAULT_TEXT, type NodeKind, TEXT_SIZE_PX, type TextOptions } from '@/types/canvas';

/** The typography contract the node renderers apply and F08 v2's properties toolbar edits through `data.text`. */
export interface TextStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: 400 | 600;
  textAlign: 'left' | 'center' | 'right';
}

/** Effective options are `data.text ?? DEFAULT_TEXT[kind]`; defaults are never stored (02-design "Data and state"). */
export function effectiveText(kind: NodeKind, data: { text?: TextOptions }): TextOptions {
  return data.text ?? DEFAULT_TEXT[kind];
}

/** CSS for a set of text options: size from `TEXT_SIZE_PX`, line-height 1.3, weight 600 when bold. */
export function textStyle(options: TextOptions): TextStyle {
  return {
    fontSize: TEXT_SIZE_PX[options.size],
    lineHeight: 1.3,
    fontWeight: options.bold ? 600 : 400,
    textAlign: options.align,
  };
}
