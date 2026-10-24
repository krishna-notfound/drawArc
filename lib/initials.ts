/**
 * Avatar initials (F11 FR-006): the first letter of up to two words, uppercased; `'?'` for a blank name.
 * Iterates code points so a non-BMP first character (emoji, rare CJK) is never split in half.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0]!.toUpperCase())
    .join('');
}
