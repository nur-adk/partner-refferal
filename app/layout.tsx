import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Klimt & Design — Lead Sourcing",
  description: "Internal lead-sourcing tool for partner referral prospects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-gray-50 text-gray-900 antialiased">
        <header className="border-b border-gray-200 bg-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
            <Link href="/" className="text-sm font-semibold tracking-tight text-gray-900">
              Klimt &amp; Design
            </Link>
            <Link href="/leads" className="text-sm text-gray-600 hover:text-gray-900">
              Leads
            </Link>
            <Link href="/upload" className="text-sm text-gray-600 hover:text-gray-900">
              Upload CSV
            </Link>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
