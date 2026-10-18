import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AccessBadge } from "@/components/access-badge";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dispute Desk",
  description: "Resolve PayPal disputes early, with AI suggestions grounded in your own order data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <header className="border-b border-line bg-sheet">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Dispute Desk
            </Link>
            <div className="flex items-center gap-2">
              <span className="rounded border border-line px-2 py-0.5 text-sm text-muted">PayPal sandbox</span>
              <Suspense fallback={null}>
                <AccessBadge />
              </Suspense>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
