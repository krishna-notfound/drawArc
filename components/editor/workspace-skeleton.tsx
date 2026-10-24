/** Suspense fallback while the workspace gate resolves: the navbar frame and an empty canvas area. */
export function WorkspaceSkeleton() {
  return (
    <div aria-hidden="true" data-slot="workspace-skeleton">
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-surface-border bg-base/95 px-2">
        <div className="h-9 w-9 rounded-md bg-subtle" />
        <div className="mx-auto h-4 w-40 animate-pulse rounded bg-subtle motion-reduce:animate-none" />
        <div className="h-8 w-8 rounded-full bg-subtle" />
      </div>
      <div className="h-dvh pt-14" />
    </div>
  );
}
