import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KhetOS",
  description:
    "Offline-first crop microclimate, safety, scheme and market intelligence for small farms.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hi" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
