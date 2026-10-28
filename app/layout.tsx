import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { LayoutBoundaryProbe } from "@/components/e2e/layout-boundary-probe";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { e2eHooksEnabled } from "@/lib/env.public";
import { siteUrl } from "@/lib/site";

import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "drawArc", template: "%s · drawArc" },
  description: "Real-time collaborative system-design canvas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-base text-copy-primary font-sans">
        {/* Inside <body> per Clerk's App Router guidance; static (no `dynamic` prop) so the shell still prerenders. */}
        <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/sign-in">
          <Providers>{children}</Providers>
          {/* E2E-only global-error probe (F15 AC-012); absent from production builds. */}
          {e2eHooksEnabled ? (
            <Suspense fallback={null}>
              <LayoutBoundaryProbe />
            </Suspense>
          ) : null}
        </ClerkProvider>
      </body>
    </html>
  );
}
