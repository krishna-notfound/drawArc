import Link from 'next/link';

// Structure only; F01 applies design tokens.
export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <Link href="/">Go to drawArc home</Link>
    </main>
  );
}
