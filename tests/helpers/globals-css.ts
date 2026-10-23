import { readFileSync } from 'node:fs';

/** Raw `app/globals.css` with comments stripped. */
export function readGlobalsCss(): string {
  return readFileSync('app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Body of the first block whose selector/at-rule matches `opener` (e.g. `:root`, `@theme inline`). */
export function blockBody(css: string, opener: string): string {
  const start = css.indexOf(`${opener} {`);
  if (start === -1) throw new Error(`block "${opener}" not found in app/globals.css`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`block "${opener}" is not closed`);
}

/** Ordered `--name: value` declarations of a block body, values whitespace-normalised and lower-cased. */
export function declarations(body: string): Array<[string, string]> {
  return body
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('--'))
    .map((part) => {
      const colon = part.indexOf(':');
      return [part.slice(0, colon).trim(), normalise(part.slice(colon + 1))] as [string, string];
    });
}

export function normalise(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}
