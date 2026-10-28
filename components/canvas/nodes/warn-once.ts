const warned = new Set<string>();

/** One client-side diagnostic per node id (unknown shape, reserved kind); `lib/logger` is server-only. */
export function warnOnce(id: string, message: string): void {
  if (warned.has(id)) return;
  warned.add(id);
  // eslint-disable-next-line no-console -- client-side diagnostic; lib/logger is server-only.
  console.warn(`[canvas] node ${id} ${message}`);
}
