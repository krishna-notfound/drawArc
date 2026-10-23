/** Holds the Clerk form's footprint while the session check streams in, so the page does not jump. */
export function AuthFormFallback() {
  return <div aria-hidden="true" className="h-[30rem] w-full max-w-[25rem] rounded-xl bg-surface" />;
}
