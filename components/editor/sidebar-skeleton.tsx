/** Suspense fallback for the sidebar lists (EC-011): tab strip and placeholder rows, no data. */
export function SidebarSkeleton() {
  return (
    <div aria-hidden="true" data-slot="sidebar-skeleton" className="flex min-h-0 flex-1 flex-col gap-3 px-3 pt-3">
      <div className="h-9 w-full rounded-lg bg-subtle" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex flex-col gap-1.5 px-3 py-2">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-subtle motion-reduce:animate-none" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-subtle motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
